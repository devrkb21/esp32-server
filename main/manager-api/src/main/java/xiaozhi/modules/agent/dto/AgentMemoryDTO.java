package xiaozhi.modules.agent.dto;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Agent memoryUpdateDTO
 */
@Data
@Schema(description = "Agent memoryUpdateObject")
public class AgentMemoryDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "SummaryMemory", example = "Build a growable dynamic memory network，While retaining key information within limited space，Intelligent maintenanceInformationEvolution trajectory\n" +
            "According toforvoiceRecord，SummaryuserreneedInformation，so as to provide more personalized services in future conversations", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String summaryMemory;
}
