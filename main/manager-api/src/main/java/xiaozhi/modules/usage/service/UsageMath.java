package xiaozhi.modules.usage.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;

import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.usage.dto.UsageReportDTO;
import xiaozhi.modules.usage.entity.UsageDailyEntity;

/**
 * Pure helpers of the usage module (no Spring, unit tested): report row checks, prices, cost and
 * the summary tables of the usage page.
 */
public final class UsageMath {
    public static final Set<String> MODEL_TYPES = Set.of("LLM", "ASR", "TTS");
    /** Report rows further than this many days from today are refused (clock errors). */
    public static final int MAX_DAYS_OFF = 3;
    private static final long MAX_COUNT = 10_000_000L;
    static final String[] SUM_KEYS = { "llmRequests", "promptTokens", "completionTokens", "asrSeconds",
            "ttsChars", "quotaBlocked" };

    private UsageMath() {
    }

    /** A comma list of model ids ("a, b,,a"; 'null' or blank: none), order kept, duplicates dropped. */
    public static List<String> parseChain(String value) {
        List<String> out = new ArrayList<>();
        if (StringUtils.isBlank(value)) {
            return out;
        }
        for (String part : value.split(",")) {
            String id = part.trim();
            if (!id.isEmpty() && !"null".equalsIgnoreCase(id) && !"none".equalsIgnoreCase(id) && !out.contains(id)) {
                out.add(id);
            }
        }
        return out;
    }

    /** The price per 1K tokens by model id from the sys param JSON ({} or broken JSON: none). */
    @SuppressWarnings("unchecked")
    public static Map<String, BigDecimal> parsePrices(String json) {
        Map<String, BigDecimal> out = new HashMap<>();
        if (StringUtils.isBlank(json) || "null".equalsIgnoreCase(json.trim())) {
            return out;
        }
        try {
            Map<String, Object> raw = JsonUtils.parseObject(json, Map.class);
            if (raw == null) {
                return out;
            }
            for (Map.Entry<String, Object> e : raw.entrySet()) {
                try {
                    BigDecimal price = new BigDecimal(String.valueOf(e.getValue()).trim());
                    if (price.signum() >= 0) {
                        out.put(e.getKey(), price);
                    }
                } catch (NumberFormatException ignored) {
                    // a price that is not a number is left out
                }
            }
        } catch (Exception ignored) {
            // broken JSON: no prices
        }
        return out;
    }

    /** Estimated cost of `tokens` at `pricePer1k` (null when the model has no price). */
    public static BigDecimal cost(long tokens, BigDecimal pricePer1k) {
        if (pricePer1k == null) {
            return null;
        }
        return pricePer1k.multiply(BigDecimal.valueOf(tokens)).divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
    }

    private static long clampCount(Number n) {
        if (n == null) {
            return 0;
        }
        return Math.max(0, Math.min(MAX_COUNT, n.longValue()));
    }

    /**
     * A report row as an entity, or null when it is not acceptable (bad date, type, robot or
     * nothing counted). Owner and character are filled in by the caller.
     */
    public static UsageDailyEntity toEntity(UsageReportDTO.Row row, LocalDate today) {
        if (row == null || StringUtils.isBlank(row.getMacAddress()) || StringUtils.isBlank(row.getDate())) {
            return null;
        }
        String type = StringUtils.trimToEmpty(row.getModelType()).toUpperCase(Locale.ROOT);
        if (!MODEL_TYPES.contains(type)) {
            return null;
        }
        LocalDate day;
        try {
            day = LocalDate.parse(row.getDate().trim());
        } catch (DateTimeParseException e) {
            return null;
        }
        if (today != null && Math.abs(day.toEpochDay() - today.toEpochDay()) > MAX_DAYS_OFF) {
            return null;
        }
        String modelId = StringUtils.defaultIfBlank(StringUtils.trim(row.getModelId()), type);
        UsageDailyEntity e = new UsageDailyEntity();
        e.setUsageDate(java.sql.Date.valueOf(day));
        e.setMacAddress(StringUtils.left(row.getMacAddress().trim().toLowerCase(Locale.ROOT), 64));
        e.setModelType(type);
        e.setModelId(StringUtils.left(modelId, 64));
        e.setLlmRequests((int) clampCount(row.getLlmRequests()));
        e.setPromptTokens(clampCount(row.getPromptTokens()));
        e.setCompletionTokens(clampCount(row.getCompletionTokens()));
        double seconds = row.getAsrSeconds() == null || row.getAsrSeconds().isNaN() ? 0 : row.getAsrSeconds();
        e.setAsrSeconds(BigDecimal.valueOf(Math.max(0, Math.min(MAX_COUNT, seconds))).setScale(2, RoundingMode.HALF_UP));
        e.setTtsChars(clampCount(row.getTtsChars()));
        e.setQuotaBlocked((int) clampCount(row.getQuotaBlocked()));
        boolean empty = e.getLlmRequests() == 0 && e.getPromptTokens() == 0 && e.getCompletionTokens() == 0
                && e.getAsrSeconds().signum() == 0 && e.getTtsChars() == 0 && e.getQuotaBlocked() == 0;
        return empty ? null : e;
    }

    // --- summary --------------------------------------------------------------------------

    static BigDecimal num(Object v) {
        if (v == null) {
            return BigDecimal.ZERO;
        }
        if (v instanceof BigDecimal b) {
            return b;
        }
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static Map<String, Object> zero() {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : SUM_KEYS) {
            m.put(k, BigDecimal.ZERO);
        }
        m.put("tokens", BigDecimal.ZERO);
        m.put("cost", null);
        return m;
    }

