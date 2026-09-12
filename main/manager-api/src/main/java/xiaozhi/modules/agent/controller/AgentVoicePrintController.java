package xiaozhi.modules.agent.controller;

import java.util.List;

import org.apache.commons.lang3.StringUtils;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.agent.dto.AgentVoicePrintSaveDTO;
import xiaozhi.modules.agent.dto.AgentVoicePrintUpdateDTO;
import xiaozhi.modules.agent.dto.VoiceprintSecurityDTO;
import xiaozhi.modules.agent.service.AgentVoicePrintService;
import xiaozhi.modules.agent.vo.AgentVoicePrintVO;
import xiaozhi.modules.security.user.SecurityUser;
import xiaozhi.modules.sys.service.SysParamsService;

@Tag(name = "AgentVoiceprintManagement")
@AllArgsConstructor
@RestController
@RequestMapping("/agent/voice-print")
public class AgentVoicePrintController {
    private final AgentVoicePrintService agentVoicePrintService;
    private final SysParamsService sysParamsService;

    @PostMapping
    @Operation(summary = "CreateAgentVoiceprint")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> save(@RequestBody @Valid AgentVoicePrintSaveDTO dto) {
        boolean b = agentVoicePrintService.insert(dto);
        if (b) {
            return new Result<>();
        }
        return new Result<Void>().error(ErrorCode.AGENT_VOICEPRINT_CREATE_FAILED);
    }

    @PutMapping
    @Operation(summary = "UpdateAgentforshouldVoiceprint")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> update(@RequestBody @Valid AgentVoicePrintUpdateDTO dto) {
        Long userId = SecurityUser.getUserId();
        boolean b = agentVoicePrintService.update(userId, dto);
        if (b) {
            return new Result<>();
        }
        return new Result<Void>().error(ErrorCode.AGENT_VOICEPRINT_UPDATE_FAILED);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "DeleteAgentforshouldVoiceprint")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> delete(@PathVariable String id) {
        Long userId = SecurityUser.getUserId();
        // firstDeleteAssociateDevice
        boolean delete = agentVoicePrintService.delete(userId, id);
        if (delete) {
            return new Result<>();
        }
        return new Result<Void>().error(ErrorCode.AGENT_VOICEPRINT_DELETE_FAILED);
    }

    @GetMapping("/list/{id}")
    @Operation(summary = "Get voiceprint list for user's specified agent")
    @RequiresPermissions("sys:role:normal")
    public Result<List<AgentVoicePrintVO>> list(@PathVariable String id) {
        String voiceprintUrl = sysParamsService.getValue("server.voice_print", true);
        if (StringUtils.isBlank(voiceprintUrl) || "null".equals(voiceprintUrl)) {
            throw new RenException(ErrorCode.VOICEPRINT_API_NOT_CONFIGURED);
        }
        Long userId = SecurityUser.getUserId();
        List<AgentVoicePrintVO> list = agentVoicePrintService.list(userId, id);
        return new Result<List<AgentVoicePrintVO>>().ok(list);
    }

    @GetMapping("/security")
    @Operation(summary = "Get voiceprint security policy settings")
    @RequiresPermissions("sys:role:normal")
    public Result<VoiceprintSecurityDTO> getSecuritySettings() {
        VoiceprintSecurityDTO dto = new VoiceprintSecurityDTO();

        String thresholdStr = sysParamsService.getValue("server.voiceprint_similarity_threshold", true);
        double threshold = 0.70;
        if (StringUtils.isNotBlank(thresholdStr) && !"null".equals(thresholdStr)) {
            try {
                threshold = Double.parseDouble(thresholdStr);
            } catch (NumberFormatException ignored) {}
        }
        dto.setConfidenceThreshold(threshold);

        String reqSmarthome = sysParamsService.getValue("server.voiceprint_require_smarthome", true);
        dto.setRequireVoiceMatchSmartHome("true".equalsIgnoreCase(reqSmarthome) || "1".equals(reqSmarthome));

        String adminOnly = sysParamsService.getValue("server.voiceprint_admin_only", true);
        dto.setAdminSpeakerOnly("true".equalsIgnoreCase(adminOnly) || "1".equals(adminOnly));

        return new Result<VoiceprintSecurityDTO>().ok(dto);
    }

    @PostMapping("/security")
    @Operation(summary = "Update voiceprint security policy settings")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> updateSecuritySettings(@RequestBody VoiceprintSecurityDTO dto) {
        if (dto.getConfidenceThreshold() != null) {
            sysParamsService.setParam("server.voiceprint_similarity_threshold", String.valueOf(dto.getConfidenceThreshold()), "Voiceprint similarity threshold");
        }
        if (dto.getRequireVoiceMatchSmartHome() != null) {
            sysParamsService.setParam("server.voiceprint_require_smarthome", String.valueOf(dto.getRequireVoiceMatchSmartHome()), "Require voice match for smart home commands");
        }
        if (dto.getAdminSpeakerOnly() != null) {
            sysParamsService.setParam("server.voiceprint_admin_only", String.valueOf(dto.getAdminSpeakerOnly()), "Admin speaker only for sensitive actions");
        }
        return new Result<>();
    }
}
