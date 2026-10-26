package xiaozhi.modules.family;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import xiaozhi.common.utils.MessageUtils;
import org.junit.jupiter.api.Test;

import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.dao.DeviceShareDao;
import xiaozhi.modules.family.entity.DeviceShareEntity;
import xiaozhi.modules.family.service.DeviceAccess;
import xiaozhi.modules.family.service.FamilyRole;
import xiaozhi.modules.family.service.FamilyRole.Action;
import xiaozhi.modules.family.service.impl.DeviceAccessServiceImpl;

class DeviceAccessServiceImplTest {
    private static final long OWNER = 1L;
    private static final long MEMBER = 2L;
    private static final long STRANGER = 3L;

    private DeviceShareDao shareDao;
    private DeviceDao deviceDao;
    private AgentDao agentDao;
    private DeviceAccessServiceImpl access;
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
        agentDao = mock(AgentDao.class);
        access = new DeviceAccessServiceImpl(shareDao, deviceDao, agentDao);
        device = new DeviceEntity();
        device.setId("dev1");
        device.setUserId(OWNER);
        device.setAgentId("agent1");
        when(deviceDao.selectById("dev1")).thenReturn(device);
        AgentEntity agent = new AgentEntity();
        agent.setId("agent1");
        agent.setUserId(OWNER);
        when(agentDao.selectById("agent1")).thenReturn(agent);
    }

    private DeviceShareEntity share(String role, Long ownerId) {
        DeviceShareEntity s = new DeviceShareEntity();
        s.setId(10L);
        s.setDeviceId("dev1");
        s.setUserId(MEMBER);
        s.setOwnerId(ownerId);
        s.setRole(role);
        s.setStatus(FamilyRole.STATUS_ACCEPTED);
        return s;
    }

    @Test
    void ownerIsOwnerWithoutAnyShareLookup() {
        assertEquals(FamilyRole.OWNER, access.roleOf(device, OWNER));
        assertTrue(access.can(device, OWNER, Action.DELETE));
    }

    @Test
    void acceptedMemberUsesButCannotManage() {
        when(shareDao.selectOne(any())).thenReturn(share("member", OWNER));
        assertEquals(FamilyRole.MEMBER, access.roleOf(device, MEMBER));
        assertTrue(access.can(device, MEMBER, Action.USE));
        assertFalse(access.can(device, MEMBER, Action.MANAGE));
        RenException e = assertThrows(RenException.class, () -> access.require("dev1", MEMBER, Action.DELETE));
        assertEquals(ErrorCode.NO_PERMISSION, e.getCode());
    }

    @Test
    void strangerDoesNotSeeTheRobotAtAll() {
        when(shareDao.selectOne(any())).thenReturn(null);
        assertEquals(FamilyRole.NONE, access.roleOf(device, STRANGER));
        RenException e = assertThrows(RenException.class, () -> access.require("dev1", STRANGER, Action.VIEW));
        assertEquals(ErrorCode.DEVICE_NOT_EXIST, e.getCode());
        assertThrows(RenException.class, () -> access.require("missing", OWNER, Action.VIEW));
    }

    @Test
    void aShareFromAnEarlierOwnerIsVoid() {
        when(shareDao.selectOne(any())).thenReturn(share("co_owner", 99L));
        assertEquals(FamilyRole.NONE, access.roleOf(device, MEMBER));
    }

    @Test
    void characterRoleFollowsTheRobotsThatRunIt() {
        when(shareDao.selectList(any())).thenReturn(List.of(share("co_owner", OWNER)));
        assertEquals(FamilyRole.OWNER, access.agentRole("agent1", OWNER));
        assertEquals(FamilyRole.CO_OWNER, access.agentRole("agent1", MEMBER));
        assertTrue(access.canAgent("agent1", MEMBER, Action.MANAGE));
        assertFalse(access.canAgent("agent1", MEMBER, Action.DELETE));
        // The robot moved to another character: the share no longer covers agent1
        device.setAgentId("agent2");
        assertEquals(FamilyRole.NONE, access.agentRole("agent1", MEMBER));
        assertEquals(FamilyRole.NONE, access.agentRole(null, MEMBER));
    }

    @Test
    void audienceIsOwnerThenFamilyWithoutDuplicates() {
        DeviceShareEntity again = share("member", OWNER);
        DeviceShareEntity stale = share("member", 99L);
        stale.setUserId(7L);
        when(shareDao.selectList(any())).thenReturn(List.of(share("member", OWNER), again, stale));
        assertEquals(List.of(OWNER, MEMBER), access.audience(device));
    }

    @Test
    void staticEntryFallsBackToOwnerOnlyWithoutSpring() {
        DeviceAccess.use(null);
        assertEquals(FamilyRole.OWNER, DeviceAccess.roleOf(device, OWNER));
        assertEquals(FamilyRole.NONE, DeviceAccess.roleOf(device, MEMBER));
        assertTrue(DeviceAccess.canAgent("agent1", OWNER, OWNER, Action.DELETE));
        assertFalse(DeviceAccess.canAgent("agent1", OWNER, MEMBER, Action.VIEW));
        DeviceAccess.use(access);
        try {
            when(shareDao.selectOne(any())).thenReturn(share("member", OWNER));
            assertEquals(FamilyRole.MEMBER, DeviceAccess.roleOf(device, MEMBER));
        } finally {
            DeviceAccess.use(null);
        }
    }
}
