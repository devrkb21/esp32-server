package xiaozhi.modules.notify.dao;

import org.apache.ibatis.annotations.Mapper;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.notify.entity.NotificationEntity;

@Mapper
public interface NotificationDao extends BaseDao<NotificationEntity> {
}
