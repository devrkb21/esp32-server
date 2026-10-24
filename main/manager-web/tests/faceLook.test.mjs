import { describe, expect, it } from 'vitest';
import {
  H,
  MOOD_DURATION,
  MOODS,
  W,
  countPixels,
  createCanvas,
  createLiveliness,
  defaultLook,
  evaluateMood,
  fillRoundRect,
  getPixel,
  isDefaultLook,
  litBounds,
  normalizeLook,
  pixelRuns,
  renderFace,
  renderMoodFrame,
  renderMoodStill,
  sameLook,
  toAscii,
  toSvg,
} from '../src/utils/faceLook.mjs';

function face(look = {}, mood = 'neutral', t = 0) {
  return renderFace(evaluateMood(mood, t), { ...defaultLook(), ...look });
}

function lit(c) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (getPixel(c, x, y)) out.push(`${x},${y}`);
  return out;
}

function rowSpan(c, y, x0 = 0, x1 = W - 1) {
  const xs = [];
  for (let x = x0; x <= x1; x++) if (getPixel(c, x, y)) xs.push(x);
  return xs.length ? [xs[0], xs[xs.length - 1], xs.length] : null;
}

// Neutral eyes: 20x22 r6 at 1.35x = 27 x 29.7, r 8.1, centred at (38, 30) and (90, 30)
const EYE_BOTTOM = 30 + 29.7 / 2; // 44.85

describe('look settings', () => {
  it('fills missing keys with the original face and clamps bad values', () => {
    expect(normalizeLook(undefined)).toEqual(defaultLook());
    expect(normalizeLook({ size: 300, spacing: -40, height: '3', shape: 'star', mouth: 'cat', blush: 'yes' }))
      .toEqual({ ...defaultLook(), size: 125, spacing: -10, height: 3, mouth: 'cat' });
    expect(isDefaultLook({})).toBe(true);
    expect(sameLook({ size: 100 }, {})).toBe(true);
    expect(sameLook({ blush: true }, {})).toBe(false);
    expect(defaultLook().hands).toBe(true);
    expect(normalizeLook({ hands: false }).hands).toBe(false);
    expect(normalizeLook({ hands: 'no' }).hands).toBe(true);
    expect(sameLook({ hands: false }, {})).toBe(false);
  });
});

