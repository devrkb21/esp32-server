import { describe, expect, it } from 'vitest';
import {
  SESSIONS_PAGE, dateParts, dayWord, errorText, firstLine, lineContent, macParts, mergeSessions, messageList,
  messageTs, messageWhen, sortMessages, speakerOf, stampText, statusOf, syncOf, withTimeMarks,
} from '../src/views/messages/messagesModel.js';
import fixtures from '../src/apis/demo/pages/messages.js';
import pageStrings from '../src/i18n/pages/messages.js';

describe('sent messages', () => {
  it('reads both reply shapes of the messages call', () => {
    expect(messageList([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(messageList({ messages: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(messageList(null)).toBeNull();
    expect(messageList({})).toBeNull();
  });

  it('keeps the legacy status rule: an answer wins over the delivery status', () => {
    expect(statusOf({ status: 'pending' })).toBe('pending');
    expect(statusOf({ status: 'delivered' })).toBe('delivered');
    expect(statusOf({ status: 'delivered', answer: 'yes' })).toBe('yes');
    expect(statusOf({ status: 'delivered', answer: 'no' })).toBe('no');
    expect(statusOf({ status: 'delivered', answer: 'seen' })).toBe('seen');
    expect(statusOf({})).toBe('pending');
  });

  it('draws a waiting message dashed and everything after it solid', () => {
    expect(syncOf({ status: 'pending' })).toBe('pending');
    expect(syncOf({ status: 'delivered' })).toBe('applied');
    expect(syncOf({ status: 'delivered', answer: 'no' })).toBe('applied');
  });

  it('sorts newest first and accepts the older `created` stamp', () => {
    const list = sortMessages([{ id: 'a', ts: 10 }, { id: 'b', created: 30 }, { id: 'c', ts: 20 }]);
    expect(list.map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(messageTs({ created: 5 })).toBe(5);
    expect(messageTs(null)).toBe(0);
  });

  it('gives the clock in the reader\'s digits and a date only for older days', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    const today = messageWhen(new Date(2026, 9, 25, 9, 5).getTime() / 1000, 'bn', now);
    expect(today).toMatchObject({ time: '৯:০৫', date: '', word: 'today' });
    const old = messageWhen(new Date(2026, 9, 20, 18, 30).getTime() / 1000, 'en', now);
    expect(old.time).toBe('18:30');
    expect(old.date).not.toBe('');
    expect(messageWhen(0, 'en').time).toBe('');
  });

  it('shows the server\'s own error text when there is one', () => {
    expect(errorText({ data: { msg: 'Robot not found' } }, 'x')).toBe('Robot not found');
    expect(errorText(undefined, 'fallback')).toBe('fallback');
  });
});

describe('conversations', () => {
  it('extracts plain, object and part-list contents', () => {
    expect(lineContent('hello')).toEqual({ speaker: '', parts: [{ type: 'text', text: 'hello' }] });
    expect(lineContent('{"speaker":"Apu","content":"hi"}')).toEqual({ speaker: 'Apu', parts: [{ type: 'text', text: 'hi' }] });
    const parts = lineContent('[{"type":"text","text":"a"},{"type":"tool","text":"b"},{"type":"tool_result","text":"c"}]').parts;
    expect(parts.map((p) => p.type)).toEqual(['text', 'tool', 'tool_result']);
    expect(lineContent('{"other":1}').parts[0].text).toBe('{"other":1}');
    expect(lineContent(null).parts[0].text).toBe('');
  });

  it('tells the speakers apart by chat type', () => {
    expect(speakerOf({ chatType: 1 })).toBe('person');
    expect(speakerOf({ chatType: 2 })).toBe('bot');
    expect(speakerOf({ chatType: 3 })).toBe('tool');
  });

  it('folds a long tool result to its first line', () => {
    expect(firstLine('first line here, long enough\nsecond')).toBe('first line here, long enough...');
    expect(firstLine('short')).toBe('short');
    expect(firstLine('{\n  "ok": true\n}')).toBe('{ "ok": true }...');
  });

  it('puts a time mark first and wherever more than a minute passed', () => {
    const at = (s) => new Date(Date.UTC(2026, 9, 25, 10, 0, s)).toISOString();
    const items = withTimeMarks([
      { id: 1, createdAt: at(0) }, { id: 2, createdAt: at(30) }, { id: 3, createdAt: at(200) },
    ]);
    expect(items.map((x) => (x.mark ? 'T' : x.line.id))).toEqual(['T', 1, 2, 'T', 3]);
    expect(withTimeMarks([])).toEqual([]);
  });

  it('dates a session row and stamps a time mark', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    expect(dayWord(new Date(2026, 9, 25, 1, 0), now)).toBe('today');
    expect(dayWord(new Date(2026, 9, 24, 23, 0), now)).toBe('yesterday');
    expect(dayWord(new Date(2026, 9, 20), now)).toBe('older');
    const p = dateParts(new Date(2026, 9, 23, 7, 4), 'bn', now);
    expect(p).toMatchObject({ day: '২৩', time: '৭:০৪', word: 'older' });
    const words = { today: 'Today', yesterday: 'Yesterday' };
    expect(stampText(new Date(2026, 9, 25, 9, 30), 'en', words, now)).toBe('Today 09:30');
    expect(stampText(new Date(2026, 9, 24, 21, 5), 'en', words, now)).toBe('Yesterday 21:05');
    expect(stampText('nonsense', 'en', words, now)).toBe('');
  });

  it('hides the middle bytes of a MAC address', () => {
    expect(macParts('28:84:85:00:00:01')).toEqual({ head: '28:84', middle: ':85:00:', tail: '00:01' });
    expect(macParts('not a mac')).toBeNull();
  });

  it('adds a new page of sessions without duplicates', () => {
    const merged = mergeSessions([{ sessionId: 'a' }], [{ sessionId: 'a' }, { sessionId: 'b' }]);
    expect(merged.map((s) => s.sessionId)).toEqual(['a', 'b']);
  });
});

describe('demo fixtures and strings', () => {
  const find = (method, path) => fixtures.find((f) => f.method === method && f.url.test(path));

  it('pages the sessions like the server: a full first page, then the rest', () => {
    const h = find('GET', '/xiaozhi/agent/demo-agent-1/sessions');
    const p1 = h.reply({ query: {}, data: { page: 1, limit: SESSIONS_PAGE } });
    const p2 = h.reply({ query: {}, data: { page: 2, limit: SESSIONS_PAGE } });
    expect(p1.list).toHaveLength(SESSIONS_PAGE);
    expect(p2.list.length).toBeGreaterThan(0);
    expect(p2.list.length).toBeLessThan(SESSIONS_PAGE);
  });

  it('keeps a message sent in the demo in the list', () => {
    const post = find('POST', '/xiaozhi/device/companion/demo-device-1/messages');
    const get = find('GET', '/xiaozhi/device/companion/demo-device-1/messages');
    const m = post.reply({ data: { from: 'Ammu', text: 'test', ask: true } });
    expect(get.reply().messages[0]).toEqual(m);
    expect(statusOf(m)).toBe('pending');
  });

  it('answers the chat history of a session with ordered lines', () => {
    const h = find('GET', '/xiaozhi/agent/demo-agent-1/chat-history/demo-s-2');
    const lines = h.reply({ path: '/xiaozhi/agent/demo-agent-1/chat-history/demo-s-2' });
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.some((l) => l.chatType === 3)).toBe(true);
  });

  it('writes every string in Bangla and English', () => {
    expect(Object.keys(pageStrings.bn).sort()).toEqual(Object.keys(pageStrings.en).sort());
    for (const table of [pageStrings.bn, pageStrings.en]) {
      for (const v of Object.values(table)) expect(v).not.toMatch(/—/);
    }
  });
});
