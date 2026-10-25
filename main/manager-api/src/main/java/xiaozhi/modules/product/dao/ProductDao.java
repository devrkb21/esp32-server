package xiaozhi.modules.product.dao;

import org.apache.ibatis.annotations.Mapper;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.product.entity.ProductEntity;

/**
 * Product catalog
 */
@Mapper
public interface ProductDao extends BaseDao<ProductEntity> {

}
