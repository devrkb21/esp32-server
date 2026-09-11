package xiaozhi.modules.agent.entity;

import java.io.Serializable;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * AgentandPluginUniqueMappingtable
 * 
 * @TableName ai_agent_plugin_mapping
 */
@Data
@TableName(value = "ai_agent_plugin_mapping")
@Schema(description = "AgentandPluginUniqueMappingtable")
public class AgentPluginMapping implements Serializable {
    /**
     * Primary key
     */
    @TableId(type = IdType.ASSIGN_ID)
    @Schema(description = "MappingInformationPrimary key ID")
    private Long id;

    /**
     * AgentID
     */
    @Schema(description = "AgentID")
    private String agentId;

    /**
     * PluginID
     */
    @Schema(description = "PluginID")
    private String pluginId;

    /**
     * PluginParameter(Json)Format
     */
    @Schema(description = "PluginParameter(Json)Format")
    private String paramInfo;

    // RedundantField，Used forpartyconvenientatAccording toidQueryPluginwhen，forQueried according toPluginProvider_code,SeedaolayerxmlFile
    @TableField(exist = false)
    @Schema(description = "Pluginprovider_code, forshouldtableai_model_provider")
    private String providerCode;

    @TableField(exist = false)
    private static final long serialVersionUID = 1L;
}