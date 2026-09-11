package xiaozhi.modules.voiceclone.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;

import xiaozhi.modules.model.dto.VoiceDTO;
import xiaozhi.modules.voiceclone.entity.VoiceCloneEntity;

/**
 * Voice cloning
 */
@Mapper
public interface VoiceCloneDao extends BaseMapper<VoiceCloneEntity> {
    /**
     * Get list of successfully trained voice timbres for user
     * 
     * @param modelId ModelID
     * @param userId  User ID
     * @return List of successfully trained voice timbres
     */
    List<VoiceDTO> getTrainSuccess(String modelId, Long userId);

}
