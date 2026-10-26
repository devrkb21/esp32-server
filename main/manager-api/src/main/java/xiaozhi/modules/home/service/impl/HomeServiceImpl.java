package xiaozhi.modules.home.service.impl;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.home.dao.HomeDeviceDao;
import xiaozhi.modules.home.dao.HomeIntegrationDao;
import xiaozhi.modules.home.dto.HomeDeviceDTO;
import xiaozhi.modules.home.dto.HomeIntegrationDTO;
import xiaozhi.modules.home.entity.HomeDeviceEntity;
import xiaozhi.modules.home.entity.HomeIntegrationEntity;
import xiaozhi.modules.home.service.HomeActions;
import xiaozhi.modules.home.service.HomeAssistantClient;
import xiaozhi.modules.home.service.HomeResult;
import xiaozhi.modules.home.service.HomeSecretBox;
import xiaozhi.modules.home.service.HomeService;
import xiaozhi.modules.home.service.MiniMqttClient;
import xiaozhi.modules.sys.service.SysParamsService;

@Slf4j
@Service
public class HomeServiceImpl implements HomeService {
    /** Sys param holding the key material for HomeSecretBox (made at first use when missing). */
    public static final String KEY_PARAM = "home.secret_key";
    /** Environment variable that, when set, is used instead of the sys param. */
    public static final String KEY_ENV = "NOBIX_HOME_KEY";

    public static final int MAX_DEVICES = 200;
    public static final int MAX_ALIASES = 10;
    public static final int MAX_ALIAS = 40;
    public static final int MAX_NAME = 100;
    public static final int MAX_PAYLOAD = 200;

    private final HomeIntegrationDao integrationDao;
    private final HomeDeviceDao deviceDao;
    private final SysParamsService sysParamsService;
    private final HomeAssistantClient ha;
    private final MiniMqttClient mqtt;
    private volatile HomeSecretBox box;

    @Autowired
    public HomeServiceImpl(HomeIntegrationDao integrationDao, HomeDeviceDao deviceDao, SysParamsService sysParamsService) {
        this(integrationDao, deviceDao, sysParamsService, new HomeAssistantClient(), new MiniMqttClient(), null);
    }

    /** For tests: fixed clients and key. */
    public HomeServiceImpl(HomeIntegrationDao integrationDao, HomeDeviceDao deviceDao, SysParamsService sysParamsService,
            HomeAssistantClient ha, MiniMqttClient mqtt, HomeSecretBox box) {
        this.integrationDao = integrationDao;
        this.deviceDao = deviceDao;
        this.sysParamsService = sysParamsService;
        this.ha = ha;
        this.mqtt = mqtt;
        this.box = box;
    }

    // ------------------------------------------------------------------ integration
    @Override
    public Map<String, Object> getIntegration(Long userId) {
        return view(integration(userId), countDevices(userId));
    }

    @Override
    public Map<String, Object> saveIntegration(Long userId, HomeIntegrationDTO dto) {
        if (dto == null) {
            throw new RenException("Nothing to save");
        }
        HomeIntegrationEntity row = integration(userId);
        boolean isNew = row == null;
        if (isNew) {
            row = new HomeIntegrationEntity();
            row.setUserId(userId);
            row.setMqttTls(false);
        }
        // Home Assistant
        if (dto.getHaBaseUrl() != null) {
            String url = StringUtils.trimToEmpty(dto.getHaBaseUrl());
            String normalized = url.isEmpty() ? null : HomeAssistantClient.normalizeBaseUrl(url);
            if (!url.isEmpty() && normalized == null) {
                throw new RenException("The Home Assistant address must start with http:// or https://");
            }
            boolean moved = row.getHaToken() != null && !sameOrigin(row.getHaBaseUrl(), normalized);
            if (moved && StringUtils.isBlank(dto.getHaToken()) && !Boolean.TRUE.equals(dto.getClearHaToken())) {
                // The saved token never goes to a new address without the owner typing it again.
                throw new RenException("token_required: enter the access token again for the new address");
            }
            row.setHaBaseUrl(normalized);
        }
        if (Boolean.TRUE.equals(dto.getClearHaToken())) {
            row.setHaToken(null);
        }
        if (StringUtils.isNotBlank(dto.getHaToken())) {
            String token = dto.getHaToken().trim();
            if (token.length() > 2000 || token.chars().anyMatch(Character::isWhitespace)) {
                throw new RenException("The access token is not valid");
            }
            row.setHaToken(box().seal(token));
        }
        // MQTT
        if (dto.getMqttHost() != null) {
            String host = StringUtils.trimToNull(dto.getMqttHost());
            if (host != null && (host.length() > 200 || !host.matches("[A-Za-z0-9._:\\[\\]-]+"))) {
                throw new RenException("The MQTT host is not valid");
            }
            boolean moved = row.getMqttPassword() != null && !StringUtils.equalsIgnoreCase(row.getMqttHost(), host);
            if (moved && StringUtils.isBlank(dto.getMqttPassword()) && !Boolean.TRUE.equals(dto.getClearMqttPassword())) {
                throw new RenException("password_required: enter the MQTT password again for the new broker");
            }
            row.setMqttHost(host);
        }
        if (dto.getMqttPort() != null) {
            int port = dto.getMqttPort();
            if (port < 1 || port > 65535) {
                throw new RenException("The MQTT port must be 1-65535");
            }
            row.setMqttPort(port);
        }
        if (dto.getMqttUsername() != null) {
            String user = StringUtils.trimToNull(dto.getMqttUsername());
            if (user != null && user.length() > 200) {
                throw new RenException("The MQTT user name is too long");
            }
            row.setMqttUsername(user);
        }
        if (Boolean.TRUE.equals(dto.getClearMqttPassword())) {
            row.setMqttPassword(null);
        }
        if (StringUtils.isNotEmpty(dto.getMqttPassword())) {
            if (dto.getMqttPassword().length() > 500) {
                throw new RenException("The MQTT password is too long");
            }
            row.setMqttPassword(box().seal(dto.getMqttPassword()));
        }
        if (dto.getMqttTls() != null) {
            row.setMqttTls(dto.getMqttTls());
        }
        if (isNew) {
            integrationDao.insert(row);
        } else {
            integrationDao.updateById(row);
        }
        return view(row, countDevices(userId));
    }

