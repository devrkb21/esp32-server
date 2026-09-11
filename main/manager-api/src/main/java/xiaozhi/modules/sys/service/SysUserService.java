package xiaozhi.modules.sys.service;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.sys.dto.AdminPageUserDTO;
import xiaozhi.modules.sys.dto.PasswordDTO;
import xiaozhi.modules.sys.dto.SysUserDTO;
import xiaozhi.modules.sys.entity.SysUserEntity;
import xiaozhi.modules.sys.vo.AdminPageUserVO;

/**
 * System user
 */
public interface SysUserService extends BaseService<SysUserEntity> {

    SysUserDTO getByUsername(String username);

    SysUserDTO getByUserId(Long userId);

    void save(SysUserDTO dto);

    /**
     * DeleteSpecified user，and has associated data devices and agents
     * 
     * @param ids
     */
    void deleteById(Long ids);

    /**
     * Verify whether allowedChange passwordChange
     * 
     * @param userId      Userid
     * @param passwordDTO VerifyPasswordparameters of
     */
    void changePassword(Long userId, PasswordDTO passwordDTO);

    /**
     * DirectlyChange password，No verification needed
     * 
     * @param userId   Userid
     * @param password Password
     */
    void changePasswordDirectly(Long userId, String password);

    /**
     * Reset password
     * 
     * @param userId Userid
     * @return Randomly generate compliantPassword
     */
    String resetPassword(Long userId);

    /**
     * AdministratorPaginationUser information
     * 
     * @param dto PaginationFind parameter
     * @return User listPagination data
     */
    PageData<AdminPageUserVO> page(AdminPageUserDTO dto);

    /**
     * BatchUpdateUserStatus
     * 
     * @param status  UserStatus
     * @param userIds User IDArray
     */
    void changeStatus(Integer status, String[] userIds);

    /**
     * GetWhether to allow user registration
     * 
     * @return Whether to allow user registration
     */
    boolean getAllowUserRegister();
}
