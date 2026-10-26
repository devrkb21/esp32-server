package xiaozhi.modules.contacts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import xiaozhi.common.exception.RenException;
import xiaozhi.modules.contacts.dao.RobotContactDao;
import xiaozhi.modules.contacts.dto.ContactRequestDTO;
import xiaozhi.modules.contacts.entity.RobotContactEntity;
import xiaozhi.modules.contacts.service.CompanionMessenger;
import xiaozhi.modules.contacts.service.impl.ContactsServiceImpl;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.sys.dto.SysUserDTO;
import xiaozhi.modules.sys.service.SysUserService;

class ContactsServiceImplTest {
    private static final Long ME = 1L;
    private static final Long DAD = 2L;
    private final Map<String, DeviceEntity> robots = new HashMap<>();
    private final List<RobotContactEntity> rows = new ArrayList<>();
    private CompanionMessenger messenger;
    private ProductService products;
    private ContactsServiceImpl service;

    private static DeviceEntity robot(String id, Long user, String alias) {
        DeviceEntity d = new DeviceEntity();
        d.setId(id);
        d.setMacAddress(id);
        d.setUserId(user);
        d.setAlias(alias);
        d.setBoard("tinybot");
        return d;
    }

    @BeforeEach
    void setUp() {
        robots.put("aa:01", robot("aa:01", ME, "Desk"));
        robots.put("aa:02", robot("aa:02", ME, "Kitchen"));
        robots.put("bb:01", robot("bb:01", DAD, "Baba's TinyBot"));
        DeviceDao deviceDao = mock(DeviceDao.class);
        when(deviceDao.selectById(anyString())).thenAnswer(i -> robots.get((String) i.getArgument(0)));
        when(deviceDao.selectList(any())).thenAnswer(i -> new ArrayList<>(robots.values().stream()
                .filter(d -> d.getUserId().equals(ME)).sorted((a, b) -> a.getId().compareTo(b.getId())).toList()));
        RobotContactDao contactDao = mock(RobotContactDao.class);
        when(contactDao.selectList(any())).thenAnswer(i -> new ArrayList<>(rows));
        when(contactDao.selectById(any())).thenAnswer(i -> rows.stream()
                .filter(r -> r.getId().equals(i.getArgument(0))).findFirst().orElse(null));
        doAnswer(i -> {
            RobotContactEntity e = i.getArgument(0);
            e.setId(500L + rows.size());
            rows.add(e);
            return 1;
        }).when(contactDao).insert(any(RobotContactEntity.class));
        when(contactDao.updateById(any(RobotContactEntity.class))).thenReturn(1);
        SysUserService users = mock(SysUserService.class);
        SysUserDTO dad = new SysUserDTO();
        dad.setId(DAD);
        dad.setUsername("baba");
        SysUserDTO me = new SysUserDTO();
        me.setId(ME);
        me.setUsername("khoka");
        when(users.getByUsername("baba")).thenReturn(dad);
        when(users.getByUsername("khoka")).thenReturn(me);
        when(users.getByUserId(DAD)).thenReturn(dad);
        when(users.getByUserId(ME)).thenReturn(me);
        products = mock(ProductService.class);
        when(products.hasFeature(any(), any())).thenReturn(true);
        messenger = mock(CompanionMessenger.class);
        when(messenger.send(anyString(), any())).thenReturn(new CompanionMessenger.Outcome(true, Map.of("id", "m1"), null));
        service = new ContactsServiceImpl(contactDao, deviceDao, users, products, messenger);
    }

    private ContactRequestDTO req(String device, String username, String name, List<String> aliases) {
        ContactRequestDTO dto = new ContactRequestDTO();
        dto.setDeviceId(device);
        dto.setUsername(username);
        dto.setName(name);
        dto.setAliases(aliases);
        return dto;
    }

