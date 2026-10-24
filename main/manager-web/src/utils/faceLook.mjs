// TinyBot look: a pixel-exact port of the robot's face drawing, used for the live preview.
//
// Mirrors the firmware (xiaozhi-esp32 main/companion):
//   face_canvas.cc      FillRoundRect, FillEllipse, EllipseRing, Line on a 1-bit 128x64 buffer
//   face_animations.cc  DrawEye (Normal / ArcUp / ArcDown / Line / Ring / RingPupil), the kFxBlush
//                       overlay of DrawFx, DrawMouth, Render(pose, canvas, look) and the poses of
//                       IdleNeutral, IdleHappy, IdleSleepy, IdleSad, IdleAffectionate, EmoSurprised
//   living_face.cc      ApplyLiveliness (blink, gaze shift, breathing)
// and the settings.look contract of xiaozhi-server core/companion/schema.py.
//
// The same file lives in manager-web (src/utils/faceLook.mjs) and manager-mobile
// (src/pages/companion/faceLook.mjs). Keep the two copies identical.
//
// Pure functions only: no DOM, no Vue. Pose scaling uses Math.fround like the firmware's float
// maths; the primitives run in double precision, which can differ from the robot only for
// a pixel whose centre sits exactly on a shape edge.

export const W = 128
export const H = 64

const fr = Math.fround
const PI = 3.14159265
const TWO_PI = 2 * PI
const EYE_SCALE = fr(1.35)
const LEFT_X = 38
const RIGHT_X = 90
const EYE_Y = 30
const BOTTOM = H - 1

// ------------------------------------------------------------------------------ look settings

export const LOOK_CHOICES = Object.freeze({
  shape: ['rounded', 'round', 'square'],
  eyes: ['plain', 'shine', 'pupil'],
  mouth: ['none', 'smile', 'cat', 'dot'],
  blink: ['slow', 'normal', 'fast'],
  energy: ['calm', 'normal', 'playful'],
})

export const LOOK_RANGES = Object.freeze({
  size: [75, 125],
  spacing: [-10, 10],
  height: [-6, 6],
})

export const LOOK_KEYS = ['shape', 'size', 'spacing', 'height', 'eyes', 'mouth', 'blush', 'blink', 'energy']

/** The original face (schema.py default_look) */
export function defaultLook() {
  return {
    shape: 'rounded',
    size: 100,
    spacing: 0,
    height: 0,
    eyes: 'plain',
    mouth: 'none',
    blush: false,
    blink: 'normal',
    energy: 'normal',
  }
}

/** A complete, valid look from whatever the server sent (missing or bad keys = defaults) */
export function normalizeLook(raw) {
  const look = defaultLook()
  if (!raw || typeof raw !== 'object')
    return look
  Object.keys(LOOK_CHOICES).forEach((key) => {
    if (LOOK_CHOICES[key].includes(raw[key]))
      look[key] = raw[key]
  })
  Object.keys(LOOK_RANGES).forEach((key) => {
    const v = Number(raw[key])
    if (raw[key] !== null && raw[key] !== '' && Number.isFinite(v)) {
      const [lo, hi] = LOOK_RANGES[key]
      look[key] = Math.min(hi, Math.max(lo, Math.round(v)))
    }
  })
  if (typeof raw.blush === 'boolean')
    look.blush = raw.blush
  return look
}

export function sameLook(a, b) {
  const x = normalizeLook(a)
  const y = normalizeLook(b)
  return LOOK_KEYS.every(key => x[key] === y[key])
}

export function isDefaultLook(look) {
  return sameLook(look, defaultLook())
}

// ------------------------------------------------------------------------------ 1-bit canvas

export function createCanvas() {
  return { w: W, h: H, bits: new Uint8Array(W * H) }
}

export function clearCanvas(c) {
  c.bits.fill(0)
}

export function getPixel(c, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H)
    return false
  return c.bits[y * W + x] === 1
}

export function setPixel(c, x, y, on = true) {
  if (x < 0 || y < 0 || x >= W || y >= H)
    return
  c.bits[y * W + x] = on ? 1 : 0
}

export function countPixels(c, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) {
  let n = 0
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) n += c.bits[y * W + x]
  }
  return n
}

