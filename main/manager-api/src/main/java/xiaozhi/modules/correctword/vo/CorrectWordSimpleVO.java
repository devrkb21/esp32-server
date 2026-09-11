package xiaozhi.modules.correctword.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Replacement wordStreamlineVO（DevicesideUse）")
public class CorrectWordSimpleVO {

    @Schema(description = "originalword")
    private String sourceWord;

    @Schema(description = "Replacement word")
    private String targetWord;
}
