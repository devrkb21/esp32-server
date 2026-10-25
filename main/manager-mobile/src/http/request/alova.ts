import type { uniappRequestAdapter } from '@alova/adapter-uniapp'
import type { IResponse } from './types'
import type { Language } from '@/store/lang'
import AdapterUniapp from '@alova/adapter-uniapp'
import { createAlova } from 'alova'
import { createServerTokenAuthentication } from 'alova/client'
import VueHook from 'alova/vue'
import { DEMO, demoRequestAdapter } from '@/api/demo'
import { t } from '@/i18n'
import { normalizeLanguage } from '@/store/lang'
import { getEnvBaseUrl } from '@/utils'
import { safePagePath } from '@/utils/linkCode.mjs'
import { toast } from '@/utils/toast'
import { ContentTypeEnum, ResultEnum } from './enum'
import { httpStatusKey, networkErrorKey, requestErrorMessage } from './errorText.mjs'

// Language mapping for Accept-Language header
const langMap: Record<Language, string> = {
  bn: 'bn-BD',
  en: 'en-US',
}

/**
 * Every error this layer shows is one plain line in the app's language (errorText.mjs); the raw
 * server or transport text goes to the console only. A thrown error carries `shown: true` when it
 * was toasted here, so screens do not toast it again (src/utils/requestError.ts).
 */
function markShown(err: any) {
  try {
    if (err && typeof err === 'object')
      err.shown = true
  }
  catch {}
  return err
}

/** A business error (HTTP 200, code not 0): the message keeps the "Request error [code]: msg" form. */
function businessError(code: number | string, msg: string) {
  const err: any = new Error(`Request error [${code}]: ${msg}`)
  err.code = Number(code)
  err.serverMsg = msg
  return err
}

let lastNetworkToastAt = 0

/**
 * The sign-in page, remembering the page the owner was on (e.g. the robot link page with its
 * code) so signing in leads back there. Only pages of this app are kept.
 */
function loginWithReturn(): string {
  try {
    const pages = getCurrentPages()
    const page: any = pages[pages.length - 1]
    if (page && page.route) {
      const query = Object.entries(page.options || {}).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
      const back = safePagePath(`/${page.route}${query ? `?${query}` : ''}`)
      if (back)
        return `/pages/login/index?redirect=${encodeURIComponent(back)}`
    }
  }
  catch {}
  return '/pages/login/index'
}

/**
 * Create request instance
 */
const { onAuthRequired, onResponseRefreshToken } = createServerTokenAuthentication<
  typeof VueHook,
  typeof uniappRequestAdapter
>({
  refreshTokenOnError: {
    isExpired: (error) => {
      return error.response?.status === ResultEnum.Unauthorized
    },
    handler: async () => {
      try {
        // await authLogin();
      }
      catch (error) {
        // Navigate to login page
        await uni.reLaunch({ url: '/pages/login/index' })
        throw error
      }
    },
  },
})

/**
 * alova request instance
 */
const alovaInstance = createAlova({
  baseURL: getEnvBaseUrl(),
  ...AdapterUniapp(),
  // Demo build: answered from src/api/demo fixtures, never the network
  ...(DEMO ? { requestAdapter: demoRequestAdapter as any } : {}),
  // Slow mobile networks and cold server starts need more than a few seconds
  timeout: 15000,
  statesHook: VueHook,

  beforeRequest: onAuthRequired((method) => {
    // Dynamically get latest baseURL for H5
    const currentBaseUrl = getEnvBaseUrl()
    if (currentBaseUrl !== method.baseURL) {
      method.baseURL = currentBaseUrl
    }

    // Check mixed content error (HTTPS page requesting HTTP API)
    const currentProtocol = typeof window !== 'undefined' && window.location.protocol
    const requestProtocol = method.baseURL?.split(':')[0]
    const currentLang = langMap[normalizeLanguage(uni.getStorageSync('app_language'))]
    if (currentProtocol === 'https:' && requestProtocol === 'http') {
      const errorMessage = t('network.mixedContent')
      toast.error(errorMessage)
      throw markShown(new Error(errorMessage))
    }

    // Set default Content-Type
    method.config.headers = {
      'Content-Type': ContentTypeEnum.JSON,
      'Accept': 'application/json, text/plain, */*',
      'Accept-language': currentLang,
      ...method.config.headers,
    }

    const { config } = method
    const ignoreAuth = config.meta?.ignoreAuth

    // Handle authentication info
    if (!ignoreAuth) {
      const authInfo = JSON.parse(uni.getStorageSync('token') || '{}')
      if (!authInfo.token) {
        // Navigate to login page
        uni.reLaunch({ url: loginWithReturn() })
        throw new Error('[Request error]: Not logged in')
      }
      // Add Authorization header
      method.config.headers.Authorization = `Bearer ${authInfo.token}`
    }

    // Handle dynamic domain
    if (config.meta?.domain) {
      method.baseURL = config.meta.domain
      console.log('Current domain', method.baseURL)
    }
  }),

  responded: onResponseRefreshToken({
    onSuccess: (response, method) => {
      const { config } = method
      const { requestType } = config
      const {
        statusCode,
        data: rawData,
        errMsg,
      } = response as UniNamespace.RequestSuccessCallbackResult

      // Handle special request types (upload/download)
      if (requestType === 'upload' || requestType === 'download') {
        return response
      }

      // The session ended (HTTP 401 or code 401): sign in again, then come back to this page
      const body = (rawData && typeof rawData === 'object' ? rawData : {}) as IResponse
      if (statusCode === ResultEnum.Unauthorized || (statusCode === 200 && Number(body.code) === ResultEnum.Unauthorized)) {
        console.warn('[Request] session ended', method.url, body.msg || errMsg)
        uni.removeStorageSync('token')
        toast.info(t('request.sessionEnded'))
        uni.reLaunch({ url: loginWithReturn() })
        throw markShown(businessError(ResultEnum.Unauthorized, String(body.msg || 'Unauthorized')))
      }

      // HTTP status errors: a plain line for the status, the raw text to the console only
      if (statusCode !== 200) {
        console.error(`[Request] HTTP ${statusCode}`, method.url, errMsg, rawData)
        const err: any = new Error(`HTTP request error [${statusCode}]`)
        err.status = statusCode
        if (config.meta?.toast !== false) {
          toast.error(t(httpStatusKey(statusCode)))
          markShown(err)
        }
        throw err
      }

      // Handle business logic errors
      const { code, msg, data } = body
      if (code !== ResultEnum.Success) {
        if (config.meta?.isExposeError) {
          return Promise.reject(msg)
        }

        console.warn(`[Request] code ${code}`, method.url, msg)
        const err = businessError(code, String(msg ?? ''))
        if (config.meta?.toast !== false) {
          // the server's own words only when they are meant for people, else a plain line
          const said = requestErrorMessage(err, 'request.failed')
          toast.warning(said.text || t(said.key || 'request.failed'))
          markShown(err)
        }
        throw err
      }
      // Successful response, return business data
      return data
    },
    // No HTTP response at all: offline, wrong server address, server down, timeout
    onError: (error, method) => {
      const key = networkErrorKey(error)
      const now = Date.now()
      console.error('[Request failed]', method.url, error)
      if (key && method.config.meta?.toast !== false) {
        // One toast per burst: a page firing several requests at once shows it once
        if (now - lastNetworkToastAt > 3000) {
          lastNetworkToastAt = now
          toast.error(t(key))
        }
        markShown(error)
      }
      throw error
    },
  }),
})

export const http = alovaInstance