describe('face drawing', () => {
  it('default neutral face lights exactly the two firmware round rects', () => {
    const c = face();
    const expected = createCanvas();
    fillRoundRect(expected, 38, 30, 27, 29.7, 8.1);
    fillRoundRect(expected, 90, 30, 27, 29.7, 8.1);
    expect(lit(c)).toEqual(lit(expected));

    // hand-computed FillRoundRect rows: top 15.15, bottom 44.85, left 24.5, right 51.5
    expect(rowSpan(c, 30, 0, 63)).toEqual([24, 51, 28]); // full width row
    expect(rowSpan(c, 30, 64, 127)).toEqual([76, 103, 28]);
    // y 15: d = 15.15 + 8.1 - 15.5 = 7.75, inset = 8.1 - sqrt(8.1² - 7.75²) = 5.74 -> 30..45
    expect(rowSpan(c, 15, 0, 63)).toEqual([30, 45, 16]);
    expect(rowSpan(c, 14)).toBeNull();
    expect(rowSpan(c, 44, 0, 63)).toEqual([30, 45, 16]);
    expect(rowSpan(c, 45)).toBeNull();
    expect(countPixels(c, 0, 0, 63, 63)).toBe(countPixels(c, 64, 0, 127, 63));
  });

  it('spacing moves each eye outward and height moves both down', () => {
    const base = face();
    const wide = face({ spacing: 5 });
    const low = face({ height: 3 });
    const bl = litBounds(base, 0, 0, 63, 63);
    const br = litBounds(base, 64, 0, 127, 63);
    expect(litBounds(wide, 0, 0, 63, 63)).toEqual({ ...bl, x0: bl.x0 - 5, x1: bl.x1 - 5 });
    expect(litBounds(wide, 64, 0, 127, 63)).toEqual({ ...br, x0: br.x0 + 5, x1: br.x1 + 5 });
    expect(litBounds(low, 0, 0, 63, 63)).toEqual({ ...bl, y0: bl.y0 + 3, y1: bl.y1 + 3 });
    const narrow = face({ spacing: -10 });
    expect(litBounds(narrow, 0, 0, 63, 63).x1).toBe(bl.x1 + 10);
  });

  it('size scales the eyes', () => {
    const big = litBounds(face({ size: 125 }), 0, 0, 63, 63);
    const small = litBounds(face({ size: 75 }), 0, 0, 63, 63);
    const base = litBounds(face(), 0, 0, 63, 63);
    expect(big.x1 - big.x0).toBeGreaterThan(base.x1 - base.x0);
    expect(small.x1 - small.x0).toBeLessThan(base.x1 - base.x0);
    expect(small.y1 - small.y0).toBe(21); // 22 * 1.35 * 0.75 = 22.3 rows tall
  });

  it('shape changes only the corners', () => {
    const rounded = face();
    const round = face({ shape: 'round' });
    const square = face({ shape: 'square' });
    expect(rowSpan(round, 15, 0, 63)[2]).toBeLessThan(rowSpan(rounded, 15, 0, 63)[2]);
    expect(rowSpan(square, 15, 0, 63)[2]).toBeGreaterThan(rowSpan(rounded, 15, 0, 63)[2]);
    expect(rowSpan(square, 30, 0, 63)).toEqual(rowSpan(rounded, 30, 0, 63));
  });

  it('shine cuts a highlight and pupil leaves a lit dot inside a dark pupil', () => {
    const plain = face();
    const shine = face({ eyes: 'shine' });
    // shine at (38 - 5.4, 30 - 5.94), radius 3.24
    expect(getPixel(shine, 32, 24)).toBe(false);
    expect(getPixel(plain, 32, 24)).toBe(true);
    expect(countPixels(shine)).toBeLessThan(countPixels(plain));

    const pupil = face({ eyes: 'pupil' });
    // pupil centre (38, 31.5): rx 7.02, ry 8.3; dot at (35.5, 28.6) r 2.1
    expect(getPixel(pupil, 38, 33)).toBe(false);
    expect(getPixel(pupil, 35, 28)).toBe(true);
    expect(getPixel(pupil, 25, 30)).toBe(true); // eye edge still lit
  });

  it('the pupil rolls with the robot\'s tilt (look_x / look_y), within the eye', () => {
    const tilt = (lx, ly) => renderFace({ ...evaluateMood('neutral', 0), look_x: lx, look_y: ly }, { eyes: 'pupil' });
    // eye 27 x 29.7 at (38, 30): px = clamp(0.24 * 27 * look_x, ±6.48), py = clamp(0.22 * 29.7 * look_y, -5.94..7.13)
    const level = tilt(0, 0);
    expect(lit(level)).toEqual(lit(face({ eyes: 'pupil' })));
    const right = tilt(1, 0); // centre (44.48, 31.5)
    expect(getPixel(level, 49, 33)).toBe(true);
    expect(getPixel(right, 49, 33)).toBe(false);
    const left = tilt(-1, 0); // centre (31.52, 31.5)
    expect(getPixel(level, 27, 33)).toBe(true);
    expect(getPixel(left, 27, 33)).toBe(false);
    const down = tilt(0, 1); // centre (38, 38.03)
    expect(getPixel(level, 40, 44)).toBe(true);
    expect(getPixel(down, 40, 44)).toBe(false);
    const up = tilt(0, -1); // clamped at -0.2 h: centre (38, 25.56)
    expect(getPixel(up, 40, 19)).toBe(false);
    expect(getPixel(level, 40, 19)).toBe(true);
    // -1..1 only, and both eyes roll the same way
    expect(lit(tilt(5, 0))).toEqual(lit(right));
    expect(lit(tilt('x', null))).toEqual(lit(level));
    expect(getPixel(right, 90 + 11, 33)).toBe(false);
  });

  it('draws no detail while the lid is mostly closed (sleepy)', () => {
    expect(lit(face({ eyes: 'pupil' }, 'sleepy'))).toEqual(lit(face({}, 'sleepy')));
  });

  it('"none" draws nothing below the eyes; each mouth draws in the mouth area', () => {
    const below = (c) => countPixels(c, 0, Math.ceil(EYE_BOTTOM) + 1, W - 1, H - 1);
    expect(below(face())).toBe(0);
    // my = 44.85 + 7 = 51.85
    const smile = face({ mouth: 'smile' });
    const cat = face({ mouth: 'cat' });
    const dot = face({ mouth: 'dot' });
    for (const c of [smile, cat, dot]) {
      const box = litBounds(c, 0, 46, W - 1, H - 1);
      expect(box).not.toBeNull();
      expect(box.x0).toBeGreaterThanOrEqual(54);
      expect(box.x1).toBeLessThanOrEqual(73);
      expect(box.y0).toBeGreaterThanOrEqual(46);
      expect(box.y1).toBeLessThanOrEqual(60);
    }
    // smile: lower half ring rx 6 at y 49.85; dot: 4x4 disc at (64, 51.85); cat: two arcs
    expect(litBounds(smile, 0, 46, W - 1, H - 1)).toEqual({ x0: 57, y0: 49, x1: 70, y1: 53 });
    expect(litBounds(dot, 0, 46, W - 1, H - 1)).toEqual({ x0: 62, y0: 50, x1: 65, y1: 53 });
    expect(getPixel(cat, 64, 50)).toBe(true); // the two arcs meet in the middle
    expect(countPixels(dot)).toBe(countPixels(face()) + countPixels(dot, 0, 46, W - 1, H - 1));
  });

  it('the mouth follows the mood', () => {
    const area = [0, 40, W - 1, H - 1];
    const sad = litBounds(face({ mouth: 'smile' }, 'sad', 0), ...area);
    const happy = litBounds(face({ mouth: 'smile' }, 'happy', 0), ...area);
    const surprised = face({ mouth: 'dot' }, 'surprised', 1);
    expect(happy.x1 - happy.x0).toBeGreaterThan(14); // wider smile
    expect(sad).not.toBeNull();
    // surprised: open "o" ring instead of the dot
    const o = litBounds(surprised, 56, 48, 72, H - 1);
    expect(o.x1 - o.x0).toBe(7);
    expect(getPixel(surprised, 64, Math.round((o.y0 + o.y1) / 2))).toBe(false);
  });

  it('blush adds cheek marks below both eyes, but not over ring eyes', () => {
    const on = face({ blush: true });
    const area = [0, 46, W - 1, H - 1];
    expect(countPixels(face(), ...area)).toBe(0);
    expect(litBounds(on, 0, 46, 63, H - 1)).not.toBeNull();
    expect(litBounds(on, 64, 46, W - 1, H - 1)).not.toBeNull();
    expect(lit(face({ blush: true }, 'surprised', 1))).toEqual(lit(face({}, 'surprised', 1)));
    // the love mood blushes on its own
    expect(countPixels(face({}, 'love'), ...area)).toBeGreaterThan(0);
  });
});

