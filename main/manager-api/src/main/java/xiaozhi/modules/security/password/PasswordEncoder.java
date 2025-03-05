package xiaozhi.modules.security.***REDACTED***;

/**
 * Service interface for encoding ***REDACTED***s.
 * <p>
 * The preferred implementation is {@code BCryptPasswordEncoder}.
 *
 * @author Keith Donald
 */
public interface PasswordEncoder {

    /**
     * Encode the raw ***REDACTED***. Generally, a good encoding algorithm applies a SHA-1 or
     * greater hash combined with an 8-byte or greater randomly generated salt.
     */
    String encode(CharSequence rawPassword);

    /**
     * Verify the encoded ***REDACTED*** obtained from storage matches the submitted raw
     * ***REDACTED*** after it too is encoded. Returns true if the ***REDACTED***s match, false if
     * they do not. The stored ***REDACTED*** itself is never decoded.
     *
     * @param rawPassword     the raw ***REDACTED*** to encode and match
     * @param encodedPassword the encoded ***REDACTED*** from storage to compare with
     * @return true if the raw ***REDACTED***, after encoding, matches the encoded ***REDACTED*** from
     * storage
     */
    boolean matches(CharSequence rawPassword, String encodedPassword);

}