    @Override
    public Map<String, Object> test(Long userId, String target) {
        HomeIntegrationEntity row = integration(userId);
        if ("mqtt".equals(target)) {
            return mqtt.check(broker(row)).toMap();
        }
        if (row == null) {
            return HomeResult.fail("not_configured", "Home Assistant is not set up").toMap();
        }
        return ha.check(row.getHaBaseUrl(), box().open(row.getHaToken())).toMap();
    }

    @Override
    public Map<String, Object> importHa(Long userId) {
        HomeIntegrationEntity row = integration(userId);
        if (row == null) {
            return HomeResult.fail("not_configured", "Home Assistant is not set up").toMap();
        }
        HomeResult r = ha.states(row.getHaBaseUrl(), box().open(row.getHaToken()), HomeActions.DOMAINS);
        if (!r.ok()) {
            return r.toMap();
        }
        @SuppressWarnings("unchecked")
        List<HomeAssistantClient.Entity> entities = (List<HomeAssistantClient.Entity>) r.extra().get("entities");
        Map<String, HomeDeviceEntity> existing = new HashMap<>();
        List<HomeDeviceEntity> all = devices(userId);
        for (HomeDeviceEntity d : all) {
            if ("ha".equals(d.getSource()) && d.getEntityId() != null) {
                existing.put(d.getEntityId(), d);
            }
        }
        int added = 0;
        int count = all.size();
        int sort = all.stream().map(HomeDeviceEntity::getSort).filter(s -> s != null).max(Integer::compare).orElse(0);
        for (HomeAssistantClient.Entity e : entities) {
            if (existing.containsKey(e.entityId())) {
                continue; // keeps the owner's name, aliases and on/off choice
            }
            if (count >= MAX_DEVICES) {
                break;
            }
            HomeDeviceEntity d = new HomeDeviceEntity();
            d.setUserId(userId);
            d.setSource("ha");
            d.setEntityId(e.entityId());
            d.setDomain(e.domain());
            d.setName(StringUtils.abbreviate(e.name(), MAX_NAME));
            d.setAliases("[]");
            d.setEnabled(true);
            d.setSort(++sort);
            deviceDao.insert(d);
            added++;
            count++;
        }
        HomeResult out = HomeResult.ok("Imported").with("found", entities.size()).with("added", added)
                .with("devices", listDevices(userId, false));
        return out.toMap();
    }

