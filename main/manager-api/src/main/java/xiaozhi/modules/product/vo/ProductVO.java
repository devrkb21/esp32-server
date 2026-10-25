package xiaozhi.modules.product.vo;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import xiaozhi.common.utils.DateUtils;

/**
 * Product (admin view, and the result of resolving a board type)
 */
@Data
@Schema(description = "Product")
public class ProductVO implements Serializable {
    @Schema(description = "id")
    private Long id;

    @Schema(description = "Unique key")
    private String productKey;

    @Schema(description = "Name (English)")
    private String nameEn;

    @Schema(description = "Name (Bangla)")
    private String nameBn;

    @Schema(description = "Description")
    private String description;

    @Schema(description = "Icon URL")
    private String iconUrl;

    @Schema(description = "Comma-separated board type patterns")
    private String boardTypes;

    @Schema(description = "Feature keys")
    private List<String> features;

    @Schema(description = "Sort order")
    private Integer sort;

    @Schema(description = "Status (0: disabled, 1: enabled)")
    private Integer status;

    @Schema(description = "Creation time")
    @JsonFormat(pattern = DateUtils.DATE_TIME_PATTERN)
    private Date createDate;

    @Schema(description = "Update time")
    @JsonFormat(pattern = DateUtils.DATE_TIME_PATTERN)
    private Date updateDate;

    public boolean hasFeature(String feature) {
        return features != null && feature != null && features.contains(feature);
    }
}
