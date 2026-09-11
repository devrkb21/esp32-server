package xiaozhi.modules.sys.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.sys.dto.SysParamsDTO;
import xiaozhi.modules.sys.entity.SysParamsEntity;

/**
 * Parameter management
 */
public interface SysParamsService extends BaseService<SysParamsEntity> {

    PageData<SysParamsDTO> page(Map<String, Object> params);

    List<SysParamsDTO> list(Map<String, Object> params);

    SysParamsDTO get(Long id);

    void save(SysParamsDTO dto);

    void update(SysParamsDTO dto);

    void delete(String[] ids);

    /**
     * According to parameter code，Get parameter'svalueValue
     *
     * @param paramCode Parameter code
     * @param fromCache Whether to obtain from cache
     */
    String getValue(String paramCode, Boolean fromCache);

    /**
     * According to parameter code，GetvalueObjectObject
     *
     * @param paramCode Parameter code
     * @param clazz     ObjectObject
     */
    <T> T getValueObject(String paramCode, Class<T> clazz);

    /**
     * According to parameter code，Updatevalue
     *
     * @param paramCode  Parameter code
     * @param paramValue Parameter value
     */
    int updateValueByCode(String paramCode, String paramValue);

    /**
     * InitializeServer secret key
     */
    void initServerSecret();

    /**
     * GetSystem function menu configuration
     *
     * @param fromCache Whether to get from cache
     * @return System function menu configurationJSONString
     */
    String getSystemWebMenu(boolean fromCache);

    /**
     * UpdateSystem function menu configuration（Automatically handles cleanup of feature-related plugins）
     *
     * @param configJson NewSystem function menu configurationJSON
     */
    void updateSystemWebMenu(String configJson);
}
