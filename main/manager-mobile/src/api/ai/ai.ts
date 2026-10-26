import { http } from '@/http/request/alova'

// AI wave: kids mode of a character and the owner's daily LLM quota (manager-api modules kids, usage).

export interface KidsSettings {
  enabled: boolean
  /** 3 to 12 */
  age: number
  blockedTopics: string[]
}

export interface QuotaToday {
  date: string
  /** 0: no limit */
  limit: number
  used: number
  remaining: number | null
  exceeded: boolean
  /** chats the robot stopped today because the limit was reached */
  blocked: number
}

/** Kids mode of a character */
export function getKids(agentId: string) {
  return http.Get<KidsSettings>(`/agent/${encodeURIComponent(agentId)}/kids`, {
    meta: { ignoreAuth: false, toast: false },
    cacheFor: { expire: 0 },
  })
}

/** Save kids mode of a character (answers what was stored) */
export function saveKids(agentId: string, data: KidsSettings) {
  return http.Put<KidsSettings>(`/agent/${encodeURIComponent(agentId)}/kids`, data)
}

/** The signed-in owner's LLM requests today against the daily limit */
export function getQuota() {
  return http.Get<QuotaToday>('/usage/quota', {
    meta: { ignoreAuth: false, toast: false },
    cacheFor: { expire: 0 },
  })
}
