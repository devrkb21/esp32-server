package xiaozhi.modules.summary.task;

import java.time.LocalDate;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.modules.notify.service.WatchRules;
import xiaozhi.modules.summary.service.SummaryService;

/**
 * The nightly summary: at 21:00 (Asia/Dhaka) every robot's day is built and sent to its owner
 * and family as a "দিনের সারাংশ" notification; at 23:55 it is rebuilt silently with the rest of
 * the evening and marked final.
 */
@Slf4j
@Component
public class DailySummaryTask {
    private final SummaryService summaryService;

    public DailySummaryTask(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @Scheduled(cron = "0 0 21 * * *", zone = "Asia/Dhaka")
    public void evening() {
        run(false, true);
    }

    @Scheduled(cron = "0 55 23 * * *", zone = "Asia/Dhaka")
    public void night() {
        run(true, false);
    }

    private void run(boolean finalBuild, boolean notify) {
        try {
            int n = summaryService.buildAll(LocalDate.now(WatchRules.ZONE), finalBuild, notify);
            log.info("Daily summary: {} robots ({})", n, finalBuild ? "final" : "evening");
        } catch (Exception e) {
            log.warn("Daily summary failed: {}", e.getMessage());
        }
    }
}
