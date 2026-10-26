package xiaozhi.modules.kids;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import xiaozhi.modules.kids.dao.AgentKidsDao;
import xiaozhi.modules.kids.dto.AgentKidsDTO;
import xiaozhi.modules.kids.entity.AgentKidsEntity;
import xiaozhi.modules.kids.service.AgentKidsService;
import xiaozhi.modules.kids.service.impl.AgentKidsServiceImpl;

class AgentKidsServiceTest {

    @Test
    void cleanKeepsLimits() {
        AgentKidsDTO in = new AgentKidsDTO();
        in.setEnabled(true);
        in.setAge(40);
        List<String> topics = new ArrayList<>(Arrays.asList("  ভূত  ", "Horror", "horror", "", null, "x".repeat(60)));
        for (int i = 0; i < 40; i++) {
            topics.add("t" + i);
        }
        in.setBlockedTopics(topics);
        AgentKidsDTO out = AgentKidsService.clean(in);
        assertEquals(12, out.getAge());
        assertEquals("ভূত", out.getBlockedTopics().get(0));
        assertEquals("Horror", out.getBlockedTopics().get(1));
        assertEquals(40, out.getBlockedTopics().get(2).length());
        assertEquals(30, out.getBlockedTopics().size());

        AgentKidsDTO young = new AgentKidsDTO();
        young.setAge(1);
        assertEquals(3, AgentKidsService.clean(young).getAge());
        assertFalse(AgentKidsService.clean(null).getEnabled());
    }

    @Test
    void runtimeConfigOnlyWhenOn() {
        AgentKidsDTO off = new AgentKidsDTO();
        assertNull(AgentKidsService.toRuntime(off));
        AgentKidsDTO on = new AgentKidsDTO();
        on.setEnabled(true);
        on.setAge(6);
        on.setBlockedTopics(List.of("ভূত"));
        Map<String, Object> rt = AgentKidsService.toRuntime(on);
        assertEquals(6, rt.get("age"));
        assertEquals(List.of("ভূত"), rt.get("blocked_topics"));
    }

    @Test
    void saveInsertsThenUpdatesAndReadsBack() {
        AgentKidsDao dao = mock(AgentKidsDao.class);
        AgentKidsServiceImpl service = new AgentKidsServiceImpl(dao);
        AgentKidsDTO dto = new AgentKidsDTO();
        dto.setEnabled(true);
        dto.setAge(5);
        dto.setBlockedTopics(List.of("যুদ্ধ"));
        service.save("a1", dto);
        ArgumentCaptor<AgentKidsEntity> saved = ArgumentCaptor.forClass(AgentKidsEntity.class);
        verify(dao).insert(saved.capture());
        assertEquals(1, saved.getValue().getEnabled());
        assertEquals("[\"যুদ্ধ\"]", saved.getValue().getBlockedTopics());

        when(dao.selectById(any())).thenReturn(saved.getValue());
        service.save("a1", dto);
        verify(dao).updateById(any(AgentKidsEntity.class));
        AgentKidsDTO back = service.get("a1");
        assertEquals(5, back.getAge());
        assertEquals(List.of("যুদ্ধ"), back.getBlockedTopics());
        assertEquals(true, service.runtimeConfig("a1").get("enabled"));
        assertNull(service.runtimeConfig(""));
    }
}