/** Lit-pixel bounding box {x0, y0, x1, y1}, or null when blank */
export function litBounds(c, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) {
  let box = null
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      if (!c.bits[y * W + x])
        continue
      if (!box)
        box = { x0: x, y0: y, x1: x, y1: y }
      box.x0 = Math.min(box.x0, x)
      box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y)
      box.y1 = Math.max(box.y1, y)
    }
  }
  return box
}

export function hLine(c, x0, x1, y, on = true) {
  if (y < 0 || y >= H)
    return
  const a = Math.max(x0, 0)
  const b = Math.min(x1, W - 1)
  for (let x = a; x <= b; x++) setPixel(c, x, y, on)
}

export function fillRect(c, x, y, w, h, on = true) {
  for (let yy = y; yy < y + h; yy++) hLine(c, x, x + w - 1, yy, on)
}

export function fillRoundRect(c, cx, cy, w, h, r, on = true) {
  if (w <= 0 || h <= 0)
    return
  const left = cx - w / 2
  const right = cx + w / 2
  const top = cy - h / 2
  const bottom = cy + h / 2
  let rr = Math.min(r, Math.min(w, h) / 2)
  if (rr < 0)
    rr = 0
  for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
    const yc = y + 0.5
    if (yc < top || yc > bottom)
      continue
    let inset = 0
    let d = 0
    if (yc < top + rr)
      d = top + rr - yc
    else if (yc > bottom - rr)
      d = yc - (bottom - rr)
    if (d > 0)
      inset = rr - Math.sqrt(Math.max(0, rr * rr - d * d))
    hLine(c, Math.ceil(left + inset - 0.5), Math.floor(right - inset - 0.5), y, on)
  }
}

export function fillEllipse(c, cx, cy, rx, ry, on = true) {
  if (rx <= 0 || ry <= 0)
    return
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry
    if (dy < -1 || dy > 1)
      continue
    const half = rx * Math.sqrt(1 - dy * dy)
    hLine(c, Math.ceil(cx - half - 0.5), Math.floor(cx + half - 0.5), y, on)
  }
}

// part: 0 = full, 1 = upper half, 2 = lower half, 3 = right half, 4 = left half
export function ellipseRing(c, cx, cy, rx, ry, thick, part = 0, on = true) {
  const orx = rx + thick / 2
  const ory = ry + thick / 2
  const irx = Math.max(0.1, rx - thick / 2)
  const iry = Math.max(0.1, ry - thick / 2)
  for (let y = Math.floor(cy - ory); y <= Math.ceil(cy + ory); y++) {
    const yc = y + 0.5
    if (part === 1 && yc > cy + thick / 2)
      continue
    if (part === 2 && yc < cy - thick / 2)
      continue
    for (let x = Math.floor(cx - orx); x <= Math.ceil(cx + orx); x++) {
      const dx = x + 0.5 - cx
      const dy = yc - cy
      if (part === 3 && dx < 0)
        continue
      if (part === 4 && dx > 0)
        continue
      const outer = (dx * dx) / (orx * orx) + (dy * dy) / (ory * ory)
      const inner = (dx * dx) / (irx * irx) + (dy * dy) / (iry * iry)
      if (outer <= 1 && inner >= 1)
        setPixel(c, x, y, on)
    }
  }
}

export function line(c, x0, y0, x1, y1, thick, on = true) {
  const hw = Math.max(0.5, thick / 2)
  const minx = Math.floor(Math.min(x0, x1) - hw)
  const maxx = Math.ceil(Math.max(x0, x1) + hw)
  const miny = Math.floor(Math.min(y0, y1) - hw)
  const maxy = Math.ceil(Math.max(y0, y1) + hw)
  const vx = x1 - x0
  const vy = y1 - y0
  const len2 = vx * vx + vy * vy
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5 - x0
      const py = y + 0.5 - y0
      const t = len2 > 0 ? Math.min(1, Math.max(0, (px * vx + py * vy) / len2)) : 0
      const dx = px - t * vx
      const dy = py - t * vy
      if (dx * dx + dy * dy <= hw * hw)
        setPixel(c, x, y, on)
    }
  }
}

// ------------------------------------------------------------------------------ poses

export const MOODS = ['neutral', 'happy', 'sleepy', 'sad', 'love', 'surprised']

// One pass in seconds (face_animations.cc kInfo); all of these loop
export const MOOD_DURATION = Object.freeze({
  neutral: 4,
  happy: 4,
  sleepy: 6,
  sad: 6,
  love: 4,
  surprised: 1.5,
})

