package xiaozhi.modules.device.service.impl;

import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import cn.hutool.core.map.MapUtil;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.redis.RedisKeys;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.agent.dao.AgentDao;
import xiaozhi.modules.agent.dto.AgentCreateDTO;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.agent.service.AgentService;
import xiaozhi.modules.device.dto.DeviceLinkDTO;
import xiaozhi.modules.device.service.DeviceLinkService;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.device.vo.DeviceLinkInfoVO;
import xiaozhi.modules.device.vo.DeviceLinkResultVO;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductVO;

@Slf4j
@Service
@AllArgsConstructor
public class DeviceLinkServiceImpl implements DeviceLinkService {

    /** Name of the character created for a first robot when the product has no name. */
    static final String FALLBACK_AGENT_NAME = "আমার রোবট";

    private final RedisUtils redisUtils;
    private final DeviceService deviceService;
    private final AgentService agentService;
    private final AgentDao agentDao;
    private final ProductService productService;

    /** What the activation cache knows about a pending robot. */
    record Pending(String code, String deviceId, String board) {
    }

    @Override
    public DeviceLinkInfoVO lookup(String rawCode) {
        Pending pending = findPending(rawCode);
        ProductVO product = productService.resolve(pending.board());

        DeviceLinkInfoVO vo = new DeviceLinkInfoVO();
        vo.setCode(pending.code());
        vo.setBoard(pending.board());
        if (product != null) {
            vo.setProductKey(product.getProductKey());
            vo.setProductNameEn(product.getNameEn());
            vo.setProductNameBn(product.getNameBn());
            vo.setProductIconUrl(product.getIconUrl());
        }
        vo.setMacTail(macTail(pending.deviceId()));
        vo.setValid(true);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DeviceLinkResultVO link(Long userId, DeviceLinkDTO dto) {
        if (userId == null) {
            throw new RenException(ErrorCode.USER_NOT_LOGIN);
        }
        // Validate the code before touching characters, so a bad code never creates one.
        Pending pending = findPending(dto == null ? null : dto.getCode());
        String requested = dto == null ? null : StringUtils.trimToNull(dto.getAgentId());

        List<String> agentIds = listAgentIds(userId);
        AgentChoice choice = DeviceLinkService.decideAgent(agentIds, requested);
        if (choice == null) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }

        String agentId;
        boolean created = false;
        switch (choice) {
            case REQUESTED -> agentId = requested;
            case ONLY -> agentId = agentIds.get(0);
            case CREATE -> {
                AgentCreateDTO create = new AgentCreateDTO();
                create.setAgentName(defaultAgentName(pending.board()));
                agentId = agentService.createAgent(create);
                created = true;
            }
            default -> throw new RenException(ErrorCode.DEVICE_LINK_CHOOSE_AGENT);
        }

        deviceService.deviceActivation(agentId, pending.code());
        log.info("Robot linked: user={}, agent={}, agentCreated={}", userId, agentId, created);
        return new DeviceLinkResultVO(pending.deviceId(), agentId, created);
    }

    private Pending findPending(String rawCode) {
        String code = DeviceLinkService.normalizeCode(rawCode);
        if (code == null) {
            throw new RenException(ErrorCode.DEVICE_LINK_CODE_FORMAT);
        }
        Object cachedDeviceId = redisUtils.get(RedisKeys.getOtaActivationCode(code));
        String deviceId = cachedDeviceId == null ? null : cachedDeviceId.toString();
        if (StringUtils.isBlank(deviceId)) {
            throw new RenException(ErrorCode.DEVICE_LINK_CODE_EXPIRED);
        }
        String safeDeviceId = deviceId.replace(":", "_").toLowerCase();
        Map<String, Object> data = JsonUtils
                .toStringObjectMap(redisUtils.get(RedisKeys.getOtaDeviceActivationInfo(safeDeviceId)));
        if (MapUtil.isEmpty(data) || !code.equals(String.valueOf(data.get("activation_code")))) {
            throw new RenException(ErrorCode.DEVICE_LINK_CODE_EXPIRED);
        }
        if (deviceService.selectById(deviceId) != null) {
            throw new RenException(ErrorCode.DEVICE_ALREADY_ACTIVATED);
        }
        Object board = data.get("board");
        String boardType = board == null || "unknown".equals(board.toString()) ? null : board.toString();
        return new Pending(code, deviceId, boardType);
    }

    private List<String> listAgentIds(Long userId) {
        QueryWrapper<AgentEntity> wrapper = new QueryWrapper<>();
        wrapper.select("id").eq("user_id", userId).orderByDesc("created_at");
        return agentDao.selectList(wrapper).stream().map(AgentEntity::getId).toList();
    }

    private String defaultAgentName(String board) {
        try {
            ProductVO product = productService.resolve(board);
            if (product != null) {
                if (StringUtils.isNotBlank(product.getNameBn())) {
                    return product.getNameBn();
                }
                if (StringUtils.isNotBlank(product.getNameEn())) {
                    return product.getNameEn();
                }
            }
        } catch (RuntimeException e) {
            log.warn("Could not resolve product for board {}: {}", board, e.getMessage());
        }
        return FALLBACK_AGENT_NAME;
    }

    /** Last 4 hex digits of a MAC address, upper-case, or null. */
    static String macTail(String mac) {
        if (mac == null) {
            return null;
        }
        String hex = mac.replaceAll("[^0-9A-Fa-f]", "");
        return hex.length() < 4 ? null : hex.substring(hex.length() - 4).toUpperCase();
    }
}
