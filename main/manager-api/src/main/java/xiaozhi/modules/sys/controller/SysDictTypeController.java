package xiaozhi.modules.sys.controller;

import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.constant.Constant;
import xiaozhi.common.page.PageData;
import xiaozhi.common.utils.Result;
import xiaozhi.common.validator.ValidatorUtils;
import xiaozhi.modules.sys.dto.SysDictTypeDTO;
import xiaozhi.modules.sys.service.SysDictTypeService;
import xiaozhi.modules.sys.vo.SysDictTypeVO;

/**
 * Dictionary typeManagement
 *
 * @author czc
 * @since 2025-04-30
 */
@AllArgsConstructor
@RestController
@RequestMapping("/admin/dict/type")
@Tag(name = "Dictionary typeManagement")
public class SysDictTypeController {
    private final SysDictTypeService sysDictTypeService;

    @GetMapping("/page")
    @Operation(summary = "Pagination queryDictionary type")
    @RequiresPermissions("sys:role:superAdmin")
    @Parameters({ @Parameter(name = "dictType", description = "Dictionary typeCode"),
            @Parameter(name = "dictName", description = "Dictionary typeName"),
            @Parameter(name = Constant.PAGE, description = "Current page number，from1Start", required = true),
            @Parameter(name = Constant.LIMIT, description = "Records per page", required = true) })
    public Result<PageData<SysDictTypeVO>> page(@Parameter(hidden = true) @RequestParam Map<String, Object> params) {
        ValidatorUtils.validateEntity(params);
        PageData<SysDictTypeVO> page = sysDictTypeService.page(params);
        return new Result<PageData<SysDictTypeVO>>().ok(page);
    }

    @GetMapping("/{id}")
    @Operation(summary = "GetDictionary typeDetails")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<SysDictTypeVO> get(@PathVariable("id") Long id) {
        SysDictTypeVO vo = sysDictTypeService.get(id);
        return new Result<SysDictTypeVO>().ok(vo);
    }

    @PostMapping("/save")
    @Operation(summary = "SaveDictionary type")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> save(@RequestBody SysDictTypeDTO dto) {
        // Parameter validation
        ValidatorUtils.validateEntity(dto);

        sysDictTypeService.save(dto);
        return new Result<>();
    }

    @PutMapping("/update")
    @Operation(summary = "UpdateDictionary type")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> update(@RequestBody SysDictTypeDTO dto) {
        // Parameter validation
        ValidatorUtils.validateEntity(dto);

        sysDictTypeService.update(dto);
        return new Result<>();
    }

    @PostMapping("/delete")
    @Operation(summary = "DeleteDictionary type")
    @RequiresPermissions("sys:role:superAdmin")
    @Parameter(name = "ids", description = "IDArray", required = true)
    public Result<Void> delete(@RequestBody Long[] ids) {
        sysDictTypeService.delete(ids);
        return new Result<>();
    }
}
