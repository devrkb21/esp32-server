// TinyBot look: a pixel-exact port of the robot's face drawing, used for the live preview.
//
// Mirrors the firmware (xiaozhi-esp32 main/companion):
//   face_canvas.cc      FillRoundRect, FillEllipse, EllipseRing, Line, FillTriangle, Glyph ('+')
//                       on a 1-bit 128x64 buffer
//   face_animations.cc  DrawEye (Normal / ArcUp / ArcDown / Line / SqueezeL / SqueezeR / Ring /
//                       RingPupil), the kFxTears / kFxSparkle / kFxSweat / kFxBlush / kFxThinkDots
//                       overlays of DrawFx, the hands (HandPose, Paw, ThumbsUp, DrawHands),
//                       DrawMouth, Render(pose, canvas, look) and the poses of IdleNeutral,
//                       IdleHappy, IdleSleepy, IdleSad, IdleAffectionate, EmoSurprised,
//                       EmoConfident, EmoThinking, EmoEmbarrassed, Online and Yawn
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

export const LOOK_KEYS = ['shape', 'size', 'spacing', 'height', 'eyes', 'mouth', 'blush', 'blink', 'energy', 'hands']

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
    hands: true,
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
  if (typeof raw.hands === 'boolean')
    look.hands = raw.hands
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

export function fillTriangle(c, x0, y0, x1, y1, x2, y2, on = true) {
  const minx = Math.floor(Math.min(x0, x1, x2))
  const maxx = Math.ceil(Math.max(x0, x1, x2))
  const miny = Math.floor(Math.min(y0, y1, y2))
  const maxy = Math.ceil(Math.max(y0, y1, y2))
  const edge = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const e0 = edge(x0, y0, x1, y1, px, py)
      const e1 = edge(x1, y1, x2, y2, px, py)
      const e2 = edge(x2, y2, x0, y0, px, py)
      if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0))
        setPixel(c, x, y, on)
    }
  }
}

// 5x5 glyphs, one number per row, bit 4 = leftmost column (only the ones the preview uses)
const GLYPHS = Object.freeze({
  '+': [0x04, 0x04, 0x1F, 0x04, 0x04],
})

export function glyph(c, ch, x, y, scale = 1, on = true) {
  const rows = GLYPHS[ch]
  if (!rows)
    return
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & (0x10 >> col))
        fillRect(c, x + col * scale, y + row * scale, scale, scale, on)
    }
  }
}

// ------------------------------------------------------------------------------ poses

export const MOODS = ['neutral', 'happy', 'sleepy', 'sad', 'love', 'surprised', 'like', 'thinking', 'shy', 'hello', 'yawn']

// One pass in seconds (face_animations.cc kInfo); the preview loops all of them
export const MOOD_DURATION = Object.freeze({
  neutral: 4, // IdleNeutral
  happy: 4, // IdleHappy
  sleepy: 6, // IdleSleepy
  sad: 6, // IdleSad
  love: 4, // IdleAffectionate
  surprised: 1.5, // EmoSurprised
  like: 2.5, // EmoConfident
  thinking: 3, // EmoThinking
  shy: 2.5, // EmoEmbarrassed
  hello: 1.1, // Online (plays once on the robot)
  yawn: 3, // Yawn (plays once on the robot)
})

// Reduced motion: the still frame (seconds into the mood) where the paws are fully up
export const MOOD_STILL_T = Object.freeze({
  surprised: 0.8,
  like: 1,
  thinking: 1,
  shy: 0.6,
  hello: 0.5,
  yawn: 1.6,
})

// HandPose (face_animations.h): little paws that come up from the bottom edge
export const HAND_POSES = ['none', 'coverMouth', 'thumbsUp', 'wave', 'waveBoth', 'chin', 'cheeks', 'coverEyes']