function clamp01(u) {
  return Math.min(1, Math.max(0, u))
}
function sn(t, hz) {
  return Math.sin(t * TWO_PI * hz)
}
function seg(t, t0, t1) {
  return clamp01((t - t0) / (t1 - t0))
}

export function eyePose(w, h, r, style = 'normal') {
  return { x: 0, y: 0, w, h, r, lid_top: 0, lid_angle: 0, lid_bottom: 0, style }
}

function both(p, e) {
  p.l = { ...e }
  p.r = { ...e }
}

/** face_anim::Evaluate for the moods of the preview switcher; t in seconds */
export function evaluateMood(mood, t) {
  const p = { l: eyePose(20, 22, 6), r: eyePose(20, 22, 6), dx: 0, dy: 0, blush: false, blink: true, gaze: false }
  switch (mood) {
    case 'happy': // IdleHappy
      both(p, eyePose(22, 20, 8))
      p.l.lid_bottom = p.r.lid_bottom = 0.3
      p.gaze = true
      break
    case 'sleepy': // IdleSleepy
      both(p, eyePose(22, 16, 6))
      p.l.lid_top = p.r.lid_top = fr(0.6 + 0.12 * sn(t, 1 / 6))
      p.dy = 1
      break
    case 'sad': // IdleSad
      both(p, eyePose(19, 18, 6))
      p.l.y = p.r.y = fr(2 + 0.5 * sn(t, 0.17))
      p.l.lid_top = p.r.lid_top = 0.25
      p.l.lid_angle = p.r.lid_angle = -6
      break
    case 'love': // IdleAffectionate
      both(p, eyePose(21, 19, 8))
      p.l.lid_bottom = p.r.lid_bottom = 0.35
      p.blush = true
      p.gaze = true
      break
    case 'surprised': // EmoSurprised
      both(p, eyePose(24, 26, 0, 'ring'))
      p.dy = fr(-2 * (1 - seg(t, 0, 0.4)))
      p.blink = false
      break
    default: // IdleNeutral
      both(p, eyePose(20, 22, 6))
      p.gaze = true
      break
  }
  return p
}

// ------------------------------------------------------------------------------ liveliness

// [base, random span] in ms (living_face.cc)
export const BLINK_MS = Object.freeze({ slow: [4000, 4000], normal: [2500, 3000], fast: [1400, 1800] })
export const GAZE_MS = Object.freeze({ calm: [6000, 6000], normal: [4000, 4000], playful: [2000, 3000] })
export const BLINK_LEN_MS = 220

/**
 * LivingFace::ApplyLiveliness. rand() returns [0, 1); pass a seeded one in tests.
 * apply(pose, nowMs, look) changes the pose in place (lids, height, gaze).
 */
export function createLiveliness(rand = Math.random, startMs = 0) {
  const state = {
    nextBlink: startMs + 3000,
    blinkStart: -1,
    nextGaze: startMs + 4500,
    gazeX: 0,
  }
  const pick = span => Math.floor(rand() * span)
  function apply(pose, nowMs, rawLook) {
    const look = normalizeLook(rawLook)
    let blink = 0
    if (state.blinkStart < 0 && nowMs >= state.nextBlink)
      state.blinkStart = nowMs
    if (state.blinkStart >= 0) {
      const u = (nowMs - state.blinkStart) / BLINK_LEN_MS
      if (u >= 1) {
        state.blinkStart = -1
        const [base, span] = BLINK_MS[look.blink]
        state.nextBlink = nowMs + base + pick(span)
      }
      else {
        blink = Math.sin(PI * u)
      }
    }
    if (nowMs >= state.nextGaze) {
      const r = pick(3)
      state.gazeX = r === 0 ? -6 : r === 1 ? 6 : 0
      const [base, span] = GAZE_MS[look.energy]
      state.nextGaze = nowMs + base + pick(span)
    }
    const breath = 1.2 * Math.sin((nowMs / 1000) * 0.8);
    [pose.l, pose.r].forEach((e) => {
      if (e.style !== 'normal')
        return
      if (pose.blink && blink > 0)
        e.lid_top = Math.max(e.lid_top, blink)
      if (pose.blink)
        e.h += breath
      if (pose.gaze)
        e.x += state.gazeX
    })
    return pose
  }
  return { state, apply }
}

