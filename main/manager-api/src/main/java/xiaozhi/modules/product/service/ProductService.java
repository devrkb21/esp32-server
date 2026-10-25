package xiaozhi.modules.product.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.product.dto.ProductDTO;
import xiaozhi.modules.product.entity.ProductEntity;
import xiaozhi.modules.product.vo.ProductListVO;
import xiaozhi.modules.product.vo.ProductVO;

/**
 * Product catalog: which Nobix product a device is, and which features it has.
 */
public interface ProductService extends BaseService<ProductEntity> {

    /** Key of the fallback product that matches every board ('*'). It cannot be deleted. */
    String GENERIC_KEY = "generic";

    /** Sys param holding the product key used for devices that have not reported a board yet. */
    String DEFAULT_KEY_PARAM = "product.default_key";

    /** Feature key of the TinyBot companion module (day, alarms, prayer, look, messages, ...). */
    String FEATURE_COMPANION = "companion";

    /**
     * Resolves the product for a board type. Exact patterns win over prefix patterns ("x-*",
     * longest prefix first), which win over '*'; ties go to the lower sort value. A null/blank
     * board resolves to the product named by sys param {@value #DEFAULT_KEY_PARAM}. Only enabled
     * products are considered. Never returns null: falls back to the generic product.
     */
    ProductVO resolve(String board);

    /** Whether the product resolved from this board has the feature. */
    boolean hasFeature(String board, String feature);

    /** Throws RenException(DEVICE_FEATURE_NOT_SUPPORTED) when the board's product lacks the feature. */
    void requireFeature(String board, String feature);

    /** Enabled products, ordered by sort. */
    List<ProductListVO> listEnabled();

    PageData<ProductVO> page(Map<String, Object> params);

    void save(ProductDTO dto);

    void update(ProductDTO dto);

    void delete(Long[] ids);

    /** Drops the in-memory cache of enabled products. */
    void invalidateCache();
}
