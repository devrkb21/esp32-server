package xiaozhi.modules.calendar.dto;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * A dated special day, as the back office sees it
 */
@Data
@Schema(description = "Special day")
public class CalendarDayDTO implements Serializable {

    @Schema(description = "id (omit on create, required on update)")
    private String id;

    @Schema(description = "The day, yyyy-MM-dd", example = "2027-03-10")
    private String date;

    @Schema(description = "eid_ul_fitr, eid_ul_adha or custom", example = "eid_ul_fitr")
    private String key;

    @Schema(description = "Name in Bangla (default for Eid: ঈদুল ফিতর / ঈদুল আযহা)")
    private String nameBn;

    @Schema(description = "Name in English (default for Eid: Eid ul-Fitr / Eid ul-Adha)")
    private String nameEn;
}
