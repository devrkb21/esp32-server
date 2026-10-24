import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKOFF_AFTER,
  BACKOFF_DELAY_MS,
  DEFAULT_QUALITY,
  LIVE_MAX_AGE_MS,
  POLL_DELAY_MS,
  SCREEN_TOOL,
  createScreenPoller,
  frameAgeParts,
  isLive,
  parseScreenFrame,
  parseToolResult,
  screenToolArgs,
  toolErrorText,
} from '../src/utils/liveScreen.mjs';

// A tiny real JPEG header in base64 is not needed: the parser only checks the base64 shape
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==';
const RESULT = { width: 128, height: 64, jpeg: JPEG };

describe('live screen: tool result parsing', () => {
  it('uses the firmware tool and a 1..100 quality (default 90)', () => {
    expect(SCREEN_TOOL).toBe('self.screen.preview');
    expect(screenToolArgs()).toEqual({ quality: DEFAULT_QUALITY });
    expect(DEFAULT_QUALITY).toBe(90);
    expect(screenToolArgs(50)).toEqual({ quality: 50 });
    expect(screenToolArgs(0)).toEqual({ quality: 1 });
    expect(screenToolArgs(250)).toEqual({ quality: 100 });
    expect(screenToolArgs('70.6')).toEqual({ quality: 71 });
    expect(screenToolArgs('high')).toEqual({ quality: 90 });
  });

  it('reads the frame when manager-api already parsed it', () => {
    const f = parseScreenFrame(RESULT);
    expect(f).toEqual({ width: 128, height: 64, jpeg: JPEG, src: `data:image/jpeg;base64,${JPEG}` });
  });

  it('reads the frame from a JSON string', () => {
    expect(parseScreenFrame(JSON.stringify(RESULT)).jpeg).toBe(JPEG);
    expect(parseScreenFrame(`  ${JSON.stringify(RESULT)}\n`).src).toBe(`data:image/jpeg;base64,${JPEG}`);
  });

  it('reads the frame from the raw MCP result (JSON in content[0].text)', () => {
    const mcp = { content: [{ type: 'text', text: JSON.stringify(RESULT) }], isError: false };
    expect(parseScreenFrame(mcp).jpeg).toBe(JPEG);
    // and a string holding the whole MCP result
    expect(parseScreenFrame(JSON.stringify(mcp)).jpeg).toBe(JPEG);
  });

  it('accepts a data URI and wrapped base64, defaults missing sizes to 128x64', () => {
    const wrapped = `data:image/jpeg;base64,${JPEG.slice(0, 20)}\n${JPEG.slice(20)}`;
    expect(parseScreenFrame({ jpeg: wrapped })).toMatchObject({ width: 128, height: 64, jpeg: JPEG });
    expect(parseScreenFrame({ ...RESULT, width: 'x', height: -1 })).toMatchObject({ width: 128, height: 64 });
    expect(parseScreenFrame({ ...RESULT, width: 256, height: 128 })).toMatchObject({ width: 256, height: 128 });
  });

  it('rejects what is not a frame', () => {
    for (const bad of [
      null, undefined, '', 'OK', '{not json', 42, [], {}, { jpeg: '' }, { jpeg: 'abc' }, { jpeg: 'not base64!!' },
      { jpeg: 123 }, { content: [] }, { content: [{ type: 'image', data: JPEG }] },
      { isError: true, content: [{ type: 'text', text: JSON.stringify(RESULT) }] },
    ]) {
      expect(parseScreenFrame(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('parses generic tool results and MCP error text', () => {
    expect(parseToolResult('{"a":1}')).toEqual({ a: 1 });
    expect(parseToolResult('true')).toBe('true');
    expect(parseToolResult({ content: [{ type: 'text', text: '[1,2]' }] })).toEqual([1, 2]);
    expect(parseToolResult(null)).toBeNull();
    expect(toolErrorText({ isError: true, content: [{ type: 'text', text: ' Unknown tool ' }] })).toBe('Unknown tool');
    expect(toolErrorText(RESULT)).toBe('');
  });

  it('formats the frame age and knows when it is live', () => {
    expect(frameAgeParts(0, 5000)).toBeNull();
    expect(frameAgeParts(1000, 2500)).toEqual({ key: 'now', n: 0 });
    expect(frameAgeParts(1000, 13000)).toEqual({ key: 'seconds', n: 12 });
    expect(frameAgeParts(0 + 1, 1 + 125000)).toEqual({ key: 'minutes', n: 2 });
    expect(frameAgeParts(1, 1 + 7300000)).toEqual({ key: 'hours', n: 2 });
    const st = { status: 'live', frameAt: 1000 };
    expect(isLive(st, 1000 + LIVE_MAX_AGE_MS)).toBe(true);
    expect(isLive(st, 1001 + LIVE_MAX_AGE_MS)).toBe(false);
    expect(isLive({ ...st, status: 'retrying' }, 1000)).toBe(false);
  });

  it('keeps the shared copy in manager-mobile identical', () => {
    const web = readFileSync(resolve(process.cwd(), 'src/utils/liveScreen.mjs'), 'utf8');
    const mobile = readFileSync(resolve(process.cwd(), '../manager-mobile/src/pages/companion/liveScreen.mjs'), 'utf8');
    expect(mobile).toBe(web);
  });
});

describe('live screen: polling', () => {
  let calls;
  let answers;
  let states;

  // Each fetch returns a promise we settle from the test
  function makePoller(extra = {}) {
    calls = 0;
    answers = [];
    states = [];
    return createScreenPoller({
      fetchFrame: () => {
        calls++;
        return new Promise((res, rej) => answers.push({ res, rej }));
      },
      onUpdate: (s) => states.push(s),
      timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
      now: () => Date.now(),
      ...extra,
    });
  }
  const frame = () => parseScreenFrame(RESULT);
  async function answer(ok = true) {
    const a = answers.shift();
    if (ok) a.res(frame());
    else a.rej({ msg: 'offline' });
    await vi.advanceTimersByTimeAsync(0);
  }
  const last = () => states[states.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks once at start, then 700 ms after each answer, one request at a time', async () => {
    const p = makePoller();
    expect(calls).toBe(0);
    p.start();
    expect(calls).toBe(1);
    expect(last().status).toBe('connecting');
    // no second request while the first one is open, however long it takes
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls).toBe(1);
    await answer(true);
    expect(last().status).toBe('live');
    expect(last().frame.jpeg).toBe(JPEG);
    expect(last().frameAt).toBe(Date.now());
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS - 1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    expect(POLL_DELAY_MS).toBe(700);
    p.destroy();
  });

  it('backs off to every 5 s after 3 failures in a row, and recovers on a frame', async () => {
    const p = makePoller();
    p.start();
    await answer(false); // 1
    expect(last().status).toBe('retrying');
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    expect(calls).toBe(2);
    await answer(false); // 2
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    expect(calls).toBe(3);
    await answer(false); // 3: back off
    expect(BACKOFF_AFTER).toBe(3);
    expect(last().status).toBe('offline');
    expect(last().failures).toBe(3);
    await vi.advanceTimersByTimeAsync(BACKOFF_DELAY_MS - 1);
    expect(calls).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(4);
    await answer(false); // still offline: again 5 s
    await vi.advanceTimersByTimeAsync(BACKOFF_DELAY_MS - 1);
    expect(calls).toBe(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(5);
    await answer(true); // back: fast again
    expect(last().status).toBe('live');
    expect(last().failures).toBe(0);
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    expect(calls).toBe(6);
    p.destroy();
  });

  it('a failure keeps the last frame (shown as stale)', async () => {
    const p = makePoller();
    p.start();
    await answer(true);
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    await answer(false);
    expect(last().status).toBe('retrying');
    expect(last().frame).not.toBeNull();
    p.destroy();
  });

  it('counts a non-frame answer and a throwing fetch as failures', async () => {
    let n = 0;
    const p = createScreenPoller({
      fetchFrame: () => {
        n++;
        if (n === 1) return Promise.resolve(null);
        throw new Error('boom');
      },
      onUpdate: (s) => { states.push(s); },
    });
    states = [];
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(p.getState().failures).toBe(1);
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    expect(p.getState().failures).toBe(2);
    expect(p.getState().error.message).toBe('boom');
    p.destroy();
  });

  it('pause stops asking; resume asks right away', async () => {
    const p = makePoller();
    p.start();
    await answer(true);
    p.pause();
    expect(last().status).toBe('paused');
    expect(last().result).toBe('live');
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(1);
    p.resume();
    expect(calls).toBe(2);
    p.destroy();
  });

  it('an answer that arrives while paused is kept but schedules nothing', async () => {
    const p = makePoller();
    p.start();
    p.pause();
    await answer(true);
    expect(last().frame).not.toBeNull();
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(1);
    p.resume();
    expect(calls).toBe(2);
    p.destroy();
  });

  it('stops while the page is hidden or the component is out of view', async () => {
    const p = makePoller();
    p.start();
    await answer(true);
    p.setPageVisible(false);
    expect(last().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(1);
    p.setPageVisible(true);
    expect(calls).toBe(2);
    await answer(true);
    p.setVisible(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(2);
    // visible again but the page is hidden: still nothing
    p.setPageVisible(false);
    p.setVisible(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(2);
    p.setPageVisible(true);
    expect(calls).toBe(3);
    p.destroy();
  });

  it('coming back while a request is open does not start a second one', async () => {
    const p = makePoller();
    p.start();
    p.setVisible(false);
    p.setVisible(true);
    expect(calls).toBe(1);
    await answer(true);
    await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    expect(calls).toBe(2);
    p.destroy();
  });

  it('retry skips the back-off wait', async () => {
    const p = makePoller();
    p.start();
    for (let i = 0; i < 3; i++) {
      await answer(false);
      if (i < 2) await vi.advanceTimersByTimeAsync(POLL_DELAY_MS);
    }
    expect(last().status).toBe('offline');
    p.retry();
    expect(calls).toBe(4);
    p.destroy();
  });

  it('starts only when asked and ignores answers after destroy', async () => {
    const p = makePoller();
    p.setVisible(true);
    p.resume();
    expect(calls).toBe(0);
    p.start();
    p.destroy();
    const count = states.length;
    await answer(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(states.length).toBe(count);
    expect(calls).toBe(1);
    p.start(); // a destroyed poller stays off
    expect(calls).toBe(1);
  });
});

describe('live screen: placement', () => {
  const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('sits at the top of the companion Status tab', () => {
    const src = read('src/views/CompanionManagement.vue');
    const start = src.indexOf("activeTab === 'status'\" key=\"status\"");
    const status = src.slice(start, src.indexOf('class="cm-tiles"', start));
    expect(start).toBeGreaterThan(0);
    expect(status).toContain('<TinyBotLiveScreen :device-id="deviceId" />');
  });

  it('shows "Live from TinyBot" next to the simulated "Preview" on the look page', () => {
    const src = read('src/components/TinyBotLook.vue');
    expect(src).toContain("$t('look.previewLabel')");
    expect(src).toContain('<TinyBotLiveScreen v-if="deviceId" compact :device-id="deviceId" />');
    expect(src).toContain('ref="oled"'); // the simulated preview stays
    const live = read('src/components/TinyBotLiveScreen.vue');
    expect(live).toContain("$t('companion.live.compactTitle')");
    expect(live).toContain('image-rendering: pixelated');
    expect(live).toContain("addEventListener('visibilitychange'");
    expect(live).toContain('IntersectionObserver');
  });
});
