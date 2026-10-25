// TinyBot look: a pixel-exact port of the robot's face drawing, used for the live preview.
//
// Mirrors the firmware (xiaozhi-esp32 main/companion):
//   face_canvas.cc      FillRoundRect, FillEllipse, EllipseRing, Line, FillTriangle, Heart,
//                       Glyph, Text / TextWidth (3x5 font) on a 1-bit 128x64 buffer
//   face_animations.cc  DrawEye (Normal / ArcUp / ArcDown / Line / SqueezeL / SqueezeR / Ring /
//                       RingPupil; the pupil detail follows the gaze and FacePose look_x/look_y),
//                       the kFxTears / kFxZzz / kFxSparkle / kFxSweat / kFxBlush /
//                       kFxThinkDots overlays of DrawFx, the hands (HandPose, Paw, ThumbsUp,
//                       DrawHands), DrawMouth, Render(pose, canvas, look) and the poses of
//                       IdleNeutral, IdleHappy, IdleSleepy, IdleSad, IdleAffectionate,
//                       EmoSurprised, EmoConfident, EmoThinking, EmoEmbarrassed, Online and Yawn;
//                       TinyBot's day: Prop, LifeEyes, the Life* poses and Sleeping, Clear,
//                       Steam, DrawProp and the TV-light flicker of Render
//   daily_life.cc       Anim() (activity -> animation; meals pick a food by variant)
//   living_face.cc      ApplyLiveliness (blink, gaze shift, breathing)
// and the settings.look / settings.routine contracts of xiaozhi-server core/companion/schema.py.
//
// The same file lives in manager-web (src/utils/faceLook.mjs) and manager-mobile
// (src/utils/faceLook.mjs). Keep the two copies identical.
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
  // Chat subtitle font built into the firmware (tinybot_display.cc ApplyChatFont); not drawn
  // by the face preview
  chat_font: ['pixel', 'pixel_large', 'clean_small', 'clean', 'clean_large'],
})

export const LOOK_RANGES = Object.freeze({
  size: [75, 125],
  spacing: [-10, 10],
  height: [-6, 6],
})

export const LOOK_KEYS = ['shape', 'size', 'spacing', 'height', 'eyes', 'mouth', 'blush', 'blink', 'energy', 'hands', 'chat_font']

/**
 * The chat fonts for the sample tiles. `px` is the firmware font size, `strip` the height of the
 * subtitle strip it gets (line height + 3, at most 22). `pixel` fonts are unscii (retro), `clean`
 * ones Montserrat. A browser cannot draw these exact fonts: the tiles only approximate them.
 */
export const CHAT_FONTS = Object.freeze([
  { id: 'pixel', style: 'pixel', px: 8, strip: 11 },
  { id: 'pixel_large', style: 'pixel', px: 16, strip: 19 },
  { id: 'clean_small', style: 'clean', px: 10, strip: 15 },
  { id: 'clean', style: 'clean', px: 12, strip: 18 },
  { id: 'clean_large', style: 'clean', px: 14, strip: 19 },
])

/** Sample line of the font tiles (Latin only: the OLED cannot shape Bangla) */
export const CHAT_FONT_SAMPLE = 'Hello! I\'m TinyBot'

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
    chat_font: 'pixel',
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

// 5x5 glyphs, one number per row, bit 4 = leftmost column (face_canvas.cc kGlyphs)
const GLYPHS = Object.freeze({
  'z': [0x00, 0x1E, 0x04, 0x08, 0x1E],
  'Z': [0x1F, 0x02, 0x04, 0x08, 0x1F],
  '?': [0x0E, 0x11, 0x02, 0x04, 0x04], // dot drawn below separately
  '!': [0x04, 0x04, 0x04, 0x00, 0x04],
  '+': [0x04, 0x04, 0x1F, 0x04, 0x04],
  '*': [0x15, 0x0E, 0x1F, 0x0E, 0x15],
  '.': [0x00, 0x00, 0x00, 0x00, 0x04],
  '~': [0x00, 0x08, 0x15, 0x02, 0x00],
  'n': [0x07, 0x05, 0x05, 0x1D, 0x18], // music note
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
  if (ch === '?')
    fillRect(c, x + 2 * scale, y + 6 * scale, scale, scale, on)
}

export function heart(c, cx, cy, s, on = true) {
  const r = s * 0.27
  fillEllipse(c, cx - s * 0.23, cy - s * 0.14, r, r, on)
  fillEllipse(c, cx + s * 0.23, cy - s * 0.14, r, r, on)
  fillTriangle(c, cx - s * 0.49, cy - s * 0.06, cx + s * 0.49, cy - s * 0.06, cx, cy + s * 0.46, on)
}

// 3x5 pixel font, 3 bits per row, MSB = left column (face_canvas.cc kFont3x5)
const FONT_3X5 = Object.freeze({
  'A': [0b010, 0b101, 0b111, 0b101, 0b101],
  'B': [0b110, 0b101, 0b110, 0b101, 0b110],
  'C': [0b011, 0b100, 0b100, 0b100, 0b011],
  'D': [0b110, 0b101, 0b101, 0b101, 0b110],
  'E': [0b111, 0b100, 0b110, 0b100, 0b111],
  'F': [0b111, 0b100, 0b110, 0b100, 0b100],
  'G': [0b011, 0b100, 0b101, 0b101, 0b011],
  'H': [0b101, 0b101, 0b111, 0b101, 0b101],
  'I': [0b111, 0b010, 0b010, 0b010, 0b111],
  'J': [0b001, 0b001, 0b001, 0b101, 0b010],
  'K': [0b101, 0b101, 0b110, 0b101, 0b101],
  'L': [0b100, 0b100, 0b100, 0b100, 0b111],
  'M': [0b101, 0b111, 0b111, 0b101, 0b101],
  'N': [0b110, 0b101, 0b101, 0b101, 0b101],
  'O': [0b010, 0b101, 0b101, 0b101, 0b010],
  'P': [0b110, 0b101, 0b110, 0b100, 0b100],
  'Q': [0b010, 0b101, 0b101, 0b110, 0b011],
  'R': [0b110, 0b101, 0b110, 0b101, 0b101],
  'S': [0b011, 0b100, 0b010, 0b001, 0b110],
  'T': [0b111, 0b010, 0b010, 0b010, 0b010],
  'U': [0b101, 0b101, 0b101, 0b101, 0b111],
  'V': [0b101, 0b101, 0b101, 0b101, 0b010],
  'W': [0b101, 0b101, 0b111, 0b111, 0b101],
  'X': [0b101, 0b101, 0b010, 0b101, 0b101],
  'Y': [0b101, 0b101, 0b010, 0b010, 0b010],
  'Z': [0b111, 0b001, 0b010, 0b100, 0b111],
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b110, 0b001, 0b010, 0b100, 0b111],
  '3': [0b110, 0b001, 0b010, 0b001, 0b110],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b110, 0b001, 0b110],
  '6': [0b011, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b110],
  '<': [0b001, 0b010, 0b100, 0b010, 0b001],
  '>': [0b100, 0b010, 0b001, 0b010, 0b100],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
  'x': [0b000, 0b101, 0b010, 0b101, 0b000],
})

