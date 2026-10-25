// History (/history): the chat history on its own page, for products with 'chat_history' but no
// 'messages' (the same list TinyBot shows inside Messages: src/views/messages/ChatHistory.vue).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/apis/api', () => ({
  default: {
    agent: { getAgentSessions: vi.fn(), getAgentChatHistory: vi.fn(), getAudioId: vi.fn(), getDownloadUrl: vi.fn() },
    getServiceUrl: () => '',
  },
}));
vi.mock('@/shell/robot', async (orig) => ({ ...(await orig()), loadRobots: vi.fn(async () => []) }));

import Api from '@/apis/api';
import kit from '@/kit';
import { robot } from '@/shell/robot';
import shell from '@/i18n/pages/shell.js';
import messages from '@/i18n/pages/messages.js';
import History from '@/views/messages/History.vue';

const now = new Date().toISOString();
async function setup(query = '?agentId=a1') {
  const Blank = { template: '<div />' };
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/history', component: History }, { path: '/robots', component: Blank }] });
  router.push(`/history${query}`);
  await router.isReady();
  const i18n = createI18n({ legacy: true, allowComposition: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...messages.en } } });
  const w = mount(History, { global: { plugins: [router, i18n, kit], stubs: { teleport: true } } });
  await flushPromises();
  return w;
}

describe('History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    robot.agentId = ''; robot.deviceId = ''; robot.loaded = true; robot.list = [];
    Api.agent.getAgentSessions.mockImplementation((id, q, cb) => cb({ data: { code: 0, data: { list: [
      { sessionId: 's1', createdAt: now, chatCount: 2, title: 'Weather' },
    ] } } }));
    Api.agent.getAgentChatHistory.mockImplementation((id, s, cb) => cb({ data: { code: 0, data: [
      { chatType: 1, content: 'How is the weather?', createdAt: now },
      { chatType: 2, content: 'Sunny all day.', createdAt: now },
    ] } }));
  });

  it('lists the sessions of the character and reads one', async () => {
    const w = await setup();
    expect(w.find('h1').text()).toBe('Chat history');
    expect(Api.agent.getAgentSessions).toHaveBeenCalledWith('a1', expect.objectContaining({ page: 1 }), expect.any(Function));
    expect(w.text()).toContain('Weather');
    await w.find('.conv-row').trigger('click');
    await flushPromises();
    expect(Api.agent.getAgentChatHistory).toHaveBeenCalledWith('a1', 's1', expect.any(Function));
    expect(w.text()).toContain('Sunny all day.');
  });

  it('falls back to the chosen robot\'s character, and asks for a robot when there is none', async () => {
    robot.agentId = 'a2';
    await setup('');
    expect(Api.agent.getAgentSessions.mock.calls[0][0]).toBe('a2');
    robot.agentId = '';
    const w = await setup('');
    expect(w.text()).toContain(shell.en['common.goRobots'] || 'robot');
  });

  it('has its strings in both languages, with no em dash', () => {
    for (const k of ['nav.history', 'history.desc', 'history.sectionDesc']) {
      expect(messages.bn[k]).toBeTruthy();
      expect(messages.en[k]).toBeTruthy();
      expect(messages.bn[k] + messages.en[k]).not.toMatch(/—/);
    }
  });
});