describe('liveliness', () => {
  function seq(values) {
    let i = 0;
    return () => values[i++ % values.length];
  }

  it('blinks after 3 s, then at the chosen pace', () => {
    const live = createLiveliness(() => 0);
    const look = { blink: 'fast' };
    expect(live.apply(evaluateMood('neutral', 0), 2999, look).l.lid_top).toBe(0);
    live.apply(evaluateMood('neutral', 0), 3000, look);
    const mid = live.apply(evaluateMood('neutral', 0), 3110, look);
    expect(mid.l.lid_top).toBeCloseTo(1, 5);
    live.apply(evaluateMood('neutral', 0), 3220, look);
    expect(live.state.nextBlink).toBe(3220 + 1400);
  });

  it('shifts the gaze only for moods that look around', () => {
    const live = createLiveliness(seq([0.5, 0]));
    const p = live.apply(evaluateMood('neutral', 0), 4500, { energy: 'playful' });
    expect(p.l.x).toBe(6);
    expect(live.state.nextGaze).toBe(4500 + 2000);
    const sad = live.apply(evaluateMood('sad', 0), 4600, {});
    expect(sad.l.x).toBe(0);
  });

  it('never blinks the surprised ring eyes', () => {
    const live = createLiveliness(() => 0);
    const p = live.apply(evaluateMood('surprised', 0), 3110, {});
    expect(p.l.lid_top).toBe(0);
    expect(p.l.h).toBe(26);
  });

  it('renders a frame and exports runs / svg', () => {
    const c = renderMoodFrame('happy', { mouth: 'smile' }, 5000, createLiveliness(() => 0.3));
    const runs = pixelRuns(c);
    expect(runs.reduce((n, r) => n + r[2], 0)).toBe(countPixels(c));
    expect(toSvg(c)).toContain('viewBox="0 0 128 64"');
  });
});

