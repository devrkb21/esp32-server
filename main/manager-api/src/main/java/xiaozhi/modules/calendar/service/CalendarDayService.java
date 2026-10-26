package xiaozhi.modules.calendar.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.service.BaseService;
import xiaozhi.modules.calendar.dto.CalendarDayDTO;
import xiaozhi.modules.calendar.entity.CalendarDayEntity;

/**
 * Admin list of dated special days (Eid and custom days) for TinyBot's calendar.
 */
public interface CalendarDayService extends BaseService<CalendarDayEntity> {

    /** Keys an admin may enter; the fixed national days are known to xiaozhi-server itself. */
    List<String> KEYS = List.of("eid_ul_fitr", "eid_ul_adha", "custom");

    /** All days, by date. */
    List<CalendarDayDTO> listAll();

    /** Days from 30 days ago on, for xiaozhi-server: [{date, key, name_bn, name_en}]. */
    List<Map<String, String>> forServer();

    CalendarDayDTO save(CalendarDayDTO dto);

    CalendarDayDTO update(CalendarDayDTO dto);

    void delete(String[] ids);
}
