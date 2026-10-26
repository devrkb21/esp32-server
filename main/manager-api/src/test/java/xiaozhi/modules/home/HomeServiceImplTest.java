package xiaozhi.modules.home;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.home.dao.HomeDeviceDao;
import xiaozhi.modules.home.dao.HomeIntegrationDao;
import xiaozhi.modules.home.dto.HomeDeviceDTO;
import xiaozhi.modules.home.dto.HomeIntegrationDTO;
import xiaozhi.modules.home.entity.HomeDeviceEntity;
import xiaozhi.modules.home.entity.HomeIntegrationEntity;
import xiaozhi.modules.home.service.HomeAssistantClient;
import xiaozhi.modules.home.service.HomeSecretBox;
import xiaozhi.modules.home.service.MiniMqttClient;
import xiaozhi.modules.home.service.impl.HomeServiceImpl;
import xiaozhi.modules.sys.service.SysParamsService;

class HomeServiceImplTest {
    private static final Long USER = 7L;
    private final AtomicReference<HomeIntegrationEntity> integration = new AtomicReference<>();
    private final List<HomeDeviceEntity> devices = new ArrayList<>();
    private HomeServiceImpl service;

    @BeforeEach
    void setUp() {
        HomeIntegrationDao integrationDao = mock(HomeIntegrationDao.class);
        HomeDeviceDao deviceDao = mock(HomeDeviceDao.class);
        when(integrationDao.selectOne(any())).thenAnswer(i -> integration.get());
        doAnswer(i -> {
            HomeIntegrationEntity e = i.getArgument(0);
            e.setId(1L);
            integration.set(e);
            return 1;
        }).when(integrationDao).insert(any(HomeIntegrationEntity.class));
        when(integrationDao.updateById(any(HomeIntegrationEntity.class))).thenReturn(1);
        when(deviceDao.selectList(any())).thenAnswer(i -> new ArrayList<>(devices));
        when(deviceDao.selectCount(any())).thenAnswer(i -> (long) devices.size());
        when(deviceDao.selectById(any())).thenAnswer(i -> devices.stream()
                .filter(d -> d.getId().equals(i.getArgument(0))).findFirst().orElse(null));
        doAnswer(i -> {
            HomeDeviceEntity e = i.getArgument(0);
            e.setId(100L + devices.size());
            devices.add(e);
            return 1;
        }).when(deviceDao).insert(any(HomeDeviceEntity.class));
        when(deviceDao.updateById(any(HomeDeviceEntity.class))).thenReturn(1);
        service = new HomeServiceImpl(integrationDao, deviceDao, mock(SysParamsService.class),
                new HomeAssistantClient(Duration.ofSeconds(3)), new MiniMqttClient(3000), new HomeSecretBox("test-key"));
    }

    private void saveHa(String url, String token) {
        HomeIntegrationDTO dto = new HomeIntegrationDTO();
        dto.setHaBaseUrl(url);
        dto.setHaToken(token);
        service.saveIntegration(USER, dto);
    }

    @Test
    void theTokenIsStoredEncryptedAndNeverReturned() {
        saveHa("http://192.168.0.50:8123/", FakeHomeAssistant.TOKEN);
        String stored = integration.get().getHaToken();
        assertTrue(stored.startsWith("v1:"));
        assertFalse(stored.contains(FakeHomeAssistant.TOKEN));
        Map<String, Object> view = service.getIntegration(USER);
        assertFalse(JsonUtils.toJsonString(view).contains(FakeHomeAssistant.TOKEN));
        @SuppressWarnings("unchecked")
        Map<String, Object> ha = (Map<String, Object>) view.get("ha");
        assertEquals(true, ha.get("tokenSaved"));
        assertEquals("http://192.168.0.50:8123", ha.get("baseUrl"));

        // A blank token keeps the saved one
        HomeIntegrationDTO keep = new HomeIntegrationDTO();
        keep.setHaBaseUrl("http://192.168.0.50:8123");
        service.saveIntegration(USER, keep);
        assertEquals(stored, integration.get().getHaToken());
    }

    @Test
    void movingTheAddressNeedsTheTokenAgain() {
        saveHa("http://192.168.0.50:8123", FakeHomeAssistant.TOKEN);
        HomeIntegrationDTO moved = new HomeIntegrationDTO();
        moved.setHaBaseUrl("http://attacker.example:8123");
        RenException e = assertThrows(RenException.class, () -> service.saveIntegration(USER, moved));
        assertTrue(e.getMsg().startsWith("token_required"));
        HomeIntegrationDTO bad = new HomeIntegrationDTO();
        bad.setHaBaseUrl("ftp://x");
        assertThrows(RenException.class, () -> service.saveIntegration(USER, bad));
    }

