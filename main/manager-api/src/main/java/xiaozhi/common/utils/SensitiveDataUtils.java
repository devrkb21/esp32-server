package xiaozhi.common.utils;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;

import cn.hutool.json.JSONObject;

/**
 * Sensitive data processing utility class
 */
public class SensitiveDataUtils {

    // Sensitive fields list
    private static final Set<String> SENSITIVE_FIELDS = new HashSet<>(Arrays.asList(
            "api_key", "personal_access_token", "access_token", "token",
            "secret", "access_key_secret", "secret_key"));

    /**
     * Check if field is a sensitive field
     */
    public static boolean isSensitiveField(String fieldName) {
        return StringUtils.isNotBlank(fieldName) && SENSITIVE_FIELDS.contains(fieldName.toLowerCase());
    }

    /**
     * Mask middle portion of string
     */
    public static String maskMiddle(String value) {
        if (StringUtils.isBlank(value) || value.length() == 1) {
            return value;
        }

        int length = value.length();
        if (length <= 8) {
            // Short string preserves first 2 and last 2 characters
            return value.substring(0, 2) + "****" + value.substring(length - 2);
        } else {
            // Long string preserves first 4 and last 4 characters
            int maskLength = length - 8;
            StringBuilder maskBuilder = new StringBuilder();
            for (int i = 0; i < maskLength; i++) {
                maskBuilder.append('*');
            }
            return value.substring(0, 4) + maskBuilder.toString() + value.substring(length - 4);
        }
    }

    /**
     * Determine whether the string is a masked value
     */
    public static boolean isMaskedValue(String value) {
        if (StringUtils.isBlank(value)) {
            return false;
        }
        // Masked value contains at least 4 consecutive *
        return value.contains("****");
    }

    /**
     * Handle sensitive fields in JSONObject
     */
    public static JSONObject maskSensitiveFields(JSONObject jsonObject) {
        if (jsonObject == null) {
            return null;
        }

        JSONObject result = new JSONObject();

        for (String key : jsonObject.keySet()) {
            Object value = jsonObject.get(key);

            if (SENSITIVE_FIELDS.contains(key.toLowerCase()) && value instanceof String) {
                result.set(key, maskMiddle((String) value));
            } else if (value instanceof JSONObject) {
                result.set(key, maskSensitiveFields((JSONObject) value));
            } else {
                result.set(key, value);
            }
        }

        return result;
    }

    /**
     * Compare sensitive fields between two JSONObjects
     * Compare sensitive fields like api_key individually
     */
    public static boolean isSensitiveDataEqual(JSONObject original, JSONObject updated) {
        if (original == null && updated == null) {
            return true;
        }
        if (original == null || updated == null) {
            return false;
        }

        // Extract and compare specific sensitive fields
        return compareSpecificSensitiveFields(original, updated, "api_key") &&
                compareSpecificSensitiveFields(original, updated, "personal_access_token") &&
                compareSpecificSensitiveFields(original, updated, "access_token") &&
                compareSpecificSensitiveFields(original, updated, "token") &&
                compareSpecificSensitiveFields(original, updated, "secret") &&
                compareSpecificSensitiveFields(original, updated, "access_key_secret") &&
                compareSpecificSensitiveFields(original, updated, "secret_key");
    }

    /**
     * Compare specific sensitive fields between two JSON objects
     * Traverse JSON object tree to find and compare sensitive fields
     */
    private static boolean compareSpecificSensitiveFields(JSONObject original, JSONObject updated, String fieldName) {
        // Extract specified sensitive fields from original object
        Map<String, String> originalFields = new HashMap<>();
        extractSpecificSensitiveField(original, originalFields, fieldName, "");

        // Extract specified sensitive fields from update object
        Map<String, String> updatedFields = new HashMap<>();
        extractSpecificSensitiveField(updated, updatedFields, fieldName, "");

        // If field counts differ，indicating additions or deletions
        if (originalFields.size() != updatedFields.size()) {
            return false;
        }

        // Compare values of each field
        for (Map.Entry<String, String> entry : originalFields.entrySet()) {
            String key = entry.getKey();
            String originalValue = entry.getValue();
            String updatedValue = updatedFields.get(key);

            if (updatedValue == null || !updatedValue.equals(originalValue)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Recursively extract specified sensitive fields from JSON object
     */
    private static void extractSpecificSensitiveField(JSONObject jsonObject, Map<String, String> fieldsMap,
            String targetFieldName, String parentPath) {
        if (jsonObject == null) {
            return;
        }

        for (String key : jsonObject.keySet()) {
            String fullPath = parentPath.isEmpty() ? key : parentPath + "." + key;
            Object value = jsonObject.get(key);

            if (value instanceof JSONObject) {
                // Recursively process nested JSON objects
                extractSpecificSensitiveField((JSONObject) value, fieldsMap, targetFieldName, fullPath);
            } else if (value instanceof String && key.equalsIgnoreCase(targetFieldName)) {
                // Find target sensitive field, save its path and value
                fieldsMap.put(fullPath, (String) value);
            }
        }
    }
}
