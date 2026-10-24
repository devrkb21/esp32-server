import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  H,
  LIFE_DURATION,
  LIFE_STILL_T,
  MAX_ROUTINE,
  MEALS,
  W,
  activityAnim,
  cleanHHMM,
  countPixels,
  createCanvas,
  createLiveliness,
  defaultLook,
  defaultRoutine,
  evaluateLife,
  getPixel,
  heart,
  litBounds,
  newRoutineItem,
  normalizeRoutine,
  previewMealVariant,
  renderActivityFrame,
  renderActivityStill,
  renderFace,
  renderLife,
  routineItemMinutes,
  routineOverlaps,
  routinePayload,
  routineProblem,
  sameRoutine,
  scheduledActivity,
  text,
  textWidth,
  toAscii,
} from '../src/utils/faceLook.mjs';

// vitest runs from manager-web/
const SCHEMA = resolve(process.cwd(), '../xiaozhi-server/core/companion/schema.py');

function lit(c) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (getPixel(c, x, y)) out.push(`${x},${y}`);
  return out;
}

// Eyes only: the pose without its prop or overlays
function eyesOnly(anim, t) {
  return renderFace({ ...evaluateLife(anim, t), prop: 'none', fx: 0 }, defaultLook());
}

const LIFE_ANIMS = Object.keys(LIFE_DURATION);

