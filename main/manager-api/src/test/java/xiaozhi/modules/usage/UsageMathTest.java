package xiaozhi.modules.usage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.model.service.ModelConfigService;
import xiaozhi.modules.sys.service.SysParamsService;
import xiaozhi.modules.usage.dao.UsageDailyDao;
import xiaozhi.modules.usage.dto.UsageReportDTO;
import xiaozhi.modules.usage.entity.UsageDailyEntity;
import xiaozhi.modules.usage.service.UsageMath;
import xiaozhi.modules.usage.service.impl.UsageServiceImpl;

class UsageMathTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 1);

    private static UsageReportDTO.Row row(String date, String type, String model, long requests, long tokens) {
        UsageReportDTO.Row r = new UsageReportDTO.Row();
        r.setDate(date);
        r.setMacAddress("AA:BB:CC:DD:EE:FF");
        r.setModelType(type);
        r.setModelId(model);
        r.setLlmRequests(requests);
        r.setPromptTokens(tokens);
        r.setCompletionTokens(0L);
        return r;
    }

    @Test
    void chainIsAnOrderedUniqueList() {
        assertEquals(List.of("LLM_A", "LLM_B"), UsageMath.parseChain(" LLM_A, LLM_B,,LLM_A ,null"));
        assertTrue(UsageMath.parseChain("null").isEmpty());
        assertTrue(UsageMath.parseChain(null).isEmpty());
    }

    @Test
    void pricesSkipBrokenValues() {
        Map<String, BigDecimal> p = UsageMath.parsePrices("{\"LLM_A\": 0.5, \"LLM_B\": \"x\", \"LLM_C\": -1}");
        assertEquals(1, p.size());
        assertEquals(0, new BigDecimal("0.5").compareTo(p.get("LLM_A")));
        assertTrue(UsageMath.parsePrices("not json").isEmpty());
        assertTrue(UsageMath.parsePrices("{}").isEmpty());
        assertEquals(0, new BigDecimal("1.25").compareTo(UsageMath.cost(2500, new BigDecimal("0.5"))));
        assertNull(UsageMath.cost(2500, null));
    }

    @Test
    void reportRowsAreCheckedAndClamped() {
        UsageDailyEntity e = UsageMath.toEntity(row("2026-11-01", "llm", "LLM_A", 3, 120), TODAY);
        assertNotNull(e);
        assertEquals("LLM", e.getModelType());
        assertEquals("aa:bb:cc:dd:ee:ff", e.getMacAddress());
        assertEquals(3, e.getLlmRequests());
        assertNull(UsageMath.toEntity(row("2026-10-01", "LLM", "LLM_A", 1, 0), TODAY)); // too far back
        assertNull(UsageMath.toEntity(row("2026-11-01", "VAD", "x", 1, 0), TODAY)); // unknown type
        assertNull(UsageMath.toEntity(row("01/11/2026", "LLM", "x", 1, 0), TODAY)); // bad date
        assertNull(UsageMath.toEntity(row("2026-11-01", "LLM", "x", 0, 0), TODAY)); // nothing counted
        UsageReportDTO.Row neg = row("2026-11-01", "LLM", "x", -5, 10);
        assertEquals(0, UsageMath.toEntity(neg, TODAY).getLlmRequests());
        UsageReportDTO.Row asr = row("2026-11-01", "ASR", "", 0, 0);
        asr.setAsrSeconds(12.345);
        UsageDailyEntity a = UsageMath.toEntity(asr, TODAY);
        assertEquals("ASR", a.getModelId());
        assertEquals(0, new BigDecimal("12.35").compareTo(a.getAsrSeconds()));
    }

    private static Map<String, Object> sum(Object... kv) {
        Map<String, Object> m = new java.util.HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    @Test
    @SuppressWarnings("unchecked")
    void summaryHasEveryDayCostsAndTopRobots() {
        List<Map<String, Object>> days = List.of(
                sum("day", "2026-10-30", "modelType", "LLM", "modelId", "LLM_A", "llmRequests", 10,
                        "promptTokens", new BigDecimal(1500), "completionTokens", new BigDecimal(500)),
                sum("day", "2026-11-01", "modelType", "LLM", "modelId", "LLM_B", "llmRequests", 2,
                        "promptTokens", 100, "completionTokens", 100),
                sum("day", "2026-11-01", "modelType", "ASR", "modelId", "ASR_G", "asrSeconds", new BigDecimal("30.50")),
                sum("day", "2026-11-01", "modelType", "LLM", "modelId", "quota", "quotaBlocked", 4));
        List<Map<String, Object>> robots = List.of(
                sum("macAddress", "m1", "userId", 7L, "username", "owner1", "alias", "Desk", "modelType", "LLM",
                        "modelId", "LLM_A", "llmRequests", 10, "promptTokens", 1500, "completionTokens", 500),
                sum("macAddress", "m2", "userId", 7L, "username", "owner1", "modelType", "LLM", "modelId", "LLM_B",
                        "llmRequests", 2, "promptTokens", 100, "completionTokens", 100),
                sum("macAddress", "m3", "userId", 8L, "username", "owner2", "modelType", "ASR", "modelId", "ASR_G",
                        "asrSeconds", 30.5));
        Map<String, BigDecimal> prices = Map.of("LLM_A", new BigDecimal("0.5"));
        Map<String, Object> s = UsageMath.summary(LocalDate.of(2026, 10, 30), TODAY, days, robots, prices,
                Map.of("LLM_A", "Groq Llama"), 2);

        Map<String, Object> totals = (Map<String, Object>) s.get("totals");
        assertEquals(12L, totals.get("llmRequests"));
        assertEquals(2200L, totals.get("tokens"));
        assertEquals(4L, totals.get("quotaBlocked"));
        assertEquals(1.0, totals.get("cost")); // 2000 tokens of LLM_A at 0.5 per 1K; LLM_B has no price
        assertEquals(30.5, totals.get("asrSeconds"));

        List<Map<String, Object>> daysOut = (List<Map<String, Object>>) s.get("days");
        assertEquals(3, daysOut.size());
        assertEquals(0L, daysOut.get(1).get("llmRequests")); // 2026-10-31: nothing, still listed

        List<Map<String, Object>> models = (List<Map<String, Object>>) s.get("models");
        assertEquals(3, models.size()); // the quota refusals are not a model
        assertEquals("ASR", models.get(0).get("modelType"));
        assertEquals("Groq Llama", models.get(1).get("modelName"));
        assertEquals(0.5, models.get(1).get("pricePer1k"));
        assertNull(models.get(2).get("cost"));

        List<Map<String, Object>> users = (List<Map<String, Object>>) s.get("users");
        assertEquals("owner1", users.get(0).get("username"));
        assertEquals(2, users.get(0).get("robots"));

        List<Map<String, Object>> top = (List<Map<String, Object>>) s.get("robots");
        assertEquals(2, top.size());
        assertEquals("m1", top.get(0).get("macAddress"));
        assertEquals(true, s.get("priced"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void reportStoresRowsWithOwnerAndAnswersUsedToday() {
        UsageDailyDao dao = mock(UsageDailyDao.class);
        DeviceService devices = mock(DeviceService.class);
        SysParamsService params = mock(SysParamsService.class);
        DeviceEntity device = new DeviceEntity();
        device.setUserId(7L);
        device.setAgentId("agent1");
        when(devices.getDeviceByMacAddress("aa:bb:cc:dd:ee:ff")).thenReturn(device);
        when(params.getValue(anyString(), any())).thenReturn(null);
        when(dao.llmRequestsOfUser(eq(7L), anyString())).thenReturn(42L);
        UsageServiceImpl service = new UsageServiceImpl(dao, devices, mock(ModelConfigService.class), params);
        String today = service.today().toString();

        Map<String, Object> out = service.report(List.of(
                row(today, "LLM", "LLM_A", 2, 50), row(today, "LLM", "LLM_B", 1, 0), row("1999-01-01", "LLM", "x", 1, 0)));
        assertEquals(2, out.get("accepted"));
        assertEquals(42L, ((Map<String, Object>) out.get("users")).get("7"));
        verify(dao, times(2)).upsert(any(UsageDailyEntity.class));
        verify(devices, times(1)).getDeviceByMacAddress("aa:bb:cc:dd:ee:ff"); // one lookup per robot

        Map<String, Object> empty = service.report(List.of());
        assertEquals(0, empty.get("accepted"));
        verify(dao, never()).upsert(eq(null));
    }

    @Test
    void quotaOfAnOwner() {
        UsageDailyDao dao = mock(UsageDailyDao.class);
        SysParamsService params = mock(SysParamsService.class);
        when(params.getValue(eq(UsageServiceImpl.QUOTA_PARAM), any())).thenReturn("50");
        when(dao.llmRequestsOfUser(eq(7L), anyString())).thenReturn(50L);
        when(dao.quotaBlockedOfUser(eq(7L), anyString())).thenReturn(3L);
        UsageServiceImpl service = new UsageServiceImpl(dao, mock(DeviceService.class), mock(ModelConfigService.class), params);
        Map<String, Object> q = service.quota(7L);
        assertEquals(50, q.get("limit"));
        assertEquals(true, q.get("exceeded"));
        assertEquals(0L, q.get("remaining"));
        assertEquals(3L, q.get("blocked"));

        when(params.getValue(eq(UsageServiceImpl.QUOTA_PARAM), any())).thenReturn("0");
        Map<String, Object> unlimited = service.quota(7L);
        assertEquals(false, unlimited.get("exceeded"));
        assertNull(unlimited.get("remaining"));
    }
}
