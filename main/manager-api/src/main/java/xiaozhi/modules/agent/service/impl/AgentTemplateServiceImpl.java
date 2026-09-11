package xiaozhi.modules.agent.service.impl;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.spring.repository.CrudRepository;

import xiaozhi.modules.agent.dao.AgentTemplateDao;
import xiaozhi.modules.agent.entity.AgentTemplateEntity;
import xiaozhi.modules.agent.service.AgentTemplateService;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

/**
 * @author chenerlei
 * @description forfortable【ai_agent_template(Agent configurationTemplatetable)】DatalibOperationServiceImplement
 * @createDate 2025-03-22 11:48:18
 */
@Service
public class AgentTemplateServiceImpl extends CrudRepository<AgentTemplateDao, AgentTemplateEntity>
        implements AgentTemplateService {

    /**
     * GetDefaultTemplate
     * 
     * @return DefaultTemplateEntity
     */
    public AgentTemplateEntity getDefaultTemplate() {
        LambdaQueryWrapper<AgentTemplateEntity> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(AgentTemplateEntity::getSort)
                .last("LIMIT 1");
        return this.getOne(wrapper);
    }

    /**
     * UpdateDefaultTemplateinModelID
     * 
     * @param modelType Model type
     * @param modelId   ModelID
     */
    @Override
    public void updateDefaultTemplateModelId(String modelType, String modelId) {
        modelType = modelType.toUpperCase();
        // If it isragModel，No needneedUpdate
        if (modelType.equals("RAG")) {
            return;
        }

        UpdateWrapper<AgentTemplateEntity> wrapper = new UpdateWrapper<>();
        switch (modelType) {
            case "ASR":
                wrapper.set("asr_model_id", modelId);
                break;
            case "VAD":
                wrapper.set("vad_model_id", modelId);
                break;
            case "LLM":
                wrapper.set("llm_model_id", modelId);
                break;
            case "TTS":
                wrapper.set("tts_model_id", modelId);
                wrapper.set("tts_voice_id", null);
                break;
            case "VLLM":
                wrapper.set("vllm_model_id", modelId);
                break;
            case "MEMORY":
                wrapper.set("mem_model_id", modelId);
                break;
            case "INTENT":
                wrapper.set("intent_model_id", modelId);
                break;
        }
        wrapper.ge("sort", 0);
        update(wrapper);
    }

    @Override
    public void reorderTemplatesAfterDelete(Integer deletedSort) {
        if (deletedSort == null) {
            return;
        }
        
        // Query all records with sort value greater than deleted template
        UpdateWrapper<AgentTemplateEntity> updateWrapper = new UpdateWrapper<>();
        updateWrapper.gt("sort", deletedSort)
                    .setSql("sort = sort - 1");
        
        // ExecuteBatchUpdate，TheseRecordSortValuereduce1
        this.update(updateWrapper);
    }

    @Override
    public Integer getNextAvailableSort() {
        // Query all existing sort values and sort ascending
        List<Integer> sortValues = baseMapper.selectList(new QueryWrapper<AgentTemplateEntity>())
                .stream()
                .map(AgentTemplateEntity::getSort)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
        
        // IfnohasSortValue，Return1
        if (sortValues.isEmpty()) {
            return 1;
        }
        
        // Find minimumnotUseSequence
        int expectedSort = 1;
        for (Integer sort : sortValues) {
            if (sort > expectedSort) {
                // FoundemptylackSequence
                return expectedSort;
            }
            expectedSort = sort + 1;
        }
        
        // Ifnohasemptylack，ReturnMaximumSequence+1
        return expectedSort;
    }
}
