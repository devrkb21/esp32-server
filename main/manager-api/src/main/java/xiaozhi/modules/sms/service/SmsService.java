package xiaozhi.modules.sms.service;

/**
 * Method definition interface for SMS service
 *
 * @author zjy
 * @since 2025-05-12
 */
public interface SmsService {

    /**
     * SendCaptchaSMS
     * @param phone Phone numberCode
     * @param VerificationCode Captcha
     */
    void sendVerificationCodeSms(String phone, String VerificationCode) ;
}
