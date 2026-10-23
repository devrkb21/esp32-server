import Fly from 'flyio/dist/npm/fly';
import store from '../store/index';
import Constant from '../utils/constant';
import { getServiceUrl } from '../apis/api';
import { goToPage, isNotNull, showDanger, showWarning } from '../utils/index';
import i18n from '../i18n/index';

const fly = new Fly()
// Set timeout
fly.config.timeout = 30000

// 独立 fly 实例给 silent refresh 用，避免任何回调链回到 sendRequest
const refreshFly = new Fly()
refreshFly.config.timeout = 30000

// silent refresh：剩 1h 触发换 token，单飞锁避免并发
const REFRESH_AHEAD_MS = 60 * 60 * 1000
let refreshPromise = null

function getTokenExpireAt() {
    // 与 persistTokenExpireAt 同源读 localStorage（store 走的是 state.token 缓存，
    // 刚写入 localStorage 后再走 store 拿不到补写的 _localStoredAt）
    const raw = localStorage.getItem('token')
    if (!raw) return 0
    try {
        const parsed = JSON.parse(raw)
        if (!parsed || !parsed.expire) return 0
        // login.vue 写入 store 时是 setToken(now)，token 对象里没有 createdAt；
        // 用 _localStoredAt 作为本地落地时间基准
        return (parsed._localStoredAt || 0) + parsed.expire * 1000
    } catch (e) {
        return 0
    }
}

// 首次见到该 token 时记下落地时间；同步刷新 localStorage 与 store，保证两端一致
function persistTokenExpireAt() {
    const raw = localStorage.getItem('token')
    if (!raw) return
    try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.expire && !parsed._localStoredAt) {
            parsed._localStoredAt = Date.now()
            const next = JSON.stringify(parsed)
            localStorage.setItem('token', next)
            store.commit('setToken', next)
        }
    } catch (e) { /* ignore */ }
}

function shouldRefresh() {
    persistTokenExpireAt()
    const exp = getTokenExpireAt()
    if (!exp) return false
    return exp - Date.now() < REFRESH_AHEAD_MS
}

function doRefresh() {
    // 直接走 fly.request，绕过 sendRequest，避免死循环触发 silent refresh
    const raw = localStorage.getItem('token')
    if (!raw) return Promise.reject(new Error('no token'))
    let bearer
    try {
        bearer = JSON.parse(raw).token
    } catch (e) {
        return Promise.reject(e)
    }
    return refreshFly.request(getServiceUrl() + '/user/refresh', {}, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + bearer }
    }).then((res) => {
        const body = res && res.data
        if (!body || (body.code !== 0 && body.code !== 'success')) {
            throw new Error('refresh failed: ' + (body && body.msg))
        }
        const newDto = body.data
        newDto._localStoredAt = Date.now()
        store.commit('setToken', JSON.stringify(newDto))
        return newDto
    })
}

function triggerSilentRefresh() {
    if (!refreshPromise) {
        refreshPromise = doRefresh().catch((err) => {
            store.commit('clearAuth')
            goToPage(Constant.PAGE.LOGIN, true)
            throw err
        }).finally(() => {
            refreshPromise = null
        })
    }
    return refreshPromise
}

/**
 * Request service wrapper
 */
export default {
    sendRequest,
    reAjaxFun,
    clearRequestTime,
    triggerSilentRefresh
}

function sendRequest() {
    return {
        _sucCallback: null,
        _failCallback: null,
        _networkFailCallback: null,
        _method: 'GET',
        _data: {},
        _header: { 'content-type': 'application/json; charset=utf-8' },
        _url: '',
        _responseType: undefined, // Added response type field
        'send'() {
            // Set language request header
            const currentLang = i18n.locale || 'en';
            // Convert language code format, e.g. zh_CN to zh-CN
            let acceptLanguage = currentLang.replace('_', '-');
            // Add default locale code for English
            if (acceptLanguage === 'en') {
                acceptLanguage = 'en-US';
            }
            this._header['Accept-Language'] = acceptLanguage;

            const doSend = () => {
                if (isNotNull(store.getters.getToken)) {
                    this._header.Authorization = 'Bearer ' + (JSON.parse(store.getters.getToken)).token
                }

                // 打印请求信息
                fly.request(this._url, this._data, {
                    method: this._method,
                    headers: this._header,
                    responseType: this._responseType
                }).then((res) => {
                    const error = httpHandlerError(res, this._failCallback, this._networkFailCallback);
                    if (error) {
                        return
                    }

                    if (this._sucCallback) {
                        this._sucCallback(res)
                    }
                }).catch((res) => {
                    // 打印失败响应
                    console.log('catch', res)
                    httpHandlerError(res, this._failCallback, this._networkFailCallback)
                })
            }

            // 剩 1h 内过期就先 silent refresh 再发，确保请求带新 token
            if (shouldRefresh()) {
                triggerSilentRefresh().then(doSend).catch(() => {
                    // 触发 refresh 后被拦截跳登录，这里什么都不用做
                })
            } else {
                doSend()
            }
            return this
        },
        'success'(callback) {
            this._sucCallback = callback
            return this
        },
        'fail'(callback) {
            this._failCallback = callback
            return this
        },
        'networkFail'(callback) {
            this._networkFailCallback = callback
            return this
        },
        'url'(url) {
            if (url) {
                url = url.replaceAll('$', '/')
            }
            this._url = url
            return this
        },
        'data'(data) {
            this._data = data
            return this
        },
        'method'(method) {
            this._method = method
            return this
        },
        'header'(header) {
            this._header = header
            return this
        },
        'showLoading'(showLoading) {
            this._showLoading = showLoading
            return this
        },
        'async'(flag) {
            this.async = flag
        },
        // Added type setting method
        'type'(responseType) {
            this._responseType = responseType;
            return this;
        }
    }
}

/**
 * Info: returned info after request completes
 * failCallback: callback function
 * networkFailCallback: callback function
 */
// Error handling function
function httpHandlerError(info, failCallback, networkFailCallback) {

    /** Request successful, exit function when status is 200 */
    let networkError = false
    if (info.status === 200) {
        if (info.data.code === 'success' || info.data.code === 0 || info.data.code === undefined) {
            return networkError
        } else if (info.data.code === 401) {
            store.commit('clearAuth');
            goToPage(Constant.PAGE.LOGIN, true);
            return true
        } else {
            // Directly use i18n message returned by backend
            let errorMessage = info.data.msg;
            
            if (failCallback) {
                failCallback(info)
            } else {
                showDanger(errorMessage)
            }
            return true
        }
    }
    if (networkFailCallback) {
        networkFailCallback(info)
    } else {
        showDanger(`Network request error [${info.status}]`)
    }
    return true
}

let requestTime = 0
let reAjaxSec = 2

function reAjaxFun(fn) {
    let nowTimeSec = new Date().getTime() / 1000
    if (requestTime === 0) {
        requestTime = nowTimeSec
    }
    let ajaxIndex = parseInt((nowTimeSec - requestTime) / reAjaxSec)
    if (ajaxIndex > 10) {
        showWarning('Unable to connect to server')
    } else {
        showWarning('Connecting to server (' + ajaxIndex + ')')
    }
    if (ajaxIndex < 10 && fn) {
        setTimeout(() => {
            fn()
        }, reAjaxSec * 1000)
    }
}

function clearRequestTime() {
    requestTime = 0
}