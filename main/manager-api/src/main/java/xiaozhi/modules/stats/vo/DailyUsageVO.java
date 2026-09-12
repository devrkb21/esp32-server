package xiaozhi.modules.stats.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Daily and Hourly Usage Trends VO")
public class DailyUsageVO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Date or Time labels (e.g. last 7 days or 24 hours)")
    private List<String> dates;

    @Schema(description = "Query counts per time bucket")
    private List<Long> queryCounts;

    @Schema(description = "Estimated token counts per time bucket")
    private List<Long> tokenCounts;

    @Schema(description = "Average total roundtrip latencies per time bucket")
    private List<Double> avgLatencies;

    @Schema(description = "Top active devices")
    private List<TopDeviceVO> topDevices;

    @Schema(description = "Top active agents")
    private List<TopAgentVO> topAgents;

    public List<String> getDates() {
        return dates;
    }

    public void setDates(List<String> dates) {
        this.dates = dates;
    }

    public List<Long> getQueryCounts() {
        return queryCounts;
    }

    public void setQueryCounts(List<Long> queryCounts) {
        this.queryCounts = queryCounts;
    }

    public List<Long> getTokenCounts() {
        return tokenCounts;
    }

    public void setTokenCounts(List<Long> tokenCounts) {
        this.tokenCounts = tokenCounts;
    }

    public List<Double> getAvgLatencies() {
        return avgLatencies;
    }

    public void setAvgLatencies(List<Double> avgLatencies) {
        this.avgLatencies = avgLatencies;
    }

    public List<TopDeviceVO> getTopDevices() {
        return topDevices;
    }

    public void setTopDevices(List<TopDeviceVO> topDevices) {
        this.topDevices = topDevices;
    }

    public List<TopAgentVO> getTopAgents() {
        return topAgents;
    }

    public void setTopAgents(List<TopAgentVO> topAgents) {
        this.topAgents = topAgents;
    }
}
