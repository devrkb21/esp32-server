import { describe, expect, it } from 'vitest';
import {
  MAX_PAIRS, checkContent, checkFileName, contentLines, contentText, filterFiles, isErrorBody, pairCount, previewRows,
  splitPair, validLines,
} from '../src/views/words/wordsModel.js';
import {
  agoParts, applyStatus, clientIdOf, contactsFor, filterAgents, initialOf, isOnline, parseStatus, permissionChanges,
  readPermissions, toRobot,
} from '../src/views/words/addressBookModel.js';

describe('replacement words: the legacy dialog checks', () => {
  it('needs content', () => {
    expect(checkContent('')).toEqual({ code: 'required' });
    expect(checkContent('  \n \n')).toEqual({ code: 'required' });
  });
  it('accepts good pairs and ignores blank lines', () => {
    expect(checkContent('tiny bot|TinyBot\n\nটাইনি বট|টাইনিবট\n')).toBeNull();
    expect(validLines('a|b\n\n  \nc|d')).toEqual(['a|b', 'c|d']);
  });
  it('wants exactly one pipe per line, reported with the line number as typed', () => {
    expect(checkContent('a|b\n\nab')).toEqual({ code: 'pipe', line: 3 });
    expect(checkContent('a|b|c')).toEqual({ code: 'pipe', line: 1 });
  });
  it('refuses an empty side', () => {
    expect(checkContent(' |b')).toEqual({ code: 'emptyOriginal', line: 1 });
    expect(checkContent('a| ')).toEqual({ code: 'emptyReplacement', line: 1 });
  });
  it('refuses the legacy special characters on either side', () => {
    expect(checkContent('a!|b')).toEqual({ code: 'originalChar', line: 1 });
    expect(checkContent('a|b?')).toEqual({ code: 'replacementChar', line: 1 });
    expect(checkContent('a_b|c')).toEqual({ code: 'originalChar', line: 1 });
    expect(checkContent('ডাল ভাত|ডাল-ভাত')).toBeNull();
  });
  it('caps a file at 4000 pairs', () => {
    const many = Array.from({ length: MAX_PAIRS + 1 }, (_, i) => `w${i}|x${i}`).join('\n');
    expect(MAX_PAIRS).toBe(4000);
    expect(checkContent(many)).toEqual({ code: 'tooMany', max: 4000 });
    expect(pairCount(many)).toBe(4001);
  });
  it('needs a file name', () => {
    expect(checkFileName(' ')).toEqual({ code: 'fileNameRequired' });
    expect(checkFileName('Names')).toBeNull();
  });
  it('reads content sent as an array or a string', () => {
    expect(contentText(['a|b', 'c|d'])).toBe('a|b\nc|d');
    expect(contentLines('a|b\r\n\r\nc|d')).toEqual(['a|b', 'c|d']);
    expect(splitPair(' tiny bot | TinyBot ')).toEqual({ original: 'tiny bot', replacement: 'TinyBot' });
  });
  it('previews lines with their problems', () => {
    const rows = previewRows('a|b\nbad', 5);
    expect(rows[0]).toMatchObject({ n: 1, original: 'a', replacement: 'b', problem: '' });
    expect(rows[1]).toMatchObject({ n: 2, problem: 'pipe' });
  });
  it('filters by file name, ignoring case', () => {
    const rows = [{ fileName: 'Prayer names' }, { fileName: 'Commands' }];
    expect(filterFiles(rows, 'prayer')).toEqual([rows[0]]);
    expect(filterFiles(rows, '')).toBe(rows);
  });
  it('tells an error body from file text', () => {
    expect(isErrorBody({ code: 500, msg: 'x' })).toBe(true);
    expect(isErrorBody('a|b')).toBe(false);
  });
});

describe('address book helpers', () => {
  const robot = toRobot({ id: 'd1', alias: '', macAddress: '28:84:85:00:00:01', board: 'tinybot' });
  it('names a robot by its alias, else its id', () => {
    expect(robot.name).toBe('d1');
    expect(toRobot({ id: 'd2', alias: 'Desk', macAddress: 'x' }).name).toBe('Desk');
    expect(robot.status).toBe('unknown');
  });
  it('reads the gateway status as the legacy page did', () => {
    expect(clientIdOf(robot)).toBe('tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01');
    expect(isOnline({ isAlive: true })).toBe(true);
    expect(isOnline({ isAlive: false, exists: true })).toBe(false);
    expect(isOnline({ isAlive: null, exists: true })).toBe(true);
    expect(parseStatus({ code: 0, data: 'not json' })).toBeNull();
    const map = parseStatus({ code: 0, data: JSON.stringify({ [clientIdOf(robot)]: { isAlive: true } }) });
    const list = [{ ...robot }];
    applyStatus(list, map);
    expect(list[0]).toMatchObject({ online: true, status: 'online' });
  });
  it('lists the other robots once per MAC', () => {
    const agents = [
      { id: 'a1', devices: [{ id: 'd1', deviceId: 'AA' }, { id: 'd2', deviceId: 'BB' }] },
      { id: 'a2', devices: [{ id: 'd3', deviceId: 'bb' }, { id: 'd4', deviceId: 'CC' }] },
    ];
    expect(contactsFor(agents, 'd1').map((d) => d.id)).toEqual(['d2', 'd4']);
  });
  it('keys permissions by the target MAC, case-insensitively', () => {
    const contacts = [{ id: 'd2', deviceId: 'AA:BB' }, { id: 'd3', deviceId: 'CC:DD' }];
    const { selected, aliases } = readPermissions([
      { targetMac: 'aa:bb', alias: 'Desk', hasPermission: true },
      { targetMac: 'cc:dd', alias: '', hasPermission: false },
    ], contacts);
    expect(selected).toEqual(['AA:BB']);
    expect(aliases).toEqual({ 'AA:BB': 'Desk', 'CC:DD': '' });
    expect(permissionChanges(contacts, ['CC:DD'], ['AA:BB'])).toEqual([
      { targetMac: 'AA:BB', hasPermission: false }, { targetMac: 'CC:DD', hasPermission: true },
    ]);
  });
  it('filters characters by their name or a robot name or MAC', () => {
    const agents = [{ agentName: 'TinyBot', devices: [{ name: 'Desk', deviceId: '28:84' }] }, { agentName: 'Study', devices: [] }];
    expect(filterAgents(agents, 'desk')).toEqual([agents[0]]);
    expect(filterAgents(agents, '28:84')).toEqual([agents[0]]);
    expect(filterAgents(agents, 'stu')).toEqual([agents[1]]);
  });
  it('says how long ago in whole units', () => {
    const now = 1_000_000_000_000;
    expect(agoParts(now - 30_000, now)).toEqual({ key: 'justNow', n: 0 });
    expect(agoParts(now - 5 * 60_000, now)).toEqual({ key: 'minutes', n: 5 });
    expect(agoParts(now - 3 * 86_400_000, now)).toEqual({ key: 'days', n: 3 });
    expect(agoParts(null, now)).toBeNull();
  });
  it('gives an initial only for a real name', () => {
    expect(initialOf({ alias: 'desk' })).toBe('D');
    expect(initialOf({ alias: '' })).toBe('');
    expect(initialOf({ alias: '' }, 'টাইনিবট')).toBe('ট');
  });
});
