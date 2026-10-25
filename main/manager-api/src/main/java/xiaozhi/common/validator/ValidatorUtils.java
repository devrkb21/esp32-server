package xiaozhi.common.validator;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.hibernate.validator.messageinterpolation.ResourceBundleMessageInterpolator;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.validation.beanvalidation.MessageSourceResourceBundleLocator;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import xiaozhi.common.exception.RenException;

/**
 * Hibernate-validator validation utility class
 * Reference document: http://docs.jboss.org/hibernate/validator/6.0/reference/en-US/html_single/
 */
public class ValidatorUtils {

    private static ResourceBundleMessageSource getMessageSource() {
        ResourceBundleMessageSource bundleMessageSource = new ResourceBundleMessageSource();
        bundleMessageSource.setDefaultEncoding("UTF-8");
        bundleMessageSource.setBasenames("i18n/validation");
        // Unknown locales fall back to the English base bundle
        bundleMessageSource.setFallbackToSystemLocale(false);
        return bundleMessageSource;
    }

    /**
     * Validate object
     *
     * @param object Object to validate
     * @param groups Groups to validate
     */
    public static void validateEntity(Object object, Class<?>... groups)
            throws RenException {
        Locale.setDefault(LocaleContextHolder.getLocale());
        Validator validator = Validation.byDefaultProvider().configure().messageInterpolator(
                new ResourceBundleMessageInterpolator(new MessageSourceResourceBundleLocator(getMessageSource())))
                .buildValidatorFactory().getValidator();

        Set<ConstraintViolation<Object>> constraintViolations = validator.validate(object, groups);
        if (!constraintViolations.isEmpty()) {
            ConstraintViolation<Object> constraint = constraintViolations.iterator().next();
            throw new RenException(constraint.getMessage());
        }
    }

    /**
     * Default country calling code (Bangladesh).
     */
    public static final String DEFAULT_AREA_CODE = "+880";

    /**
     * Bangladesh mobile number: +880 1[3-9] followed by 8 digits.
     * Also tolerates the same number without the plus (8801...) and the local
     * form without the area code (01...).
     * For example:
     * - +8801712345678
     * - 8801712345678
     * - 01712345678
     */
    private static final Pattern BANGLADESH_PHONE_PATTERN = Pattern.compile("^(?:\\+?880|0)1[3-9]\\d{8}$");

    /**
     * Generic international mobile number for other area codes from the
     * MOBILE_AREA dictionary: +[country_code][phone_number], e.g. +447123456789.
     */
    private static final Pattern INTERNATIONAL_PHONE_PATTERN = Pattern.compile("^\\+[1-9]\\d{0,3}[1-9]\\d{4,14}$");

    /**
     * Check if mobile phone number is valid.
     * Bangladesh (+880) is the default: +8801712345678, 8801712345678 and
     * 01712345678 are accepted. A number that starts with +880 must be a valid
     * Bangladeshi mobile number. Other countries are accepted in the generic
     * international format +[country_code][phone_number].
     *
     * @param phone Phone number
     * @return boolean
     */
    public static boolean isValidPhone(String phone) {
        if (phone == null || phone.isEmpty()) {
            return false;
        }

        if (BANGLADESH_PHONE_PATTERN.matcher(phone).matches()) {
            return true;
        }
        // A Bangladeshi number that failed the strict check above is invalid
        if (phone.startsWith(DEFAULT_AREA_CODE)) {
            return false;
        }
        return INTERNATIONAL_PHONE_PATTERN.matcher(phone).matches();
    }
}