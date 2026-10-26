package xiaozhi.modules.family;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.Test;

import xiaozhi.modules.family.service.FamilyPhones;
import xiaozhi.modules.family.service.FamilyRole;
import xiaozhi.modules.family.service.FamilyRole.Action;

class FamilyRoleTest {

    @Test
    void memberUsesButCannotManageDeleteOrShare() {
        FamilyRole m = FamilyRole.MEMBER;
        assertTrue(m.allows(Action.VIEW));
        assertTrue(m.allows(Action.USE));
        assertFalse(m.allows(Action.MANAGE));
        assertFalse(m.allows(Action.DELETE));
        assertFalse(m.allows(Action.SHARE));
    }

    @Test
    void coOwnerManagesButOnlyTheOwnerDeletesAndShares() {
        assertTrue(FamilyRole.CO_OWNER.allows(Action.MANAGE));
        assertFalse(FamilyRole.CO_OWNER.allows(Action.DELETE));
        assertFalse(FamilyRole.CO_OWNER.allows(Action.SHARE));
        for (Action a : Action.values()) {
            assertTrue(FamilyRole.OWNER.allows(a), a.name());
            assertFalse(FamilyRole.NONE.allows(a), a.name());
        }
        assertFalse(FamilyRole.OWNER.allows(null));
    }

    @Test
    void shareRolesAndInvitableRoles() {
        assertEquals(FamilyRole.MEMBER, FamilyRole.ofShare("member"));
        assertEquals(FamilyRole.CO_OWNER, FamilyRole.ofShare("co_owner"));
        assertEquals(FamilyRole.NONE, FamilyRole.ofShare("owner"));
        assertEquals(FamilyRole.NONE, FamilyRole.ofShare(null));
        assertTrue(FamilyRole.isInvitable("member"));
        assertTrue(FamilyRole.isInvitable("co_owner"));
        assertFalse(FamilyRole.isInvitable("owner"));
        assertEquals(FamilyRole.CO_OWNER, FamilyRole.stronger(FamilyRole.MEMBER, FamilyRole.CO_OWNER));
        assertEquals(FamilyRole.MEMBER, FamilyRole.stronger(null, FamilyRole.MEMBER));
        assertEquals(FamilyRole.NONE, FamilyRole.stronger(null, null));
    }

    @Test
    void bangladeshiNumbersMatchEverySpelling() {
        Set<String> all = Set.of("01712345678", "8801712345678", "+8801712345678");
        assertTrue(FamilyPhones.candidates("01712345678").containsAll(all));
        assertTrue(FamilyPhones.candidates("+880 1712-345678").containsAll(all));
        assertTrue(FamilyPhones.candidates("8801712345678").containsAll(all));
        assertEquals("01712345678", FamilyPhones.bangladeshLocal("+8801712345678"));
        // 012 is not a mobile prefix; a username stays as typed
        assertEquals(null, FamilyPhones.bangladeshLocal("01212345678"));
        assertEquals(Set.of("rakib"), FamilyPhones.candidates("  rakib "));
        assertTrue(FamilyPhones.candidates("").isEmpty());
        assertTrue(FamilyPhones.candidates(null).isEmpty());
        assertTrue(FamilyPhones.looksLikePhone("+880 1712 345678"));
        assertFalse(FamilyPhones.looksLikePhone("rakib"));
    }
}
