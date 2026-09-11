package xiaozhi.modules.model.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.model.dto.LlmModelBasicInfoDTO;
import xiaozhi.modules.model.dto.ModelBasicInfoDTO;
import xiaozhi.modules.model.dto.ModelConfigBodyDTO;
import xiaozhi.modules.model.dto.ModelConfigDTO;
import xiaozhi.modules.model.entity.ModelConfigEntity;

public interface ModelConfigService extends BaseService<ModelConfigEntity> {

    List<ModelBasicInfoDTO> getModelCodeList(String modelType, String modelName);

    List<LlmModelBasicInfoDTO> getLlmModelCodeList(String modelName);

    PageData<ModelConfigDTO> getPageList(String modelType, String modelName, String page, String limit);

    ModelConfigDTO add(String modelType, String provideCode, ModelConfigBodyDTO modelConfigBodyDTO);

    ModelConfigDTO edit(String modelType, String provideCode, String id, ModelConfigBodyDTO modelConfigBodyDTO);

    void delete(String id);

    /**
     * According toIDGetModel name
     * 
     * @param id ModelID
     * @return Model name
     */
    String getModelNameById(String id);

    /**
     * According toIDGetModel configuration
     * 
     * @param id ModelID
     * @return Model configurationEntity
     */
    ModelConfigEntity getModelByIdFromCache(String id);

    /**
     * SetDefault model
     *
     * @param modelType Model type
     * @param isDefault WhetherDefault（1:is，0:no）
     */
    void setDefaultModel(String modelType, int isDefault);

    /**
     * GetMatchConditionTTSPlatformList
     *
     * @return TTSPlatformList(idandmodelName)
     */
    List<Map<String, Object>> getTtsPlatformList();

    /**
     * Get all enabled model configurations by model type
     *
     * @param modelType Model type（e.g., LLM, TTS, ASRetc）
     * @return List of enabled model configurations
     */
    List<ModelConfigEntity> getEnabledModelsByType(String modelType);
}
