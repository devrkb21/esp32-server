package xiaozhi.modules.summary.dao;

import org.apache.ibatis.annotations.Mapper;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.summary.entity.DailySummaryEntity;

@Mapper
public interface DailySummaryDao extends BaseDao<DailySummaryEntity> {
}
