import { http } from '@/http/request/alova'

// Family sharing (manager-api module `family`): a robot's owner shares it with other accounts as
// a member or a co-owner. Shapes: docs of the FAMILY wave (GET /family/robots etc.).
export type FamilyRole = 'owner' | 'co_owner' | 'member'

/** A robot shared with me (accepted). */
export interface SharedRobot {
  shareId: string
  deviceId: string
  agentId: string
  agentName: string
  alias: string
  macAddress: string
  board: string
  appVersion?: string
  productKey?: string
  productName?: string
  productNameBn?: string
  features?: string[]
  lastConnectedAtTimestamp?: number | null
  role: 'member' | 'co_owner'
  ownerName: string
}

export interface FamilyMember {
  id: string
  userId: string
  name: string
  role: 'member' | 'co_owner'
  status: 'pending' | 'accepted'
  createdAt: number
  respondedAt: number | null
}

export interface FamilyOfDevice {
  role: FamilyRole
  canShare: boolean
  ownerName: string
  members: FamilyMember[]
}

export interface FamilyInvite {
  id: string
  deviceId: string
  robotName: string
  productKey?: string
  productName?: string
  productNameBn?: string
  ownerName: string
  role: 'member' | 'co_owner'
  createdAt: number
}

const quiet = { meta: { ignoreAuth: false, toast: false }, cacheFor: { expire: 0 } }

/** Robots other accounts shared with me. */
export function getSharedRobots() {
  return http.Get<SharedRobot[]>('/family/robots', quiet)
}

/** The people of one robot (pending invites and accepted members) and my role on it. */
export function getFamily(deviceId: string) {
  return http.Get<FamilyOfDevice>(`/family/device/${deviceId}`, quiet)
}

/** Invite an account by username or phone. */
export function inviteToFamily(deviceId: string, target: string, role: 'member' | 'co_owner') {
  return http.Post<FamilyMember>(`/family/device/${deviceId}/invite`, { target, role })
}

/** Change a member's role (owner only). */
export function setFamilyRole(shareId: string, role: 'member' | 'co_owner') {
  return http.Put(`/family/share/${shareId}`, { role })
}

/** Remove a member, cancel an invite, or leave a shared robot (my own share). */
export function removeFamilyShare(shareId: string) {
  return http.Delete(`/family/share/${shareId}`)
}

/** Invitations sent to me that wait for an answer. */
export function getInvites() {
  return http.Get<FamilyInvite[]>('/family/invites', quiet)
}

export function acceptInvite(id: string) {
  return http.Post(`/family/invites/${id}/accept`, {})
}

export function declineInvite(id: string) {
  return http.Post(`/family/invites/${id}/decline`, {})
}
