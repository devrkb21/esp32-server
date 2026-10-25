import { describe, expect, it } from 'vitest';
import { dateText, pageOf, payloadOf, recordingsFrom, transcriptOf, validate } from '@/views/voiceprint/voiceprintModel';

describe('voiceprint model', () => {
  it('reads plain and speaker-tagged transcripts', () => {
    expect(transcriptOf(' hello ')).toEqual({ text: 'hello', speaker: '' });
    expect(transcriptOf('{"speaker":"Apu","content":"কাল পরীক্ষা"}')).toEqual({ text: 'কাল পরীক্ষা', speaker: 'Apu' });
    expect(transcriptOf('{not json')).toEqual({ text: '{not json', speaker: '' });
    expect(transcriptOf(null)).toEqual({ text: '', speaker: '' });
    expect(transcriptOf(['x'])).toEqual({ text: '', speaker: '' });
  });

  it('keeps one recording per audio id, drops lines without audio and TinyBot lines', () => {
    const list = recordingsFrom([
      { audioId: 'a', content: 'one' },
      { audioId: 'a', content: 'dup' },
      { audioId: '', content: 'no audio' },
      { audioId: 'b', content: 'bot', chatType: 2 },
      { audioId: 'c', content: 'user', chatType: 1 },
    ]);
    expect(list.map((r) => r.audioId)).toEqual(['a', 'c']);
    expect(recordingsFrom(null)).toEqual([]);
  });

  it('validates the three required fields and the introduction length', () => {
    expect(validate({ audioId: '', sourceName: ' ', introduce: '' })).toEqual({
      audioId: 'vp.err.audio', sourceName: 'vp.err.name', introduce: 'vp.err.intro',
    });
    expect(validate({ audioId: 'a', sourceName: 'Ammu', introduce: 'x'.repeat(101) })).toEqual({ introduce: 'vp.err.introLong' });
    expect(validate({ audioId: 'a', sourceName: 'Ammu', introduce: 'mother' })).toEqual({});
  });

  it('builds the add and update bodies like the legacy page', () => {
    expect(payloadOf({ id: null, audioId: 'a', sourceName: ' Ammu ', introduce: ' mother ' }, 'ag1'))
      .toEqual({ agentId: 'ag1', audioId: 'a', sourceName: 'Ammu', introduce: 'mother' });
    expect(payloadOf({ id: 'v1', audioId: 'b', sourceName: 'Apu', introduce: 'sister' }, 'ag1', { id: 'v1', agentId: 'ag1', createDate: 'x' }))
      .toEqual({ id: 'v1', agentId: 'ag1', createDate: 'x', audioId: 'b', sourceName: 'Apu', introduce: 'sister' });
  });

  it('pages the list in the browser and clamps the page', () => {
    const list = Array.from({ length: 23 }, (_, i) => i);
    expect(pageOf(list, 3).rows).toEqual([20, 21, 22]);
    expect(pageOf(list, 9).page).toBe(3);
    expect(pageOf([], 2)).toEqual({ page: 1, pages: 1, rows: [] });
  });

  it('writes dates in the reader\'s digits', () => {
    expect(dateText('2026-10-12 08:30:00', 'en')).toMatch(/12/);
    expect(dateText('2026-10-12 08:30:00', 'bn')).toMatch(/১২/);
    expect(dateText('', 'en')).toBe('');
  });
});
