import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

// The API layer is replaced: these tests check that the pages keep the legacy calls and params.
const api = vi.hoisted(() => ({
  voiceResource: {
    getVoiceResourceList: vi.fn(),
    saveVoiceResource: vi.fn(),
    deleteVoiceResource: vi.fn(),
    getTtsPlatformList: vi.fn(),
  },
  voiceClone: {
    getVoiceCloneList: vi.fn(),
    updateName: vi.fn(),
    cloneAudio: vi.fn(),
    getAudioId: vi.fn(),
    getPlayVoiceUrl: vi.fn((u) => `/xiaozhi/voiceClone/play/${u}`),
    uploadVoice: vi.fn(),
  },
  admin: { getUserList: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import kit from '@/kit';
import i18n from '@/i18n';
import VoiceResourceManagement from '@/views/voices/VoiceResourceManagement.vue';
import VoiceCloneManagement from '@/views/voices/VoiceCloneManagement.vue';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });
const resources = [
  { id: 'r1', voiceId: 'bn-BD-NabanitaNeural', name: 'Nabanita', userName: 'demo', modelName: 'EdgeTTS', languages: 'Bangla', hasVoice: true, trainStatus: 2, createDate: '2025-03-02 14:05:00' },
  { id: 'r2', voiceId: 'slot-2', name: '', userName: 'owner-02', modelName: 'Clone', languages: 'Bangla', hasVoice: true, trainStatus: 3, trainError: 'too noisy', createDate: '2025-03-03 10:00:00' },
];
const clones = [
  { id: 'c1', voiceId: 'slot-11', name: 'Mine', languages: 'Bangla', hasVoice: true, trainStatus: 0 },
  { id: 'c2', voiceId: 'slot-12', name: '', languages: 'Bangla', hasVoice: false, trainStatus: 0 },
];

function mountPage(Page, confirm = vi.fn(() => Promise.resolve())) {
  const message = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() });
  const wrapper = mount(Page, {
    attachTo: document.body,
    global: { plugins: [i18n, kit], mocks: { $confirm: confirm, $message: message } },
  });
  return { wrapper, message, confirm };
}

beforeEach(() => {
  // jsdom has no media playback
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLMediaElement.prototype.load = () => {};
  i18n.global.locale = 'en';
  for (const group of Object.values(api)) for (const fn of Object.values(group)) fn.mockReset?.();
  api.voiceClone.getPlayVoiceUrl.mockImplementation((u) => `/xiaozhi/voiceClone/play/${u}`);
  api.voiceResource.getVoiceResourceList.mockImplementation((params, cb) => cb(ok({ list: resources.map((r) => ({ ...r })), total: 2 })));
  api.voiceResource.getTtsPlatformList.mockImplementation((cb) => cb(ok([{ id: 'p1', modelName: 'EdgeTTS' }])));
  api.voiceClone.getVoiceCloneList.mockImplementation((params, cb) => cb(ok({ list: clones.map((r) => ({ ...r })), total: 2 })));
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Voices page', () => {
  it('loads the list with the legacy params and shows each row', async () => {
    const { wrapper } = mountPage(VoiceResourceManagement);
    await flushPromises();
    expect(api.voiceResource.getVoiceResourceList).toHaveBeenCalledWith(
      { page: 1, limit: 10, name: '', orderField: 'create_date', order: 'desc' }, expect.any(Function));
    const text = wrapper.text();
    expect(text).toContain('Nabanita');
    expect(text).toContain('bn-BD-NabanitaNeural');
    expect(text).toContain('Ready');
    expect(text).toContain('too noisy');
    wrapper.unmount();
  });

  it('searches by name from page 1', async () => {
    const { wrapper } = mountPage(VoiceResourceManagement);
    await flushPromises();
    wrapper.vm.currentPage = 2;
    wrapper.vm.searchName = 'Nab';
    wrapper.vm.handleSearch();
    expect(api.voiceResource.getVoiceResourceList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, name: 'Nab' }), expect.any(Function));
    wrapper.unmount();
  });

  it('deletes the selected rows after a confirmation', async () => {
    api.voiceResource.deleteVoiceResource.mockImplementation((ids, cb) => cb(ok(null)));
    const { wrapper, confirm, message } = mountPage(VoiceResourceManagement);
    await flushPromises();
    wrapper.vm.selected = ['r1', 'r2'];
    wrapper.vm.deleteSelected();
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ danger: true }));
    expect(api.voiceResource.deleteVoiceResource).toHaveBeenCalledWith(['r1', 'r2'], expect.any(Function));
    expect(message.success).toHaveBeenCalled();
    expect(api.voiceResource.getVoiceResourceList).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('warns when nothing is selected and does not delete on cancel', async () => {
    const confirm = vi.fn(() => Promise.reject('cancel'));
    const { wrapper, message } = mountPage(VoiceResourceManagement, confirm);
    await flushPromises();
    wrapper.vm.deleteSelected();
    expect(message.warning).toHaveBeenCalled();
    wrapper.vm.deleteVoices([resources[0]]);
    await flushPromises();
    expect(api.voiceResource.deleteVoiceResource).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('saves a new voice with the legacy form shape', async () => {
    api.voiceResource.saveVoiceResource.mockImplementation((form, cb) => cb(ok(null)));
    const { wrapper } = mountPage(VoiceResourceManagement);
    await flushPromises();
    wrapper.vm.handleSubmit({ modelId: 'p1', voiceIds: ['a', 'b'], userId: 'u1', languages: 'Bangla' });
    expect(api.voiceResource.saveVoiceResource).toHaveBeenCalledWith(
      { modelId: 'p1', voiceIds: ['a', 'b'], userId: 'u1', languages: 'Bangla' }, expect.any(Function));
    expect(wrapper.vm.addOpen).toBe(false);
    wrapper.unmount();
  });
});

