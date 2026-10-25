package xiaozhi.modules.product.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
import xiaozhi.common.validator.group.AddGroup;
import xiaozhi.common.validator.group.DefaultGroup;
import xiaozhi.common.validator.group.UpdateGroup;
import xiaozhi.modules.product.dto.ProductDTO;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.product.vo.ProductListVO;
import xiaozhi.modules.product.vo.ProductVO;

/**
 * Product catalog (TinyBot and future Nobix products)
 */
@AllArgsConstructor
@RestController
@RequestMapping("/product")
@Tag(name = "Product catalog")
public class ProductController {
    private final ProductService productService;

    @GetMapping("/list")
    @Operation(summary = "Enabled products (key, names, icon, features)")
    @RequiresPermissions("sys:role:normal")
    public Result<List<ProductListVO>> list() {
        return new Result<List<ProductListVO>>().ok(productService.listEnabled());
    }

    @GetMapping("/page")
    @Operation(summary = "Page products (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    @Parameters({ @Parameter(name = "keywords", description = "Matches key or names"),
            @Parameter(name = Constant.PAGE, description = "Current page number, from 1", required = true),
            @Parameter(name = Constant.LIMIT, description = "Records per page", required = true) })
    public Result<PageData<ProductVO>> page(@Parameter(hidden = true) @RequestParam Map<String, Object> params) {
        ValidatorUtils.validateEntity(params);
        return new Result<PageData<ProductVO>>().ok(productService.page(params));
    }

    @PostMapping
    @Operation(summary = "Create product (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> save(@RequestBody ProductDTO dto) {
        ValidatorUtils.validateEntity(dto, AddGroup.class, DefaultGroup.class);
        productService.save(dto);
        return new Result<>();
    }

    @PutMapping
    @Operation(summary = "Update product (admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Void> update(@RequestBody ProductDTO dto) {
        ValidatorUtils.validateEntity(dto, UpdateGroup.class, DefaultGroup.class);
        productService.update(dto);
        return new Result<>();
    }

    @DeleteMapping
    @Operation(summary = "Delete products (admin); the generic product cannot be deleted")
    @RequiresPermissions("sys:role:superAdmin")
    @Parameter(name = "ids", description = "ID array", required = true)
    public Result<Void> delete(@RequestBody Long[] ids) {
        productService.delete(ids);
        return new Result<>();
    }
}
