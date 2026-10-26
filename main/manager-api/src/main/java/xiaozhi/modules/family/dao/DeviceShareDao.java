package xiaozhi.modules.family.dao;

import org.apache.ibatis.annotations.Mapper;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.family.entity.DeviceShareEntity;

/**
 * Family sharing rows (ai_device_share)
 */
@Mapper
public interface DeviceShareDao extends BaseDao<DeviceShareEntity> {
}
