package xiaozhi.modules.calendar.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;
import lombok.EqualsAndHashCode;
import xiaozhi.common.entity.BaseEntity;

/**
 * A dated special day the admin enters (Eid ul-Fitr, Eid ul-Adha or a custom day). Lunar
 * dates are never computed: an Eid is only known once an admin has entered its date.
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("ai_calendar_day")
public class CalendarDayEntity extends BaseEntity {
    /** The day, yyyy-MM-dd */
    private String dayDate;
    /** eid_ul_fitr, eid_ul_adha or custom */
    private String dayKey;
    /** Name in Bangla */
    private String nameBn;
    /** Name in English */
    private String nameEn;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
