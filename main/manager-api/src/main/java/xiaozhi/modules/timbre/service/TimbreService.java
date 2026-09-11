package xiaozhi.modules.timbre.service;

import java.util.List;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.model.dto.VoiceDTO;
import xiaozhi.modules.timbre.dto.TimbreDataDTO;
import xiaozhi.modules.timbre.dto.TimbrePageDTO;
import xiaozhi.modules.timbre.entity.TimbreEntity;
import xiaozhi.modules.timbre.vo.TimbreDetailsVO;

/**
 * Voice timbre business layer definition
 * 
 * @author zjy
 * @since 2025-3-21
 */
public interface TimbreService extends BaseService<TimbreEntity> {
    /**
     * PaginationGet voice timbreSpecifyttsunderVoice timbre
     * 
     * @param dto PaginationFind parameter
     * @return Voice timbre list pagination data
     */
    PageData<TimbreDetailsVO> page(TimbrePageDTO dto);

    /**
     * Get voice timbreSpecifyidDetailsInformation
     * 
     * @param timbreId Voice timbretableid
     * @return Voice timbreInformation
     */
    TimbreDetailsVO get(String timbreId);

    /**
     * SaveVoice timbreInformation
     * 
     * @param dto NeedneedSaveData
     */
    void save(TimbreDataDTO dto);

    /**
     * SaveVoice timbreInformation
     * 
     * @param timbreId NeedneedUpdateid
     * @param dto      NeedneedUpdateData
     */
    void update(String timbreId, TimbreDataDTO dto);

    /**
     * Batch deleteVoice timbre
     * 
     * @param ids Voice timbre to be deletedidList
     */
    void delete(String[] ids);

    List<VoiceDTO> getVoiceNames(String ttsModelId, String voiceName);

    /**
     * Get the first valid language of standard timbre or cloned timbre configuration。
     *
     * @param id Voice timbreID
     * @return Default language；Returned when voice timbre does not exist or has no valid language configurednull
     */
    String getDefaultLanguageById(String id);

    /**
     * According toIDGet voice timbreName
     * 
     * @param id Voice timbreID
     * @return Voice timbre name
     */
    String getTimbreNameById(String id);

    /**
     * Get voice timbre info by timbre code
     * 
     * @param ttsModelId Voice timbreModelID
     * @param voiceCode  Voice timbre code
     * @return Voice timbreInformation
     */
    VoiceDTO getByVoiceCode(String ttsModelId, String voiceCode);
}