// ------------------------------------------------------------------------------ rendering

function drawEye(c, e, cx, cy, isLeft, detail) {
  const w = Math.max(2, e.w)
  const h = Math.max(2, e.h)
  switch (e.style) {
    case 'normal': {
      if (e.lid_top >= 0.97) { // fully closed
        line(c, cx - w / 2, cy + h / 2 - 2, cx + w / 2, cy + h / 2 - 2, 2.5)
        return
      }
      fillRoundRect(c, cx, cy, w, h, e.r)
      // The user's eye detail, cut out before the lids so a blink still covers it
      if (e.lid_top < 0.55) {
        if (detail === 'shine') {
          const s = Math.max(1.5, 0.12 * w)
          fillEllipse(c, cx - 0.2 * w, cy - 0.2 * h, s, s, false)
        }
        else if (detail === 'pupil') {
          const px = Math.min(0.2 * w, Math.max(-0.2 * w, 0.3 * e.x)) // follows the gaze
          const pcx = cx + px
          const pcy = cy + 1.5
          const prx = 0.26 * w
          const pry = 0.28 * h
          fillEllipse(c, pcx, pcy, prx, pry, false)
          const d = Math.max(1, 0.3 * prx)
          fillEllipse(c, pcx - 0.35 * prx, pcy - 0.35 * pry, d, d, true)
        }
      }
      const top = cy - h / 2
      const bottom = cy + h / 2
      if (e.lid_top > 0 || e.lid_angle !== 0 || e.lid_bottom > 0) {
        for (let x = Math.floor(cx - w / 2); x <= Math.ceil(cx + w / 2); x++) {
          const norm = Math.min(1, Math.max(-1, (x + 0.5 - cx) / (w / 2)))
          const inner = isLeft ? norm : -norm // +1 at the corner nearest the nose
          if (e.lid_top > 0 || e.lid_angle !== 0) {
            const lidY = top + e.lid_top * h + 0.5 * e.lid_angle * inner
            for (let y = Math.floor(top); y < lidY; y++) setPixel(c, x, y, false)
          }
          if (e.lid_bottom > 0) {
            const cheekY = bottom - e.lid_bottom * h * (1 - 0.6 * norm * norm)
            for (let y = Math.ceil(cheekY); y <= Math.ceil(bottom); y++) setPixel(c, x, y, false)
          }
        }
      }
      return
    }
    case 'arcUp':
      ellipseRing(c, cx, cy + h * 0.25, w / 2, h / 2, 4, 1)
      return
    case 'arcDown':
      ellipseRing(c, cx, cy - h * 0.25, w / 2, h / 2, 4, 2)
      return
    case 'line':
      line(c, cx - w / 2, cy, cx + w / 2, cy, 3)
      return
    case 'ring':
      ellipseRing(c, cx, cy, w / 2, h / 2, 3.5)
      return
    case 'ringPupil':
      ellipseRing(c, cx, cy, w / 2, h / 2, 3)
      fillEllipse(c, cx, cy, 2.5, 2.5)
      break
    default:
      break
  }
}

// The mouth follows the mood of the eyes: wider smile when happy, frown when sad, open when surprised
function drawMouth(c, p, mouth, eyesBottom) {
  const mx = 64 + p.dx
  const my = Math.min(60, eyesBottom + 7)
  const st = p.l.style
  const happy = p.l.lid_bottom > 0 || st === 'arcUp' || st === 'arcDown'
  const sad = p.l.lid_angle < -1
  if (st === 'ring' || st === 'ringPupil') {
    ellipseRing(c, mx, my, 3, 3.5, 1.4, 0)
    return
  }
  if (mouth === 'smile') {
    if (sad)
      ellipseRing(c, mx, my + 2, 6, 3, 1.6, 1)
    else ellipseRing(c, mx, my - 2, happy ? 8 : 6, happy ? 4 : 3, 1.6, 2)
  }
  else if (mouth === 'cat') {
    ellipseRing(c, mx - 3, my - 1, 3, 2.5, 1.4, 2)
    ellipseRing(c, mx + 3, my - 1, 3, 2.5, 1.4, 2)
  }
  else if (mouth === 'dot') {
    fillEllipse(c, mx, my, happy ? 2.5 : 2, 2)
  }
}

