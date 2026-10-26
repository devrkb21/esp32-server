package xiaozhi.modules.family;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import xiaozhi.common.utils.MessageUtils;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import xiaozhi.common.exception.RenException;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.dao.DeviceShareDao;
import xiaozhi.modules.family.entity.DeviceShareEntity;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.family.service.FamilyRole;
import xiaozhi.modules.family.service.FamilyRole.Action;
import xiaozhi.modules.family.service.impl.FamilyServiceImpl;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.sys.dao.SysUserDao;
import xiaozhi.modules.sys.entity.SysUserEntity;

class FamilyServiceImplTest {
    private static final long OWNER = 1L;
    private static final long INVITEE = 2L;

    private DeviceShareDao shareDao;
    private DeviceDao deviceDao;
    private SysUserDao userDao;
    private DeviceAccessService access;
    private NotifyService notify;
    private FamilyServiceImpl family;
    private DeviceEntity device;

    private MockedStatic<MessageUtils> messages;

    @AfterEach
    void tearDown() {
        messages.close();
    }

    @BeforeEach
    void setUp() {
        messages = Mockito.mockStatic(MessageUtils.class);
        messages.when(() -> MessageUtils.getMessage(org.mockito.ArgumentMatchers.anyInt())).thenReturn("error");
        shareDao = mock(DeviceShareDao.class);
        deviceDao = mock(DeviceDao.class);
        userDao = mock(SysUserDao.class);
        access = mock(DeviceAccessService.class);
        notify = mock(NotifyService.class);
        family = new FamilyServiceImpl(shareDao, deviceDao, mock(AgentDao.class), userDao, access,
                mock(ProductService.class), notify);
        device = new DeviceEntity();
        device.setId("dev1");
        device.setUserId(OWNER);
        device.setAlias("Dadu's bot");
        when(deviceDao.selectById("dev1")).thenReturn(device);
        when(access.require("dev1", OWNER, Action.SHARE)).thenReturn(device);
        when(userDao.selectById(OWNER)).thenReturn(user(OWNER, "rakib"));
        when(userDao.selectById(INVITEE)).thenReturn(user(INVITEE, "+8801712345678"));
    }

    private static SysUserEntity user(long id, String name) {
        SysUserEntity u = new SysUserEntity();
        u.setId(id);
        u.setUsername(name);
        return u;
    }

    @Test
    void inviteByLocalPhoneNumberFindsTheAccountAndTellsThem() {
        when(userDao.selectList(any())).thenReturn(List.of(user(INVITEE, "+8801712345678")));
        when(shareDao.selectOne(any())).thenReturn(null);
        when(shareDao.selectCount(any())).thenReturn(0L);

        Map<String, Object> row = family.invite("dev1", OWNER, "01712345678", "co_owner");

        ArgumentCaptor<DeviceShareEntity> saved = ArgumentCaptor.forClass(DeviceShareEntity.class);
        verify(shareDao).insert(saved.capture());
        assertEquals(INVITEE, saved.getValue().getUserId());
        assertEquals(OWNER, saved.getValue().getOwnerId());
        assertEquals("co_owner", saved.getValue().getRole());
        assertEquals(FamilyRole.STATUS_PENDING, saved.getValue().getStatus());
        assertEquals("pending", row.get("status"));
        assertEquals(Boolean.FALSE, row.get("self"));
        ArgumentCaptor<NotifyMessage> msg = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notify).notifyUsers(eq(List.of(INVITEE)), msg.capture());
        assertEquals(NotifyTypes.FAMILY_INVITE, msg.getValue().getType());
        assertTrue(msg.getValue().getBodyBn().contains("সহ-মালিক"));
    }

    @Test
    void inviteRejectsUnknownSelfAndBadRoles() {
        when(userDao.selectList(any())).thenReturn(List.of());
        assertThrows(RenException.class, () -> family.invite("dev1", OWNER, "nobody", "member"));
        when(userDao.selectList(any())).thenReturn(List.of(user(OWNER, "rakib")));
        assertThrows(RenException.class, () -> family.invite("dev1", OWNER, "rakib", "member"));
        assertThrows(RenException.class, () -> family.invite("dev1", OWNER, "rakib", "owner"));
        verify(shareDao, never()).insert(any(DeviceShareEntity.class));
    }

    @Test
    void inviteRejectsSomeoneAlreadyInTheFamily() {
        when(userDao.selectList(any())).thenReturn(List.of(user(INVITEE, "nila")));
        DeviceShareEntity existing = new DeviceShareEntity();
        existing.setId(5L);
        existing.setOwnerId(OWNER);
        existing.setStatus(FamilyRole.STATUS_ACCEPTED);
        when(shareDao.selectOne(any())).thenReturn(existing);
        assertThrows(RenException.class, () -> family.invite("dev1", OWNER, "nila", "member"));
    }

    @Test
    void acceptingTellsTheOwner() {
        DeviceShareEntity s = new DeviceShareEntity();
        s.setId(5L);
        s.setDeviceId("dev1");
        s.setUserId(INVITEE);
        s.setOwnerId(OWNER);
        s.setStatus(FamilyRole.STATUS_PENDING);
        when(shareDao.selectById(5L)).thenReturn(s);

        family.respond(5L, INVITEE, true);

        assertEquals(FamilyRole.STATUS_ACCEPTED, s.getStatus());
        verify(shareDao).updateById(s);
        verify(notify).notifyUsers(eq(List.of(OWNER)), any(NotifyMessage.class));
        // Someone else cannot answer it, and it cannot be answered twice
        assertThrows(RenException.class, () -> family.respond(5L, OWNER, true));
        assertThrows(RenException.class, () -> family.respond(5L, INVITEE, false));
    }

    @Test
    void aMemberLeavesButCannotRemoveOthers() {
        DeviceShareEntity mine = new DeviceShareEntity();
        mine.setId(5L);
        mine.setDeviceId("dev1");
        mine.setUserId(INVITEE);
        when(shareDao.selectById(5L)).thenReturn(mine);
        family.remove(5L, INVITEE);
        verify(shareDao).deleteById(5L);

        DeviceShareEntity other = new DeviceShareEntity();
        other.setId(6L);
        other.setDeviceId("dev1");
        other.setUserId(9L);
        when(shareDao.selectById(6L)).thenReturn(other);
        when(access.require("dev1", INVITEE, Action.SHARE)).thenThrow(new RenException("no"));
        assertThrows(RenException.class, () -> family.remove(6L, INVITEE));
        verify(shareDao, never()).deleteById(6L);
        verify(access, never()).require(eq("dev1"), anyLong(), eq(Action.VIEW));
    }
}
