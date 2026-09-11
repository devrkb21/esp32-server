package xiaozhi.modules.sys.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import org.apache.ibatis.annotations.Param;
import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.sys.entity.SysDictDataEntity;
import xiaozhi.modules.sys.vo.SysDictDataItem;

/**
 * Dictionary data
 */
@Mapper
public interface SysDictDataDao extends BaseDao<SysDictDataEntity> {

    List<SysDictDataItem> getDictDataByType(String dictType);

    /**
     * According toDictionary typeIDGetDictionary typeCode
     * 
     * @param dictTypeId Dictionary typeID
     * @return Dictionary typeCode
     */
    String getTypeByTypeId(Long dictTypeId);

    /**
     * According to dictionary dataIDCollection retrievalDictionary typeCode collection
     */
    List<String> getDictTypesByIdList(@Param("dictDataIdList") List<Long> dictDataIdList);
}
