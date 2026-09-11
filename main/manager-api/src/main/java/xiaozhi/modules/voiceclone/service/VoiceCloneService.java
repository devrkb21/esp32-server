package xiaozhi.modules.voiceclone.service;

import java.util.List;
import java.util.Map;

import org.springframework.web.multipart.MultipartFile;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.voiceclone.dto.VoiceCloneDTO;
import xiaozhi.modules.voiceclone.dto.VoiceCloneResponseDTO;
import xiaozhi.modules.voiceclone.entity.VoiceCloneEntity;

/**
 * Voice clone management
 */
public interface VoiceCloneService extends BaseService<VoiceCloneEntity> {

    /**
     * Pagination query
     */
    PageData<VoiceCloneEntity> page(Map<String, Object> params);

    /**
     * SaveVoice cloning
     */
    void save(VoiceCloneDTO dto);

    /**
     * Batch delete
     */
    void delete(String[] ids);

    /**
     * According toUser IDQuery voice clone list
     * 
     * @param userId User ID
     * @return Voice cloningList
     */
    List<VoiceCloneEntity> getByUserId(Long userId);

    /**
     * Paginate query voice cloning list with model names and user names
     */
    PageData<VoiceCloneResponseDTO> pageWithNames(Map<String, Object> params);

    /**
     * According toIDQuery voice cloning information with model name and user name
     */
    VoiceCloneResponseDTO getByIdWithNames(String id);

    /**
     * According toUser IDQuery voice clone list with model names
     */
    List<VoiceCloneResponseDTO> getByUserIdWithNames(Long userId);

    /**
     * Upload audio file
     */
    void uploadVoice(String id, MultipartFile voiceFile) throws Exception;

    /**
     * Update voice clone name
     */
    void updateName(String id, String name);

    /**
     * GetAudioData
     */
    byte[] getVoiceData(String id);

    /**
     * Cloned audio，Call Volcengine for voice replication training
     * 
     * @param cloneId Voice clone recordID
     */
    void cloneAudio(String cloneId);
}
