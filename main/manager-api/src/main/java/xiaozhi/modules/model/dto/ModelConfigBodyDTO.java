package xiaozhi.modules.model.dto;

import java.io.Serial;

import cn.hutool.json.JSONObject;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Model provider/provider")
public class ModelConfigBodyDTO {

    @Serial
    private static final long serialVersionUID = 1L;

    @Schema(description = "ModelID,Auto-generated if not filled")
    private String id;

    @Schema(description = "ModelCode(e.g.AliLLM、DoubaoTTS)")
    private String modelCode;

    @Schema(description = "Model name")
    private String modelName;

    @Schema(description = "WhetherDefaultConfiguration(0no 1is)")
    private Integer isDefault;

    @Schema(description = "WhetherEnabled")
    private Integer isEnabled;

    @Schema(description = "Model configuration(JSONFormat)")
    private JSONObject configJson;

    @Schema(description = "Official documentation link")
    private String docLink;

    @Schema(description = "Remark")
    private String remark;

    @Schema(description = "Sort")
    private Integer sort;
}
