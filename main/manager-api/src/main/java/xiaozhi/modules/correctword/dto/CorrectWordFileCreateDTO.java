package xiaozhi.modules.correctword.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

@Data
@Schema(description = "CreateReplacement word fileDTO")
public class CorrectWordFileCreateDTO {

    @NotBlank(message = "File namecannot be empty")
    @Schema(description = "File name")
    private String fileName;

    @NotEmpty(message = "Replacement word content cannot be empty")
    @Schema(description = "Replacement wordContent，EachFormat：originalword|Replacement word")
    private List<String> content;

    @Schema(description = "File size（Bytes），Cannot exceed1MB")
    private Long fileSize;
}