describe('TinyBot\'s day: activities', () => {
  it('lists the server activities in order', () => {
    expect(ACTIVITIES).toEqual(['exercise', 'boxing', 'breakfast', 'lunch', 'dinner', 'newspaper', 'chat', 'work',
      'nap', 'tea', 'art', 'tv', 'book']);
    if (existsSync(SCHEMA)) {
      const src = readFileSync(SCHEMA, 'utf8');
      const tuple = src.match(/^ACTIVITIES = \(([\s\S]*?)\)/m)[1];
      expect(ACTIVITIES).toEqual([...tuple.matchAll(/"(\w+)"/g)].map((m) => m[1]));
    }
  });

  it('maps activities to the firmware animations (daily_life::Anim)', () => {
    expect(activityAnim('exercise')).toBe('LifeExercise');
    expect(activityAnim('nap')).toBe('Sleeping');
    expect(activityAnim('tv')).toBe('LifeTv');
    expect(activityAnim('nope')).toBeNull();
    for (const a of ACTIVITIES) expect(LIFE_DURATION[activityAnim(a)]).toBeGreaterThan(0);
  });

  it('meals pick noodles, a sandwich or an apple by variant', () => {
    for (const meal of MEALS) {
      expect([0, 1, 2].map((v) => activityAnim(meal, v))).toEqual(['LifeEatBowl', 'LifeEatSandwich', 'LifeEatApple']);
      expect(activityAnim(meal, 4)).toBe('LifeEatSandwich');
      expect(activityAnim(meal, -1)).toBe('LifeEatApple');
    }
    expect(evaluateLife('LifeEatBowl', 0).prop).toBe('bowl');
    expect(evaluateLife('LifeEatSandwich', 0).prop).toBe('sandwich');
    expect(evaluateLife('LifeEatApple', 0).prop).toBe('apple');
    // the preview shows the three foods in turn, one sandwich/apple loop each
    expect([0, 9599, 9600, 19200, 28800].map(previewMealVariant)).toEqual([0, 0, 1, 2, 0]);
    expect(lit(renderActivityFrame('lunch', {}, 1000, null, 0, undefined, 2)))
      .toEqual(lit(renderLife('LifeEatApple', {}, 1)));
  });

  it('every activity draws in the prop area under the eyes', () => {
    for (const anim of LIFE_ANIMS) {
      for (const t of [0, LIFE_STILL_T[anim], LIFE_DURATION[anim] * 0.66]) {
        const c = renderLife(anim, defaultLook(), t);
        if (anim === 'Sleeping') {
          // nap: closed eyes and the floating Zzz on the right
          expect(countPixels(c, 100, 0, W - 1, H - 1)).toBeGreaterThan(10);
          continue;
        }
        expect(countPixels(c, 0, 36, W - 1, H - 1), `${anim} t=${t}`).toBeGreaterThan(40);
      }
    }
  });

  it('the life eyes stay up, above the props', () => {
    for (const anim of LIFE_ANIMS.filter((a) => a !== 'Sleeping')) {
      for (let t = 0; t < LIFE_DURATION[anim]; t += 0.1) {
        const eyes = litBounds(eyesOnly(anim, t));
        expect(eyes.y1, `${anim} t=${t.toFixed(1)}`).toBeLessThanOrEqual(31);
      }
    }
    // smaller and higher than the normal face (bottom row 41)
    expect(litBounds(eyesOnly('LifeBook', 1)).y1).toBeLessThanOrEqual(30);
  });

  it('uses the firmware life eyes: Eye(15, 14, 5) at y -9 (LifeEyes)', () => {
    const p = evaluateLife('LifeExercise', 0);
    for (const e of [p.l, p.r]) expect([e.w, e.h, e.r, e.x, e.y, e.style]).toEqual([15, 14, 5, 0, -9, 'normal']);
    expect(evaluateLife('LifeBook', 0).l.y).toBe(-7); // LifeEyes(p, -4 + 8 * line, 2)
    expect(evaluateLife('LifeBook', 0).l.x).toBe(-4);
    expect(evaluateLife('LifeBoxing', 0).l.x).toBe(4); // eyes on the bag
    const tv = evaluateLife('LifeTv', 1);
    expect([tv.l.w, tv.l.h, tv.l.y]).toEqual([16, 16, -9]);
    const funny = evaluateLife('LifeTv', 5.5);
    expect([funny.l.style, funny.l.w, funny.l.h, funny.l.y]).toEqual(['squeezeL', 14, 10, -9]);
    const yum = evaluateLife('LifeEatBowl', 1.32); // bite at its peak
    expect([yum.l.style, yum.l.w, yum.l.h, yum.l.y]).toEqual(['arcUp', 15, 9, -9]);
  });

  it('the prop takes the mouth\'s place', () => {
    for (const a of ACTIVITIES.filter((x) => x !== 'nap')) {
      const smile = renderActivityStill(a, { mouth: 'smile' });
      expect(lit(smile), a).toEqual(lit(renderActivityStill(a, {})));
    }
    // nap holds nothing: the chosen mouth shows under the closed eyes, like on the robot
    expect(lit(renderActivityStill('nap', { mouth: 'smile' }))).not.toEqual(lit(renderActivityStill('nap', {})));
  });

  it('hands off draws no paws', () => {
    for (const anim of LIFE_ANIMS.filter((a) => a !== 'Sleeping' && a !== 'LifeBoxing')) {
      const t = LIFE_STILL_T[anim];
      const on = renderLife(anim, { hands: true }, t);
      const off = renderLife(anim, { hands: false }, t);
      expect(lit(off), anim).not.toEqual(lit(on));
      // the paws' arms come up from the bottom edge: lit there only with the paws
      let armOnly = 0;
      for (let x = 0; x < W; x++) if (getPixel(on, x, H - 1) && !getPixel(off, x, H - 1)) armOnly++;
      expect(armOnly, anim).toBeGreaterThan(0);
    }
    // these props end above the bottom row: without paws nothing reaches it
    for (const anim of ['LifeEatSandwich', 'LifeEatApple', 'LifeWork', 'LifeTea']) {
      expect(countPixels(renderLife(anim, { hands: false }, LIFE_STILL_T[anim]), 0, H - 1, W - 1, H - 1), anim).toBe(0);
    }
    // boxing gloves are the arms themselves; nap holds nothing
    expect(lit(renderLife('LifeBoxing', { hands: false }, 0.3))).toEqual(lit(renderLife('LifeBoxing', {}, 0.3)));
    expect(lit(renderLife('Sleeping', { hands: false }, 1))).toEqual(lit(renderLife('Sleeping', {}, 1)));
  });

  it('boxing: the left glove jabs the bag with a "POW", the right one guards', () => {
    const jab = renderLife('LifeBoxing', {}, 0.3);
    const rest = renderLife('LifeBoxing', {}, 1.0);
    expect(litBounds(jab, 60, 30, 104, 50).x1).toBeGreaterThan(95); // glove at the bag
    expect(countPixels(jab, 70, 52, 80, 56)).toBeGreaterThan(10); // POW
    expect(countPixels(rest, 70, 52, 80, 56)).toBe(0);
    expect(litBounds(rest, 30, 30, 100, 63).x1).toBeLessThan(50); // glove pulled back
    expect(countPixels(jab, 110, 0, 122, 10)).toBeGreaterThan(5); // the chain of the bag
    expect(countPixels(jab, 12, 36, 32, 56)).toBeGreaterThan(80); // guarding glove
  });

  it('draws the 3x5 text of FaceCanvas::Text', () => {
    expect(textWidth('DAILY NEWS')).toBe(39);
    expect(textWidth('x5', 2)).toBe(14);
    expect(textWidth('')).toBe(0);
    const c = createCanvas();
    text(c, 'T1', 0, 0);
    expect(toAscii(c).split('\n').slice(0, 5).map((r) => r.slice(0, 7))).toEqual([
      '###..#.',
      '.#..##.',
      '.#...#.',
      '.#...#.',
      '.#..###',
    ]);
    // exercise counts reps in the middle at 2x: "x2" one second in
    const reps = createCanvas();
    text(reps, 'x2', 64 - Math.trunc(textWidth('x2', 2) / 2), 42, 2);
    const ex = renderLife('LifeExercise', {}, 1);
    for (let y = 42; y < 52; y++) for (let x = 57; x < 71; x++) expect(getPixel(ex, x, y), `${x},${y}`).toBe(getPixel(reps, x, y));
    // the newspaper masthead is cut out of the paper
    expect(countPixels(renderLife('LifeNewspaper', {}, 1), 45, 33, 83, 37)).toBeLessThan(39 * 5);
  });

  it('the tea mug carries a heart and a tea-bag tag', () => {
    const c = renderLife('LifeTea', {}, 1);
    // FaceCanvas::Heart(x - 1, y + 3, 8, false) cut out of the mug at (58, 50)
    const print = createCanvas();
    heart(print, 57, 53, 8);
    const printed = lit(print);
    expect(printed.length).toBeGreaterThan(20);
    for (const xy of printed) {
      const [x, y] = xy.split(',').map(Number);
      expect(getPixel(c, x, y), xy).toBe(false);
    }
    expect(getPixel(c, 49, 53)).toBe(true); // mug body around it
    expect(countPixels(c, 71, 45, 76, 50)).toBeGreaterThan(20); // the tag
  });

  it('nap is the Sleeping animation with the Zzz', () => {
    const p = evaluateLife('Sleeping', 1);
    expect(p.l.style).toBe('line');
    expect(p.blink).toBe(false);
    expect(lit(renderActivityStill('nap', {}))).toEqual(lit(renderLife('Sleeping', {}, 1)));
    // the letters drift up-right over 1 / 0.45 s
    expect(lit(renderLife('Sleeping', {}, 0))).not.toEqual(lit(renderLife('Sleeping', {}, 1)));
  });

  it('the TV light flickers in the eyes', () => {
    const a = renderLife('LifeTv', {}, 1);
    const b = renderLife('LifeTv', {}, 1.2);
    expect(lit(a)).not.toEqual(lit(b));
    const eyesNoFlicker = renderFace({ ...evaluateLife('LifeTv', 1), prop: 'none' }, {});
    expect(countPixels(a, 0, 0, W - 1, 33)).toBeLessThan(countPixels(eyesNoFlicker, 0, 0, W - 1, 33));
  });

  it('animates, loops on the firmware duration and has a reduced-motion still', () => {
    for (const a of ACTIVITIES) {
      const anim = activityAnim(a, 0);
      const dur = LIFE_DURATION[anim] * 1000;
      const x = renderActivityFrame(a, {}, 300, null, 0, createCanvas(), 0);
      const y = renderActivityFrame(a, {}, 300 + dur, null, 0, createCanvas(), 0);
      expect(lit(x), a).toEqual(lit(y));
      expect(lit(renderActivityStill(a, {})).length, a).toBeGreaterThan(100);
    }
    expect(lit(renderActivityFrame('work', {}, 100, null))).not.toEqual(lit(renderActivityFrame('work', {}, 600, null)));
    const live = createLiveliness(() => 0, 0);
    expect(toAscii(renderActivityFrame('tea', {}, 3100, live, 3100)).split('\n')).toHaveLength(H);
  });
});