/** FaceCanvas::Text: 3x5 letters, 1 px apart; unknown characters (space) leave a gap */
export function text(c, str, x, y, scale = 1, on = true) {
  for (const ch of String(str || '')) {
    const rows = FONT_3X5[ch]
    if (rows) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (rows[row] & (0b100 >> col))
            fillRect(c, x + col * scale, y + row * scale, scale, scale, on)
        }
      }
    }
    x += 4 * scale
  }
}

export function textWidth(str, scale = 1) {
  const n = String(str || '').length
  return n > 0 ? (4 * n - 1) * scale : 0
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
  zzz: 1 << 1,
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

// FacePose{} defaults
function newPose(t) {
  return {
    l: eyePose(20, 22, 6),
    r: eyePose(20, 22, 6),
    hands: 'none',
    prop: 'none',
    hand_k: 1,
    dx: 0,
    dy: 0,
    fx: 0,
    fx_t: t,
    look_x: 0, // where the pupils roll, -1..1 (right / down): the robot's tilt
    look_y: 0,
    blink: true,
    gaze: false,
  }
}

/** face_anim::Evaluate for the moods of the preview switcher; t in seconds */
export function evaluateMood(mood, t) {
  const p = newPose(t)
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

// ------------------------------------------------------------------------------ TinyBot's day

// settings.routine activity keys (schema.py ACTIVITIES, daily_life.cc kNames)
export const ACTIVITIES = ['exercise', 'boxing', 'breakfast', 'lunch', 'dinner', 'newspaper', 'chat', 'work', 'nap', 'tea', 'art', 'tv', 'book']
export const MEALS = ['breakfast', 'lunch', 'dinner']
// Small list icons for the routine editors
export const ACTIVITY_ICON = Object.freeze({
  exercise: '🏋️',
  boxing: '🥊',
  breakfast: '🥣',
  lunch: '🍜',
  dinner: '🍽️',
  newspaper: '📰',
  chat: '💬',
  work: '💻',
  nap: '😴',
  tea: '🍵',
  art: '🎨',
  tv: '📺',
  book: '📖',
})

// Prop (face_animations.h): what a daily-life animation holds
export const PROPS = ['none', 'dumbbells', 'gloves', 'bowl', 'sandwich', 'apple', 'newspaper', 'phone', 'laptop', 'tea', 'easel', 'popcorn', 'book']

// One pass in seconds (face_animations.cc kInfo); all of them loop
export const LIFE_DURATION = Object.freeze({
  LifeExercise: 2,
  LifeBoxing: 1.2,
  LifeEatBowl: 2.4,
  LifeEatSandwich: 9.6,
  LifeEatApple: 9.6,
  LifeNewspaper: 6,
  LifeChat: 4,
  LifeWork: 6,
  LifeTea: 5,
  LifeArt: 8,
  LifeTv: 6,
  LifeBook: 6,
  Sleeping: 4,
})

// Reduced motion: a still frame (seconds into the animation) that shows the activity best
export const LIFE_STILL_T = Object.freeze({
  LifeExercise: 1, // dumbbells up, sweating
  LifeBoxing: 0.3, // left punch landing, "pow"
  LifeEatBowl: 0.4,
  LifeEatSandwich: 2.7, // one bite taken
  LifeEatApple: 2.7,
  LifeNewspaper: 1,
  LifeChat: 2.5, // two messages
  LifeWork: 1.1,
  LifeTea: 1, // steaming
  LifeArt: 6, // hills, sun and house painted
  LifeTv: 1,
  LifeBook: 1,
  Sleeping: 1,
})

const MEAL_ANIMS = ['LifeEatBowl', 'LifeEatSandwich', 'LifeEatApple']
// The preview shows the three foods in turn (every sandwich/apple loop; bowl loops fit too)
export const MEAL_CYCLE_MS = 9600

/** daily_life::Anim: the animation for an activity; meals pick noodles / sandwich / apple by variant */
export function activityAnim(activity, variant = 0) {
  switch (activity) {
    case 'exercise': return 'LifeExercise'
    case 'boxing': return 'LifeBoxing'
    case 'breakfast':
    case 'lunch':
    case 'dinner': {
      const v = Math.trunc(Number(variant) || 0)
      return MEAL_ANIMS[((v % 3) + 3) % 3]
    }
    case 'newspaper': return 'LifeNewspaper'
    case 'chat': return 'LifeChat'
    case 'work': return 'LifeWork'
    case 'nap': return 'Sleeping'
    case 'tea': return 'LifeTea'
    case 'art': return 'LifeArt'
    case 'tv': return 'LifeTv'
    case 'book': return 'LifeBook'
    default: return null
  }
}

/** Which food a meal shows in the preview at tMs (cycles through the three) */
export function previewMealVariant(tMs) {
  return Math.floor(Math.max(0, tMs) / MEAL_CYCLE_MS) % 3
}

// Daily-life eyes: smaller and higher up, so the prop fits underneath
function lifeEyes(p, x, y) {
  both(p, eyePose(15, 14, 5))
  p.l.x = p.r.x = fr(x)
  p.l.y = p.r.y = fr(-9 + y)
}

// Closed happy / content eyes in the daily-life spot
function lifeStyled(p, style) {
  both(p, eyePose(15, 9, 0, style))
  p.l.y = p.r.y = -9
}

/** face_anim::Evaluate for the TinyBot's-day animations (Life* and Sleeping); t in seconds */
export function evaluateLife(anim, t) {
  const p = newPose(fr(t))
  t = p.fx_t
  const u = fr(t / (LIFE_DURATION[anim] || 4))
  switch (anim) {
    case 'LifeExercise': {
      const lift = fr(0.5 - 0.5 * Math.cos(TWO_PI * u))
      lifeEyes(p, 0, 0)
      p.l.lid_top = p.r.lid_top = fr(0.35 * lift) // effort
      p.l.lid_angle = p.r.lid_angle = fr(3 * lift)
      if (lift > 0.75)
        p.fx |= FX.sweat
      p.prop = 'dumbbells'
      break
    }
    case 'LifeBoxing':
      lifeEyes(p, 4, 0)
      p.l.lid_top = p.r.lid_top = 0.25
      p.l.lid_angle = p.r.lid_angle = 5 // determined
      p.dx = fr((u < 0.5 ? 1.5 : -1.5) * bump((u * 2) % 1))
      p.prop = 'gloves'
      break
    case 'LifeEatBowl': {
      const bite = fr(bump(seg(u, 0.35, 0.75))) // chopsticks at the mouth
      lifeEyes(p, 0, 2 * (1 - bite))
      if (bite > 0.6)
        lifeStyled(p, 'arcUp') // yum
      p.prop = 'bowl'
      break
    }
    case 'LifeEatSandwich':
    case 'LifeEatApple': {
      const v = fr((t % 2.4) / 2.4) // one bite every 2.4 s
      const bite = fr(bump(seg(v, 0.3, 0.7)))
      lifeEyes(p, 0, 2 * (1 - bite))
      if (bite > 0.6)
        lifeStyled(p, 'arcUp')
      p.prop = anim === 'LifeEatSandwich' ? 'sandwich' : 'apple'
      break
    }
    case 'LifeNewspaper':
      lifeEyes(p, -3 + 6 * ((t / 1.5) % 1), 0) // reading along the lines
      p.prop = 'newspaper'
      break
    case 'LifeChat':
      lifeEyes(p, 0, 3)
      if (t % 4 > 3)
        lifeStyled(p, 'arcUp') // a funny reply
      p.prop = 'phone'
      break
    case 'LifeWork':
      lifeEyes(p, 2 * sn(t, 0.25), 3)
      p.l.lid_top = p.r.lid_top = fr(0.15) // focused
      p.prop = 'laptop'
      break
    case 'LifeTea': {
      const sip = fr(bump(seg(u, 0.45, 0.85)))
      lifeEyes(p, 0, 0)
      if (sip > 0.5)
        lifeStyled(p, 'arcDown') // ahh
      p.prop = 'tea'
      break
    }
    case 'LifeArt':
      lifeEyes(p, 5, 1) // looking at the canvas
      if (u > 0.9)
        lifeStyled(p, 'arcUp') // proud
      p.prop = 'easel'
      break
    case 'LifeTv':
      lifeEyes(p, 0, 0)
      p.l.w = p.r.w = 16
      p.l.h = p.r.h = 16
      if (u > 0.8) { // something funny on TV
        p.l = eyePose(14, 10, 0, 'squeezeL')
        p.r = eyePose(14, 10, 0, 'squeezeR')
        p.l.y = p.r.y = -9
        p.dy = fr(sn(t, 4))
      }
      p.blink = u < 0.8
      p.prop = 'popcorn'
      break
    case 'LifeBook':
      lifeEyes(p, -4 + 8 * ((t / 1.5) % 1), 2)
      p.prop = 'book'
      break
    case 'Sleeping': // nap
      both(p, eyePose(20, 2, 0, 'line'))
      p.l.y = p.r.y = 2
      p.dy = fr(sn(t, 0.25))
      p.fx |= FX.zzz
      p.blink = false
      break
    default:
      both(p, eyePose(20, 22, 6))
      p.gaze = true
      break
  }
  return p
}

// ------------------------------------------------------------------------------ routine

export const MAX_ROUTINE = 24
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** "HH:MM" (also accepts "H:MM" like the server, normalized to "0H:MM"); null when invalid */
export function cleanHHMM(value) {
  if (typeof value !== 'string')
    return null
  let v = value.trim()
  if (/^\d:[0-5]\d$/.test(v))
    v = `0${v}`
  return HHMM_RE.test(v) ? v : null
}

export function minuteOfDay(hhmm) {
  const v = cleanHHMM(hhmm)
  return v === null ? -1 : Number(v.slice(0, 2)) * 60 + Number(v.slice(3))
}

export function hhmmOfMinute(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** The server's default day (schema.py default_routine) */
export function defaultRoutine() {
  const items = [
    ['08:00', '08:15', 'exercise'],
    ['08:15', '08:30', 'boxing'],
    ['08:30', '09:00', 'breakfast'],
    ['09:00', '09:20', 'newspaper'],
    ['09:20', '09:30', 'chat'],
    ['09:30', '11:00', 'work'],
    ['11:40', '12:00', 'chat'],
    ['13:00', '13:30', 'lunch'],
    ['13:30', '14:00', 'nap'],
    ['14:00', '15:30', 'work'],
    ['15:30', '16:00', 'tea'],
    ['17:00', '18:00', 'art'],
    ['18:30', '19:00', 'dinner'],
    ['19:00', '20:00', 'tv'],
    ['20:00', '21:00', 'book'],
  ]
  return { enabled: true, items: items.map(([start, end, activity]) => ({ start, end, activity })) }
}

/** Sorted by start like the server (stable: equal starts keep their order) */
export function sortRoutine(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

/** Why one item can't be saved: '' | 'time' | 'sameTime' | 'activity' */
export function routineItemProblem(item) {
  if (!item || typeof item !== 'object')
    return 'time'
  const start = cleanHHMM(item.start)
  const end = cleanHHMM(item.end)
  if (start === null || end === null)
    return 'time'
  if (start === end)
    return 'sameTime'
  if (!ACTIVITIES.includes(item.activity))
    return 'activity'
  return ''
}

/** First problem of a routine ({ code, index }), or null; code: 'tooMany' | 'time' | 'sameTime' | 'activity' */
export function routineProblem(routine) {
  const items = (routine && routine.items) || []
  if (items.length > MAX_ROUTINE)
    return { code: 'tooMany', index: -1 }
  for (let i = 0; i < items.length; i++) {
    const code = routineItemProblem(items[i])
    if (code)
      return { code, index: i }
  }
  return null
}

/** A complete routine from whatever the server sent (missing = the default day; bad items dropped) */
export function normalizeRoutine(raw) {
  if (!raw || typeof raw !== 'object')
    return defaultRoutine()
  const out = {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    items: Array.isArray(raw.items) ? [] : defaultRoutine().items,
  }
  if (Array.isArray(raw.items)) {
    raw.items.forEach((item) => {
      if (out.items.length < MAX_ROUTINE && !routineItemProblem(item))
        out.items.push({ start: cleanHHMM(item.start), end: cleanHHMM(item.end), activity: item.activity })
    })
  }
  out.items = sortRoutine(out.items)
  return out
}

/** PUT body for settings.routine: the full, sorted list */
export function routinePayload(routine) {
  const items = sortRoutine((routine && routine.items) || []).map(item => ({
    start: cleanHHMM(item.start) || item.start,
    end: cleanHHMM(item.end) || item.end,
    activity: item.activity,
  }))
  return { enabled: !!(routine && routine.enabled), items }
}

export function sameRoutine(a, b) {
  return JSON.stringify(routinePayload(a)) === JSON.stringify(routinePayload(b))
}

// [from, to) minute spans of an item; one crossing midnight is split in two
function spans(item) {
  const s = minuteOfDay(item.start)
  const e = minuteOfDay(item.end)
  if (s < 0 || e < 0 || s === e)
    return []
  return s < e ? [[s, e]] : [[s, 1440], [0, e]]
}

/** Minutes an item lasts (crossing midnight counts through) */
export function routineItemMinutes(item) {
  return spans(item).reduce((n, [a, b]) => n + b - a, 0)
}

/** Index pairs [i, j] (i < j) of items whose times overlap */
export function routineOverlaps(items) {
  const list = Array.isArray(items) ? items : []
  const out = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const hit = spans(list[i]).some(([a, b]) => spans(list[j]).some(([c, d]) => a < d && c < b))
      if (hit)
        out.push([i, j])
    }
  }
  return out
}

/** daily_life::Scheduled at a minute of the day: the first sorted item covering it, '' if none or off */
export function scheduledActivity(routine, minute) {
  if (!routine || routine.enabled === false)
    return ''
  const m = Math.floor(minute)
  const item = sortRoutine(routine.items).find(r => spans(r).some(([a, b]) => m >= a && m < b))
  return item ? item.activity : ''
}

/** A new item right after the last one (30 minutes of tea), or at noon in an empty day */
export function newRoutineItem(items) {
  const list = sortRoutine(items)
  const last = list[list.length - 1]
  const start = last ? minuteOfDay(last.end) : 12 * 60
  return { start: hhmmOfMinute(start), end: hhmmOfMinute(start + 30), activity: 'tea' }
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

function drawEye(c, e, cx, cy, isLeft, detail, lookX = 0, lookY = 0) {
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
          // The pupil looks where the eye looks and rolls toward the low side when TinyBot is
          // tilted (look_x/y), within the white of the eye
          const px = Math.min(0.24 * w, Math.max(-0.24 * w, 0.45 * e.x + lookX * 0.24 * w))
          const py = Math.min(0.24 * h, Math.max(-0.2 * h, 0.45 * e.y + lookY * 0.22 * h))
          const pcx = cx + px
          const pcy = cy + 1.5 + py
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
  if (fx & FX.zzz) {
    for (let i = 0; i < 3; i++) {
      const ph = fr((t * 0.45 + i / 3) % 1)
      const x = 100 + Math.trunc(ph * 12)
      const y = 46 - Math.trunc(ph * 44)
      glyph(c, ph > 0.6 ? 'Z' : 'z', x, y, ph > 0.6 ? 3 : 2)
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

// Clear: a dark gap around a prop so it stays apart from the eyes and paws
function clearAround(c, cx, cy, w, h) {
  fillRoundRect(c, cx, cy, w + 3, h + 3, 3, false)
}

function steam(c, x, y, t) {
  for (let i = 0; i < 2; i++) {
    const ph = (t * 0.8 + i * 0.5) % 1
    const yy = y - ph * 8
    const xx = x + i * 5 - 2
    if (ph < 0.85)
      line(c, xx + 1.5 * Math.sin(ph * 9), yy, xx + 1.5 * Math.sin(ph * 9 + 1.5), yy - 3, 1)
  }
}

function lerp(a, b, u) {
  return a + (b - a) * u
}

// DrawProp: the daily-life prop (with the paws when the look has them); takes the mouth's place
function drawProp(c, p, paws) {
  const t = p.fx_t || 0
  switch (p.prop) {
    case 'dumbbells': {
      // Arm curls, one side after the other, with the rep count in the middle
      for (let side = 0; side < 2; side++) {
        const lift = 0.5 - 0.5 * Math.cos(TWO_PI * t / 2 + (side ? PI : 0))
        const x = side ? 108 : 20
        const y = 57 - 20 * lift
        clearAround(c, x, y, 26, 16)
        line(c, x - 7, y, x + 7, y, 2.6) // handle
        for (const dx of [-9, 9]) { // plates
          fillRoundRect(c, x + dx, y, 6, 16, 1.5)
          line(c, x + dx, y - 6, x + dx, y + 6, 1, false)
        }
        if (paws)
          paw(c, x, y + 2, 5, side ? 4 : -4)
      }
      const reps = `x${(Math.trunc(t / 1) % 9) + 1}`
      text(c, reps, 64 - Math.trunc(textWidth(reps, 2) / 2), 42, 2)
      break
    }
    case 'gloves': {
      // Punching bag on the right; the left glove jabs it, the right one guards
      const u = (t % 1.2) / 1.2
      const jab = bump(seg(u, 0, 0.45))
      const swing = 5 * Math.sin(TWO_PI * seg(u, 0.25, 1)) * (1 - seg(u, 0.25, 1))
      const bx = 116 + swing
      line(c, 116, 0, bx, 12, 1.2) // chain
      fillRoundRect(c, bx, 33, 16, 42, 6) // bag
      line(c, bx - 7, 22, bx + 7, 22, 1.4, false)
      line(c, bx - 7, 45, bx + 7, 45, 1.4, false)
      const glove = (x, y, r) => {
        fillEllipse(c, x, y, r + 1.6, r * 0.85 + 1.6, false)
        fillEllipse(c, x, y, r, r * 0.85)
        fillEllipse(c, x - r * 0.45, y - r * 0.15, r * 0.3, r * 0.45, false) // thumb seam
        fillRoundRect(c, x + r * 0.2, y + r * 0.95, r * 1.2, 4, 1) // cuff
        line(c, x - r * 0.4, y + r * 0.95, x + r * 0.8, y + r * 0.95, 1, false)
      }
      glove(lerp(40, 92, jab), lerp(52, 40, jab), lerp(9, 10.5, jab))
      glove(22, 46, 8.5)
      if (jab > 0.85)
        text(c, 'POW', 70, 52)
      break
    }
    case 'bowl': {
      // Noodle bowl; the chopsticks lift a few noodles to the mouth
      const bite = bump(seg((t % 2.4) / 2.4, 0.3, 0.8))
      clearAround(c, 60, 54, 54, 22)
      fillEllipse(c, 58, 49, 26, 15)
      fillRect(c, 30, 33, 58, 16, false) // top half off: a bowl
      line(c, 31, 49, 85, 49, 2.4) // rim
      line(c, 40, 55, 76, 55, 1.2, false) // painted band
      for (let i = 0; i < 4; i++) ellipseRing(c, 44 + i * 9, 48, 4.5, 2.2, 1.2, 1) // noodles
      const tx = lerp(62, 64, bite) // chopstick tips
      const ty = lerp(46, 31, bite)
      const hx = lerp(98, 92, bite) // held end
      const hy = lerp(40, 30, bite)
      line(c, hx, hy, tx, ty, 1.8)
      line(c, hx + 2, hy + 3, tx + 2, ty + 2, 1.8)
      if (bite > 0.1) {
        for (let i = 0; i < 3; i++) { // hanging noodles
          const nx = tx - 2 + i * 2
          line(c, nx, ty + 1, nx + 1.5 * Math.sin(t * 6 + i), ty + 4 + 6 * bite, 1)
        }
      }
      else {
        steam(c, 54, 42, t)
        steam(c, 64, 41, t + 0.4)
      }
      if (paws)
        paw(c, hx + 2, hy + 4, 5, 10)
      break
    }
    case 'sandwich': {
      // A triangle sandwich held up in both paws, smaller with every bite
      const v = (t % 2.4) / 2.4
      const bites = Math.trunc(t / 2.4) % 4
      const y = 4 * bump(seg(v, 0.3, 0.7)) // lifted to the mouth
      const top = 32 - y
      const bottom = 60 - y
      clearAround(c, 64, (top + bottom) / 2, 48, 32)
      fillTriangle(c, 40, bottom, 88, bottom, 64, top)
      fillTriangle(c, 45, bottom - 2.5, 83, bottom - 2.5, 64, top + 5, false) // crust
      fillTriangle(c, 48, bottom - 4, 80, bottom - 4, 64, top + 9) // bread
      for (let i = 0; i < 2; i++) { // filling layers
        const ly = bottom - 9 - i * 6
        const half = (ly - top) * 0.85
        line(c, 64 - half, ly, 64 + half, ly, 1, false)
      }
      const zy = bottom - 12
      for (let x = 64 - (zy - top) * 0.8; x < 64 + (zy - top) * 0.8 - 3; x += 3)
        line(c, x, zy, x + 1.5, zy - 2, 1, false) // lettuce
      for (let i = 0; i < bites; i++) fillEllipse(c, 64 + (i % 2 ? 4 : -4), top + 3 + i * 3, 4, 4, false)
      if (paws) {
        paw(c, 40, bottom - 1, 5, -6)
        paw(c, 88, bottom - 1, 5, 6)
      }
      break
    }
    case 'apple': {
      // A big apple with a leaf; each bite leaves a bigger notch, then a new apple
      const v = (t % 2.4) / 2.4
      const bites = Math.trunc(t / 2.4) % 4
      const y = 48 - 4 * bump(seg(v, 0.3, 0.7))
      const x = 64
      clearAround(c, x, y, 30, 30)
      fillEllipse(c, x - 5, y + 1, 10, 11) // two lobes
      fillEllipse(c, x + 5, y + 1, 10, 11)
      fillEllipse(c, x, y - 10, 3, 2, false) // dip at the stem
      line(c, x, y - 9, x + 2, y - 15, 1.8) // stem
      fillEllipse(c, x + 7, y - 13, 5, 2.5) // leaf
      line(c, x + 3, y - 13, x + 11, y - 13, 1, false)
      fillEllipse(c, x - 8, y - 4, 2, 3.5, false) // shine
      for (let i = 0; i < bites; i++)
        fillEllipse(c, x + 15, y - 6 + i * 5, 5.5, 4, false) // bite marks, right side
      if (paws)
        paw(c, x - 13, y + 11, 5, -6)
      break
    }
    case 'newspaper': {
      // A big newspaper with a masthead, columns and a photo; peeking over the top
      const up = bump(seg(t % 6, 4.4, 5.6))
      const top = 30 - 3 * up
      const itop = Math.trunc(top)
      fillRect(c, 14, itop, 100, 64 - itop, false)
      fillRoundRect(c, 64, top + 18, 96, 36, 1)
      text(c, 'DAILY NEWS', 64 - Math.trunc(textWidth('DAILY NEWS') / 2), itop + 3, 1, false)
      line(c, 18, top + 10, 110, top + 10, 1, false)
      for (let i = 0; i < 6; i++) { // columns of text
        const ly = top + 13 + i * 3
        line(c, 20, ly, 60, ly, 1, false)
      }
      fillRect(c, 66, itop + 13, 42, 17, false) // photo
      fillTriangle(c, 70, top + 28, 82, top + 18, 92, top + 28)
      fillEllipse(c, 100, top + 18, 3, 3)
      if (paws) {
        paw(c, 16, top + 22, 5, -3)
        paw(c, 112, top + 22, 5, 3)
      }
      break
    }
    case 'phone': {
      // A phone with a chat on its screen; a "..." bubble when a friend is typing
      clearAround(c, 64, 49, 30, 34)
      fillRoundRect(c, 64, 49, 26, 32, 4)
      fillRoundRect(c, 64, 49, 20, 24, 1, false) // screen
      const n = Math.trunc(t % 4) // a new message every second
      for (let i = 0; i <= Math.min(n, 3); i++) {
        const mine = i % 2 === 1
        fillRoundRect(c, mine ? 67.5 : 60.5, 40 + i * 5.5, 11, 3.5, 1.4)
      }
      if (n === 3)
        heart(c, 67, 57, 5)
      fillEllipse(c, 64, 64, 2, 1.2, false)
      if (paws) {
        const tap = sn(t, 3) > 0 ? 1 : 0
        paw(c, 50, 58 - 2 * tap, 5, -6)
        paw(c, 78, 58 - 2 * (1 - tap), 5, 6)
      }
      fillRoundRect(c, 114, 7, 24, 12, 4) // typing bubble
      fillTriangle(c, 105, 10, 108, 12, 103, 16)
      for (let i = 0; i < 3; i++) {
        if (Math.trunc(t * 3) % 4 > i)
          fillEllipse(c, 107 + i * 7, 7, 1.5, 1.5, false)
      }
      break
    }
    case 'laptop': {
      // The back of an open laptop (with a little TinyBot logo); the paws type away
      clearAround(c, 64, 47, 64, 34)
      fillRoundRect(c, 64, 44, 60, 28, 2) // lid
      fillRoundRect(c, 64, 44, 13, 11, 3, false) // logo: a tiny TinyBot
      fillRoundRect(c, 64, 44, 9, 7, 2)
      fillRect(c, 61, 43, 1, 2, false)
      fillRect(c, 66, 43, 1, 2, false)
      fillRoundRect(c, 64, 60.5, 72, 4, 1) // base
      if (paws) {
        const a = sn(t, 6) > 0 ? 1 : 0
        paw(c, 38, 60 - 2 * a, 5, -5)
        paw(c, 90, 60 - 2 * (1 - a), 5, 5)
      }
      if (Math.trunc(t * 2) % 3 === 0)
        text(c, '</>', 105, 30)
      break
    }
    case 'tea': {
      // A big mug of tea with a tea-bag tag; steam curls (sometimes a heart); sips
      const sip = bump(seg((t % 5) / 5, 0.45, 0.85))
      const x = 58
      const y = 50 - 5 * sip
      clearAround(c, x + 6, y, 40, 28)
      fillRoundRect(c, x, y, 24, 24, 4) // mug
      ellipseRing(c, x + 12, y + 1, 7, 7, 3, 3) // handle
      heart(c, x - 1, y + 3, 8, false) // a heart printed on it
      line(c, x - 9, y - 7, x + 9, y - 7, 1.2, false) // tea line
      line(c, x + 6, y - 12, x + 15, y - 4, 1) // tag string
      fillRect(c, x + 13, Math.trunc(y) - 5, 6, 6)
      fillRect(c, x + 15, Math.trunc(y) - 3, 2, 2, false)
      if (sip < 0.2) {
        if (Math.trunc(t / 5) % 2 === 1) {
          heart(c, x, y - 20 - 2 * (t % 1), 6)
        }
        else {
          steam(c, x - 4, y - 14, t)
          steam(c, x + 3, y - 15, t + 0.5)
        }
      }
      if (paws) {
        paw(c, x - 8, y + 14, 5, -4)
        paw(c, x + 8, y + 14, 5, 4)
      }
      break
    }
    case 'easel': {
      // Painting: a palette in one paw, the brush in the other, the picture grows
      const u = (t % 8) / 8
      clearAround(c, 104, 47, 34, 34)
      fillRoundRect(c, 104, 45, 30, 26, 1) // canvas
      line(c, 96, 58, 92, 64, 1.6) // legs
      line(c, 112, 58, 116, 64, 1.6)
      if (u > 0.05)
        line(c, 91, 52, 91 + 26 * Math.min(1, (u - 0.05) / 0.25), 46, 1.4, false)
      if (u > 0.35)
        ellipseRing(c, 111, 39, 3.5, 3.5, 1.2, 0, false)
      if (u > 0.55) {
        fillRect(c, 96, 45, 7, 6, false)
        fillTriangle(c, 95, 45, 104, 45, 99.5, 40, false)
      }
      const k = (u * 3) % 1
      const bx = 94 + 18 * k
      const by = 50 - 8 * bump(k)
      line(c, bx, by, bx - 14, by + 10, 1.6) // brush
      fillEllipse(c, bx, by, 1.8, 1.8)
      if (paws)
        paw(c, bx - 15, by + 11, 5, -4)
      clearAround(c, 26, 52, 30, 18) // palette
      fillEllipse(c, 26, 52, 15, 9)
      fillEllipse(c, 33, 56, 3, 2.4, false) // thumb hole
      for (let i = 0; i < 4; i++) fillEllipse(c, 17 + i * 5, 49 + (i % 2) * 2, 1.8, 1.8, false)
      if (paws)
        paw(c, 26, 60, 5, -4)
      break
    }
    case 'popcorn': {
      // Watching TV: a striped popcorn bucket, popcorn flying, the remote in a paw
      clearAround(c, 60, 52, 34, 26)
      fillTriangle(c, 46, 42, 74, 42, 70, 64)
      fillTriangle(c, 46, 42, 70, 64, 50, 64)
      for (let i = 0; i < 3; i++) line(c, 54 + i * 6, 43, 55 + i * 5, 63, 2, false)
      for (let i = 0; i < 6; i++) { // the popcorn heap
        const px = 47 + i * 5.2
        const py = 41 - (i % 2) * 3
        fillEllipse(c, px, py, 3.2, 3, false)
        fillEllipse(c, px, py, 2.4, 2.2)
      }
      const pop = (t % 1.5) / 1.5
      if (pop < 0.7)
        fillEllipse(c, 58 + 10 * pop, 36 - 9 * bump(pop / 0.7), 2, 2)
      fillRoundRect(c, 98, 50, 9, 20, 2) // remote
      fillEllipse(c, 98, 44, 2, 2, false)
      for (let i = 0; i < 3; i++) fillRect(c, 96, 49 + i * 4, 4, 2, false)
      if (paws) {
        paw(c, 48, 58, 5, -6)
        paw(c, 98, 58, 5, 4)
      }
      break
    }
    case 'book': {
      // An open storybook with text and a picture; a page turns every 6 s
      const turn = seg(t % 6, 4.9, 5.8)
      clearAround(c, 64, 49, 84, 34)
      fillTriangle(c, 22, 36, 63, 40, 22, 62) // left page
      fillTriangle(c, 63, 40, 63, 64, 22, 62)
      fillTriangle(c, 106, 36, 65, 40, 106, 62) // right page
      fillTriangle(c, 65, 40, 65, 64, 106, 62)
      for (let i = 0; i < 5; i++) {
        const ly = 42 + i * 4
        line(c, 27, ly - 1.5, 59, ly, 1, false)
      }
      fillTriangle(c, 72, 54, 82, 44, 92, 54, false) // picture: a hill and the sun
      ellipseRing(c, 98, 44, 3, 3, 1.2, 0, false)
      line(c, 70, 58, 100, 58, 1, false)
      if (turn > 0 && turn < 1) { // the turning page
        const x = lerp(104, 24, ease(turn))
        const lift = 8 * bump(turn)
        fillTriangle(c, 64, 40, x, 37 - lift, x, 61 - lift)
        fillTriangle(c, 64, 40, 64, 63, x, 61 - lift)
        line(c, 64, 40, x, 37 - lift, 1, false)
      }
      if (paws) {
        paw(c, 20, 58, 5, -6)
        paw(c, 108, 58, 5, 6)
      }
      break
    }
    default:
      break
  }
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

// look_x / look_y: -1..1, 0 when missing
function clampUnit(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(-1, n)) : 0
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
  const lookX = fr(clampUnit(pose.look_x))
  const lookY = fr(clampUnit(pose.look_y))
  drawEye(canvas, p.l, lx, ly, true, look.eyes, lookX, lookY)
  drawEye(canvas, p.r, rx, ry, false, look.eyes, lookX, lookY)
  const eyesBottom = Math.max(ly + p.l.h / 2, ry + p.r.h / 2)
  if (p.prop && p.prop !== 'none') {
    // TV light flickering in the eyes while watching
    if (p.prop === 'popcorn' && p.l.style === 'normal') {
      const f = ((p.fx_t || 0) * 2.5) % 1
      for (const ex of [lx, rx]) fillRoundRect(canvas, ex - 3 + 4 * f, ly - 3, 3, 3 + 2 * f, 1, false)
    }
    drawProp(canvas, p, look.hands) // takes the mouth's place
  }
  else if (look.mouth !== 'none') {
    drawMouth(canvas, p, look.mouth, eyesBottom)
  }
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

/** One TinyBot's-day animation frame (Life* / Sleeping) at t seconds, without liveliness */
export function renderLife(anim, rawLook, t, canvas) {
  return renderFace(evaluateLife(anim, t), rawLook, canvas)
}

/**
 * One preview frame of an activity at tMs since it started, plus liveliness when given.
 * Meals show the food of `variant` (daily_life::Anim), or cycle through the three when it is null.
 */
export function renderActivityFrame(activity, rawLook, tMs, liveliness, nowMs, canvas, variant = null) {
  const v = variant === null || variant === undefined ? previewMealVariant(tMs) : variant
  const anim = activityAnim(activity, v)
  if (!anim)
    return renderMoodFrame('neutral', rawLook, tMs, liveliness, nowMs, canvas)
  const pose = evaluateLife(anim, (Math.max(0, tMs) / 1000) % LIFE_DURATION[anim])
  if (liveliness)
    liveliness.apply(pose, nowMs === undefined ? tMs : nowMs, rawLook)
  return renderFace(pose, rawLook, canvas)
}

/** Reduced motion: one representative still frame of the activity */
export function renderActivityStill(activity, rawLook, canvas, variant = 0) {
  const anim = activityAnim(activity, variant)
  if (!anim)
    return renderMoodStill('neutral', rawLook, canvas)
  return renderLife(anim, rawLook, LIFE_STILL_T[anim] || 0, canvas)
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
