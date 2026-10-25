import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const api = vi.hoisted(() => ({
  correctWord: {
    getFileList: vi.fn(), addFile: vi.fn(), updateFile: vi.fn(), deleteFile: vi.fn(), batchDeleteFile: vi.fn(), downloadFile: vi.fn(),
  },
  agent: { getAgentList: vi.fn(), updateAgentConfig: vi.fn() },
  device: { getAgentBindDevices: vi.fn(), getDeviceStatus: vi.fn(), updateDeviceInfo: vi.fn() },
  addressBook: { getAddressBookList: vi.fn(), updateAlias: vi.fn(), updatePermission: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

const { default: kit } = await import('../src/kit/index.js');
const { default: i18n } = await import('../src/i18n/index.js');
const { default: Words } = await import('../src/views/words/ReplacementWordManagement.vue');
const { default: WordSheet } = await import('../src/views/words/ReplacementWordSheet.vue');
const { default: AddressBook } = await import('../src/views/words/AddressBookManagement.vue');

const ok = (data) => ({ data: { code: 0, data } });
const files = [
  { id: 'f1', fileName: 'Robot names', wordCount: 2, content: ['tiny bot|TinyBot', 'no bix|Nobix'], createdAt: '2026-10-01 10:00:00', updatedAt: '2026-10-20 10:00:00' },
  { id: 'f2', fileName: 'Prayer names', wordCount: 1, content: ['যোহর|জোহর'], createdAt: '2026-10-02 10:00:00', updatedAt: '2026-10-02 10:00:00' },
];
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] });
const mountIt = (C, props) => mount(C, { props, global: { plugins: [kit, i18n, router] }, attachTo: document.body });

beforeEach(() => {
  i18n.global.locale = 'en';
  for (const g of Object.values(api)) for (const f of Object.values(g)) f.mockReset();
  api.correctWord.getFileList.mockImplementation((p, cb) => cb(ok({ list: files, total: 2 })));
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Replacement words page', () => {
  it('asks for page one with the UI page size, as the legacy page did', async () => {
    const w = mountIt(Words);
    await flushPromises();
    expect(api.correctWord.getFileList.mock.calls[0][0]).toEqual({ page: 1, pageSize: 10 });
    expect(w.text()).toContain('Robot names');
    expect(w.text()).toContain('tiny bot');
    w.unmount();
  });

  it('filters the page by file name and shows the filtered-empty state', async () => {
    const w = mountIt(Words);
    await flushPromises();
    w.vm.query = 'prayer';
    await flushPromises();
    expect(w.vm.visibleRows.map((r) => r.id)).toEqual(['f2']);
    w.vm.query = 'nothing';
    await flushPromises();
    expect(w.text()).toContain('No file has this name');
    w.unmount();
  });

  it('shows an error with retry when the list answer is an error', async () => {
    api.correctWord.getFileList.mockImplementation((p, cb) => cb({ data: { code: 500, msg: 'boom' } }));
    const w = mountIt(Words);
    await flushPromises();
    expect(w.vm.failed).toBe(true);
    expect(w.text()).toContain('Could not load the files');
    w.unmount();
  });

  it('batch-deletes the selected files after a danger confirm', async () => {
    api.correctWord.batchDeleteFile.mockImplementation((ids, cb) => cb(ok(null)));
    const w = mountIt(Words);
    await flushPromises();
    w.vm.$confirm = vi.fn(() => Promise.resolve());
    w.vm.selected = ['f1', 'f2'];
    w.vm.removeSelected();
    await flushPromises();
    expect(w.vm.$confirm.mock.calls[0][2].danger).toBe(true);
    expect(api.correctWord.batchDeleteFile.mock.calls[0][0]).toEqual(['f1', 'f2']);
    expect(w.vm.selected).toEqual([]);
    w.unmount();
  });

  it('deletes one file by id', async () => {
    api.correctWord.deleteFile.mockImplementation((id, cb) => cb(ok(null)));
    const w = mountIt(Words);
    await flushPromises();
    w.vm.$confirm = vi.fn(() => Promise.resolve());
    w.vm.remove(files[1]);
    await flushPromises();
    expect(api.correctWord.deleteFile.mock.calls[0][0]).toBe('f2');
    w.unmount();
  });

  it('adds without an id and updates with one', async () => {
    api.correctWord.addFile.mockImplementation((d, cb) => cb(ok({})));
    api.correctWord.updateFile.mockImplementation((d, cb) => cb(ok(null)));
    const w = mountIt(Words);
    await flushPromises();
    w.vm.save({ id: undefined, fileName: 'New', content: ['a|b'] });
    w.vm.save({ id: 'f1', fileName: 'Robot names', content: ['a|b'] });
    await flushPromises();
    expect(api.correctWord.addFile).toHaveBeenCalledTimes(1);
    expect(api.correctWord.updateFile.mock.calls[0][0]).toEqual({ id: 'f1', fileName: 'Robot names', content: ['a|b'] });
    w.unmount();
  });
});

describe('Replacement word sheet', () => {
  it('blocks a bad line and names its line, then sends the non-blank lines', async () => {
    const w = mountIt(WordSheet, { open: true, form: { id: 'f1', fileName: 'Names', content: ['a|b'] } });
    await flushPromises();
    w.vm.content = 'a|b\n\nbroken';
    w.vm.submit();
    await flushPromises();
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.vm.errors.content).toContain('Line 3');
    w.vm.content = 'a|b\n\nc|d\n';
    w.vm.submit();
    expect(w.emitted('submit')[0][0]).toEqual({ id: 'f1', fileName: 'Names', content: ['a|b', 'c|d'] });
    w.unmount();
  });

  it('requires a file name', async () => {
    const w = mountIt(WordSheet, { open: true, form: { id: undefined, fileName: '', content: '' } });
    await flushPromises();
    w.vm.content = 'a|b';
    w.vm.submit();
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.vm.errors.fileName).toBe('Give the file a name');
    w.unmount();
  });
});

