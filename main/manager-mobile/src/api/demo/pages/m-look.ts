import type { DemoHandler } from '../index'
import { createCanvas, createLiveliness, paintToContext, renderActivityFrame } from '../../../pages/companion/faceLook.mjs'
import { onPage } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Look (owner: m-look). The live screen asks the robot for its OLED through the device tool
// self.screen.preview (POST /device/tools/call/{deviceId}); the demo answers with a frame drawn by
// the same face simulation the page uses: TinyBot reading its newspaper (the demo robot's activity),
// as a base64 JPEG like the firmware's {width, height, jpeg}. Scoped to the Look page.
// The companion view and the config PUT come from zz-base.ts.
const frame = createCanvas()
const started = Date.now()
const live = createLiveliness(Math.random, started)
let paper: any = null

function screenFrame() {
  try {
    if (typeof document === 'undefined')
      return undefined
    if (!paper) {
      paper = document.createElement('canvas')
      paper.width = 128
      paper.height = 64
    }
    const ctx = paper.getContext('2d')
    if (!ctx)
      return undefined
    const now = Date.now()
    renderActivityFrame(DEMO_COMPANION.stats.activity, DEMO_COMPANION.settings.look, now - started, live, now, frame)
    paintToContext(ctx, frame, 1, 'white', 'black')
    const jpeg = String(paper.toDataURL('image/jpeg', 0.9)).replace(/^data:image\/jpeg;base64,/, '')
    return { width: 128, height: 64, jpeg }
  }
  catch {
    return undefined
  }
}

function toolName(data: any) {
  try {
    return (typeof data === 'string' ? JSON.parse(data) : data)?.name
  }
  catch {
    return undefined
  }
}

const handlers: DemoHandler[] = [
  { method: 'POST', url: onPage('/pages/look/', /\/device\/tools\/call\/[^/]+$/), reply: (req: any) => (toolName(req?.data) === 'self.screen.preview' ? screenFrame() : undefined) },
]

export default handlers
