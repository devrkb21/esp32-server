package xiaozhi.modules.sms.service.imp;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.constant.Constant;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.redis.RedisKeys;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.modules.sms.service.SmsService;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Verification codes through REVE SMS (Bangladesh), POST {base_url}/sendtext with a JSON body.
 * The API key, secret and sender ID are system params (reve.sms.*), never in code.
 * REVE answers {"Status":"0","Text":"ACCEPTD","Message_ID":"..."}; any other Status is a failure.
 */
@Service
@AllArgsConstructor
@Slf4j
public class ReveSmsService implements SmsService {
    private static final int TIMEOUT_MS = 15000;

    private final SysParamsService sysParamsService;
    private final RedisUtils redisUtils;

    @Override
    public void sendVerificationCodeSms(String phone, String verificationCode) {
        String baseUrl = param(Constant.SysMSMParam.REVE_SMS_BASE_URL);
        String apiKey = param(Constant.SysMSMParam.REVE_SMS_API_KEY);
        String secretKey = param(Constant.SysMSMParam.REVE_SMS_SECRET_KEY);
        String callerId = param(Constant.SysMSMParam.REVE_SMS_CALLER_ID);
        String template = param(Constant.SysMSMParam.REVE_SMS_CODE_MESSAGE);
        if (StringUtils.isAnyBlank(baseUrl, apiKey, secretKey, callerId)) {
            log.error("REVE SMS is not configured: set reve.sms.base_url, api_key, secret_key and caller_id");
            refund(phone);
            throw new RenException(ErrorCode.SMS_CONNECTION_FAILED);
        }
        if (StringUtils.isBlank(template)) {
            template = "Your TinyBot verification code is {code}. Do not share it with anyone.";
        }

        JSONObject body = JSONUtil.createObj()
                .set("apikey", apiKey)
                .set("secretkey", secretKey)
                .set("callerID", callerId)
                .set("toUser", toReveNumber(phone))
                .set("messageContent", template.replace("{code}", verificationCode));
        try (HttpResponse res = HttpRequest.post(StringUtils.removeEnd(baseUrl.trim(), "/") + "/sendtext")
                .body(body.toString(), "application/json")
                .timeout(TIMEOUT_MS)
                .execute()) {
            String text = res.body();
            JSONObject json = JSONUtil.isTypeJSONObject(text) ? JSONUtil.parseObj(text) : null;
            String status = json == null ? null : json.getStr("Status");
            if (!res.isOk() || !"0".equals(status)) {
                // Log the gateway's answer, never the request (it carries the keys)
                log.error("REVE SMS rejected: http {} status {} text {}", res.getStatus(), status,
                        json == null ? StringUtils.abbreviate(text, 200) : json.getStr("Text"));
                refund(phone);
                throw new RenException(ErrorCode.SMS_SEND_FAILED);
            }
            log.info("REVE SMS accepted, message id {}", json.getStr("Message_ID"));
        } catch (RenException e) {
            throw e;
        } catch (Exception e) {
            log.error("REVE SMS request failed: {}", e.getMessage());
            refund(phone);
            throw new RenException(ErrorCode.SMS_CONNECTION_FAILED);
        }
    }

    /** REVE takes Bangladeshi numbers as 8801XXXXXXXXX (no plus). */
    static String toReveNumber(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("\\D", "");
        if (digits.startsWith("880")) {
            return digits;
        }
        if (digits.startsWith("01")) {
            return "88" + digits;
        }
        if (digits.startsWith("1") && digits.length() == 10) {
            return "880" + digits;
        }
        return digits;
    }

    private String param(Constant.SysMSMParam p) {
        return sysParamsService.getValue(p.getValue(), true);
    }

    /** A failed send does not count against today's limit. */
    private void refund(String phone) {
        redisUtils.delete(RedisKeys.getSMSTodayCountKey(phone));
    }
}
