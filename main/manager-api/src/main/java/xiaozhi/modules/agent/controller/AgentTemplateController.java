package xiaozhi.modules.agent.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import xiaozhi.common.constant.Constant;
import xiaozhi.common.page.PageData;
import xiaozhi.common.utils.ConvertUtils;
import xiaozhi.common.utils.Result;
import xiaozhi.common.utils.ResultUtils;
import xiaozhi.modules.agent.entity.AgentTemplateEntity;
import xiaozhi.modules.agent.service.AgentTemplateService;
import xiaozhi.modules.agent.vo.AgentTemplateVO;

@Tag(name = "Agent template management")
@AllArgsConstructor
@RestController
@RequestMapping("/agent/template")
public class AgentTemplateController {
    
    private final AgentTemplateService agentTemplateService;
    
    @GetMapping("/page")
    @Operation(summary = "GetTemplatePaginationList")
    @RequiresPermissions("sys:role:superAdmin")
    @Parameters({
            @Parameter(name = Constant.PAGE, description = "Current page number，from1Start", required = true),
            @Parameter(name = Constant.LIMIT, description = "Records per page", required = true),
            @Parameter(name = "agentName", description = "TemplateName，FuzzyQuery")
    })
    public Result<PageData<AgentTemplateVO>> getAgentTemplatesPage(
            @Parameter(hidden = true) @RequestParam Map<String, Object> params) {
        
        // CreatePagination object
        int page = Integer.parseInt(params.getOrDefault(Constant.PAGE, "1").toString());
        int limit = Integer.parseInt(params.getOrDefault(Constant.LIMIT, "10").toString());
        Page<AgentTemplateEntity> pageInfo = new Page<>(page, limit);
        
        // CreateQueryCondition
        QueryWrapper<AgentTemplateEntity> wrapper = new QueryWrapper<>();
        String agentName = (String) params.get("agentName");
        if (agentName != null && !agentName.isEmpty()) {
            wrapper.like("agent_name", agentName);
        }
        wrapper.orderByAsc("sort");
        
        // ExecutePagination query
        IPage<AgentTemplateEntity> pageResult = agentTemplateService.page(pageInfo, wrapper);
        
        // UseConvertUtilsConvertasVOList
        List<AgentTemplateVO> voList = ConvertUtils.sourceToTarget(pageResult.getRecords(), AgentTemplateVO.class);

        // Fix：UseConstructorCreatePageDataObject，andnotisNo-arg constructor+setter
        PageData<AgentTemplateVO> pageData = new PageData<>(voList, pageResult.getTotal());

        return new Result<PageData<AgentTemplateVO>>().ok(pageData);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "GetTemplateDetails")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<AgentTemplateVO> getAgentTemplateById(@PathVariable("id") String id) {
        AgentTemplateEntity template = agentTemplateService.getById(id);
        if (template == null) {
            return ResultUtils.error("TemplateDoes not exist");
        }
        
        // UseConvertUtilsConvertasVO
        AgentTemplateVO vo = ConvertUtils.sourceToTarget(template, AgentTemplateVO.class);
        
        return ResultUtils.success(vo);
    }
    
    @PostMapping
    @Operation(summary = "CreateTemplate")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<AgentTemplateEntity> createAgentTemplate(@Valid @RequestBody AgentTemplateEntity template) {
        // Set sort value to the next available sequence number
        template.setSort(agentTemplateService.getNextAvailableSort());
        
        boolean saved = agentTemplateService.save(template);
        if (saved) {
            return ResultUtils.success(template);
        } else {
            return ResultUtils.error("CreateTemplateFail");
        }
    }
    
    @PutMapping
    @Operation(summary = "UpdateTemplate")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<AgentTemplateEntity> updateAgentTemplate(@Valid @RequestBody AgentTemplateEntity template) {
        boolean updated = agentTemplateService.updateById(template);
        if (updated) {
            return ResultUtils.success(template);
        } else {
            return ResultUtils.error("UpdateTemplateFail");
        }
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "DeleteTemplate")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<String> deleteAgentTemplate(@PathVariable("id") String id) {
        // Query template information to be deleted first，GetitsSortValue
        AgentTemplateEntity template = agentTemplateService.getById(id);
        if (template == null) {
            return ResultUtils.error("TemplateDoes not exist");
        }
        
        Integer deletedSort = template.getSort();
        
        // ExecuteDeleteOperation
        boolean deleted = agentTemplateService.removeById(id);
        if (deleted) {
            // DeleteSuccessafter，reNewSortRemainingTemplate
            agentTemplateService.reorderTemplatesAfterDelete(deletedSort);
            return ResultUtils.success("DeleteTemplateSuccess");
        } else {
            return ResultUtils.error("DeleteTemplateFail");
        }
    }
    
    
    // AddNewBatch deletepartymethod，UsenotsameURL
    @PostMapping("/batch-remove")
    @Operation(summary = "Batch deleteTemplate")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<String> batchRemoveAgentTemplates(@RequestBody List<String> ids) {
        boolean deleted = agentTemplateService.removeByIds(ids);
        if (deleted) {
            return ResultUtils.success("Batch deleteSuccess");
        } else {
            return ResultUtils.error("Batch deleteTemplateFail");
        }
    }
}