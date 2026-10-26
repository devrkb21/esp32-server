package xiaozhi.modules.summary.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import xiaozhi.modules.device.entity.DeviceEntity;

/**
 * The daily summary of a robot ("দিনের সারাংশ"): built by the nightly job, read by the apps.
 */
public interface SummaryService {

    /** The last {@code days} days that have a summary, newest first (user needs VIEW). */
    List<Map<String, Object>> list(String deviceId, Long userId, int days);

    /** Builds (or rebuilds) today's summary now for a robot the user can see. */
    Map<String, Object> buildNow(String deviceId, Long userId);

    /** Builds and stores one robot's day; null when the companion server has no data for it. */
    Map<String, Object> build(DeviceEntity device, LocalDate day, boolean finalBuild);

    /** The nightly job: every robot known to the companion server; notifies when {@code notify}. */
    int buildAll(LocalDate day, boolean finalBuild, boolean notify);
}
