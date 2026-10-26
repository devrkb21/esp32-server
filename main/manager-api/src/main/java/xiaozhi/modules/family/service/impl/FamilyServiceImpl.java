package xiaozhi.modules.family.service.impl;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.dao.DeviceShareDao;
import xiaozhi.modules.family.entity.DeviceShareEntity;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.family.service.FamilyPhones;
import xiaozhi.modules.family.service.FamilyRole;
import xiaozhi.modules.family.service.FamilyRole.Action;
import xiaozhi.modules.family.service.FamilyService;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductVO;
import xiaozhi.modules.sys.dao.SysUserDao;
import xiaozhi.modules.sys.entity.SysUserEntity;

@Slf4j
@Service
public class FamilyServiceImpl implements FamilyService {
    /** At most this many people (pending + accepted) per robot. */
    static final int MAX_MEMBERS = 10;

    private final DeviceShareDao shareDao;
    private final DeviceDao deviceDao;
    private final AgentDao agentDao;
    private final SysUserDao userDao;
    private final DeviceAccessService access;
    private final ProductService productService;
    private final NotifyService notifyService;

    public FamilyServiceImpl(DeviceShareDao shareDao, DeviceDao deviceDao, AgentDao agentDao, SysUserDao userDao,
            DeviceAccessService access, ProductService productService, NotifyService notifyService) {
        this.shareDao = shareDao;
        this.deviceDao = deviceDao;
        this.agentDao = agentDao;
        this.userDao = userDao;
        this.access = access;
        this.productService = productService;
        this.notifyService = notifyService;
    }

