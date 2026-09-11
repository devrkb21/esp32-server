package xiaozhi.modules.sys.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.sys.dto.SysDictTypeDTO;
import xiaozhi.modules.sys.entity.SysDictTypeEntity;
import xiaozhi.modules.sys.vo.SysDictTypeVO;

/**
 * Data dictionary
 */
public interface SysDictTypeService extends BaseService<SysDictTypeEntity> {

    /**
     * Pagination queryDictionary typeInformation
     *
     * @param params QueryParameter，ContainPaginationInformationandQueryCondition
     * @return ReturnPaginationDictionary typeData
     */
    PageData<SysDictTypeVO> page(Map<String, Object> params);

    /**
     * According toIDGetDictionary typeInformation
     *
     * @param id Dictionary typeID
     * @return ReturnDictionary typeObject
     */
    SysDictTypeVO get(Long id);

    /**
     * SaveDictionary typeInformation
     *
     * @param dto Dictionary typeData transfer object
     */
    void save(SysDictTypeDTO dto);

    /**
     * UpdateDictionary typeInformation
     *
     * @param dto Dictionary typeData transfer object
     */
    void update(SysDictTypeDTO dto);

    /**
     * DeleteDictionary typeInformation
     *
     * @param ids needDeleteDictionary typeIDArray
     */
    void delete(Long[] ids);

    /**
     * List allDictionary typeInformation
     *
     * @return ReturnDictionary typeList
     */
    List<SysDictTypeVO> list(Map<String, Object> params);
}