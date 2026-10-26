package xiaozhi.modules.calendar.dao;

import org.apache.ibatis.annotations.Mapper;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.calendar.entity.CalendarDayEntity;

/**
 * Admin list of dated special days
 */
@Mapper
public interface CalendarDayDao extends BaseDao<CalendarDayEntity> {

}
