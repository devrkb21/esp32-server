package xiaozhi.modules.usage.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.RenException;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.model.entity.ModelConfigEntity;
import xiaozhi.modules.model.service.ModelConfigService;
import xiaozhi.modules.sys.service.SysParamsService;
import xiaozhi.modules.usage.dao.UsageDailyDao;
import xiaozhi.modules.usage.dto.UsageReportDTO;
import xiaozhi.modules.usage.entity.UsageDailyEntity;
import xiaozhi.modules.usage.service.UsageMath;
import xiaozhi.modules.usage.service.UsageService;

@Slf4j
@Service
@AllArgsConstructor
public class UsageServiceImpl implements UsageService {
    public static final String QUOTA_PARAM = "usage.quota.daily_llm_requests";
    public static final String PRICE_PARAM = "usage.price_per_1k";
    public static final String CURRENCY_PARAM = "usage.currency";
    /** Longest range the usage page asks for at once */
    public static final int MAX_RANGE_DAYS = 92;
    public static final int MAX_ROWS_PER_REPORT = 2000;
    public static final int TOP_ROBOTS = 10;

    private final UsageDailyDao usageDailyDao;
    private final DeviceService deviceService;
    private final ModelConfigService modelConfigService;
    private final SysParamsService sysParamsService;

    @Override
    public LocalDate today() {
        int offset = 6;
        String raw = sysParamsService.getValue("server.timezone_offset", true);
        if (StringUtils.isNotBlank(raw) && !"null".equalsIgnoreCase(raw)) {
            try {
                offset = (int) Math.round(Double.parseDouble(raw.trim()));
            } catch (NumberFormatException ignored) {
                // keep +6 (Bangladesh)
            }
        }
        return LocalDate.now(ZoneOffset.ofHours(Math.max(-12, Math.min(14, offset))));
    }

    @Override
    public int dailyLimit() {
        String raw = sysParamsService.getValue(QUOTA_PARAM, true);
        if (StringUtils.isBlank(raw)) {
            return 0;
        }
        try {
            return Math.max(0, (int) Double.parseDouble(raw.trim()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    @Override
    public long usedOn(Long userId, LocalDate day) {
        if (userId == null) {
            return 0;
        }
        return usageDailyDao.llmRequestsOfUser(userId, day.toString());
    }

    @Override
    public Map<String, Object> report(List<UsageReportDTO.Row> rows) {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Long> users = new LinkedHashMap<>();
        out.put("users", users);
        if (rows == null || rows.isEmpty()) {
            out.put("accepted", 0);
            return out;
        }
        if (rows.size() > MAX_ROWS_PER_REPORT) {
            throw new RenException("Too many usage rows in one report");
        }
        LocalDate today = today();
        Map<String, DeviceEntity> devices = new HashMap<>();
        Map<Long, LocalDate> newestDay = new HashMap<>();
        int accepted = 0;
        for (UsageReportDTO.Row row : rows) {
            UsageDailyEntity e = UsageMath.toEntity(row, today);
            if (e == null) {
                continue;
            }
            DeviceEntity device = devices.computeIfAbsent(e.getMacAddress(), mac -> {
                DeviceEntity d = deviceService.getDeviceByMacAddress(mac);
                return d == null ? new DeviceEntity() : d;
            });
            e.setUserId(device.getUserId());
            e.setAgentId(device.getAgentId());
            usageDailyDao.upsert(e);
            accepted++;
            if (e.getUserId() != null) {
                LocalDate day = ((java.sql.Date) e.getUsageDate()).toLocalDate();
                newestDay.merge(e.getUserId(), day, (a, b) -> a.isAfter(b) ? a : b);
            }
        }
        for (Map.Entry<Long, LocalDate> e : newestDay.entrySet()) {
            users.put(String.valueOf(e.getKey()), usedOn(e.getKey(), e.getValue()));
        }
        out.put("accepted", accepted);
        return out;
    }

    @Override
    public Map<String, Object> summary(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            to = today();
            from = to.minusDays(6);
        }
        if (from.isAfter(to)) {
            LocalDate t = from;
            from = to;
            to = t;
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) {
            from = to.minusDays(MAX_RANGE_DAYS - 1);
        }
        List<Map<String, Object>> dayRows = usageDailyDao.byDayAndModel(from.toString(), to.toString());
        List<Map<String, Object>> robotRows = usageDailyDao.byRobotAndModel(from.toString(), to.toString());
        Map<String, BigDecimal> prices = UsageMath.parsePrices(sysParamsService.getValue(PRICE_PARAM, true));
        Map<String, String> names = new HashMap<>();
        for (Map<String, Object> r : dayRows) {
            String id = String.valueOf(r.get("modelId"));
            if (!names.containsKey(id) && !"quota".equals(id)) {
                ModelConfigEntity m = null;
                try {
                    m = modelConfigService.getModelByIdFromCache(id);
                } catch (Exception ignored) {
                    // a model deleted since: its id is shown
                }
                names.put(id, m != null && StringUtils.isNotBlank(m.getModelName()) ? m.getModelName() : id);
            }
        }
        Map<String, Object> out = UsageMath.summary(from, to, dayRows, robotRows, prices, names, TOP_ROBOTS);
        out.put("currency", StringUtils.defaultIfBlank(sysParamsService.getValue(CURRENCY_PARAM, true), "USD"));
        out.put("dailyLimit", dailyLimit());
        out.put("today", today().toString());
        return out;
    }

    @Override
    public Map<String, Object> quota(Long userId) {
        LocalDate today = today();
        int limit = dailyLimit();
        long used = usedOn(userId, today);
        long blocked = userId == null ? 0 : usageDailyDao.quotaBlockedOfUser(userId, today.toString());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", today.toString());
        out.put("limit", limit);
        out.put("used", used);
        out.put("remaining", limit > 0 ? Math.max(0, limit - used) : null);
        out.put("exceeded", limit > 0 && used >= limit);
        out.put("blocked", blocked);
        return out;
    }
}
