import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import kit from '@/kit';
import pages from '@/i18n/pages/knowledge.js';
import {
  chunkPage, chunkSource, fileExt, formatFileSize, formatSimilarity, isTooLarge, parseState, progressPercent,
  retrievalChunks, validateKb,
} from '@/views/knowledge/kbModel';

const api = vi.hoisted(() => ({
  knowledgeBase: {
    getKnowledgeBaseList: vi.fn(),
    createKnowledgeBase: vi.fn(),
    updateKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    deleteKnowledgeBases: vi.fn(),
    getDocumentList: vi.fn(),
    uploadDocument: vi.fn(),
    parseDocument: vi.fn(),
    deleteDocument: vi.fn(),
    listChunks: vi.fn(),
    retrievalTest: vi.fn(),
  },
  model: { getRAGModels: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));
window.scrollTo = vi.fn();

const { default: KnowledgeBaseManagement } = await import('@/views/knowledge/KnowledgeBaseManagement.vue');
const { default: KnowledgeBaseItem } = await import('@/views/knowledge/KnowledgeBaseItem.vue');
const { default: KnowledgeBaseSheet } = await import('@/views/knowledge/KnowledgeBaseSheet.vue');

const reply = (data) => ({ data: { code: 0, msg: 'ok', data } });
const BASES = [
  { id: 'k1', datasetId: 'ds1', name: 'Recipes', description: 'Food', status: 1, documentCount: 2, ragModelId: 'r1' },
  { id: 'k2', datasetId: 'ds2', name: 'Notes', description: 'School', status: 0, documentCount: 0, errorMessage: 'Service down' },
];

function i18n() {
  return createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...pages.en, 'common.search': 'Search', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.save': 'Save', 'common.close': 'Close', 'common.loading': 'Loading', 'common.retry': 'Try again', 'common.loadFailed': 'Failed' } }, silentTranslationWarn: true, missingWarn: false, fallbackWarn: false });
}

function mountPage(query = {}) {
  const router = { push: vi.fn(() => Promise.resolve()) };
  const route = { query };
  const wrapper = mount(KnowledgeBaseManagement, {
    attachTo: document.body,
    global: {
      plugins: [kit, i18n()],
      mocks: { $route: route, $router: router },
      stubs: { teleport: true },
    },
  });
  return { wrapper, router, route };
}

describe('kbModel', () => {
  it('keeps the legacy upload rules', () => {
    expect(isTooLarge(10 * 1024 * 1024)).toBe(true);
    expect(isTooLarge(10 * 1024 * 1024 - 1)).toBe(false);
    expect(fileExt('a.report.docx')).toBe('DOCX');
    expect(fileExt('README')).toBe('FILE');
    expect(formatFileSize(0, 'en')).toBe('0 B');
    expect(formatFileSize(1536, 'en')).toBe('1.5 KB');
    expect(formatFileSize(1536, 'bn')).toBe('১.৫ KB');
  });

  it('maps parse states and progress like the legacy page', () => {
    expect(parseState(3).key).toBe('done');
    expect(parseState(1).key).toBe('processing');
    expect(parseState(4).key).toBe('failed');
    expect(parseState(2).key).toBe('cancelled');
    expect(parseState(undefined).key).toBe('notStarted');
    expect(progressPercent({ parseStatusCode: 3 })).toBe(100);
    expect(progressPercent({ parseStatusCode: 1 })).toBe(50);
    expect(progressPercent({ parseStatusCode: 1, chunkNum: 1, totalChunkNum: 4 })).toBe(25);
    expect(progressPercent({ parseStatusCode: 0 })).toBe(0);
  });

  it('reads the three chunk reply shapes', () => {
    expect(chunkPage({ list: [1, 2], total: 9 })).toEqual({ list: [1, 2], total: 9 });
    expect(chunkPage({ chunks: [1] })).toEqual({ list: [1], total: 1 });
    expect(chunkPage([1, 2, 3])).toEqual({ list: [1, 2, 3], total: 3 });
    expect(chunkPage(null)).toEqual({ list: [], total: 0 });
    expect(retrievalChunks({ chunks: [{ a: 1 }] })).toHaveLength(1);
    expect(retrievalChunks(null)).toEqual([]);
    expect(chunkSource({ document_keyword: 'a.pdf' })).toBe('a.pdf');
    expect(formatSimilarity(0.5, 'en')).toBe('0.5000');
  });

  it('validates the knowledge base form with the legacy rules', () => {
    expect(validateKb({ name: '', description: '', ragModelId: null })).toEqual({
      name: 'kb.form.nameRequired', description: 'kb.form.descRequired', ragModelId: 'kb.form.ragRequired',
    });
    expect(validateKb({ name: 'x'.repeat(51), description: 'd', ragModelId: 'r' }).name).toBe('kb.form.nameLength');
    expect(validateKb({ name: 'bad!name', description: 'd', ragModelId: 'r' }).name).toBe('kb.form.namePattern');
    expect(validateKb({ name: 'My notes_1-a', description: 'd'.repeat(301), ragModelId: 'r' })).toEqual({ description: 'kb.form.descLength' });
    expect(validateKb({ name: 'My notes', description: 'ok', ragModelId: 'r' })).toEqual({});
  });
});

describe('KnowledgeBaseManagement', () => {
  beforeEach(() => {
    Object.values(api.knowledgeBase).forEach((f) => f.mockReset());
    api.model.getRAGModels.mockReset();
    api.knowledgeBase.getKnowledgeBaseList.mockImplementation((p, cb) => cb(reply({ list: BASES.map((b) => ({ ...b })), total: 2 })));
    api.knowledgeBase.getDocumentList.mockImplementation((id, p, cb) => cb(reply({ list: [{ id: 'd1', name: 'a.pdf', parseStatusCode: 3 }, { id: 'd2', name: 'b.txt', parseStatusCode: 0 }], total: 2 })));
    api.knowledgeBase.listChunks.mockImplementation((id, doc, p, cb) => cb(reply({ list: [{ content: 'x' }], total: 5 })));
    api.model.getRAGModels.mockImplementation((cb) => cb(reply([{ id: 'r1', modelName: 'RAG one' }])));
  });

  it('lists knowledge bases with paging and the name filter', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    expect(api.knowledgeBase.getKnowledgeBaseList).toHaveBeenCalledWith({ page: 1, page_size: 20, name: '' }, expect.any(Function), expect.any(Function));
    expect(wrapper.text()).toContain('Recipes');
    expect(wrapper.text()).toContain('Service down');
    await wrapper.find('.kb-filter input').setValue('rec');
    await wrapper.find('.kb-filter form').trigger('submit');
    expect(api.knowledgeBase.getKnowledgeBaseList).toHaveBeenLastCalledWith({ page: 1, page_size: 20, name: 'rec' }, expect.any(Function), expect.any(Function));
    wrapper.unmount();
  });

  it('opens a knowledge base through the URL', async () => {
    const { wrapper, router } = mountPage();
    await flushPromises();
    await wrapper.find('.kb-name__open').trigger('click');
    expect(router.push).toHaveBeenCalledWith({ query: { kb: 'ds1' } });
    wrapper.unmount();
  });

  it('sends the legacy status update', async () => {
    api.knowledgeBase.updateKnowledgeBase.mockImplementation((id, data, cb) => cb(reply(null)));
    const { wrapper } = mountPage();
    await flushPromises();
    wrapper.vm.setStatus(wrapper.vm.knowledgeBases[0], false);
    expect(api.knowledgeBase.updateKnowledgeBase).toHaveBeenCalledWith('ds1',
      { id: 'k1', datasetId: 'ds1', name: 'Recipes', description: 'Food', status: 0 }, expect.any(Function), expect.any(Function));
    expect(wrapper.vm.knowledgeBases[0].status).toBe(0);
    wrapper.unmount();
  });

  it('creates with name, description, status and RAG model', async () => {
    api.knowledgeBase.createKnowledgeBase.mockImplementation((data, cb) => cb(reply({})));
    const { wrapper } = mountPage();
    await flushPromises();
    wrapper.vm.handleSubmit({ id: null, name: 'New', description: 'D', status: 1, ragModelId: 'r1' });
    expect(api.knowledgeBase.createKnowledgeBase).toHaveBeenCalledWith({ name: 'New', description: 'D', status: 1, ragModelId: 'r1' }, expect.any(Function), expect.any(Function));
    wrapper.unmount();
  });
});

describe('KnowledgeBaseSheet', () => {
  it('defaults a new base to the first RAG model and blocks an invalid form', async () => {
    api.model.getRAGModels.mockImplementation((cb) => cb(reply([{ id: 'r1', modelName: 'RAG one' }, { id: 'r2', modelName: 'RAG two' }])));
    const wrapper = mount(KnowledgeBaseSheet, {
      props: { open: true, value: { id: null, name: '', description: '', status: 1 } },
      global: { plugins: [kit, i18n()], stubs: { teleport: true } },
    });
    await flushPromises();
    expect(wrapper.vm.form.ragModelId).toBe('r1');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeFalsy();
    expect(wrapper.text()).toContain('Enter a name');
    wrapper.vm.form.name = 'Good name';
    wrapper.vm.form.description = 'Something';
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')[0][0]).toMatchObject({ name: 'Good name', ragModelId: 'r1', status: 1 });
    wrapper.unmount();
  });
});

describe('KnowledgeBaseItem', () => {
  it('loads documents, their chunk counts, and runs the retrieval test', async () => {
    api.knowledgeBase.retrievalTest.mockImplementation((id, data, cb) => cb(reply({ chunks: [{ content: 'hit', similarity: 0.91, document_keyword: 'a.pdf' }] })));
    const wrapper = mount(KnowledgeBaseItem, {
      props: { kb: { ...BASES[0] } },
      global: { plugins: [kit, i18n()], stubs: { teleport: true } },
    });
    await flushPromises();
    expect(api.knowledgeBase.getDocumentList).toHaveBeenCalledWith('ds1', { page: 1, page_size: 10, name: '' }, expect.any(Function), expect.any(Function));
    expect(api.knowledgeBase.listChunks).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('View chunks');
    expect(wrapper.text()).toContain('Ready');
    wrapper.vm.question = '  what to cook  ';
    wrapper.vm.runRetrievalTest();
    expect(api.knowledgeBase.retrievalTest).toHaveBeenCalledWith('ds1', { question: 'what to cook' }, expect.any(Function), expect.any(Function));
    await flushPromises();
    expect(wrapper.text()).toContain('0.9100');
    wrapper.unmount();
  });

  it('refuses files of 10 MB or more and uploads the rest one by one', async () => {
    api.knowledgeBase.uploadDocument.mockImplementation((id, fd, cb) => cb(reply({})));
    const wrapper = mount(KnowledgeBaseItem, {
      props: { kb: { ...BASES[0] } },
      global: { plugins: [kit, i18n()], stubs: { teleport: true } },
    });
    await flushPromises();
    wrapper.vm.handleFiles([{ name: 'big.pdf', size: 11 * 1024 * 1024 }, { name: 'ok.pdf', size: 1000 }, { name: 'ok2.md', size: 10 }]);
    expect(wrapper.vm.selectedFilesList.map((f) => f.name)).toEqual(['ok.pdf', 'ok2.md']);
    wrapper.vm.handleBatchUploadSubmit();
    await flushPromises();
    expect(api.knowledgeBase.uploadDocument).toHaveBeenCalledTimes(2);
    expect(api.knowledgeBase.uploadDocument.mock.calls[0][1]).toBeInstanceOf(FormData);
    wrapper.unmount();
  });
});
