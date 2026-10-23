package xiaozhi.modules.security.service;

import xiaozhi.common.page.TokenDTO;
import xiaozhi.common.service.BaseService;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.security.entity.SysUserTokenEntity;
import xiaozhi.modules.sys.dto.PasswordDTO;
import xiaozhi.modules.sys.dto.SysUserDTO;

/**
 * UserToken
 * Copyright (c) Renren Open Source. All rights reserved.
 * Website: https://www.renren.io
 */
public interface SysUserTokenService extends BaseService<SysUserTokenEntity> {

    /**
     * Generatetoken
     *
     * @param userId User ID
     */
    Result<TokenDTO> createToken(Long userId);

    /**
     * 用旧token换新token，旧token立即失效
     *
     * @param oldToken 旧token字符串
     */
    Result<TokenDTO> refreshToken(String oldToken);

    SysUserDTO getUserByToken(String token);

    /**
     * Exit
     *
     * @param userId User ID
     */
    void logout(Long userId);

    /**
     * Change password
     *
     * @param userId
     * @param passwordDTO
     */
    void changePassword(Long userId, PasswordDTO passwordDTO);

}