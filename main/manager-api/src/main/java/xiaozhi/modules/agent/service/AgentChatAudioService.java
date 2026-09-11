package xiaozhi.modules.agent.service;

import com.baomidou.mybatisplus.extension.repository.IRepository;

import xiaozhi.modules.agent.entity.AgentChatAudioEntity;

/**
 * Agent chat audio data table handlingservice
 *
 * @author Goody
 * @version 1.0, 2025/5/8
 * @since 1.0.0
 */
public interface AgentChatAudioService extends IRepository<AgentChatAudioEntity> {
    /**
     * SaveAudioData
     *
     * @param audioData AudioData
     * @return AudioID
     */
    String saveAudio(byte[] audioData);

    /**
     * GetAudioData
     *
     * @param audioId AudioID
     * @return AudioData
     */
    byte[] getAudio(String audioId);
}