    @Override
    public List<Map<String, Object>> sharedRobots(Long userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (userId == null) {
            return out;
        }
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("user_id", userId).eq("status", FamilyRole.STATUS_ACCEPTED).orderByAsc("create_date"));
        for (DeviceShareEntity share : shares) {
            DeviceEntity device = deviceDao.selectById(share.getDeviceId());
            if (device == null || access.roleOf(device, userId) == FamilyRole.NONE) {
                continue;
            }
            AgentEntity agent = StringUtils.isBlank(device.getAgentId()) ? null : agentDao.selectById(device.getAgentId());
            ProductVO product = productService.resolve(device.getBoard());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("shareId", String.valueOf(share.getId()));
            row.put("deviceId", device.getId());
            row.put("agentId", device.getAgentId());
            row.put("agentName", agent == null ? "" : agent.getAgentName());
            row.put("alias", StringUtils.defaultString(device.getAlias()));
            row.put("macAddress", device.getMacAddress());
            row.put("board", device.getBoard());
            row.put("appVersion", device.getAppVersion());
            row.put("productKey", product == null ? null : product.getProductKey());
            row.put("productName", product == null ? null : product.getNameEn());
            row.put("productNameBn", product == null ? null : product.getNameBn());
            row.put("features", product == null ? List.of() : product.getFeatures());
            row.put("lastConnectedAtTimestamp", device.getLastConnectedAt() == null ? null : device.getLastConnectedAt().getTime());
            row.put("role", share.getRole());
            row.put("ownerName", userName(device.getUserId()));
            out.add(row);
        }
        return out;
    }

    @Override
    public Map<String, Object> deviceFamily(String deviceId, Long userId) {
        DeviceEntity device = access.require(deviceId, userId, Action.VIEW);
        FamilyRole role = access.roleOf(device, userId);
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("device_id", deviceId).in("status", FamilyRole.STATUS_PENDING, FamilyRole.STATUS_ACCEPTED)
                .orderByAsc("create_date"));
        List<Map<String, Object>> members = new ArrayList<>();
        for (DeviceShareEntity s : shares) {
            if (s.getOwnerId() != null && !s.getOwnerId().equals(device.getUserId())) {
                continue; // left over from an earlier owner
            }
            // Only the owner sees pending invites of other people
            if (FamilyRole.STATUS_PENDING.equals(s.getStatus()) && role != FamilyRole.OWNER
                    && !s.getUserId().equals(userId)) {
                continue;
            }
            members.add(memberRow(s, userId));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("role", role.key());
        out.put("canShare", role.allows(Action.SHARE));
        out.put("ownerName", userName(device.getUserId()));
        out.put("members", members);
        return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> invite(String deviceId, Long userId, String target, String role) {
        DeviceEntity device = access.require(deviceId, userId, Action.SHARE);
        if (!FamilyRole.isInvitable(role)) {
            throw new RenException("Choose member or co-owner");
        }
        SysUserEntity invitee = findUser(target);
        if (invitee == null) {
            throw new RenException("No account with this username or phone number");
        }
        if (invitee.getId().equals(device.getUserId())) {
            throw new RenException("You cannot invite yourself");
        }
        DeviceShareEntity existing = shareDao.selectOne(new QueryWrapper<DeviceShareEntity>()
                .eq("device_id", deviceId).eq("user_id", invitee.getId()).last("LIMIT 1"));
        Date now = new Date();
        if (existing != null && device.getUserId().equals(existing.getOwnerId())
                && !FamilyRole.STATUS_DECLINED.equals(existing.getStatus())) {
            throw new RenException("This robot is already shared with this account");
        }
        Long count = shareDao.selectCount(new QueryWrapper<DeviceShareEntity>()
                .eq("device_id", deviceId).in("status", FamilyRole.STATUS_PENDING, FamilyRole.STATUS_ACCEPTED));
        if (count != null && count >= MAX_MEMBERS) {
            throw new RenException("A robot can be shared with at most " + MAX_MEMBERS + " people");
        }
        DeviceShareEntity share = existing != null ? existing : new DeviceShareEntity();
        share.setDeviceId(deviceId);
        share.setOwnerId(device.getUserId());
        share.setUserId(invitee.getId());
        share.setRole(role);
        share.setStatus(FamilyRole.STATUS_PENDING);
        share.setInvitedBy(userId);
        share.setRespondedAt(null);
        share.setUpdateDate(now);
        if (existing == null) {
            share.setCreateDate(now);
            shareDao.insert(share);
        } else {
            share.setCreateDate(now);
            shareDao.updateById(share);
        }
        String robot = robotName(device);
        String owner = userName(device.getUserId());
        boolean co = FamilyRole.CO_OWNER.key().equals(role);
        notifyService.notifyUsers(List.of(invitee.getId()), NotifyMessage.of(NotifyTypes.FAMILY_INVITE)
                .title("পরিবারে যোগ দেওয়ার আমন্ত্রণ", "An invitation to join a family")
                .body(owner + " আপনাকে " + robot + " রোবটে " + (co ? "সহ-মালিক" : "সদস্য") + " হিসেবে যোগ দিতে বলেছেন।",
                        owner + " invited you to " + robot + " as " + (co ? "a co-owner" : "a member") + ".")
                .setDeviceId(deviceId).setRobotName(robot).setDedupeKey("invite:" + share.getId() + ":" + now.getTime()));
        return memberRow(share, userId);
    }

    @Override
    public void changeRole(Long shareId, Long userId, String role) {
        DeviceShareEntity share = shareOrThrow(shareId);
        access.require(share.getDeviceId(), userId, Action.SHARE);
        if (!FamilyRole.isInvitable(role)) {
            throw new RenException("Choose member or co-owner");
        }
        share.setRole(role);
        share.setUpdateDate(new Date());
        shareDao.updateById(share);
    }

    @Override
    public void remove(Long shareId, Long userId) {
        DeviceShareEntity share = shareOrThrow(shareId);
        boolean own = share.getUserId() != null && share.getUserId().equals(userId);
        if (!own) {
            access.require(share.getDeviceId(), userId, Action.SHARE);
        }
        shareDao.deleteById(shareId);
    }

    @Override
    public List<Map<String, Object>> invites(Long userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (userId == null) {
            return out;
        }
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("user_id", userId).eq("status", FamilyRole.STATUS_PENDING).orderByDesc("create_date"));
        for (DeviceShareEntity s : shares) {
            DeviceEntity device = deviceDao.selectById(s.getDeviceId());
            if (device == null || (s.getOwnerId() != null && !s.getOwnerId().equals(device.getUserId()))) {
                continue;
            }
            ProductVO product = productService.resolve(device.getBoard());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(s.getId()));
            row.put("deviceId", device.getId());
            row.put("robotName", robotName(device));
            row.put("productKey", product == null ? null : product.getProductKey());
            row.put("productName", product == null ? null : product.getNameEn());
            row.put("productNameBn", product == null ? null : product.getNameBn());
            row.put("ownerName", userName(device.getUserId()));
            row.put("role", s.getRole());
            row.put("createdAt", s.getCreateDate() == null ? null : s.getCreateDate().getTime());
            out.add(row);
        }
        return out;
    }

    @Override
    public void respond(Long shareId, Long userId, boolean accept) {
        DeviceShareEntity share = shareOrThrow(shareId);
        if (userId == null || !userId.equals(share.getUserId())) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }
        if (!FamilyRole.STATUS_PENDING.equals(share.getStatus())) {
            throw new RenException("This invitation was already answered");
        }
        DeviceEntity device = deviceDao.selectById(share.getDeviceId());
        if (device == null) {
            shareDao.deleteById(shareId);
            throw new RenException(ErrorCode.DEVICE_NOT_EXIST);
        }
        Date now = new Date();
        share.setStatus(accept ? FamilyRole.STATUS_ACCEPTED : FamilyRole.STATUS_DECLINED);
        share.setRespondedAt(now);
        share.setUpdateDate(now);
        shareDao.updateById(share);
        if (accept && device.getUserId() != null) {
            String name = userName(userId);
            String robot = robotName(device);
            notifyService.notifyUsers(List.of(device.getUserId()), NotifyMessage.of(NotifyTypes.FAMILY_JOINED)
                    .title("পরিবারে নতুন সদস্য", "Someone joined your family")
                    .body(name + " এখন " + robot + " দেখতে ও ব্যবহার করতে পারবেন।",
                            name + " can now see and use " + robot + ".")
                    .setDeviceId(device.getId()).setRobotName(robot).setDedupeKey("joined:" + shareId));
        }
    }

    // ------------------------------------------------------------------ helpers

    private DeviceShareEntity shareOrThrow(Long shareId) {
        DeviceShareEntity share = shareId == null ? null : shareDao.selectById(shareId);
        if (share == null) {
            throw new RenException("This invitation no longer exists");
        }
        return share;
    }

    /** Ids go out as strings: snowflake ids do not fit a JavaScript number. */
    private Map<String, Object> memberRow(DeviceShareEntity s, Long viewerId) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(s.getId()));
        row.put("userId", String.valueOf(s.getUserId()));
        row.put("self", s.getUserId() != null && s.getUserId().equals(viewerId));
        row.put("name", userName(s.getUserId()));
        row.put("role", s.getRole());
        row.put("status", s.getStatus());
        row.put("createdAt", s.getCreateDate() == null ? null : s.getCreateDate().getTime());
        row.put("respondedAt", s.getRespondedAt() == null ? null : s.getRespondedAt().getTime());
        return row;
    }

    /** The account a username or phone number names (Bangladeshi numbers in any spelling). */
    private SysUserEntity findUser(String target) {
        Set<String> names = FamilyPhones.candidates(target);
        if (names.isEmpty()) {
            return null;
        }
        List<SysUserEntity> users = userDao.selectList(new QueryWrapper<SysUserEntity>().in("username", names));
        if (users.isEmpty()) {
            return null;
        }
        // An exact username match wins over another spelling of the same phone number
        String exact = target.trim();
        for (SysUserEntity u : users) {
            if (exact.equals(u.getUsername())) {
                return u;
            }
        }
        return users.get(0);
    }

    private String userName(Long userId) {
        if (userId == null) {
            return "";
        }
        SysUserEntity u = userDao.selectById(userId);
        return u == null ? "" : StringUtils.defaultString(u.getUsername());
    }

    private String robotName(DeviceEntity device) {
        if (StringUtils.isNotBlank(device.getAlias())) {
            return device.getAlias();
        }
        ProductVO product = productService.resolve(device.getBoard());
        if (product != null && StringUtils.isNotBlank(product.getNameEn())) {
            return product.getNameEn();
        }
        return "TinyBot";
    }
}