    @Test
    void bothOwnersMustAgreeBeforeMessagesFlow() {
        Map<String, Object> asked = service.request(ME, req("aa:01", "baba", "বাবার রোবট", List.of("বাবা", "Baba")));
        assertEquals("pending", asked.get("status"));
        Long id = Long.valueOf((String) asked.get("id"));
        // Not yet a target, and sending fails
        assertTrue(service.targets(ME, "aa:01").stream().noneMatch(t -> "contact".equals(t.get("kind"))));
        assertEquals("not_found", service.send(ME, "aa:01", "c:" + id, "আমি আসছি").get("code"));

        // Only the asked owner can accept, with one of their own robots
        assertThrows(RenException.class, () -> service.accept(ME, id, req("aa:02", null, "x", null)));
        assertThrows(RenException.class, () -> service.accept(DAD, id, req("aa:02", null, "খোকা", null)));
        service.accept(DAD, id, req("bb:01", null, "খোকার রোবট", List.of("খোকা")));

        List<Map<String, Object>> targets = service.targets(ME, "aa:01");
        Map<String, Object> dad = targets.stream().filter(t -> "contact".equals(t.get("kind"))).findFirst().orElseThrow();
        assertEquals("বাবার রোবট", dad.get("name"));
        assertEquals(List.of("বাবা", "Baba"), dad.get("aliases"));
        // My other robot is a target too, the robot itself is not
        assertTrue(targets.stream().anyMatch(t -> "d:aa:02".equals(t.get("key"))));
        assertTrue(targets.stream().noneMatch(t -> "d:aa:01".equals(t.get("key"))));
        // The contact belongs to robot aa:01 only
        assertTrue(service.targets(ME, "aa:02").stream().noneMatch(t -> "contact".equals(t.get("kind"))));

        Map<String, Object> sent = service.send(ME, "aa:01", "c:" + id, "  আমি   আসছি ");
        assertEquals(true, sent.get("ok"));
        assertEquals("বাবার রোবট", sent.get("to"));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(messenger).send(eq("bb:01"), body.capture());
        // Dad's robot says who it is from in Dad's own words, and waits out the night
        assertEquals("খোকার রোবট", body.getValue().get("from"));
        assertEquals("আমি আসছি", body.getValue().get("text"));
        assertEquals("later", body.getValue().get("quiet"));
    }

    @Test
    void ownRobotsNeedNoContactAndStrangersAreRefused() {
        Map<String, Object> sent = service.send(ME, "aa:01", "d:aa:02", "খাবার তৈরি");
        assertEquals(true, sent.get("ok"));
        assertEquals("Kitchen", sent.get("to"));
        assertEquals("not_found", service.send(ME, "aa:01", "d:bb:01", "hi").get("code"));
        assertEquals("not_found", service.send(DAD, "aa:01", "d:aa:02", "hi").get("code"));
        assertEquals("empty", service.send(ME, "aa:01", "d:aa:02", "   ").get("code"));
        assertEquals("too_long", service.send(ME, "aa:01", "d:aa:02", "x".repeat(301)).get("code"));
        RenException own = assertThrows(RenException.class, () -> service.request(ME, req("aa:01", "khoka", "x", null)));
        assertTrue(own.getMsg().startsWith("own_account"));
        assertThrows(RenException.class, () -> service.request(ME, req("bb:01", "baba", "x", null)));
    }

    @Test
    void aProductWithoutTheFeatureCannotSend() {
        when(products.hasFeature("tinybot", "robot_messages")).thenReturn(false);
        assertEquals("not_supported", service.send(ME, "aa:01", "d:aa:02", "hi").get("code"));
        verify(messenger, never()).send(anyString(), any());
    }

    @Test
    void aDeclinedRequestCanBeAskedAgain() {
        Map<String, Object> asked = service.request(ME, req("aa:01", "baba", "Baba", null));
        assertThrows(RenException.class, () -> service.request(ME, req("aa:01", "baba", "Baba", null)));
        service.decline(DAD, Long.valueOf((String) asked.get("id")));
        assertEquals("pending", service.request(ME, req("aa:01", "baba", "Baba", null)).get("status"));
    }
}
