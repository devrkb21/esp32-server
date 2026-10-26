package xiaozhi.modules.kids.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Kids mode of a character: {enabled, age (3-12), blockedTopics}.
 */
@Data
@Schema(description = "Kids mode of a character")
public class AgentKidsDTO {
    @Schema(description = "Kids mode on")
    private Boolean enabled = false;
    @Schema(description = "Age of the child, 3 to 12")
    private Integer age = 7;
    @Schema(description = "Topics TinyBot never talks about (at most 30, each at most 40 characters)")
    private List<String> blockedTopics = new ArrayList<>();
}
