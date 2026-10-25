import { toast } from '@/kit/toast'
import smCrypto from 'sm-crypto'
import router from '../router'
import Constant from '../utils/constant'

/**
 * Check if user is logged in
 */
export function checkUserLogin(fn) {
    let token = localStorage.getItem(Constant.STORAGE_KEY.TOKEN)
    let userType = localStorage.getItem(Constant.STORAGE_KEY.USER_TYPE)
    if (isNull(token) || isNull(userType)) {
        goToPage('console', true)
        return
    }
    if (fn) {
        fn()
    }
}

/**
 * Check if empty
 * @param data
 * @returns {boolean}
 */
export function isNull(data) {
    if (data === undefined) {
        return true
    } else if (data === null) {
        return true
    } else if (typeof data === 'string' && (data.length === 0 || data === '' || data === 'undefined' || data === 'null')) {
        return true
    } else if ((data instanceof Array) && data.length === 0) {
        return true
    }
    return false
}

/**
 * Check if not empty
 * @param data
 * @returns {boolean}
 */
export function isNotNull(data) {
    return !isNull(data)
}

/**
 * Show top red notification
 * @param msg
 */
export function showDanger(msg) {
    if (isNull(msg)) {
        return
    }
    toast.error(msg)
}

/**
 * Show top orange notification
 * @param msg
 */
export function showWarning(msg) {
    if (isNull(msg)) {
        return
    }
    toast.warning(msg)
}



/**
 * Show top green notification
 * @param msg
 */
export function showSuccess(msg) {
    toast.success(msg)
}



/**
 * Page navigation
 * @param path
 * @param isRepalce
 */
export function goToPage(path, isRepalce) {
    if (isRepalce) {
        router.replace(path)
    } else {
        router.push(path)
    }
}

/**
 * Get current Vue page name
 * @param path
 * @param isRepalce
 */
export function getCurrentPage() {
    let hash = location.hash.replace('#', '')
    if (hash.indexOf('?') > 0) {
        hash = hash.substring(0, hash.indexOf('?'))
    }
    return hash
}

/**
 * Generate random number in [min, max]
 * @param min
 * @param max
 * @returns {number}
 */
export function randomNum(min, max) {
    return Math.round(Math.random() * (max - min) + min)
}


/**
 * Get UUID
 */
export function getUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        return (c === 'x' ? (Math.random() * 16 | 0) : ('r&0x3' | '0x8')).toString(16)
    })
}


// A Bangladeshi mobile number as the server stores it after +880: 1[3-9] and eight more digits.
const BD_MOBILE = /^1[3-9]\d{8}$/;

// Only the digits of what was typed; Bangla digits (০-৯) count as digits.
function mobileDigits(mobile) {
    return String(mobile || '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09E6)).replace(/\D/g, '');
}

// The digits of a Bangladeshi mobile without the local leading 0 or a typed 880 prefix
// ('01712345678', '+8801712345678' and '1712345678' all give '1712345678').
function bdLocal(digits) {
    if (/^8801[3-9]\d{8}$/.test(digits)) return digits.slice(3);
    if (/^01[3-9]\d{8}$/.test(digits)) return digits.slice(1);
    return digits;
}

/**
 * Validate a mobile number for the chosen country code.
 * Bangladesh (+880) is the rule: a mobile number is 1[3-9] and eight more digits, typed as
 * 1712345678, with the local leading zero as 01712345678, or in full as +8801712345678.
 * Any other country code only gets a plain length check (5 to 15 digits).
 * @param {string} mobile Phone number as typed
 * @param {string} areaCode Country code, e.g. '+880'
 * @returns {boolean}
 */
export function validateMobile(mobile, areaCode) {
    const cleanMobile = mobileDigits(mobile);
    if (areaCode === '+880') return BD_MOBILE.test(bdLocal(cleanMobile));
    return /^\d{5,15}$/.test(cleanMobile);
}

/**
 * The number the server receives: country code + digits, without the Bangladeshi local 0
 * ('+880', '01712345678' -> '+8801712345678').
 * @param {string} areaCode Country code, e.g. '+880'
 * @param {string} mobile Phone number as typed
 * @returns {string}
 */
export function fullMobile(areaCode, mobile) {
    let digits = mobileDigits(mobile);
    if (areaCode === '+880') digits = bdLocal(digits);
    return `${areaCode || ''}${digits}`;
}


/**
 * Generate SM2 keypair (hex format)
 * @returns {Object} Object containing public and private keys
 */
export function generateSm2KeyPairHex() {
    // Generate SM2 keypair using sm-crypto
    const sm2 = smCrypto.sm2;
    const keypair = sm2.generateKeyPairHex();
    
    return {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        clientPublicKey: keypair.publicKey, // Client public key
        clientPrivateKey: keypair.privateKey // Client private key
    };
}

/**
 * SM2 public key encryption
 * @param {string} publicKey Public key (hex format)
 * @param {string} plainText Plaintext
 * @returns {string} Encrypted ciphertext (hex format)
 */
export function sm2Encrypt(publicKey, plainText) {
    if (!publicKey) {
        throw new Error('Public key cannot be null or undefined');
    }
    
    if (!plainText) {
        throw new Error('Plaintext cannot be empty');
    }
    
    const sm2 = smCrypto.sm2;
    // SM2 encrypt, add 04 prefix for uncompressed public key
    const encrypted = sm2.doEncrypt(plainText, publicKey, 1);
    // Convert to hex format (match backend, add 04 prefix)
    const result = "04" + encrypted;
    
    return result;
}

/**
 * SM2 private key decryption
 * @param {string} privateKey Private key (hex format)
 * @param {string} cipherText Ciphertext (hex format)
 * @returns {string} Decrypted plaintext
 */
export function sm2Decrypt(privateKey, cipherText) {
    const sm2 = smCrypto.sm2;
    // Remove 04 prefix (match backend)
    const dataWithoutPrefix = cipherText.startsWith("04") ? cipherText.substring(2) : cipherText;
    // SM2 decrypt
    return sm2.doDecrypt(dataWithoutPrefix, privateKey, 1);
}

/**
 * Debounce function
 * @param {Function} fn Function to debounce
 * @param {number} delay Delay time in ms, default 500ms
 * @param {boolean} immediate Whether to execute immediately, default false
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 500, immediate = false) {
    let timer = null;
    
    return function (...args) {
        const context = this;
        
        if (timer) {
            clearTimeout(timer);
        }
        
        if (immediate && !timer) {
            fn.apply(context, args);
        }
        
        timer = setTimeout(() => {
            if (!immediate) {
                fn.apply(context, args);
            }
            timer = null;
        }, delay);
    };
}