describe('TinyBot\'s day: routine', () => {
  it('the reset day equals the server default', () => {
    const day = defaultRoutine();
    expect(day.enabled).toBe(true);
    expect(day.items).toHaveLength(15);
    expect(day.items[0]).toEqual({ start: '08:00', end: '08:15', activity: 'exercise' });
    if (existsSync(SCHEMA)) {
      const src = readFileSync(SCHEMA, 'utf8');
      const body = src.match(/def default_routine\(\)[\s\S]*?return /)[0];
      const server = [...body.matchAll(/\("(\d\d:\d\d)", "(\d\d:\d\d)", "(\w+)"\)/g)]
        .map(([, start, end, activity]) => ({ start, end, activity }));
      expect(day.items).toEqual(server);
    }
    expect(defaultRoutine()).not.toBe(day); // a fresh copy each time
  });

  it('normalizes what the server sent (missing = the default day)', () => {
    expect(normalizeRoutine(undefined)).toEqual(defaultRoutine());
    expect(normalizeRoutine({ enabled: false })).toEqual({ ...defaultRoutine(), enabled: false });
    expect(normalizeRoutine({ items: [] })).toEqual({ enabled: true, items: [] });
    expect(normalizeRoutine({
      enabled: true,
      items: [
        { start: '9:00', end: '10:00', activity: 'work' },
        { start: '07:00', end: '07:30', activity: 'tea' },
        { start: '08:00', end: '08:00', activity: 'tea' },
        { start: '08:00', end: '09:00', activity: 'dance' },
      ],
    }).items).toEqual([
      { start: '07:00', end: '07:30', activity: 'tea' },
      { start: '09:00', end: '10:00', activity: 'work' },
    ]);
  });

  it('validates items like the server', () => {
    expect(cleanHHMM('7:05')).toBe('07:05');
    expect(cleanHHMM('24:00')).toBeNull();
    expect(routineProblem(defaultRoutine())).toBeNull();
    expect(routineProblem({ items: [{ start: '10:00', end: '10:00', activity: 'tea' }] })).toEqual({ code: 'sameTime', index: 0 });
    expect(routineProblem({ items: [{ start: '', end: '10:00', activity: 'tea' }] })).toEqual({ code: 'time', index: 0 });
    expect(routineProblem({ items: [{ start: '09:00', end: '10:00', activity: 'x' }] })).toEqual({ code: 'activity', index: 0 });
    const many = Array.from({ length: MAX_ROUTINE + 1 }, () => ({ start: '09:00', end: '10:00', activity: 'tea' }));
    expect(routineProblem({ items: many })).toEqual({ code: 'tooMany', index: -1 });
    expect(routineProblem({ items: many.slice(1) })).toBeNull();
  });

  it('finds overlaps (warning only) including across midnight', () => {
    expect(routineOverlaps(defaultRoutine().items)).toEqual([]);
    expect(routineOverlaps([
      { start: '09:00', end: '10:00', activity: 'work' },
      { start: '09:30', end: '09:45', activity: 'tea' },
      { start: '23:00', end: '01:00', activity: 'tv' },
      { start: '00:30', end: '02:00', activity: 'book' },
      { start: '10:00', end: '11:00', activity: 'art' },
    ])).toEqual([[0, 1], [2, 3]]);
    expect(routineItemMinutes({ start: '23:00', end: '01:00' })).toBe(120);
  });

  it('knows what is scheduled now like the firmware (first sorted match)', () => {
    const day = defaultRoutine();
    expect(scheduledActivity(day, 8 * 60)).toBe('exercise');
    expect(scheduledActivity(day, 8 * 60 + 15)).toBe('boxing');
    expect(scheduledActivity(day, 11 * 60 + 10)).toBe('');
    expect(scheduledActivity({ ...day, enabled: false }, 8 * 60)).toBe('');
    const night = { enabled: true, items: [{ start: '22:00', end: '02:00', activity: 'book' }, { start: '21:00', end: '23:00', activity: 'tv' }] };
    expect(scheduledActivity(night, 22 * 60 + 30)).toBe('tv'); // starts first, wins the overlap
    expect(scheduledActivity(night, 60)).toBe('book');
  });

  it('builds the PUT body: the full list, sorted', () => {
    const r = { enabled: true, items: [{ start: '9:00', end: '10:00', activity: 'work' }, { start: '08:00', end: '08:30', activity: 'tea' }] };
    expect(routinePayload(r)).toEqual({
      enabled: true,
      items: [{ start: '08:00', end: '08:30', activity: 'tea' }, { start: '09:00', end: '10:00', activity: 'work' }],
    });
    expect(sameRoutine(r, routinePayload(r))).toBe(true);
    expect(sameRoutine(r, { ...r, enabled: false })).toBe(false);
  });

  it('suggests a new item after the last one', () => {
    expect(newRoutineItem(defaultRoutine().items)).toEqual({ start: '21:00', end: '21:30', activity: 'tea' });
    expect(newRoutineItem([])).toEqual({ start: '12:00', end: '12:30', activity: 'tea' });
    expect(newRoutineItem([{ start: '23:00', end: '23:45', activity: 'tv' }]).end).toBe('00:15');
  });
});
