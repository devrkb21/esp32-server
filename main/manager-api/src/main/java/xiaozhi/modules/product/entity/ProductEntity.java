package xiaozhi.modules.product.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;
import lombok.EqualsAndHashCode;
import xiaozhi.common.entity.BaseEntity;

/**
 * A Nobix product (TinyBot, ...). Devices are mapped to a product by matching the board type
 * they report at OTA time against {@link #boardTypes}.
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("ai_product")
public class ProductEntity extends BaseEntity {
    /**
     * Unique lower-case key, e.g. tinybot
     */
    private String productKey;
    /**
     * Name (English)
     */
    private String nameEn;
    /**
     * Name (Bangla)
     */
    private String nameBn;
    /**
     * Description
     */
    private String description;
    /**
     * Icon URL (nullable)
     */
    private String iconUrl;
    /**
     * Comma-separated board type patterns: exact ("tinybot"), prefix ("tinybot-*") or "*"
     */
    private String boardTypes;
    /**
     * JSON array of feature keys
     */
    private String features;
    /**
     * Sort order
     */
    private Integer sort;
    /**
     * Status (0: disabled, 1: enabled)
     */
    private Integer status;
    /**
     * Updater
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;
    /**
     * Update time
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