    @Test
    void testImportAndSwitchAgainstAFakeHomeAssistant() throws Exception {
        try (FakeHomeAssistant fake = new FakeHomeAssistant()) {
            saveHa(fake.baseUrl(), FakeHomeAssistant.TOKEN);
            Map<String, Object> test = service.test(USER, "ha");
            assertEquals(true, test.get("ok"));
            assertEquals("2026.10.1", test.get("version"));

            Map<String, Object> imported = service.importHa(USER);
            assertEquals(true, imported.get("ok"));
            assertEquals(4, imported.get("added")); // the sensor is left out
            assertEquals("Living Room Light", devices.get(0).getName());
            assertEquals("switch.kettle", devices.get(3).getName()); // no friendly name: the id

            // A second import keeps the owner's edits and adds nothing
            HomeDeviceDTO edit = new HomeDeviceDTO();
            edit.setName("বসার ঘরের লাইট");
            edit.setAliases(List.of(" বসার ঘরের বাতি ", "living room light", "LIVING ROOM LIGHT", ""));
            Map<String, Object> edited = service.saveDevice(USER, devices.get(0).getId(), edit);
            assertEquals(List.of("বসার ঘরের বাতি", "living room light"), edited.get("aliases"));
            assertEquals(0, service.importHa(USER).get("added"));
            assertEquals("বসার ঘরের লাইট", devices.get(0).getName());

            Map<String, Object> off = service.act(USER, devices.get(0).getId(), "off", null);
            assertEquals(true, off.get("ok"));
            assertEquals("light.turn_off", off.get("service"));
            FakeHomeAssistant.Call last = fake.calls.get(fake.calls.size() - 1);
            assertEquals("/api/services/light/turn_off", last.path());
            assertEquals(Map.of("entity_id", "light.living_room"), JsonUtils.parseMap(last.body()));

            Long ac = devices.get(2).getId();
            Map<String, Object> cool = service.act(USER, ac, "set_temperature", 24.0);
            assertEquals(true, cool.get("ok"));
            last = fake.calls.get(fake.calls.size() - 1);
            assertEquals("/api/services/climate/set_temperature", last.path());
            assertEquals(Map.of("temperature", 24, "entity_id", "climate.ac"), JsonUtils.parseMap(last.body()));

            assertEquals("unsupported", service.act(USER, devices.get(1).getId(), "set_temperature", 24.0).get("code"));
            assertEquals("not_found", service.act(99L, devices.get(1).getId(), "on", null).get("code"));
        }
    }

    @Test
    void aWrongTokenAndADeadHubAreToldApart() throws Exception {
        try (FakeHomeAssistant fake = new FakeHomeAssistant()) {
            saveHa(fake.baseUrl(), "wrong-token");
            assertEquals("unauthorized", service.test(USER, "ha").get("code"));
        }
        integration.set(null);
        int port;
        try (ServerSocket s = new ServerSocket(0)) {
            port = s.getLocalPort();
        }
        saveHa("http://127.0.0.1:" + port, FakeHomeAssistant.TOKEN);
        assertEquals("unreachable", service.test(USER, "ha").get("code"));
        integration.set(null);
        assertEquals("not_configured", service.test(USER, "ha").get("code"));
    }

    @Test
    void mqttDevicesPublishTheirPayloadThroughTheBroker() throws Exception {
        try (ServerSocket broker = new ServerSocket(0)) {
            List<byte[]> seen = new ArrayList<>();
            Thread t = new Thread(() -> fakeBroker(broker, seen));
            t.start();
            HomeIntegrationDTO dto = new HomeIntegrationDTO();
            dto.setMqttHost("127.0.0.1");
            dto.setMqttPort(broker.getLocalPort());
            dto.setMqttUsername("home");
            dto.setMqttPassword("broker-secret");
            service.saveIntegration(USER, dto);
            assertNotEquals("broker-secret", integration.get().getMqttPassword());
            assertFalse(JsonUtils.toJsonString(service.getIntegration(USER)).contains("broker-secret"));

            HomeDeviceDTO fan = new HomeDeviceDTO();
            fan.setName("Ceiling fan");
            fan.setDomain("fan");
            fan.setTopic("home/fan/set");
            fan.setPayloadOn("1");
            fan.setPayloadOff("0");
            fan.setAliases(List.of("ফ্যান"));
            Map<String, Object> made = service.saveDevice(USER, null, fan);
            assertEquals("mqtt", made.get("source"));
            Map<String, Object> on = service.act(USER, Long.valueOf((String) made.get("id")), "on", null);
            assertEquals(true, on.get("ok"), String.valueOf(on));
            t.join(3000);
            String publish = new String(seen.get(1), java.nio.charset.StandardCharsets.UTF_8);
            assertTrue(publish.contains("home/fan/set"));
            assertTrue(publish.endsWith("1"));
            String connect = new String(seen.get(0), java.nio.charset.StandardCharsets.ISO_8859_1);
            assertTrue(connect.contains("broker-secret")); // decrypted only on the wire
        }
    }

    /** Accepts one client: reads CONNECT, answers CONNACK 0, reads PUBLISH and DISCONNECT. */
    static void fakeBroker(ServerSocket server, List<byte[]> seen) {
        try (Socket s = server.accept()) {
            InputStream in = s.getInputStream();
            OutputStream out = s.getOutputStream();
            seen.add(readPacket(in));
            out.write(new byte[] { 0x20, 0x02, 0x00, 0x00 });
            out.flush();
            seen.add(readPacket(in));
            seen.add(readPacket(in));
        } catch (IOException ignored) {
            // the test checks what was seen
        }
    }

    static byte[] readPacket(InputStream in) throws IOException {
        int type = in.read();
        if (type < 0) {
            throw new IOException("eof");
        }
        int len = 0;
        int mul = 1;
        int b;
        do {
            b = in.read();
            len += (b & 0x7F) * mul;
            mul *= 128;
        } while ((b & 0x80) != 0);
        return in.readNBytes(len);
    }
}
