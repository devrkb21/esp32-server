package xiaozhi.modules.security.service.impl;

import java.io.IOException;
import java.time.Duration;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.wf.captcha.SpecCaptcha;
import com.wf.captcha.base.Captcha;

import cn.hutool.core.util.RandomUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import xiaozhi.common.constant.Constant;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.redis.RedisKeys;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.modules.security.service.CaptchaService;
import xiaozhi.modules.sms.service.SmsService;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Captcha
 */
@Service
public class CaptchaServiceImpl implements CaptchaService {
    @Resource
    private RedisUtils redisUtils;
    @Resource
    private SmsService smsService;
    @Resource
    private SysParamsService sysParamsService;
    @Value("${renren.redis.open}")
    private boolean open;
    /**
     * Local Cache 5minutes to expire
     */
    Cache<String, String> localCache = CacheBuilder.newBuilder().maximumSize(1000)
            .expireAfterAccess(Duration.ofMinutes(5)).build();

    @Override
    public void create(HttpServletResponse response, String uuid) throws IOException {
        response.setContentType("image/gif");
        response.setHeader("Pragma", "No-cache");
        response.setHeader("Cache-Control", "no-cache");
        response.setDateHeader("Expires", 0);

        // GenerateCaptcha
        SpecCaptcha captcha = new SpecCaptcha(150, 40);
        captcha.setLen(5);
        captcha.setCharType(Captcha.TYPE_DEFAULT);
        captcha.out(response.getOutputStream());

        // Saveto cache
        setCache(uuid, captcha.text());
    }

    @Override
    public boolean validate(String uuid, String code, Boolean delete) {
        if (StringUtils.isBlank(code)) {
            return false;
        }
        // GetCaptcha
        String captcha = getCache(uuid, delete);

        // ValidateSuccess
        if (code.equalsIgnoreCase(captcha)) {
            return true;
        }

        return false;
    }

    @Override
    public void sendSMSValidateCode(String phone) {
        // Check sending interval
        String lastSendTimeKey = RedisKeys.getSMSLastSendTimeKey(phone);
        // Check whether sent，If last send time is not set（60s）
        String lastSendTime = redisUtils
                .getKeyOrCreate(lastSendTimeKey,
                        String.valueOf(System.currentTimeMillis()), 60L);
        if (lastSendTime != null) {
            long lastSendTimeLong = Long.parseLong(lastSendTime);
            long currentTime = System.currentTimeMillis();
            long timeDiff = currentTime - lastSendTimeLong;
            if (timeDiff < 60000) {
                throw new RenException(ErrorCode.SMS_SEND_TOO_FREQUENTLY, String.valueOf((60000 - timeDiff) / 1000));
            }
        }

        // Check today's send count
        String todayCountKey = RedisKeys.getSMSTodayCountKey(phone);
        Integer todayCount = (Integer) redisUtils.get(todayCountKey);
        if (todayCount == null) {
            todayCount = 0;
        }

        // Get maximum send count limit
        Integer maxSendCount = sysParamsService.getValueObject(
                Constant.SysMSMParam.SERVER_SMS_MAX_SEND_COUNT.getValue(),
                Integer.class);
        if (maxSendCount == null) {
            maxSendCount = 5; // Default value
        }

        if (todayCount >= maxSendCount) {
            throw new RenException(ErrorCode.TODAY_SMS_LIMIT_REACHED);
        }

        String key = RedisKeys.getSMSValidateCodeKey(phone);
        String validateCodes = RandomUtil.randomNumbers(6);

        // SetCaptcha
        setCache(key, validateCodes);

        // Update today's send count
        if (todayCount == 0) {
            redisUtils.increment(todayCountKey, RedisUtils.DEFAULT_EXPIRE);
        } else {
            redisUtils.increment(todayCountKey);
        }

        // SendCaptchaSMS
        smsService.sendVerificationCodeSms(phone, validateCodes);
    }

    @Override
    public boolean validateSMSValidateCode(String phone, String code, Boolean delete) {
        String key = RedisKeys.getSMSValidateCodeKey(phone);
        return validate(key, code, delete);
    }

    private void setCache(String key, String value) {
        if (open) {
            key = RedisKeys.getCaptchaKey(key);
            // Set5minutes to expire
            redisUtils.set(key, value, 300);
        } else {
            localCache.put(key, value);
        }
    }

    private String getCache(String key, Boolean delete) {
        if (open) {
            key = RedisKeys.getCaptchaKey(key);
            String captcha = (String) redisUtils.get(key);
            // DeleteCaptcha
            if (captcha != null && delete) {
                redisUtils.delete(key);
            }

            return captcha;
        }

        String captcha = localCache.getIfPresent(key);
        // DeleteCaptcha
        if (captcha != null) {
            localCache.invalidate(key);
        }
        return captcha;
    }
}
