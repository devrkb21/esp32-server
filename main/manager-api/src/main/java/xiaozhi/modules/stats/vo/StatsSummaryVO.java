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
@Schema(description = "Analytics Stats Summary VO")
public class StatsSummaryVO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Total User Voice Queries")
    private Long totalQueries;

    @Schema(description = "Queries Executed Today")
    private Long todayQueries;

    @Schema(description = "Active Online Devices")
    private Long activeDevices;

    @Schema(description = "Total Bound Devices")
    private Long totalDevices;

    @Schema(description = "Total Agents")
    private Long totalAgents;

    @Schema(description = "Total Estimated Tokens Consumed")
    private Long totalTokens;

    @Schema(description = "Estimated Tokens Consumed Today")
    private Long todayTokens;

    @Schema(description = "Average Total Roundtrip Latency in ms", example = "780.0")
    private Double avgLatencyMs;

    @Schema(description = "Average ASR Speech Recognition Latency in ms", example = "210.0")
    private Double asrLatencyMs;

    @Schema(description = "Average LLM Generation Latency in ms", example = "390.0")
    private Double llmLatencyMs;

    @Schema(description = "Average TTS Audio Synthesis Latency in ms", example = "180.0")
    private Double ttsLatencyMs;

    public Long getTotalQueries() {
        return totalQueries;
    }

    public void setTotalQueries(Long totalQueries) {
        this.totalQueries = totalQueries;
    }

    public Long getTodayQueries() {
        return todayQueries;
    }

    public void setTodayQueries(Long todayQueries) {
        this.todayQueries = todayQueries;
    }

    public Long getActiveDevices() {
        return activeDevices;
    }

    public void setActiveDevices(Long activeDevices) {
        this.activeDevices = activeDevices;
    }

    public Long getTotalDevices() {
        return totalDevices;
    }

    public void setTotalDevices(Long totalDevices) {
        this.totalDevices = totalDevices;
    }

    public Long getTotalAgents() {
        return totalAgents;
    }

    public void setTotalAgents(Long totalAgents) {
        this.totalAgents = totalAgents;
    }

    public Long getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(Long totalTokens) {
        this.totalTokens = totalTokens;
    }

    public Long getTodayTokens() {
        return todayTokens;
    }

    public void setTodayTokens(Long todayTokens) {
        this.todayTokens = todayTokens;
    }

    public Double getAvgLatencyMs() {
        return avgLatencyMs;
    }

    public void setAvgLatencyMs(Double avgLatencyMs) {
        this.avgLatencyMs = avgLatencyMs;
    }

    public Double getAsrLatencyMs() {
        return asrLatencyMs;
    }

    public void setAsrLatencyMs(Double asrLatencyMs) {
        this.asrLatencyMs = asrLatencyMs;
    }

    public Double getLlmLatencyMs() {
        return llmLatencyMs;
    }

    public void setLlmLatencyMs(Double llmLatencyMs) {
        this.llmLatencyMs = llmLatencyMs;
    }

    public Double getTtsLatencyMs() {
        return ttsLatencyMs;
    }

    public void setTtsLatencyMs(Double ttsLatencyMs) {
        this.ttsLatencyMs = ttsLatencyMs;
    }
}
