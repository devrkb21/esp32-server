import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  ota: {
    getOtaList: vi.fn(), saveOta: vi.fn(), updateOta: vi.fn(), deleteOta: vi.fn(),
    uploadFirmware: vi.fn(), getDownloadUrl: vi.fn(),
  },
  dict: { getDictDataByType: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

const { default: kit } = await import('../src/kit/index.js');
const { default: i18n } = await import('../src/i18n/index.js');
const { default: OtaManagement } = await import('../src/views/ota/OtaManagement.vue');
const { default: FirmwareSheet } = await import('../src/views/ota/FirmwareSheet.vue');

const rows = [
  { id: 'fw-2', firmwareName: 'tinybot-2.5.5', type: 'tinybot', version: '2.5.5', size: 2187264, remark: 'Release build', createDate: '2026-10-20T10:00:00', updateDate: '2026-10-20T10:00:00' },
  { id: 'fw-1', firmwareName: 'tinybot-2.5.4', type: 'tinybot', version: '2.5.4', size: 2179072, remark: '', createDate: '2026-10-01T10:00:00', updateDate: '2026-10-01T10:00:00' },
];
const ok = (data) => ({ data: { code: 0, data } });

function mountPage() {
  return mount(OtaManagement, { global: { plugins: [kit, i18n] }, attachTo: document.body });
}

beforeEach(() => {
  i18n.global.locale = 'en';
  for (const g of Object.values(api)) for (const f of Object.values(g)) f.mockReset();
  api.ota.getOtaList.mockImplementation((params, cb) => cb(ok({ list: rows, total: 2 })));
  api.dict.getDictDataByType.mockResolvedValue({ code: 0, data: [{ name: 'TinyBot (ESP32-S3 SuperMini)', key: 'tinybot' }] });
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Firmware (OTA) page', () => {
  it('asks for the list as the legacy page did and loads the firmware type dictionary', async () => {
    const w = mountPage();
    await flushPromises();
    expect(api.ota.getOtaList.mock.calls[0][0]).toEqual({ page: 1, limit: 10, firmwareName: '', orderField: 'create_date', order: 'desc' });
    expect(api.dict.getDictDataByType).toHaveBeenCalledWith('FIRMWARE_TYPE');
    expect(w.text()).toContain('tinybot-2.5.5');
    expect(w.text()).toContain('TinyBot (ESP32-S3 SuperMini)');
    // every build is on screen: the newest of its type is named
    expect(w.findAll('.tb-tag').length).toBe(1);
    w.unmount();
  });

  it('draws the row actions as icon buttons named by their labels, and the type on one line', async () => {
    const w = mountPage();
    await flushPromises();
    const acts = w.findAll('.ota__acts')[0].findAll('button');
    expect(acts.map((b) => b.attributes('aria-label'))).toEqual(['Download', 'Edit', 'Delete'].map((k) => i18n.global.t(`ota.${k.toLowerCase()}`)));
    for (const b of acts) {
      expect(b.text()).toBe('');
      expect(b.attributes('title')).toBe(b.attributes('aria-label'));
    }
    expect(w.find('.ota__type small').exists()).toBe(false);
    w.unmount();
  });

  it('searches by name from page one', async () => {
    const w = mountPage();
    await flushPromises();
    w.vm.page = 3;
    w.vm.searchName = 'tinybot';
    await w.find('form.ota__search').trigger('submit');
    const last = api.ota.getOtaList.mock.calls.at(-1)[0];
    expect(last.page).toBe(1);
    expect(last.firmwareName).toBe('tinybot');
    w.unmount();
  });

  it('shows an error state with retry when the list fails', async () => {
    api.ota.getOtaList.mockImplementation((p, cb) => cb({ data: { code: 500, msg: 'boom' } }));
    const w = mountPage();
    await flushPromises();
    expect(w.vm.failed).toBe(true);
    expect(w.text()).toContain('Could not load the firmware list');
    w.unmount();
  });

  it('deletes the selected builds after a confirm, with their ids', async () => {
    api.ota.deleteOta.mockImplementation((ids, cb) => cb(ok(null)));
    const w = mountPage();
    await flushPromises();
    w.vm.$confirm = vi.fn(() => Promise.resolve('confirm'));
    w.vm.selected = ['fw-1', 'fw-2'];
    w.vm.deleteSelected();
    await flushPromises();
    expect(w.vm.$confirm.mock.calls[0][2].danger).toBe(true);
    expect(api.ota.deleteOta.mock.calls[0][0]).toEqual(['fw-2', 'fw-1']);
    w.unmount();
  });

  it('saves a new build with saveOta and an edit with updateOta', async () => {
    api.ota.saveOta.mockImplementation((f, cb) => cb(ok(null)));
    api.ota.updateOta.mockImplementation((id, f, cb) => cb(ok(null)));
    const w = mountPage();
    await flushPromises();
    w.vm.save({ id: null, firmwareName: 'tinybot-2.5.6', type: 'tinybot', version: '2.5.6', firmwarePath: 'p', size: 1, remark: '' });
    expect(api.ota.saveOta).toHaveBeenCalled();
    w.vm.save({ ...rows[0] });
    expect(api.ota.updateOta.mock.calls[0][0]).toBe('fw-2');
    w.unmount();
  });
});

describe('Firmware sheet', () => {
  function mountSheet(form) {
    return mount(FirmwareSheet, {
      props: { open: true, form, types: [{ name: 'TinyBot', key: 'tinybot' }] },
      global: { plugins: [kit, i18n] }, attachTo: document.body,
    });
  }

  it('does not submit a new build without its uploaded file', async () => {
    const w = mountSheet({ id: null, firmwareName: 'tinybot-1.0.0', type: 'tinybot', version: '1.0.0' });
    w.vm.submit();
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.vm.errors.firmwarePath).toBe('ota.err.fileRequired');
    w.unmount();
  });

  it('uploads a picked .bin and then submits the path and size', async () => {
    api.ota.uploadFirmware.mockImplementation((file, cb) => cb(ok('2026/fw.bin')));
    const w = mountSheet({ id: null, firmwareName: 'tinybot-1.0.0', type: 'tinybot', version: '1.0.0' });
    w.vm.onFiles([{ name: 'tinybot.bin', size: 2048 }]);
    expect(w.vm.f.firmwarePath).toBe('2026/fw.bin');
    w.vm.submit();
    expect(w.emitted('submit')[0][0]).toMatchObject({ firmwarePath: '2026/fw.bin', size: 2048, version: '1.0.0' });
    w.unmount();
  });

  it('refuses other file types without uploading', () => {
    const w = mountSheet({ id: null });
    w.vm.onFiles([{ name: 'sound.wav', size: 10 }]);
    expect(api.ota.uploadFirmware).not.toHaveBeenCalled();
    w.unmount();
  });

  it('rejects a version that is not x.x.x', () => {
    const w = mountSheet({ id: 'fw-1', firmwareName: 'a', type: 'tinybot', version: '2.5', firmwarePath: 'p' });
    w.vm.submit();
    expect(w.vm.errors.version).toBe('ota.err.versionFormat');
    expect(w.emitted('submit')).toBeUndefined();
    w.unmount();
  });
});
