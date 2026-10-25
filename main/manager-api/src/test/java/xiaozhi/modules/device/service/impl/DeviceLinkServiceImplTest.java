package xiaozhi.modules.device.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.redis.RedisKeys;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.common.utils.MessageUtils;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.agent.dto.AgentCreateDTO;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.agent.service.AgentService;
import xiaozhi.modules.device.dto.DeviceLinkDTO;
import xiaozhi.modules.device.service.DeviceLinkService;
import xiaozhi.modules.device.service.DeviceLinkService.AgentChoice;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.device.vo.DeviceLinkInfoVO;
import xiaozhi.modules.device.vo.DeviceLinkResultVO;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductVO;

@DisplayName("Robot link: code lookup and character choice")
class DeviceLinkServiceImplTest {

    private static final String CODE = "123456";
    private static final String MAC = "aa:bb:cc:dd:3f:a1";
    private static final long USER_ID = 7L;

    private RedisUtils redis;
    private DeviceService deviceService;
    private AgentService agentService;
    private AgentDao agentDao;
    private ProductService productService;
    private DeviceLinkServiceImpl service;
    private MockedStatic<MessageUtils> messages;

    @BeforeEach
    void setUp() {
        // RenException looks its message up through Spring; no context here.
        messages = mockStatic(MessageUtils.class);
        messages.when(() -> MessageUtils.getMessage(anyInt())).thenReturn("message");
        redis = mock(RedisUtils.class);
        deviceService = mock(DeviceService.class);
        agentService = mock(AgentService.class);
        agentDao = mock(AgentDao.class);
        productService = mock(ProductService.class);
        service = new DeviceLinkServiceImpl(redis, deviceService, agentService, agentDao, productService);

        ProductVO tinybot = new ProductVO();
        tinybot.setProductKey("tinybot");
        tinybot.setNameEn("TinyBot");
        tinybot.setNameBn("টাইনিবট");
        when(productService.resolve(any())).thenReturn(tinybot);
    }

    @AfterEach
    void tearDown() {
        messages.close();
    }

    private void pending() {
        when(redis.get(RedisKeys.getOtaActivationCode(CODE))).thenReturn(MAC);
        Map<String, Object> data = new HashMap<>();
        data.put("activation_code", CODE);
        data.put("mac_address", MAC);
        data.put("board", "tinybot-s3");
        when(redis.get(RedisKeys.getOtaDeviceActivationInfo("aa_bb_cc_dd_3f_a1"))).thenReturn(data);
    }

    private void agents(String... ids) {
        List<AgentEntity> list = new java.util.ArrayList<>();
        for (String id : ids) {
            AgentEntity a = new AgentEntity();
            a.setId(id);
            list.add(a);
        }
        when(agentDao.selectList(any())).thenReturn(list);
    }

    private static DeviceLinkDTO dto(String code, String agentId) {
        DeviceLinkDTO d = new DeviceLinkDTO();
        d.setCode(code);
        d.setAgentId(agentId);
        return d;
    }

    private static int code(Runnable r) {
        return assertThrows(RenException.class, r::run).getCode();
    }

    @Test
    void decideAgentCoversEveryCase() {
        assertEquals(AgentChoice.CREATE, DeviceLinkService.decideAgent(List.of(), null));
        assertEquals(AgentChoice.CREATE, DeviceLinkService.decideAgent(null, " "));
        assertEquals(AgentChoice.ONLY, DeviceLinkService.decideAgent(List.of("a"), null));
        assertEquals(AgentChoice.ASK, DeviceLinkService.decideAgent(List.of("a", "b"), null));
        assertEquals(AgentChoice.REQUESTED, DeviceLinkService.decideAgent(List.of("a", "b"), "b"));
        assertNull(DeviceLinkService.decideAgent(List.of("a"), "someone-else"));
    }

    @Test
    void normalizesCodesAndBuildsUrls() {
        assertEquals("123456", DeviceLinkService.normalizeCode(" 123 456 "));
        assertNull(DeviceLinkService.normalizeCode("12345"));
        assertNull(DeviceLinkService.normalizeCode("12a456"));
        assertNull(DeviceLinkService.normalizeCode(null));
        assertEquals("https://esp.czbd.app/#/link?code=123456",
                DeviceLinkService.buildLinkUrl("https://esp.czbd.app//", "123456"));
        assertNull(DeviceLinkService.buildLinkUrl("null", "123456"));
        assertNull(DeviceLinkService.buildLinkUrl(" ", "123456"));
        assertEquals("3FA1", DeviceLinkServiceImpl.macTail(MAC));
    }

    @Test
    void lookupReturnsProductWithoutMac() {
        pending();
        DeviceLinkInfoVO vo = service.lookup(CODE);
        assertEquals("tinybot", vo.getProductKey());
        assertEquals("টাইনিবট", vo.getProductNameBn());
        assertEquals("3FA1", vo.getMacTail());
        assertTrue(vo.isValid());
    }

    @Test
    void lookupRejectsBadAndExpiredCodes() {
        assertEquals(ErrorCode.DEVICE_LINK_CODE_FORMAT, code(() -> service.lookup("12")));
        assertEquals(ErrorCode.DEVICE_LINK_CODE_EXPIRED, code(() -> service.lookup("654321")));
    }

    @Test
    void lookupRejectsAlreadyLinkedRobot() {
        pending();
        when(deviceService.selectById(MAC)).thenReturn(new xiaozhi.modules.device.entity.DeviceEntity());
        assertEquals(ErrorCode.DEVICE_ALREADY_ACTIVATED, code(() -> service.lookup(CODE)));
    }

    @Test
    void linkUsesTheOnlyCharacter() {
        pending();
        agents("agent-1");
        DeviceLinkResultVO r = service.link(USER_ID, dto(CODE, null));
        assertEquals("agent-1", r.getAgentId());
        assertEquals(MAC, r.getDeviceId());
        assertFalse(r.isAgentCreated());
        verify(deviceService).deviceActivation("agent-1", CODE);
        verify(agentService, never()).createAgent(any());
    }

    @Test
    void linkCreatesADefaultCharacterNamedAfterTheProduct() {
        pending();
        agents();
        when(agentService.createAgent(any())).thenAnswer(inv -> {
            AgentCreateDTO c = inv.getArgument(0);
            assertEquals("টাইনিবট", c.getAgentName());
            return "new-agent";
        });
        DeviceLinkResultVO r = service.link(USER_ID, dto(CODE, null));
        assertEquals("new-agent", r.getAgentId());
        assertTrue(r.isAgentCreated());
        verify(deviceService).deviceActivation("new-agent", CODE);
    }

    @Test
    void linkAsksWhenSeveralCharacters() {
        pending();
        agents("a", "b");
        assertEquals(ErrorCode.DEVICE_LINK_CHOOSE_AGENT, code(() -> service.link(USER_ID, dto(CODE, null))));
        verify(deviceService, never()).deviceActivation(any(), any());
    }

    @Test
    void linkUsesTheChosenCharacterAndRejectsSomeoneElses() {
        pending();
        agents("a", "b");
        assertEquals("b", service.link(USER_ID, dto(CODE, "b")).getAgentId());
        assertEquals(ErrorCode.NO_PERMISSION, code(() -> service.link(USER_ID, dto(CODE, "not-mine"))));
    }

    @Test
    void badCodeNeverCreatesACharacter() {
        agents();
        assertEquals(ErrorCode.DEVICE_LINK_CODE_EXPIRED, code(() -> service.link(USER_ID, dto("999999", null))));
        verify(agentService, never()).createAgent(any());
    }
}
