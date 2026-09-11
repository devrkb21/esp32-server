package xiaozhi.modules.security.service;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Captcha
 * Copyright (c) Renren Open Source. All rights reserved.
 * Website: https://www.renren.io
 */
public interface CaptchaService {

    /**
     * ImageCaptcha
     */
    void create(HttpServletResponse response, String uuid) throws IOException;

    /**
     * CaptchaValidate
     * 
     * @param uuid   uuid
     * @param code   Captcha
     * @param delete WhetherDeleteCaptcha
     * @return true：Success false：Fail
     */
    boolean validate(String uuid, String code, Boolean delete);

    /**
     * Send SMSCaptcha
     * 
     * @param phone Mobile
     */
    void sendSMSValidateCode(String phone);

    /**
     * Verify SMSCaptcha
     * 
     * @param phone  Mobile
     * @param code   Captcha
     * @param delete WhetherDeleteCaptcha
     * @return true：Success false：Fail
     */
    boolean validateSMSValidateCode(String phone, String code, Boolean delete);
}