    // ------------------------------------------------------------------ devices
    @Override
    public List<Map<String, Object>> listDevices(Long userId, boolean enabledOnly) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (HomeDeviceEntity d : devices(userId)) {
            if (enabledOnly && !Boolean.TRUE.equals(d.getEnabled())) {
                continue;
            }
            out.add(deviceView(d));
        }
        return out;
    }

    @Override
    public Map<String, Object> saveDevice(Long userId, Long id, HomeDeviceDTO dto) {
        if (dto == null) {
            throw new RenException("Nothing to save");
        }
        HomeDeviceEntity d;
        if (id == null) {
            if (countDevices(userId) >= MAX_DEVICES) {
                throw new RenException("Too many devices");
            }
            // Only MQTT devices are added by hand; Home Assistant ones come from the import.
            d = new HomeDeviceEntity();
            d.setUserId(userId);
            d.setSource("mqtt");
            d.setEnabled(true);
            d.setSort(devices(userId).stream().map(HomeDeviceEntity::getSort).filter(s -> s != null)
                    .max(Integer::compare).orElse(0) + 1);
            d.setDomain(StringUtils.defaultIfBlank(dto.getDomain(), "switch"));
        } else {
            d = ownDevice(userId, id);
        }
        if (dto.getName() != null || id == null) {
            String name = StringUtils.trimToEmpty(dto.getName());
            if (name.isEmpty() || name.length() > MAX_NAME) {
                throw new RenException("Give the device a name (up to 100 characters)");
            }
            d.setName(name);
        }
        if (dto.getAliases() != null) {
            d.setAliases(JsonUtils.toJsonString(cleanAliases(dto.getAliases())));
        } else if (d.getAliases() == null) {
            d.setAliases("[]");
        }
        if (dto.getEnabled() != null) {
            d.setEnabled(dto.getEnabled());
        }
        if ("mqtt".equals(d.getSource())) {
            if (dto.getDomain() != null) {
                if (!HomeActions.knownDomain(dto.getDomain())) {
                    throw new RenException("Unknown device kind");
                }
                d.setDomain(dto.getDomain());
            }
            if (dto.getTopic() != null || id == null) {
                String topic = StringUtils.trimToEmpty(dto.getTopic());
                if (topic.isEmpty() || topic.length() > 300 || topic.contains("#") || topic.contains("+")) {
                    throw new RenException("Give an MQTT topic without wildcards");
                }
                d.setTopic(topic);
            }
            if (dto.getPayloadOn() != null || id == null) {
                d.setPayloadOn(payload(dto.getPayloadOn(), "ON"));
            }
            if (dto.getPayloadOff() != null || id == null) {
                d.setPayloadOff(payload(dto.getPayloadOff(), "OFF"));
            }
        }
        if (id == null) {
            deviceDao.insert(d);
        } else {
            deviceDao.updateById(d);
        }
        return deviceView(d);
    }

    @Override
    public void deleteDevice(Long userId, Long id) {
        HomeDeviceEntity d = ownDevice(userId, id);
        deviceDao.deleteById(d.getId());
    }

    @Override
    public Map<String, Object> act(Long userId, Long deviceId, String action, Double value) {
        HomeDeviceEntity d = deviceId == null ? null : deviceDao.selectById(deviceId);
        if (d == null || !userId.equals(d.getUserId())) {
            return HomeResult.fail("not_found", "No such device").toMap();
        }
        String a = HomeActions.normalizeAction(action);
        if (!HomeActions.ACTIONS.contains(a)) {
            return withDevice(HomeResult.fail("unsupported", "Unknown action"), d, a);
        }
        HomeIntegrationEntity row = integration(userId);
        HomeResult r;
        try {
            if ("mqtt".equals(d.getSource())) {
                String payload = HomeActions.mqttPayload(a, d.getPayloadOn(), d.getPayloadOff());
                r = mqtt.publish(broker(row), d.getTopic(), payload);
            } else {
                HomeActions.ServiceCall call = HomeActions.haCall(d.getDomain(), a, value);
                if (row == null) {
                    r = HomeResult.fail("not_configured", "Home Assistant is not set up");
                } else {
                    r = ha.call(row.getHaBaseUrl(), box().open(row.getHaToken()), call, d.getEntityId());
                }
            }
        } catch (IllegalArgumentException e) {
            r = HomeResult.fail(e.getMessage(), "This action does not fit this device");
        }
        if (!r.ok()) {
            log.info("Smart home action {} on device {} failed: {}", a, d.getId(), r.code());
        }
        return withDevice(r, d, a);
    }

    // ------------------------------------------------------------------ helpers
    private Map<String, Object> withDevice(HomeResult r, HomeDeviceEntity d, String action) {
        Map<String, Object> out = r.toMap();
        out.put("device", deviceView(d));
        out.put("action", action);
        return out;
    }

    private HomeIntegrationEntity integration(Long userId) {
        return integrationDao.selectOne(new QueryWrapper<HomeIntegrationEntity>().eq("user_id", userId).last("LIMIT 1"));
    }

    private List<HomeDeviceEntity> devices(Long userId) {
        List<HomeDeviceEntity> list = deviceDao.selectList(new QueryWrapper<HomeDeviceEntity>().eq("user_id", userId));
        List<HomeDeviceEntity> out = new ArrayList<>(list == null ? List.of() : list);
        out.sort(Comparator.comparing((HomeDeviceEntity d) -> d.getSort() == null ? 0 : d.getSort())
                .thenComparing(d -> d.getId() == null ? 0L : d.getId()));
        return out;
    }

    private long countDevices(Long userId) {
        Long n = deviceDao.selectCount(new QueryWrapper<HomeDeviceEntity>().eq("user_id", userId));
        return n == null ? 0 : n;
    }

    private HomeDeviceEntity ownDevice(Long userId, Long id) {
        HomeDeviceEntity d = id == null ? null : deviceDao.selectById(id);
        if (d == null || !userId.equals(d.getUserId())) {
            throw new RenException("No such device");
        }
        return d;
    }

    private MiniMqttClient.Broker broker(HomeIntegrationEntity row) {
        if (row == null || StringUtils.isBlank(row.getMqttHost())) {
            return null;
        }
        boolean tls = Boolean.TRUE.equals(row.getMqttTls());
        int port = row.getMqttPort() == null ? (tls ? 8883 : 1883) : row.getMqttPort();
        return new MiniMqttClient.Broker(row.getMqttHost(), port, row.getMqttUsername(), box().open(row.getMqttPassword()), tls);
    }

    private static Map<String, Object> view(HomeIntegrationEntity row, long deviceCount) {
        Map<String, Object> haView = new LinkedHashMap<>();
        haView.put("baseUrl", row == null ? "" : StringUtils.defaultString(row.getHaBaseUrl()));
        haView.put("tokenSaved", row != null && row.getHaToken() != null);
        Map<String, Object> mqttView = new LinkedHashMap<>();
        mqttView.put("host", row == null ? "" : StringUtils.defaultString(row.getMqttHost()));
        mqttView.put("port", row == null || row.getMqttPort() == null ? 1883 : row.getMqttPort());
        mqttView.put("username", row == null ? "" : StringUtils.defaultString(row.getMqttUsername()));
        mqttView.put("passwordSaved", row != null && row.getMqttPassword() != null);
        mqttView.put("tls", row != null && Boolean.TRUE.equals(row.getMqttTls()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ha", haView);
        out.put("mqtt", mqttView);
        out.put("deviceCount", deviceCount);
        return out;
    }

    public static Map<String, Object> deviceView(HomeDeviceEntity d) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", String.valueOf(d.getId()));
        out.put("source", d.getSource());
        out.put("entityId", StringUtils.defaultString(d.getEntityId()));
        out.put("domain", d.getDomain());
        out.put("name", d.getName());
        out.put("aliases", parseAliases(d.getAliases()));
        out.put("topic", StringUtils.defaultString(d.getTopic()));
        out.put("payloadOn", StringUtils.defaultString(d.getPayloadOn()));
        out.put("payloadOff", StringUtils.defaultString(d.getPayloadOff()));
        out.put("enabled", Boolean.TRUE.equals(d.getEnabled()));
        return out;
    }

    public static List<String> parseAliases(String json) {
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

    /** Trimmed, unique (ignoring case), non-empty aliases, at most 10 of up to 40 characters. */
    public static List<String> cleanAliases(List<String> aliases) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String a : aliases == null ? List.<String>of() : aliases) {
            String s = a == null ? "" : a.trim().replaceAll("\\s+", " ");
            if (s.isEmpty()) {
                continue;
            }
            if (s.length() > MAX_ALIAS) {
                throw new RenException("An alias is longer than 40 characters");
            }
            if (seen.add(s.toLowerCase(Locale.ROOT))) {
                out.add(s);
            }
        }
        if (out.size() > MAX_ALIASES) {
            throw new RenException("At most 10 aliases per device");
        }
        return out;
    }

    private static String payload(String value, String fallback) {
        String s = value == null ? "" : value.trim();
        if (s.isEmpty()) {
            return fallback;
        }
        if (s.length() > MAX_PAYLOAD) {
            throw new RenException("An MQTT payload is longer than 200 characters");
        }
        return s;
    }

    static boolean sameOrigin(String a, String b) {
        if (a == null || b == null) {
            return a == null && b == null;
        }
        try {
            URI x = URI.create(a);
            URI y = URI.create(b);
            return StringUtils.equalsIgnoreCase(x.getScheme(), y.getScheme())
                    && StringUtils.equalsIgnoreCase(x.getHost(), y.getHost()) && x.getPort() == y.getPort();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private HomeSecretBox box() {
        HomeSecretBox b = box;
        if (b != null) {
            return b;
        }
        synchronized (this) {
            if (box == null) {
                String material = System.getenv(KEY_ENV);
                if (StringUtils.isBlank(material)) {
                    material = sysParamsService.getValue(KEY_PARAM, false);
                    if (StringUtils.isBlank(material) || "null".equals(material)) {
                        material = HomeSecretBox.newKeyMaterial();
                        sysParamsService.setParam(KEY_PARAM, material,
                                "Key of the smart-home secrets (Home Assistant tokens, MQTT passwords). Changing it makes saved secrets unreadable.");
                    }
                }
                box = new HomeSecretBox(material);
            }
            return box;
        }
    }
}
