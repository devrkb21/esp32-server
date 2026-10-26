package xiaozhi.modules.calendar.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.calendar.dto.CalendarDayDTO;
import xiaozhi.modules.calendar.service.CalendarDayService;

/**
 * TinyBot's special days: the admin's dated list (Eid ul-Fitr, Eid ul-Adha, custom days). The
 * fixed national days are known to xiaozhi-server; Eid dates are only what an admin enters.
 * xiaozhi-server reads the list through /config/calendar-days (server secret, like /config/**).
 */
@AllArgsConstructor
@RestController
@Tag(name = "Calendar (special days)")
public class CalendarDayController {
    private final CalendarDayService calendarDayService;

    @GetMapping("/calendar/days")
    @Operation(summary = "All special days by date (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<List<CalendarDayDTO>> list() {
        return new Result<List<CalendarDayDTO>>().ok(calendarDayService.listAll());
    }

    @PostMapping("/calendar/days")
    @Operation(summary = "Add a special day (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<CalendarDayDTO> save(@RequestBody CalendarDayDTO dto) {
        return new Result<CalendarDayDTO>().ok(calendarDayService.save(dto));
    }

    @PutMapping("/calendar/days")
    @Operation(summary = "Change a special day (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<CalendarDayDTO> update(@RequestBody CalendarDayDTO dto) {
        return new Result<CalendarDayDTO>().ok(calendarDayService.update(dto));
    }

    @DeleteMapping("/calendar/days")
    @Operation(summary = "Delete special days (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> delete(@RequestBody String[] ids) {
        calendarDayService.delete(ids);
        return new Result<>();
    }

    @GetMapping("/config/calendar-days")
    @Operation(summary = "Special days from 30 days ago on, for xiaozhi-server (server secret)")
    public Result<List<Map<String, String>>> forServer() {
        return new Result<List<Map<String, String>>>().ok(calendarDayService.forServer());
    }
}
