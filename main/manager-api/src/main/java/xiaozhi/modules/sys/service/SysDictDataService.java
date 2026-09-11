package xiaozhi.modules.sys.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.sys.dto.SysDictDataDTO;
import xiaozhi.modules.sys.entity.SysDictDataEntity;
import xiaozhi.modules.sys.vo.SysDictDataItem;
import xiaozhi.modules.sys.vo.SysDictDataVO;

/**
 * Data dictionary
 */
public interface SysDictDataService extends BaseService<SysDictDataEntity> {

    /**
     * Pagination queryData dictionaryInformation
     *
     * @param params QueryParameter，ContainPaginationInformationandQueryCondition
     * @return Returns pagination query results for data dictionary
     */
    PageData<SysDictDataVO> page(Map<String, Object> params);

    /**
     * According toIDGetData dictionaryEntity
     *
     * @param id Data dictionaryUnique identifier of entity
     * @return Returns detailed information of data dictionary entity
     */
    SysDictDataVO get(Long id);

    /**
     * SaveNewData dictionary item
     *
     * @param dto Data transfer object for saving data dictionary items
     */
    void save(SysDictDataDTO dto);

    /**
     * UpdateData dictionary item
     *
     * @param dto Data transfer object for updating data dictionary items
     */
    void update(SysDictDataDTO dto);

    /**
     * DeleteData dictionary item
     *
     * @param ids needDeleteData dictionary itemIDArray
     */
    void delete(Long[] ids);

    /**
     * According toDictionary typeIDDeleteCorresponding dictionary data
     *
     * @param dictTypeId Dictionary typeID
     */
    void deleteByTypeId(Long dictTypeId);

    /**
     * Get dictionary data list according to dictionary type
     *
     * @param dictType Dictionary type
     * @return Returns dictionary dataList
     */
    List<SysDictDataItem> getDictDataByType(String dictType);

}