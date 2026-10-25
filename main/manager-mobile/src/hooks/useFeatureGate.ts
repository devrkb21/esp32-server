import { computed } from 'vue'
import { hasFeature, loadRobots } from '@/utils/tbRobot'

/**
 * The central guard of the feature pages (Day, Look, Messages, Robot, Character, Voiceprints):
 * when the chosen robot's product lacks `feature`, the page shows <tb-not-here /> instead of its
 * content and makes no calls the device cannot answer. Use it first in the page's onShow:
 *   const gate = useFeatureGate('day')
 *   onShow(async () => { if (!(await gate.allowed())) return; ... })
 */
export function useFeatureGate(feature: string) {
  const missing = computed(() => !hasFeature(feature))
  async function allowed() {
    await loadRobots()
    return !missing.value
  }
  return { missing, allowed }
}
