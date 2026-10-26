package xiaozhi.modules.calendar.service.impl;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import xiaozhi.common.exception.RenException;
import xiaozhi.common.service.impl.BaseServiceImpl;
import xiaozhi.modules.calendar.dao.CalendarDayDao;
import xiaozhi.modules.calendar.dto.CalendarDayDTO;
import xiaozhi.modules.calendar.entity.CalendarDayEntity;
import xiaozhi.modules.calendar.service.CalendarDayService;

@Service
public class CalendarDayServiceImpl extends BaseServiceImpl<CalendarDayDao, CalendarDayEntity>
        implements CalendarDayService {

    private static final int MAX_NAME = 60;

    @Override
    public List<CalendarDayDTO> listAll() {
        QueryWrapper<CalendarDayEntity> q = new QueryWrapper<>();
        q.orderByAsc("day_date");
        List<CalendarDayDTO> out = new ArrayList<>();
        for (CalendarDayEntity e : baseDao.selectList(q)) {
            out.add(toDto(e));
        }
        return out;
    }

    @Override
    public List<Map<String, String>> forServer() {
        String from = LocalDate.now().minusDays(30).toString();
        List<Map<String, String>> out = new ArrayList<>();
        for (CalendarDayDTO d : listAll()) {
            if (d.getDate() == null || d.getDate().compareTo(from) < 0) {
                continue;
            }
            Map<String, String> m = new LinkedHashMap<>();
            m.put("date", d.getDate());
            m.put("key", d.getKey());
            m.put("name_bn", d.getNameBn());
            m.put("name_en", d.getNameEn());
            out.add(m);
        }
        return out;
    }

    @Override
    public CalendarDayDTO save(CalendarDayDTO dto) {
        CalendarDayEntity e = new CalendarDayEntity();
        apply(e, dto);
        insert(e);
        return toDto(e);
    }

    @Override
    public CalendarDayDTO update(CalendarDayDTO dto) {
        if (dto == null || StringUtils.isBlank(dto.getId())) {
            throw new RenException("id is required");
        }
        CalendarDayEntity e = selectById(parseId(dto.getId()));
        if (e == null) {
            throw new RenException("special day not found");
        }
        apply(e, dto);
        updateById(e);
        return toDto(e);
    }

    @Override
    public void delete(String[] ids) {
        if (ids == null || ids.length == 0) {
            return;
        }
        deleteBatchIds(Arrays.stream(ids).map(CalendarDayServiceImpl::parseId).toList());
    }

    /** Validates the request into the entity: a real date, a known key, names (Eid has defaults). */
    static void apply(CalendarDayEntity e, CalendarDayDTO dto) {
        if (dto == null) {
            throw new RenException("body is required");
        }
        String date = StringUtils.trimToEmpty(dto.getDate());
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new RenException("date must be yyyy-MM-dd");
        }
        try {
            LocalDate.parse(date);
        } catch (DateTimeParseException ex) {
            throw new RenException("date must be yyyy-MM-dd");
        }
        String key = StringUtils.trimToEmpty(dto.getKey());
        if (!KEYS.contains(key)) {
            throw new RenException("key must be one of " + String.join(", ", KEYS));
        }
        String nameBn = StringUtils.trimToEmpty(dto.getNameBn());
        String nameEn = StringUtils.trimToEmpty(dto.getNameEn());
        if ("eid_ul_fitr".equals(key)) {
            nameBn = StringUtils.defaultIfBlank(nameBn, "ঈদুল ফিতর");
            nameEn = StringUtils.defaultIfBlank(nameEn, "Eid ul-Fitr");
        } else if ("eid_ul_adha".equals(key)) {
            nameBn = StringUtils.defaultIfBlank(nameBn, "ঈদুল আযহা");
            nameEn = StringUtils.defaultIfBlank(nameEn, "Eid ul-Adha");
        } else if (nameBn.isEmpty() && nameEn.isEmpty()) {
            throw new RenException("a custom day needs a name");
        }
        if (nameBn.length() > MAX_NAME || nameEn.length() > MAX_NAME) {
            throw new RenException("names are at most " + MAX_NAME + " characters");
        }
        e.setDayDate(date);
        e.setDayKey(key);
        e.setNameBn(StringUtils.defaultIfBlank(nameBn, nameEn));
        e.setNameEn(StringUtils.defaultIfBlank(nameEn, nameBn));
    }

    static CalendarDayDTO toDto(CalendarDayEntity e) {
        CalendarDayDTO d = new CalendarDayDTO();
        d.setId(e.getId() == null ? null : String.valueOf(e.getId()));
        String day = e.getDayDate();
        d.setDate(day == null ? null : day.length() > 10 ? day.substring(0, 10) : day);
        d.setKey(e.getDayKey());
        d.setNameBn(e.getNameBn());
        d.setNameEn(e.getNameEn());
        return d;
    }

    private static Long parseId(String id) {
        try {
            return Long.valueOf(id.trim());
        } catch (NumberFormatException ex) {
            throw new RenException("invalid id");
        }
    }
}
