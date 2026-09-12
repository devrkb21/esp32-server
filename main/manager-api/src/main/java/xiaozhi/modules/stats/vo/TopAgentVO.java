package xiaozhi.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Top Active Agent VO")
public class TopAgentVO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Agent ID")
    private String agentId;

    @Schema(description = "Agent Name")
    private String agentName;

    @Schema(description = "Query Count")
    private Long queryCount;

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getAgentName() {
        return agentName;
    }

    public void setAgentName(String agentName) {
        this.agentName = agentName;
    }

    public Long getQueryCount() {
        return queryCount;
    }

    public void setQueryCount(Long queryCount) {
        this.queryCount = queryCount;
    }
}
