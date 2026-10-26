package xiaozhi.modules.family.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.dao.DeviceShareDao;
import xiaozhi.modules.family.entity.DeviceShareEntity;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.family.service.FamilyRole;
import xiaozhi.modules.family.service.FamilyRole.Action;

/**
 * Roles from ai_device.user_id (owner) and accepted ai_device_share rows. Depends on DAOs only,
 * so the device and agent services can use it without cycles.
 */
@Service
public class DeviceAccessServiceImpl implements DeviceAccessService {
    private final DeviceShareDao shareDao;
    private final DeviceDao deviceDao;
    private final AgentDao agentDao;

    public DeviceAccessServiceImpl(DeviceShareDao shareDao, DeviceDao deviceDao, AgentDao agentDao) {
        this.shareDao = shareDao;
        this.deviceDao = deviceDao;
        this.agentDao = agentDao;
    }

    @Override
    public FamilyRole roleOf(DeviceEntity device, Long userId) {
        if (device == null || userId == null) {
            return FamilyRole.NONE;
        }
        if (userId.equals(device.getUserId())) {
            return FamilyRole.OWNER;
        }
        DeviceShareEntity share = acceptedShare(device.getId(), userId);
        if (share == null || (share.getOwnerId() != null && !share.getOwnerId().equals(device.getUserId()))) {
            // A share made by an earlier owner does not survive a change of owner
            return FamilyRole.NONE;
        }
        return FamilyRole.ofShare(share.getRole());
    }

    @Override
    public FamilyRole roleOf(String deviceId, Long userId) {
        if (StringUtils.isBlank(deviceId) || userId == null) {
            return FamilyRole.NONE;
        }
        return roleOf(deviceDao.selectById(deviceId), userId);
    }

    @Override
    public boolean can(DeviceEntity device, Long userId, Action action) {
        return roleOf(device, userId).allows(action);
    }

    @Override
    public DeviceEntity require(String deviceId, Long userId, Action action) {
        DeviceEntity device = StringUtils.isBlank(deviceId) ? null : deviceDao.selectById(deviceId);
        FamilyRole role = roleOf(device, userId);
        if (role == FamilyRole.NONE) {
            throw new RenException(ErrorCode.DEVICE_NOT_EXIST);
        }
        if (!role.allows(action)) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }
        return device;
    }

    @Override
    public FamilyRole agentRole(String agentId, Long userId) {
        if (StringUtils.isBlank(agentId) || userId == null) {
            return FamilyRole.NONE;
        }
        AgentEntity agent = agentDao.selectById(agentId);
        if (agent == null) {
            return FamilyRole.NONE;
        }
        if (userId.equals(agent.getUserId())) {
            return FamilyRole.OWNER;
        }
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("user_id", userId).eq("status", FamilyRole.STATUS_ACCEPTED));
        FamilyRole best = FamilyRole.NONE;
        for (DeviceShareEntity share : shares) {
            DeviceEntity device = deviceDao.selectById(share.getDeviceId());
            // A share counts only while the robot still runs this character for the same owner
            if (device != null && agentId.equals(device.getAgentId())
                    && device.getUserId() != null && device.getUserId().equals(agent.getUserId())
                    && (share.getOwnerId() == null || share.getOwnerId().equals(device.getUserId()))) {
                best = FamilyRole.stronger(best, FamilyRole.ofShare(share.getRole()));
            }
        }
        return best;
    }

    @Override
    public boolean canAgent(String agentId, Long userId, Action action) {
        return agentRole(agentId, userId).allows(action);
    }

    @Override
    public Long agentOwner(String agentId) {
        if (StringUtils.isBlank(agentId)) {
            return null;
        }
        AgentEntity agent = agentDao.selectById(agentId);
        return agent == null ? null : agent.getUserId();
    }

    @Override
    public List<String> sharedDeviceIds(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("user_id", userId).eq("status", FamilyRole.STATUS_ACCEPTED));
        List<String> ids = new ArrayList<>();
        for (DeviceShareEntity s : shares) {
            ids.add(s.getDeviceId());
        }
        return ids;
    }

    @Override
    public List<Long> audience(DeviceEntity device) {
        if (device == null) {
            return Collections.emptyList();
        }
        Set<Long> out = new LinkedHashSet<>();
        if (device.getUserId() != null) {
            out.add(device.getUserId());
        }
        List<DeviceShareEntity> shares = shareDao.selectList(new QueryWrapper<DeviceShareEntity>()
                .eq("device_id", device.getId()).eq("status", FamilyRole.STATUS_ACCEPTED));
        for (DeviceShareEntity s : shares) {
            if (s.getUserId() != null && (s.getOwnerId() == null || s.getOwnerId().equals(device.getUserId()))) {
                out.add(s.getUserId());
            }
        }
        return new ArrayList<>(out);
    }

    @Override
    public void forgetDevice(String deviceId) {
        if (StringUtils.isNotBlank(deviceId)) {
            shareDao.delete(new QueryWrapper<DeviceShareEntity>().eq("device_id", deviceId));
        }
    }

    private DeviceShareEntity acceptedShare(String deviceId, Long userId) {
        if (StringUtils.isBlank(deviceId)) {
            return null;
        }
        return shareDao.selectOne(new QueryWrapper<DeviceShareEntity>()
                .eq("device_id", deviceId).eq("user_id", userId)
                .eq("status", FamilyRole.STATUS_ACCEPTED).last("LIMIT 1"));
    }
}
