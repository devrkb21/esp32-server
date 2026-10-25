package xiaozhi.modules.product.vo;

import java.io.Serializable;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Enabled product as shown to signed-in users (GET /product/list)
 */
@Data
@Schema(description = "Product (client view)")
public class ProductListVO implements Serializable {
    @Schema(description = "Unique key", example = "tinybot")
    private String productKey;

    @Schema(description = "Name (English)", example = "TinyBot")
    private String nameEn;

    @Schema(description = "Name (Bangla)", example = "টাইনিবট")
    private String nameBn;

    @Schema(description = "Icon URL (nullable)")
    private String iconUrl;

    @Schema(description = "Feature keys")
    private List<String> features;

    @Schema(description = "Sort order")
    private Integer sort;
}