describe('Address book page', () => {
  const agents = [{ id: 'a1', agentName: 'TinyBot' }, { id: 'a2', agentName: 'Study' }];
  const devices = {
    a1: [{ id: 'd1', alias: 'Home', macAddress: 'AA:00:00:00:00:01', board: 'tinybot' }, { id: 'd2', alias: '', macAddress: 'AA:00:00:00:00:02', board: 'tinybot' }],
    a2: [{ id: 'd3', alias: 'Desk', macAddress: 'AA:00:00:00:00:03', board: 'tinybot' }],
  };
  let pending;
  beforeEach(() => {
    pending = [];
    api.agent.getAgentList.mockImplementation((cb) => cb(ok(agents.map((a) => ({ ...a })))));
    api.device.getAgentBindDevices.mockImplementation((id, cb) => cb(ok(devices[id])));
    api.device.getDeviceStatus.mockImplementation((id, cb) => cb(ok(JSON.stringify({ 'tinybot@@@AA_00_00_00_00_01@@@AA_00_00_00_00_01': { isAlive: true } }))));
    api.addressBook.getAddressBookList.mockImplementation((mac, cb) => pending.push({ mac, cb }));
  });
  const answer = (i, list) => pending[i].cb(ok(list));

  it('chooses the first robot and keys permissions by the target MAC', async () => {
    const w = mountIt(AddressBook);
    await flushPromises();
    expect(w.vm.selectedDevice.id).toBe('d1');
    expect(pending[0].mac).toBe('AA:00:00:00:00:01');
    expect(w.vm.selectedDevice.status).toBe('online');
    answer(0, [{ targetMac: 'aa:00:00:00:00:03', alias: 'Desk bot', hasPermission: true }]);
    await flushPromises();
    expect(w.vm.selectedPermissions).toEqual(['AA:00:00:00:00:03']);
    expect(w.vm.aliases['AA:00:00:00:00:03']).toBe('Desk bot');
    w.unmount();
  });

  it('ignores a late answer for a robot that is no longer chosen, and clears while loading', async () => {
    const w = mountIt(AddressBook);
    await flushPromises();
    const second = w.vm.agentDeviceOptions[1];
    w.vm.handleDeviceClick(second.devices[0], second);
    expect(w.vm.permissionsLoading).toBe(true);
    expect(w.vm.selectedPermissions).toEqual([]);
    answer(0, [{ targetMac: 'AA:00:00:00:00:02', hasPermission: true }]);
    await flushPromises();
    expect(w.vm.selectedPermissions).toEqual([]);
    expect(w.vm.permissionsLoading).toBe(true);
    answer(1, [{ targetMac: 'AA:00:00:00:00:01', hasPermission: true }]);
    await flushPromises();
    expect(w.vm.selectedPermissions).toEqual(['AA:00:00:00:00:01']);
    w.unmount();
  });

  it('saves only the changed contacts, and not while loading', async () => {
    api.addressBook.updatePermission.mockImplementation((d, cb) => cb(ok(null)));
    const w = mountIt(AddressBook);
    await flushPromises();
    w.vm.handleSavePermissions();
    expect(api.addressBook.updatePermission).not.toHaveBeenCalled();
    answer(0, [{ targetMac: 'AA:00:00:00:00:02', hasPermission: true }]);
    await flushPromises();
    w.vm.handlePermissionToggle('AA:00:00:00:00:02', false);
    w.vm.handlePermissionToggle('AA:00:00:00:00:03', true);
    w.vm.handleSavePermissions();
    await flushPromises();
    expect(api.addressBook.updatePermission.mock.calls.map((c) => c[0])).toEqual([
      { macAddress: 'AA:00:00:00:00:01', targetMac: 'AA:00:00:00:00:02', hasPermission: false },
      { macAddress: 'AA:00:00:00:00:01', targetMac: 'AA:00:00:00:00:03', hasPermission: true },
    ]);
    w.unmount();
  });

  it('renames a contact in the address book and reloads it', async () => {
    api.addressBook.updateAlias.mockImplementation((d, cb) => cb(ok(null)));
    const w = mountIt(AddressBook);
    await flushPromises();
    answer(0, []);
    await flushPromises();
    w.vm.saveContactAlias(w.vm.allDevices[0], 'Bedroom');
    expect(api.addressBook.updateAlias.mock.calls[0][0]).toEqual({ macAddress: 'AA:00:00:00:00:01', targetMac: 'AA:00:00:00:00:02', alias: 'Bedroom' });
    expect(pending.length).toBe(2);
    w.unmount();
  });

  it('renames the robot and its character with the legacy calls', async () => {
    api.device.updateDeviceInfo.mockImplementation((id, p, cb) => cb(ok(null)));
    api.agent.updateAgentConfig.mockImplementation((id, p, cb) => cb(ok(null)));
    const w = mountIt(AddressBook);
    await flushPromises();
    w.vm.saveAlias('Kitchen');
    w.vm.saveAgentName('Helper');
    expect(api.device.updateDeviceInfo.mock.calls[0].slice(0, 2)).toEqual(['d1', { alias: 'Kitchen' }]);
    expect(api.agent.updateAgentConfig.mock.calls[0].slice(0, 2)).toEqual(['a1', { agentName: 'Helper' }]);
    expect(w.vm.selectedDevice.name).toBe('Kitchen');
    expect(w.vm.selectedAgent.agentName).toBe('Helper');
    w.unmount();
  });

  it('sends an owner with no robots to My robots', async () => {
    api.agent.getAgentList.mockImplementation((cb) => cb(ok([])));
    const w = mountIt(AddressBook);
    await flushPromises();
    expect(w.text()).toContain('No robots yet');
    w.unmount();
  });
});