describe('Voice clone page', () => {
  it('loads the list with the legacy params', async () => {
    const { wrapper } = mountPage(VoiceCloneManagement);
    await flushPromises();
    expect(api.voiceClone.getVoiceCloneList).toHaveBeenCalledWith(
      { page: 1, limit: 10, name: '', orderField: 'create_date', order: 'desc' }, expect.any(Function));
    expect(wrapper.text()).toContain('Waiting to clone');
    expect(wrapper.text()).toContain('Needs a sample');
    wrapper.unmount();
  });

  it('renames a voice through updateName', async () => {
    api.voiceClone.updateName.mockImplementation((p, cb) => cb(ok(null)));
    const { wrapper } = mountPage(VoiceCloneManagement);
    await flushPromises();
    const row = wrapper.vm.rows[0];
    wrapper.vm.startEdit(row);
    wrapper.vm.draftName = 'Renamed';
    wrapper.vm.saveName(row);
    expect(api.voiceClone.updateName).toHaveBeenCalledWith({ id: 'c1', name: 'Renamed' }, expect.any(Function));
    expect(row.name).toBe('Renamed');
    wrapper.unmount();
  });

  it('clones with the cloneId param and refreshes', async () => {
    api.voiceClone.cloneAudio.mockImplementation((p, cb) => cb(ok(null)));
    const { wrapper } = mountPage(VoiceCloneManagement);
    await flushPromises();
    wrapper.vm.handleClone(wrapper.vm.rows[0]);
    expect(api.voiceClone.cloneAudio).toHaveBeenCalledWith({ cloneId: 'c1' }, expect.any(Function), expect.any(Function));
    expect(api.voiceClone.getVoiceCloneList).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.cloningId).toBe(null);
    wrapper.unmount();
  });

  it('does not ask for audio of a voice without a sample', async () => {
    const { wrapper } = mountPage(VoiceCloneManagement);
    await flushPromises();
    wrapper.vm.handlePlay(wrapper.vm.rows[1]);
    expect(api.voiceClone.getAudioId).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe('Sheets', () => {
  it('the add sheet loads platforms and refuses an empty form', async () => {
    const { wrapper } = mountPage(VoiceResourceManagement);
    await flushPromises();
    wrapper.vm.openAdd();
    await flushPromises();
    expect(api.voiceResource.getTtsPlatformList).toHaveBeenCalled();
    expect(document.body.textContent).toContain('EdgeTTS');
    const sheet = wrapper.findComponent({ name: 'VoiceResourceSheet' });
    sheet.vm.submit();
    await flushPromises();
    expect(Object.keys(sheet.vm.errors).sort()).toEqual(['languages', 'modelId', 'userId', 'voiceIds']);
    expect(api.voiceResource.saveVoiceResource).not.toHaveBeenCalled();
    sheet.vm.form.modelId = 'p1';
    sheet.vm.voiceDraft = 'v-1, v-2';
    sheet.vm.pickOwner({ userid: 'u1', mobile: 'owner' });
    sheet.vm.form.languages = ' Bangla ';
    sheet.vm.submit();
    expect(sheet.emitted('submit')[0][0]).toEqual({ modelId: 'p1', voiceIds: ['v-1', 'v-2'], userId: 'u1', languages: 'Bangla' });
    wrapper.unmount();
  });

  it('the sample sheet opens on its first step and asks for audio first', async () => {
    const { wrapper, message } = mountPage(VoiceCloneManagement);
    await flushPromises();
    wrapper.vm.openUpload(wrapper.vm.rows[0]);
    await flushPromises();
    const sheet = wrapper.findComponent({ name: 'VoiceCloneSheet' });
    expect(sheet.vm.step).toBe(1);
    expect(document.body.textContent).toContain('Get a sample');
    sheet.vm.next();
    expect(message.warning).toHaveBeenCalled();
    expect(api.voiceClone.uploadVoice).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
