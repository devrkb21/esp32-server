import { http } from '@/http/request/alova'

/** One enabled product of the catalog (GET /product/list). */
export interface ProductListItem {
  productKey: string
  nameEn: string
  nameBn?: string | null
  iconUrl?: string | null
  features: string[]
  sort: number
}

/**
 * The enabled products (TinyBot and other Nobix devices) with the features each one has.
 * Quiet: a missing catalog falls back to TinyBot on the client.
 */
export function getProductList() {
  return http.Get<ProductListItem[]>('/product/list', {
    meta: {
      ignoreAuth: false,
      toast: false,
    },
    cacheFor: {
      expire: 0,
    },
  })
}
