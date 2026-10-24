import { describe, expect, it } from 'vitest';
import {
  H,
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
  sameLook,
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