    /** Adds one SQL sum row (and its cost) into an accumulator. */
    private static void add(Map<String, Object> acc, Map<String, Object> row, Map<String, BigDecimal> prices) {
        for (String k : SUM_KEYS) {
            acc.put(k, num(acc.get(k)).add(num(row.get(k))));
        }
        BigDecimal tokens = num(row.get("promptTokens")).add(num(row.get("completionTokens")));
        acc.put("tokens", num(acc.get("tokens")).add(tokens));
        BigDecimal price = "LLM".equals(row.get("modelType")) ? prices.get(String.valueOf(row.get("modelId"))) : null;
        BigDecimal c = cost(tokens.longValue(), price);
        if (c != null) {
            acc.put("cost", acc.get("cost") == null ? c : num(acc.get("cost")).add(c));
        }
    }

    private static Map<String, Object> plain(Map<String, Object> acc) {
        Map<String, Object> out = new LinkedHashMap<>(acc);
        for (String k : SUM_KEYS) {
            BigDecimal v = num(out.get(k));
            // (an if, not ?: : a conditional of double and long would turn every count into a double)
            if ("asrSeconds".equals(k)) {
                out.put(k, v.setScale(1, RoundingMode.HALF_UP).doubleValue());
            } else {
                out.put(k, v.longValue());
            }
        }
        out.put("tokens", num(out.get("tokens")).longValue());
        if (out.get("cost") != null) {
            out.put("cost", num(out.get("cost")).setScale(4, RoundingMode.HALF_UP).doubleValue());
        }
        return out;
    }

    private static final Comparator<Map<String, Object>> BUSIEST = Comparator
            .comparing((Map<String, Object> m) -> num(m.get("llmRequests")))
            .thenComparing(m -> num(m.get("tokens")))
            .thenComparing(m -> num(m.get("asrSeconds")))
            .thenComparing(m -> num(m.get("ttsChars")))
            .reversed();

    /**
     * The usage page: totals, one row per day (every day of the range, zeros included), per
     * model, per user and the top robots.
     *
     * @param dayRows   sums by day and model (UsageDailyDao.byDayAndModel)
     * @param robotRows sums by robot and model with owner (UsageDailyDao.byRobotAndModel)
     * @param names     model id to display name
     */
    public static Map<String, Object> summary(LocalDate from, LocalDate to, List<Map<String, Object>> dayRows,
            List<Map<String, Object>> robotRows, Map<String, BigDecimal> prices, Map<String, String> names,
            int topRobots) {
        Map<String, Object> totals = zero();
        Map<String, Map<String, Object>> days = new LinkedHashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Map<String, Object> z = zero();
            z.put("date", d.toString());
            days.put(d.toString(), z);
        }
        Map<String, Map<String, Object>> models = new LinkedHashMap<>();
        for (Map<String, Object> r : dayRows) {
            add(totals, r, prices);
            Map<String, Object> day = days.get(String.valueOf(r.get("day")));
            if (day != null) {
                add(day, r, prices);
            }
            if ("quota".equals(r.get("modelId"))) {
                continue;
            }
            String id = String.valueOf(r.get("modelId"));
            String type = String.valueOf(r.get("modelType"));
            Map<String, Object> m = models.computeIfAbsent(type + "/" + id, k -> {
                Map<String, Object> z = zero();
                z.put("modelType", type);
                z.put("modelId", id);
                z.put("modelName", names.getOrDefault(id, id));
                BigDecimal price = "LLM".equals(type) ? prices.get(id) : null;
                z.put("pricePer1k", price == null ? null : price.doubleValue());
                return z;
            });
            add(m, r, prices);
        }
        Map<String, Map<String, Object>> users = new LinkedHashMap<>();
        Map<String, Map<String, Object>> robots = new LinkedHashMap<>();
        Map<String, Set<String>> userRobots = new HashMap<>();
        for (Map<String, Object> r : robotRows) {
            String uid = r.get("userId") == null ? "" : String.valueOf(r.get("userId"));
            Map<String, Object> u = users.computeIfAbsent(uid, k -> {
                Map<String, Object> z = zero();
                z.put("userId", r.get("userId") == null ? null : num(r.get("userId")).longValue());
                z.put("username", r.get("username"));
                return z;
            });
            add(u, r, prices);
            String mac = String.valueOf(r.get("macAddress"));
            userRobots.computeIfAbsent(uid, k -> new HashSet<>()).add(mac);
            Map<String, Object> rb = robots.computeIfAbsent(mac, k -> {
                Map<String, Object> z = zero();
                z.put("macAddress", mac);
                z.put("alias", r.get("alias"));
                z.put("username", r.get("username"));
                return z;
            });
            add(rb, r, prices);
        }
        for (Map.Entry<String, Map<String, Object>> e : users.entrySet()) {
            e.getValue().put("robots", userRobots.getOrDefault(e.getKey(), Set.of()).size());
        }
        List<Map<String, Object>> modelList = new ArrayList<>(models.values());
        modelList.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("modelType")))
                .thenComparing(BUSIEST));
        List<Map<String, Object>> userList = new ArrayList<>(users.values());
        userList.sort(BUSIEST);
        List<Map<String, Object>> robotList = new ArrayList<>(robots.values());
        robotList.sort(BUSIEST);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from.toString());
        out.put("to", to.toString());
        out.put("totals", plain(totals));
        out.put("days", days.values().stream().map(UsageMath::plain).toList());
        out.put("models", modelList.stream().map(UsageMath::plain).toList());
        out.put("users", userList.stream().map(UsageMath::plain).toList());
        out.put("robots", robotList.stream().limit(Math.max(1, topRobots)).map(UsageMath::plain).toList());
        out.put("priced", !prices.isEmpty());
        return out;
    }
}
