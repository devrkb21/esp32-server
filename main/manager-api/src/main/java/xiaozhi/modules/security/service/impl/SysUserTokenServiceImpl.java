package xiaozhi.modules.security.service.impl;

import java.util.Date;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import cn.hutool.core.date.DateUtil;
import lombok.AllArgsConstructor;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.page.TokenDTO;
import xiaozhi.common.service.impl.BaseServiceImpl;
import xiaozhi.common.utils.HttpContextUtils;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.security.dao.SysUserTokenDao;
import xiaozhi.modules.security.entity.SysUserTokenEntity;
import xiaozhi.modules.security.oauth2.TokenGenerator;
import xiaozhi.modules.security.service.SysUserTokenService;
import xiaozhi.modules.sys.dto.PasswordDTO;
import xiaozhi.modules.sys.dto.SysUserDTO;
import xiaozhi.modules.sys.service.SysUserService;

@AllArgsConstructor
@Service
public class SysUserTokenServiceImpl extends BaseServiceImpl<SysUserTokenDao, SysUserTokenEntity>
        implements SysUserTokenService {

    private final SysUserService sysUserService;
    /**
     * 12hours until expiration
     */
    private final static int EXPIRE = 3600 * 12;

    @Override
    public Result<TokenDTO> createToken(Long userId) {
        // Usertoken
        String token;

        // Current time
        Date now = new Date();
        // Expiration time
        Date expireTime = new Date(now.getTime() + EXPIRE * 1000);

        // Check whether generatedtoken
        SysUserTokenEntity tokenEntity = baseDao.getByUserId(userId);
        if (tokenEntity == null) {
            // Generate atoken
            token = TokenGenerator.generateValue();

            tokenEntity = new SysUserTokenEntity();
            tokenEntity.setUserId(userId);
            tokenEntity.setToken(token);
            tokenEntity.setUpdateDate(now);
            tokenEntity.setExpireDate(expireTime);

            // Savetoken
            this.insert(tokenEntity);
        } else {
            // DeterminetokenWhether expired
            if (tokenEntity.getExpireDate().getTime() < System.currentTimeMillis()) {
                // tokenExpired，Regeneratetoken
                token = TokenGenerator.generateValue();
            } else {
                token = tokenEntity.getToken();
            }

            tokenEntity.setToken(token);
            tokenEntity.setUpdateDate(now);
            tokenEntity.setExpireDate(expireTime);

            // Updatetoken
            this.updateById(tokenEntity);
        }

        String clientHash = HttpContextUtils.getClientCode();

        TokenDTO tokenDTO = new TokenDTO();
        tokenDTO.setToken(token);
        tokenDTO.setExpire(EXPIRE);
        tokenDTO.setClientHash(clientHash);
        return new Result<TokenDTO>().ok(tokenDTO);
    }

    @Override
    @Transactional
    public Result<TokenDTO> refreshToken(String oldToken) {
        if (StringUtils.isBlank(oldToken)) {
            throw new RenException(ErrorCode.UNAUTHORIZED);
        }
        SysUserTokenEntity tokenEntity = baseDao.getByToken(oldToken);
        if (tokenEntity == null) {
            throw new RenException(ErrorCode.TOKEN_INVALID);
        }
        if (tokenEntity.getExpireDate().before(new Date())) {
            throw new RenException(ErrorCode.UNAUTHORIZED);
        }

        // CAS 更新：并发场景下只有一个请求能匹配到该 oldToken，另一个返 0 行
        String newToken = TokenGenerator.generateValue();
        Date now = new Date();
        Date expireTime = new Date(now.getTime() + EXPIRE * 1000L);
        int affected = baseDao.refreshTokenCAS(tokenEntity.getUserId(), oldToken, newToken, expireTime, now);
        if (affected == 0) {
            throw new RenException(ErrorCode.TOKEN_INVALID);
        }

        TokenDTO dto = new TokenDTO();
        dto.setToken(newToken);
        dto.setExpire(EXPIRE);
        dto.setClientHash(HttpContextUtils.getClientCode());
        return new Result<TokenDTO>().ok(dto);
    }

    @Override
    public SysUserDTO getUserByToken(String token) {
        SysUserTokenEntity userToken = baseDao.getByToken(token);
        if (null == userToken) {
            throw new RenException(ErrorCode.TOKEN_INVALID);
        }

        Date now = new Date();
        if (userToken.getExpireDate().before(now)) {
            throw new RenException(ErrorCode.UNAUTHORIZED);
        }

        SysUserDTO userDTO = sysUserService.getByUserId(userToken.getUserId());
        userDTO.setPassword("");
        return userDTO;
    }

    @Override
    public void logout(Long userId) {
        Date expireDate = DateUtil.offsetMinute(new Date(), -1);
        baseDao.logout(userId, expireDate);
    }

    @Override
    public void changePassword(Long userId, PasswordDTO passwordDTO) {
        // Change password
        sysUserService.changePassword(userId, passwordDTO);

        // make token Invalidate，requires re-login afterwards
        Date expireDate = DateUtil.offsetMinute(new Date(), -1);
        baseDao.logout(userId, expireDate);
    }
}