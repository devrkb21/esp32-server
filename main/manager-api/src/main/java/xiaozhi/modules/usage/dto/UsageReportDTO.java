package xiaozhi.modules.usage.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * A batch of daily usage rows from xiaozhi-server (POST /config/usage/report).
 */
@Data
@Schema(description = "Usage report batch")
public class UsageReportDTO {
    private List<Row> rows = new ArrayList<>();

    @Data
    public static class Row {
        @Schema(description = "Day in the server's local time, yyyy-MM-dd")
        private String date;
        private String macAddress;
        @Schema(description = "LLM, ASR or TTS")
        private String modelType;
        private String modelId;
        private Long llmRequests;
        private Long promptTokens;
        private Long completionTokens;
        private Double asrSeconds;
        private Long ttsChars;
        private Long quotaBlocked;
    }
}
