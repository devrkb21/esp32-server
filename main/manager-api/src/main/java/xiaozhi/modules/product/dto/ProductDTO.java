package xiaozhi.modules.product.dto;

import java.io.Serializable;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import lombok.Data;
import xiaozhi.common.validator.group.AddGroup;
import xiaozhi.common.validator.group.UpdateGroup;

/**
 * Product create / update request (admin)
 */
@Data
@Schema(description = "Product")
public class ProductDTO implements Serializable {

    @Schema(description = "id (omit on create, required on update)")
    @Null(message = "{id.null}", groups = AddGroup.class)
    @NotNull(message = "{id.require}", groups = UpdateGroup.class)
    private Long id;

    @Schema(description = "Unique lower-case key, e.g. tinybot", example = "tinybot")
    private String productKey;

    @Schema(description = "Name (English)", example = "TinyBot")
    private String nameEn;

    @Schema(description = "Name (Bangla)", example = "টাইনিবট")
    private String nameBn;

    @Schema(description = "Description")
    private String description;

    @Schema(description = "Icon URL (nullable)")
    private String iconUrl;

    @Schema(description = "Comma-separated board type patterns; trailing * is a prefix wildcard, * alone matches everything", example = "tinybot,tinybot-*")
    private String boardTypes;

    @Schema(description = "Feature keys ([a-z_]+)", example = "[\"chat\",\"companion\"]")
    private List<String> features;

    @Schema(description = "Sort order (ascending)")
    private Integer sort;

    @Schema(description = "Status (0: disabled, 1: enabled)")
    private Integer status;
}
