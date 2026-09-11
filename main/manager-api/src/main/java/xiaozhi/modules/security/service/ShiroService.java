package xiaozhi.modules.security.service;

import xiaozhi.modules.security.entity.SysUserTokenEntity;
import xiaozhi.modules.sys.entity.SysUserEntity;

/**
 * shiroRelated interfaces
 * Copyright (c) Renren Open Source. All rights reserved.
 * Website: https://www.renren.io
 */
public interface ShiroService {

    SysUserTokenEntity getByToken(String token);

    /**
     * According toUser ID，QueryUser
     *
     * @param userId
     */
    SysUserEntity getUser(Long userId);

}
