package xiaozhi.modules.contacts.service.impl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.contacts.dao.RobotContactDao;
import xiaozhi.modules.contacts.dto.ContactRequestDTO;
import xiaozhi.modules.contacts.entity.RobotContactEntity;
import xiaozhi.modules.contacts.service.CompanionMessenger;
import xiaozhi.modules.contacts.service.ContactsService;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.sys.dto.SysUserDTO;
import xiaozhi.modules.sys.service.SysUserService;

@Service
public class ContactsServiceImpl implements ContactsService {
    public static final String PENDING = "pending";
    public static final String ACCEPTED = "accepted";
    public static final String DECLINED = "declined";
    public static final int MAX_ALIASES = 10;
    public static final int MAX_CONTACTS = 50;

    private final RobotContactDao contactDao;
    private final DeviceDao deviceDao;
    private final SysUserService userService;
    private final ProductService productService;
    private final CompanionMessenger messenger;

    public ContactsServiceImpl(RobotContactDao contactDao, DeviceDao deviceDao, SysUserService userService,
            ProductService productService, CompanionMessenger messenger) {
        this.contactDao = contactDao;
        this.deviceDao = deviceDao;
        this.userService = userService;
        this.productService = productService;
        this.messenger = messenger;
    }

    // ------------------------------------------------------------------ owner view
    @Override
    public Map<String, Object> overview(Long userId) {
        List<DeviceEntity> robots = robotsOf(userId);
        Map<String, DeviceEntity> byId = new HashMap<>();
        List<Map<String, Object>> robotViews = new ArrayList<>();
        for (DeviceEntity d : robots) {
            byId.put(d.getId(), d);
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("deviceId", d.getId());
            r.put("name", robotName(d));
            robotViews.add(r);
        }
        List<Map<String, Object>> contacts = new ArrayList<>();
        for (RobotContactEntity c : contactsOf(userId)) {
            contacts.add(view(c, userId, byId));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("robots", robotViews);
        out.put("contacts", contacts);
        return out;
    }

    @Override
    public Map<String, Object> request(Long userId, ContactRequestDTO dto) {
        if (dto == null) {
            throw new RenException("Nothing to send");
        }
        DeviceEntity mine = ownRobot(userId, dto.getDeviceId());
        String username = StringUtils.trimToEmpty(dto.getUsername());
        if (username.isEmpty()) {
            throw new RenException("Give the other account's user name");
        }
        SysUserDTO other = userService.getByUsername(username);
        if (other == null || other.getId() == null) {
            throw new RenException("user_not_found: no account with this user name");
        }
        if (other.getId().equals(userId)) {
            throw new RenException("own_account: your own robots can already message each other");
        }
        String name = cleanName(dto.getName());
        List<String> aliases = cleanAliases(dto.getAliases());
        if (contactsOf(userId).size() >= MAX_CONTACTS) {
            throw new RenException("Too many contacts");
        }
        for (RobotContactEntity c : contactDao.selectList(new QueryWrapper<RobotContactEntity>()
                .eq("from_device_id", mine.getId()).eq("to_user_id", other.getId()))) {
            if (!DECLINED.equals(c.getStatus())) {
                throw new RenException("exists: this robot already has a contact with that account");
            }
        }
        RobotContactEntity c = new RobotContactEntity();
        c.setFromUserId(userId);
        c.setFromDeviceId(mine.getId());
        c.setToUserId(other.getId());
        c.setFromName(name);
        c.setFromAliases(JsonUtils.toJsonString(aliases));
        c.setStatus(PENDING);
        contactDao.insert(c);
        return view(c, userId, null);
    }

    @Override
    public Map<String, Object> accept(Long userId, Long id, ContactRequestDTO dto) {
        RobotContactEntity c = contact(id);
        if (c == null || !userId.equals(c.getToUserId()) || !PENDING.equals(c.getStatus())) {
            throw new RenException("No such request");
        }
        DeviceEntity mine = ownRobot(userId, dto == null ? null : dto.getDeviceId());
        String name = cleanName(dto.getName());
        List<String> aliases = cleanAliases(dto.getAliases());
        for (RobotContactEntity other : contactDao.selectList(new QueryWrapper<RobotContactEntity>()
                .eq("status", ACCEPTED).eq("from_device_id", c.getFromDeviceId()).eq("to_device_id", mine.getId()))) {
            if (!other.getId().equals(c.getId())) {
                throw new RenException("exists: these two robots are already contacts");
            }
        }
        c.setToDeviceId(mine.getId());
        c.setToName(name);
        c.setToAliases(JsonUtils.toJsonString(aliases));
        c.setStatus(ACCEPTED);
        contactDao.updateById(c);
        return view(c, userId, null);
    }

    @Override
    public void decline(Long userId, Long id) {
        RobotContactEntity c = contact(id);
        if (c == null || !userId.equals(c.getToUserId()) || !PENDING.equals(c.getStatus())) {
            throw new RenException("No such request");
        }
        c.setStatus(DECLINED);
        contactDao.updateById(c);
    }

    @Override
    public Map<String, Object> rename(Long userId, Long id, ContactRequestDTO dto) {
        RobotContactEntity c = contact(id);
        if (c == null || dto == null) {
            throw new RenException("No such contact");
        }
        boolean from = userId.equals(c.getFromUserId());
        boolean to = userId.equals(c.getToUserId()) && ACCEPTED.equals(c.getStatus());
        if (!from && !to) {
            throw new RenException("No such contact");
        }
        if (dto.getName() != null) {
            String name = cleanName(dto.getName());
            if (from) {
                c.setFromName(name);
            } else {
                c.setToName(name);
            }
        }
        if (dto.getAliases() != null) {
            String aliases = JsonUtils.toJsonString(cleanAliases(dto.getAliases()));
            if (from) {
                c.setFromAliases(aliases);
            } else {
                c.setToAliases(aliases);
            }
        }
        contactDao.updateById(c);
        return view(c, userId, null);
    }

    @Override
    public void remove(Long userId, Long id) {
        RobotContactEntity c = contact(id);
        if (c == null || !(userId.equals(c.getFromUserId()) || userId.equals(c.getToUserId()))) {
            throw new RenException("No such contact");
        }
        contactDao.deleteById(c.getId());
    }

    // ------------------------------------------------------------------ robots
    @Override
    public List<Map<String, Object>> targets(Long userId, String deviceId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (DeviceEntity d : robotsOf(userId)) {
            if (d.getId().equals(deviceId)) {
                continue;
            }
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("key", "d:" + d.getId());
            t.put("name", robotName(d));
            t.put("aliases", List.of());
            t.put("kind", "own");
            out.add(t);
        }
        for (RobotContactEntity c : contactsOf(userId)) {
            if (!ACCEPTED.equals(c.getStatus())) {
                continue;
            }
            boolean from = deviceId.equals(c.getFromDeviceId()) && userId.equals(c.getFromUserId());
            boolean to = deviceId.equals(c.getToDeviceId()) && userId.equals(c.getToUserId());
            if (!from && !to) {
                continue;
            }
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("key", "c:" + c.getId());
            t.put("name", from ? c.getFromName() : c.getToName());
            t.put("aliases", parseAliases(from ? c.getFromAliases() : c.getToAliases()));
            t.put("kind", "contact");
            out.add(t);
        }
        return out;
    }

    @Override
    public Map<String, Object> send(Long userId, String fromDeviceId, String target, String text) {
        DeviceEntity from = fromDeviceId == null ? null : deviceDao.selectById(fromDeviceId);
        if (from == null || !userId.equals(from.getUserId())) {
            return result(false, "not_found", "No such robot");
        }
        if (!productService.hasFeature(from.getBoard(), FEATURE)) {
            return result(false, "not_supported", "This robot cannot send robot messages");
        }
        String body = StringUtils.trimToEmpty(text).replaceAll("\\s+", " ");
        if (body.isEmpty()) {
            return result(false, "empty", "The message is empty");
        }
        if (body.length() > MAX_TEXT) {
            return result(false, "too_long", "The message is longer than 300 characters");
        }
        DeviceEntity to = null;
        String toName = null;
        String senderLabel = robotName(from);
        String key = StringUtils.trimToEmpty(target);
        if (key.startsWith("d:")) {
            DeviceEntity d = deviceDao.selectById(key.substring(2));
            if (d != null && userId.equals(d.getUserId()) && !d.getId().equals(from.getId())) {
                to = d;
                toName = robotName(d);
            }
        } else if (key.startsWith("c:")) {
            RobotContactEntity c = null;
            try {
                c = contact(Long.valueOf(key.substring(2)));
            } catch (NumberFormatException ignored) {
                // not a contact key
            }
            if (c != null && ACCEPTED.equals(c.getStatus())) {
                if (from.getId().equals(c.getFromDeviceId()) && userId.equals(c.getFromUserId())) {
                    to = deviceDao.selectById(c.getToDeviceId());
                    toName = c.getFromName();
                    senderLabel = StringUtils.defaultIfBlank(c.getToName(), senderLabel);
                } else if (from.getId().equals(c.getToDeviceId()) && userId.equals(c.getToUserId())) {
                    to = deviceDao.selectById(c.getFromDeviceId());
                    toName = c.getToName();
                    senderLabel = StringUtils.defaultIfBlank(c.getFromName(), senderLabel);
                }
            }
        }
        if (to == null || StringUtils.isBlank(to.getMacAddress())) {
            return result(false, "not_found", "No such contact");
        }
        if (!productService.hasFeature(to.getBoard(), ProductService.FEATURE_COMPANION)) {
            return result(false, "not_supported", "The other robot cannot play messages");
        }
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("from", StringUtils.abbreviate(senderLabel, MAX_NAME));
        msg.put("text", body);
        msg.put("ask", false);
        // Hold the message while the other robot's night mode is on; it speaks in the morning.
        msg.put("quiet", "later");
        msg.put("via", "robot");
        CompanionMessenger.Outcome outcome = messenger.send(to.getMacAddress(), msg);
        if (!outcome.ok()) {
            return result(false, "not_registered".equals(outcome.error()) ? "not_registered" : "unreachable",
                    "The message could not be handed over");
        }
        Map<String, Object> out = result(true, "ok", "Sent");
        out.put("to", toName);
        Object later = outcome.message() == null ? null : outcome.message().get("not_before");
        out.put("later", later != null);
        if (later != null) {
            out.put("notBefore", later);
        }
        if (outcome.message() != null) {
            out.put("messageId", outcome.message().get("id"));
        }
        return out;
    }

    // ------------------------------------------------------------------ helpers
    private Map<String, Object> view(RobotContactEntity c, Long userId, Map<String, DeviceEntity> mine) {
        boolean from = userId.equals(c.getFromUserId());
        String myDeviceId = from ? c.getFromDeviceId() : c.getToDeviceId();
        String otherDeviceId = from ? c.getToDeviceId() : c.getFromDeviceId();
        Long otherUser = from ? c.getToUserId() : c.getFromUserId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", String.valueOf(c.getId()));
        out.put("status", c.getStatus());
        out.put("direction", from ? "out" : "in");
        out.put("myDeviceId", myDeviceId);
        DeviceEntity myDevice = myDeviceId == null ? null
                : (mine != null && mine.containsKey(myDeviceId) ? mine.get(myDeviceId) : deviceDao.selectById(myDeviceId));
        out.put("myDeviceName", myDevice == null ? "" : robotName(myDevice));
        out.put("name", StringUtils.defaultString(from ? c.getFromName() : c.getToName()));
        out.put("aliases", parseAliases(from ? c.getFromAliases() : c.getToAliases()));
        SysUserDTO other = otherUser == null ? null : userService.getByUserId(otherUser);
        out.put("otherOwner", other == null ? "" : StringUtils.defaultIfBlank(other.getRealName(), other.getUsername()));
        out.put("otherUsername", other == null ? "" : StringUtils.defaultString(other.getUsername()));
        DeviceEntity otherDevice = otherDeviceId == null ? null : deviceDao.selectById(otherDeviceId);
        out.put("otherDeviceName", otherDevice == null ? "" : robotName(otherDevice));
        // What the other side calls my robot: shown with incoming requests, and as the sender name.
        out.put("theirName", StringUtils.defaultString(from ? c.getToName() : c.getFromName()));
        out.put("createdAt", c.getCreateDate() == null ? null : c.getCreateDate().getTime());
        return out;
    }

    private List<RobotContactEntity> contactsOf(Long userId) {
        List<RobotContactEntity> list = contactDao.selectList(new QueryWrapper<RobotContactEntity>()
                .and(w -> w.eq("from_user_id", userId).or().eq("to_user_id", userId)).orderByDesc("id"));
        return list == null ? List.of() : list;
    }

    private List<DeviceEntity> robotsOf(Long userId) {
        List<DeviceEntity> list = deviceDao.selectList(new QueryWrapper<DeviceEntity>().eq("user_id", userId).orderByAsc("sort"));
        return list == null ? List.of() : list;
    }

    private DeviceEntity ownRobot(Long userId, String deviceId) {
        DeviceEntity d = StringUtils.isBlank(deviceId) ? null : deviceDao.selectById(deviceId);
        if (d == null || !userId.equals(d.getUserId())) {
            throw new RenException("Choose one of your robots");
        }
        return d;
    }

    private RobotContactEntity contact(Long id) {
        return id == null ? null : contactDao.selectById(id);
    }

    static String robotName(DeviceEntity d) {
        return StringUtils.defaultIfBlank(StringUtils.trimToNull(d.getAlias()), "TinyBot");
    }

    static String cleanName(String name) {
        String s = StringUtils.trimToEmpty(name).replaceAll("\\s+", " ");
        if (s.isEmpty() || s.length() > MAX_NAME) {
            throw new RenException("Give a name of up to 32 characters");
        }
        return s;
    }

    static List<String> cleanAliases(List<String> aliases) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String a : aliases == null ? List.<String>of() : aliases) {
            String s = a == null ? "" : a.trim().replaceAll("\\s+", " ");
            if (s.isEmpty()) {
                continue;
            }
            if (s.length() > MAX_NAME) {
                throw new RenException("An alias is longer than 32 characters");
            }
            if (seen.add(s.toLowerCase(Locale.ROOT))) {
                out.add(s);
            }
        }
        if (out.size() > MAX_ALIASES) {
            throw new RenException("At most 10 aliases");
        }
        return out;
    }

    static List<String> parseAliases(String json) {
        if (StringUtils.isBlank(json)) {
            return new ArrayList<>();
        }
        try {
            List<String> list = JsonUtils.parseArray(json, String.class);
            return list == null ? new ArrayList<>() : list;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private static Map<String, Object> result(boolean ok, String code, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", ok);
        out.put("code", code);
        out.put("message", message);
        return out;
    }
}
