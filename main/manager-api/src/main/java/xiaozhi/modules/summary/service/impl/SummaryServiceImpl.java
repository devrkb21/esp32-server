package xiaozhi.modules.summary.service.impl;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.agent.dao.AiAgentChatHistoryDao;
import xiaozhi.modules.agent.entity.AgentChatHistoryEntity;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.family.service.FamilyRole.Action;
import xiaozhi.modules.notify.service.CompanionClient;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.notify.service.WatchRules;
import xiaozhi.modules.summary.dao.DailySummaryDao;
import xiaozhi.modules.summary.entity.DailySummaryEntity;
import xiaozhi.modules.summary.service.SummaryBuilder;
import xiaozhi.modules.summary.service.SummaryService;

@Slf4j
@Service
public class SummaryServiceImpl implements SummaryService {
    static final int MAX_DAYS = 90;

    private final DailySummaryDao summaryDao;
    private final DeviceDao deviceDao;
    private final DeviceAccessService access;
    private final CompanionClient companion;
    private final AiAgentChatHistoryDao chatHistoryDao;
    private final NotifyService notifyService;

    public SummaryServiceImpl(DailySummaryDao summaryDao, DeviceDao deviceDao, DeviceAccessService access,
            CompanionClient companion, AiAgentChatHistoryDao chatHistoryDao, NotifyService notifyService) {
        this.summaryDao = summaryDao;
        this.deviceDao = deviceDao;
        this.access = access;
        this.companion = companion;
        this.chatHistoryDao = chatHistoryDao;
        this.notifyService = notifyService;
    }

    @Override
    public List<Map<String, Object>> list(String deviceId, Long userId, int days) {
        access.require(deviceId, userId, Action.VIEW);
        int n = Math.max(1, Math.min(MAX_DAYS, days));
        String from = LocalDate.now(WatchRules.ZONE).minusDays(n - 1L).toString();
        List<DailySummaryEntity> rows = summaryDao.selectList(new QueryWrapper<DailySummaryEntity>()
                .eq("device_id", deviceId).ge("day", from).orderByDesc("day").last("LIMIT " + n));
        List<Map<String, Object>> out = new ArrayList<>();
        for (DailySummaryEntity r : rows) {
            out.add(view(r));
        }
        return out;
    }

    static Map<String, Object> view(DailySummaryEntity r) {
        Map<String, Object> row = new LinkedHashMap<>();
        Map<String, Object> data = StringUtils.isBlank(r.getData()) ? null : JsonUtils.parseMap(r.getData());
        if (data != null) {
            row.putAll(data);
        }
        row.put("day", r.getDay());
        row.put("textBn", r.getTextBn());
        row.put("textEn", r.getTextEn());
        row.put("final", r.getFinalFlag() != null && r.getFinalFlag() == 1);
        return row;
    }

    @Override
    public Map<String, Object> buildNow(String deviceId, Long userId) {
        DeviceEntity device = access.require(deviceId, userId, Action.VIEW);
        Map<String, Object> row = build(device, LocalDate.now(WatchRules.ZONE), false);
        return row == null ? Map.of() : row;
    }

    @Override
    public Map<String, Object> build(DeviceEntity device, LocalDate day, boolean finalBuild) {
        if (device == null || StringUtils.isBlank(device.getMacAddress())) {
            return null;
        }
        Map<String, Object> view = companion.device(device.getMacAddress());
        if (view == null) {
            return null;
        }
        SummaryBuilder.Input in = new SummaryBuilder.Input();
        in.day = day;
        in.robotName = StringUtils.defaultIfBlank(device.getAlias(),
                StringUtils.defaultIfBlank(view.get("name") == null ? null : String.valueOf(view.get("name")), "TinyBot"));
        in.events = companion.events(device.getMacAddress(), 200);
        in.stats = view.get("stats") instanceof Map<?, ?> ? JsonUtils.toStringObjectMap(view.get("stats")) : null;
        in.statsAreToday = day.equals(LocalDate.now(WatchRules.ZONE));
        Object pomo = view.get("pomodoro");
        if (pomo instanceof Map<?, ?> p) {
            in.workMin = WatchRules.intOf(p.get("work_min"), 25);
        }
        if (view.get("memories") instanceof List<?> mems) {
            for (Object m : mems) {
                if (m instanceof Map<?, ?> mm && mm.get("created") != null) {
                    in.memoryCreated.add(String.valueOf(mm.get("created")));
                }
            }
        }
        in.talkCount = talkCount(device.getMacAddress(), day);
        Map<String, Object> data = SummaryBuilder.build(in);
        String bn = SummaryBuilder.textBn(data, in.robotName);
        String en = SummaryBuilder.textEn(data, in.robotName);

        DailySummaryEntity row = summaryDao.selectOne(new QueryWrapper<DailySummaryEntity>()
                .eq("device_id", device.getId()).eq("day", day.toString()).last("LIMIT 1"));
        boolean fresh = row == null;
        Date now = new Date();
        if (fresh) {
            row = new DailySummaryEntity();
            row.setDeviceId(device.getId());
            row.setDay(day.toString());
            row.setCreateDate(now);
        }
        Map<String, Object> stored = new LinkedHashMap<>(data);
        stored.remove("day");
        row.setData(JsonUtils.toJsonString(stored));
        row.setTextBn(bn);
        row.setTextEn(en);
        row.setFinalFlag(finalBuild ? 1 : 0);
        row.setUpdateDate(now);
        if (fresh) {
            summaryDao.insert(row);
        } else {
            summaryDao.updateById(row);
        }
        return view(row);
    }

    private int talkCount(String mac, LocalDate day) {
        try {
            ZoneId zone = WatchRules.ZONE;
            Date from = Date.from(day.atStartOfDay(zone).toInstant());
            Date to = Date.from(day.plusDays(1).atStartOfDay(zone).toInstant());
            Long n = chatHistoryDao.selectCount(new QueryWrapper<AgentChatHistoryEntity>()
                    .eq("mac_address", mac).eq("chat_type", 1).ge("created_at", from).lt("created_at", to));
            return n == null ? 0 : n.intValue();
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    public int buildAll(LocalDate day, boolean finalBuild, boolean notify) {
        if (companion.baseUrl() == null) {
            return 0;
        }
        Set<String> macs = new HashSet<>();
        for (Map<String, Object> r : companion.devices()) {
            String mac = String.valueOf(r.get("id")).toLowerCase();
            macs.add(mac);
            macs.add(mac.toUpperCase());
        }
        if (macs.isEmpty()) {
            return 0;
        }
        int built = 0;
        for (DeviceEntity device : deviceDao.selectList(new QueryWrapper<DeviceEntity>().in("mac_address", macs))) {
            try {
                Map<String, Object> row = build(device, day, finalBuild);
                if (row == null) {
                    continue;
                }
                built++;
                if (notify) {
                    String name = StringUtils.defaultIfBlank(device.getAlias(), "TinyBot");
                    notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.DAILY_SUMMARY)
                            .title("দিনের সারাংশ", "Today's summary")
                            .body(String.valueOf(row.get("textBn")), String.valueOf(row.get("textEn")))
                            .setRobotName(name).setDedupeKey("summary:" + device.getId() + ":" + day));
                }
            } catch (Exception e) {
                log.debug("Summary of {} failed: {}", device.getId(), e.getMessage());
            }
        }
        return built;
    }
}