// FaceFx bits (face_animations.h) that the preview draws
export const FX = Object.freeze({
  tears: 1 << 0,
  sparkle: 1 << 3,
  sweat: 1 << 6,
  blush: 1 << 7,
  thinkDots: 1 << 8,
})

function clamp01(u) {
  return Math.min(1, Math.max(0, u))
}
function ease(u) {
  u = clamp01(u)
  return u * u * (3 - 2 * u)
}
function bump(u) {
  return Math.sin(PI * clamp01(u))
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
  const p = {
    l: eyePose(20, 22, 6),
    r: eyePose(20, 22, 6),
    hands: 'none',
    hand_k: 1,
    dx: 0,
    dy: 0,
    fx: 0,
    fx_t: t,
    blink: true,
    gaze: false,
  }
  switch (mood) {
    case 'happy': // IdleHappy
      both(p, eyePose(22, 20, 8))
      p.l.lid_bottom = p.r.lid_bottom = fr(0.3)
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
      p.l.lid_bottom = p.r.lid_bottom = fr(0.35)
      p.fx |= FX.blush
      p.gaze = true
      break
    case 'surprised': // EmoSurprised
      both(p, eyePose(24, 26, 0, 'ring'))
      p.dy = fr(-2 * (1 - seg(t, 0, 0.4)))
      p.hands = 'cheeks'
      p.hand_k = fr(ease(seg(t, 0.1, 0.4)))
      p.blink = false
      break
    case 'like': // EmoConfident
      both(p, eyePose(22, 18, 5))
      p.l.lid_top = fr(0.38)
      p.r.lid_top = fr(0.2) // one raised brow
      p.l.lid_angle = p.r.lid_angle = -2
      p.l.lid_bottom = p.r.lid_bottom = fr(0.2)
      p.dx = fr(1.5 * ease(seg(t, 0, 0.5)))
      p.hands = 'thumbsUp'
      p.hand_k = fr(ease(seg(t, 0.2, 0.6)))
      break
    case 'thinking': // EmoThinking
      p.l = eyePose(19, 20, 6)
      p.r = eyePose(19, 16, 6)
      p.l.x = p.r.x = -5
      p.l.y = p.r.y = -4
      p.r.lid_top = 0.25
      p.fx |= FX.thinkDots
      p.hands = 'chin'
      p.hand_k = fr(ease(seg(t, 0, 0.5)))
      break
    case 'shy': // EmoEmbarrassed
      both(p, eyePose(17, 15, 5))
      p.l.x = p.r.x = -6
      p.l.y = p.r.y = 4
      p.l.lid_bottom = p.r.lid_bottom = 0.25
      p.fx |= FX.blush | FX.sweat
      p.hands = 'coverEyes'
      // peeking: the paws drop a little now and then
      p.hand_k = fr(ease(seg(t, 0, 0.4)) * (1 - 0.35 * bump(seg(t, 1.3, 2.1))))
      break
    case 'hello': // Online
      p.hands = 'wave'
      p.hand_k = fr(ease(seg(t, 0, 0.25)) * (1 - ease(seg(t, 0.85, 1.1))))
      both(p, eyePose(22, 13, 0, 'arcUp'))
      p.dy = fr(-4 * bump(t / MOOD_DURATION.hello))
      p.fx |= FX.sparkle
      break
    case 'yawn': // Yawn
      if (t < 1.2) {
        both(p, eyePose(20, fr(22 + 3 * seg(t, 0, 1.2)), 6))
        p.l.lid_top = p.r.lid_top = fr(0.5 * seg(t, 0, 1.2))
      }
      else if (t < 2) {
        p.l = eyePose(20, 10, 0, 'squeezeL')
        p.r = eyePose(20, 10, 0, 'squeezeR')
        p.dy = -1
      }
      else {
        both(p, eyePose(20, 22, 6))
        p.l.lid_top = p.r.lid_top = fr(0.5 * (1 - seg(t, 2, 3)))
        if (t < 2.6)
          p.fx |= FX.tears
      }
      p.blink = false
      p.hands = 'coverMouth'
      p.hand_k = fr(ease(seg(t, 0.9, 1.25)) * (1 - ease(seg(t, 2, 2.4))))
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
    case 'squeezeL': // >
      line(c, cx - w / 2, cy - h / 2, cx + w / 2, cy, 3.5)
      line(c, cx + w / 2, cy, cx - w / 2, cy + h / 2, 3.5)
      return
    case 'squeezeR': // <
      line(c, cx + w / 2, cy - h / 2, cx - w / 2, cy, 3.5)
      line(c, cx - w / 2, cy, cx + w / 2, cy + h / 2, 3.5)
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
  const sad = p.l.lid_angle < -1 && p.l.lid_bottom <= 0
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

function tearDrop(c, x, y) {
  fillEllipse(c, x, y + 1, 2, 2.2)
  fillTriangle(c, x - 1.8, y + 0.5, x + 1.8, y + 0.5, x, y - 3)
}

const SPARKLE_PTS = [[12, 8], [116, 10], [64, 4]]
const THINK_DOTS = [[106, 48, 1.6], [113, 37, 2.4], [120, 23, 3.4]]

// DrawFx, for the overlays the preview moods use (same order as the firmware)
function drawFx(c, p, lx, rx, ly, ry) {
  const t = p.fx_t || 0
  const fx = p.fx
  const lb = ly + p.l.h / 2
  const rb = ry + p.r.h / 2
  if (fx & FX.tears) {
    for (let i = 0; i < 2; i++) {
      const ex = i === 0 ? lx - p.l.w * 0.25 : rx + p.r.w * 0.25
      const base = i === 0 ? lb : rb
      const span = Math.max(4, BOTTOM - 2 - base)
      tearDrop(c, ex, base + 3 + ((t * 24 + i * 9) % span))
    }
  }
  if (fx & FX.sparkle) {
    for (let i = 0; i < 3; i++) {
      if ((t * 2.5 + i * 0.33) % 1 < 0.55)
        glyph(c, '+', SPARKLE_PTS[i][0] - 2, SPARKLE_PTS[i][1] - 2)
    }
  }
  if (fx & FX.sweat)
    tearDrop(c, rx + p.r.w / 2 + 6, ry - p.r.h / 2 + 3 + ((t * 8) % 7))
  if (fx & FX.blush) {
    [lx, rx].forEach((ex) => {
      const y = Math.min(BOTTOM - 3, Math.max(lb, rb) + 4)
      for (let k = -1; k <= 1; k++) line(c, ex + k * 5 - 1, y + 2, ex + k * 5 + 2, y - 2, 1.4)
    })
  }
  if (fx & FX.thinkDots) {
    const n = Math.trunc((t * 2) % 4) // 0..3 dots visible
    for (let i = 0; i < n && i < 3; i++) fillEllipse(c, THINK_DOTS[i][0], THINK_DOTS[i][1], THINK_DOTS[i][2], THINK_DOTS[i][2])
  }
}

// A little paw: a round mitten with two finger notches on an arm that comes up from the bottom
// edge. A dark rim keeps it apart from the eyes on the 1-bit screen.
function paw(c, x, y, r, armDx = 0) {
  const ax = x + armDx
  line(c, x, y, ax, 70, 2 * r * 0.55 + 2.4, false) // rim around the arm
  line(c, x - r * 0.5, y + r * 0.4, ax - r * 0.5, 70, 1.4)
  line(c, x + r * 0.5, y + r * 0.4, ax + r * 0.5, 70, 1.4)
  fillEllipse(c, x, y, r + 1.6, r * 0.9 + 1.6, false)
  fillEllipse(c, x, y, r, r * 0.9)
  line(c, x - r * 0.33, y - r * 0.95, x - r * 0.33, y - r * 0.3, 1.2, false)
  line(c, x + r * 0.33, y - r * 0.95, x + r * 0.33, y - r * 0.3, 1.2, false)
}

// "Like": a fist with the thumb up
function thumbsUp(c, x, y) {
  line(c, x + 1, y + 4, x + 6, 70, 9.5, false)
  line(c, x - 2, y + 4, x + 3, 70, 1.4)
  line(c, x + 4, y + 4, x + 9, 70, 1.4)
  fillRoundRect(c, x, y, 15, 13, 4, false)
  fillRoundRect(c, x - 3.5, y - 8, 7, 12, 3, false)
  fillRoundRect(c, x, y, 12, 10, 3)
  fillRoundRect(c, x - 3.5, y - 8, 4.5, 10, 2)
  for (const fy of [y - 1.5, y + 1.5]) line(c, x - 1, fy, x + 5, fy, 1, false) // folded fingers
}

function drawHands(c, p, lx, rx, ly, ry, eyesBottom) {
  const k = clamp01(p.hand_k === undefined ? 1 : p.hand_k)
  if (k <= 0.02)
    return
  const drop = (1 - k) * 34 // slides up from below the screen
  const t = p.fx_t || 0
  switch (p.hands) {
    case 'coverMouth':
      paw(c, 64 + p.dx, Math.min(57, eyesBottom + 8) + drop, 8.5)
      break
    case 'thumbsUp':
      thumbsUp(c, 114, 48 + drop + 0.8 * sn(t, 1.2))
      break
    case 'wave':
      paw(c, 112 + 4 * sn(t, 2.5), 42 + drop, 6.5, 6)
      break
    case 'waveBoth':
      paw(c, 16 - 4 * sn(t, 2.5), 42 + drop, 6.5, -6)
      paw(c, 112 + 4 * sn(t, 2.5), 42 + drop, 6.5, 6)
      break
    case 'chin':
      paw(c, 70 + p.dx, Math.min(58, eyesBottom + 9) + drop - 1.2 * Math.max(0, sn(t, 1.5)), 6)
      break
    case 'cheeks':
      paw(c, Math.max(9, lx - 24), ly + 16 + drop, 6.5, -3)
      paw(c, Math.min(119, rx + 24), ry + 16 + drop, 6.5, 3)
      break
    case 'coverEyes':
      paw(c, lx + 2, ly + 3 + drop, 10)
      paw(c, rx - 2, ry + 3 + drop, 10)
      break
    default:
      break
  }
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
  p.fx = pose.fx || 0
  if (look.blush && p.l.style === 'normal' && p.r.style === 'normal')
    p.fx |= FX.blush
  drawEye(canvas, p.l, lx, ly, true, look.eyes)
  drawEye(canvas, p.r, rx, ry, false, look.eyes)
  const eyesBottom = Math.max(ly + p.l.h / 2, ry + p.r.h / 2)
  if (look.mouth !== 'none')
    drawMouth(canvas, p, look.mouth, eyesBottom)
  if (look.hands && p.hands && p.hands !== 'none') {
    drawHands(canvas, p, lx, rx, ly, ry, eyesBottom)
    if (p.hands === 'coverEyes')
      p.fx &= ~FX.blush // the blush would land on the paws
  }
  if (p.fx)
    drawFx(canvas, p, lx, rx, ly, ry)
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

/** Reduced motion: one still frame of the mood, with the paws fully up */
export function renderMoodStill(mood, rawLook, canvas) {
  return renderMoodFrame(mood, rawLook, (MOOD_STILL_T[mood] || 0) * 1000, null, 0, canvas)
}

/** ASCII dump of a frame ('#' on, '.' off), one row per line */
export function toAscii(c) {
  const rows = []
  for (let y = 0; y < H; y++) {
    let s = ''
    for (let x = 0; x < W; x++) s += c.bits[y * W + x] ? '#' : '.'
    rows.push(s)
  }
  return rows.join('\n')
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
