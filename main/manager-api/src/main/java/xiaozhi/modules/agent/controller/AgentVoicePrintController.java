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
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

import xiaozhi.common.utils.ConvertUtils;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.agent.dao.AgentVoicePrintDao;
import xiaozhi.modules.agent.entity.AgentVoicePrintEntity;
import xiaozhi.modules.family.service.DeviceAccess;
import xiaozhi.modules.family.service.FamilyRole.Action;
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
    private final AgentVoicePrintDao agentVoicePrintDao;

    /**
     * Voiceprints follow the character's family roles (DeviceAccess): the owner and co-owners
     * manage them, family members only see the list.
     */
    private boolean canAgent(String agentId, Action action) {
        return DeviceAccess.canAgent(agentId, DeviceAccess.agentOwner(agentId), SecurityUser.getUserId(), action);
    }

    /** Whose voiceprint the service should touch: the caller's own, or any when they manage the character. */
    private Long actingCreator(String voicePrintId, Long userId) {
        AgentVoicePrintEntity vp = StringUtils.isBlank(voicePrintId) ? null : agentVoicePrintDao.selectById(voicePrintId);
        if (vp != null && vp.getCreator() != null && !vp.getCreator().equals(userId)
                && canAgent(vp.getAgentId(), Action.MANAGE)) {
            return vp.getCreator();
        }
        return userId;
    }

    @PostMapping
    @Operation(summary = "CreateAgentVoiceprint")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> save(@RequestBody @Valid AgentVoicePrintSaveDTO dto) {
        if (!canAgent(dto.getAgentId(), Action.MANAGE)) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }
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
        Long userId = actingCreator(dto.getId(), SecurityUser.getUserId());
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
        Long userId = actingCreator(id, SecurityUser.getUserId());
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
        if (!canAgent(id, Action.VIEW)) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }
        // Every voiceprint of the character, whoever in the family added it
        List<AgentVoicePrintVO> list = agentVoicePrintDao.selectList(new LambdaQueryWrapper<AgentVoicePrintEntity>()
                .eq(AgentVoicePrintEntity::getAgentId, id)).stream()
                .map(e -> ConvertUtils.sourceToTarget(e, AgentVoicePrintVO.class)).toList();
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
    // These are global settings for every device, so only a super admin may change them
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> updateSecuritySettings(@RequestBody VoiceprintSecurityDTO dto) {
        if (dto.getConfidenceThreshold() != null) {
            double t = dto.getConfidenceThreshold();
            if (Double.isNaN(t) || t < 0.3 || t > 0.95) {
                return new Result<Void>().error("Voiceprint threshold must be between 0.3 and 0.95");
            }
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