describe('hands', () => {
  // Pixels lit with the paws that are not lit without them (the paws also cut dark rims)
  function handPixels(mood, t, pose) {
    const p = pose || evaluateMood(mood, t);
    const on = renderFace(p, defaultLook());
    const off = renderFace(p, { ...defaultLook(), hands: false });
    const c = createCanvas();
    for (let i = 0; i < W * H; i++) c.bits[i] = on.bits[i] && !off.bits[i] ? 1 : 0;
    return { on, off, added: c };
  }

  it('every mood is listed with its firmware duration', () => {
    expect(MOODS).toEqual(['neutral', 'happy', 'sleepy', 'sad', 'love', 'surprised', 'like', 'thinking', 'shy', 'hello', 'yawn']);
    expect(MOODS.every((m) => MOOD_DURATION[m] > 0)).toBe(true);
    expect(MOOD_DURATION.hello).toBe(1.1);
    expect(MOOD_DURATION.yawn).toBe(3);
  });

  it('hands off draws nothing new: the frame equals the pose without hands', () => {
    for (const [mood, t] of [['like', 1], ['thinking', 1], ['surprised', 0.8], ['shy', 0.6], ['hello', 0.5], ['yawn', 1.6]]) {
      const pose = evaluateMood(mood, t);
      const off = renderFace(pose, { ...defaultLook(), hands: false });
      const none = renderFace({ ...pose, hands: 'none' }, defaultLook());
      expect(lit(off)).toEqual(lit(none));
      expect(lit(off)).not.toEqual(lit(renderFace(pose, defaultLook())));
    }
    // moods without paws are unchanged by the switch
    expect(lit(face({ hands: false }, 'happy'))).toEqual(lit(face({}, 'happy')));
  });

  it('hand_k 0 draws no hand', () => {
    const pose = { ...evaluateMood('like', 1), hand_k: 0 };
    expect(lit(renderFace(pose, defaultLook()))).toEqual(lit(renderFace({ ...pose, hands: 'none' }, defaultLook())));
    // the like paw is still below the screen at the start
    expect(evaluateMood('like', 0).hand_k).toBe(0);
    expect(evaluateMood('hello', 1.1).hand_k).toBe(0);
  });

  it('thumbs up: on the right side', () => {
    const box = litBounds(handPixels('like', 1).added);
    expect(box).not.toBeNull();
    expect(box.x0).toBeGreaterThan(95);
    expect(box.y1).toBe(H - 1); // the arm comes up from the bottom edge
  });

  it('cheeks: near both edges, below the eyes', () => {
    const { added } = handPixels('surprised', 0.8);
    const left = litBounds(added, 0, 0, 63, H - 1);
    const right = litBounds(added, 64, 0, W - 1, H - 1);
    expect(left.x1).toBeLessThan(24);
    expect(right.x0).toBeGreaterThan(103);
    expect(left.y0).toBeGreaterThanOrEqual(38); // below the middle of the ring eyes
  });

  it('cover eyes: over both eye boxes', () => {
    const p = evaluateMood('shy', 0.6);
    const { added, off } = handPixels('shy', 0.6);
    const eyeL = litBounds(off, 0, 0, 63, 46);
    const eyeR = litBounds(off, 64, 0, 100, 46);
    // the paws light pixels inside both eye boxes and cover most of each eye
    expect(countPixels(added, eyeL.x0, eyeL.y0, eyeL.x1, eyeL.y1)).toBeGreaterThan(0);
    expect(countPixels(added, eyeR.x0, eyeR.y0, eyeR.x1, eyeR.y1)).toBeGreaterThan(0);
    const pawL = litBounds(added, 0, 0, 63, H - 1);
    expect(pawL.x0).toBeLessThanOrEqual(eyeL.x0 + 6) // where the paw overlaps the eye it adds no pixels;
    expect(pawL.x1).toBeGreaterThanOrEqual(eyeL.x1 - 4);
    expect(p.hand_k).toBe(1);
  });

  it('chin: one paw below the eyes, a little right of centre', () => {
    const { added, off } = handPixels('thinking', 1);
    const eyes = litBounds(off, 0, 0, 100, H - 1);
    const paw = litBounds(added, 0, 0, 100, H - 1);
    expect(paw.y0).toBeGreaterThan(eyes.y1);
    expect(paw.x0).toBeGreaterThan(55);
    expect(paw.x1).toBeLessThan(85);
  });

  it('cover mouth: bottom centre', () => {
    const paw = litBounds(handPixels('yawn', 1.6).added);
    expect(paw.x0).toBeGreaterThan(50);
    expect(paw.x1).toBeLessThan(78);
    expect(paw.y0).toBeGreaterThanOrEqual(34); // under the squeezed eyes
    expect(paw.y1).toBe(H - 1);
  });

  it('wave and wave both: paws at the sides', () => {
    const one = litBounds(handPixels('hello', 0.5).added);
    expect(one.x0).toBeGreaterThan(100);
    const pose = { ...evaluateMood('hello', 0.5), hands: 'waveBoth' };
    const both = handPixels(null, 0, pose).added;
    expect(litBounds(both, 0, 0, 40, H - 1).x1).toBeLessThan(28);
    expect(litBounds(both, 88, 0, W - 1, H - 1).x0).toBeGreaterThan(100);
  });

  it('reduced motion shows a still frame with the paw fully up', () => {
    for (const mood of ['like', 'thinking', 'surprised', 'shy', 'hello', 'yawn']) {
      expect(lit(renderMoodStill(mood, defaultLook()))).not.toEqual(lit(renderMoodStill(mood, { hands: false })));
    }
    expect(lit(renderMoodStill('neutral', {}))).toEqual(lit(face()));
  });

  it('animated moods loop on their firmware duration', () => {
    const a = renderMoodFrame('hello', {}, 500, null);
    const b = renderMoodFrame('hello', {}, 1600, null);
    expect(lit(a)).toEqual(lit(b));
    expect(toAscii(a).split(String.fromCharCode(10))).toHaveLength(H);
  });
});