function drawBlush(c, p, lx, rx, ly, ry) {
  const lb = ly + p.l.h / 2
  const rb = ry + p.r.h / 2;
  [lx, rx].forEach((ex) => {
    const y = Math.min(BOTTOM - 3, Math.max(lb, rb) + 4)
    for (let k = -1; k <= 1; k++) line(c, ex + k * 5 - 1, y + 2, ex + k * 5 + 2, y - 2, 1.4)
  })
}

function scaled(e, k) {
  return {
    ...e,
    x: fr(e.x * k),
    y: fr(e.y * k),
    w: fr(e.w * k),
    h: fr(e.h * k),
    r: fr(e.r * k),
    lid_angle: fr(e.lid_angle * k),
  }
}

/** face_anim::Render(pose, canvas, look): draws into `canvas` (or a new one) and returns it */
export function renderFace(pose, rawLook, canvas = createCanvas()) {
  const look = normalizeLook(rawLook)
  clearCanvas(canvas)
  const k = fr(fr(EYE_SCALE * look.size) / 100)
  const p = {
    ...pose,
    l: scaled(pose.l, k),
    r: scaled(pose.r, k),
    dx: fr(pose.dx * EYE_SCALE),
    dy: fr(pose.dy * EYE_SCALE),
  }
  const eyeY = EYE_Y + look.height
  const lx = LEFT_X - look.spacing + p.dx + p.l.x
  const ly = eyeY + p.dy + p.l.y
  const rx = RIGHT_X + look.spacing + p.dx + p.r.x
  const ry = eyeY + p.dy + p.r.y;
  [p.l, p.r].forEach((e) => {
    if (e.style !== 'normal')
      return
    if (look.shape === 'round')
      e.r = Math.min(e.w, e.h) / 2
    else if (look.shape === 'square')
      e.r = Math.min(e.r, 2)
  })
  let blush = !!pose.blush
  if (look.blush && p.l.style === 'normal' && p.r.style === 'normal')
    blush = true
  drawEye(canvas, p.l, lx, ly, true, look.eyes)
  drawEye(canvas, p.r, rx, ry, false, look.eyes)
  if (look.mouth !== 'none')
    drawMouth(canvas, p, look.mouth, Math.max(ly + p.l.h / 2, ry + p.r.h / 2))
  if (blush)
    drawBlush(canvas, p, lx, rx, ly, ry)
  return canvas
}

/** One preview frame: mood pose at tMs since the mood started, plus liveliness when given */
export function renderMoodFrame(mood, rawLook, tMs, liveliness, nowMs, canvas) {
  const dur = MOOD_DURATION[mood] || MOOD_DURATION.neutral
  const pose = evaluateMood(mood, (Math.max(0, tMs) / 1000) % dur)
  if (liveliness)
    liveliness.apply(pose, nowMs === undefined ? tMs : nowMs, rawLook)
  return renderFace(pose, rawLook, canvas)
}

// ------------------------------------------------------------------------------ output

/** Horizontal runs of lit pixels: [[x, y, length], ...] */
export function pixelRuns(c) {
  const runs = []
  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      if (!c.bits[y * W + x]) {
        x++
        continue
      }
      const start = x
      while (x < W && c.bits[y * W + x]) x++
      runs.push([start, y, x - start])
    }
  }
  return runs
}

/** Paint onto a 2D context at `scale` device pixels per OLED pixel */
export function paintToContext(ctx, c, scale = 4, onColor = '#f4f7fb', offColor = '#05070a') {
  ctx.fillStyle = offColor
  ctx.fillRect(0, 0, W * scale, H * scale)
  ctx.fillStyle = onColor
  pixelRuns(c).forEach(([x, y, n]) => ctx.fillRect(x * scale, y * scale, n * scale, scale))
}

/** A crisp 128x64 SVG of the frame (one path of runs) */
export function toSvg(c, onColor = '#f4f7fb', offColor = '#05070a') {
  const d = pixelRuns(c).map(([x, y, n]) => `M${x} ${y}h${n}v1h-${n}z`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}" shape-rendering="crispEdges">`
    + `<rect width="${W}" height="${H}" fill="${offColor}"/><path fill="${onColor}" d="${d}"/></svg>`
}

export function toSvgDataUri(c, onColor, offColor) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(c, onColor, offColor))}`
}
