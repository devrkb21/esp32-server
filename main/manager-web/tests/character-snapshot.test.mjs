// Version history helpers of Character & voice. The first block is the legacy security
// regression gate (agentSnapshotDisplayUtils.test.mjs), ported to vitest unchanged in substance.
import { describe, expect, it } from 'vitest';
import {
  hasValidCurrentStateToken,
  normalizeSnapshotOrderedValue,
  redactSnapshotDisplayValue,
  SNAPSHOT_SECRET_REDACTED,
} from '@/views/character/snapshotDisplay.mjs';
import {
  codeDiffLanguage, createSnapshotText, isSameFieldValue, renderMarkdown, resolveDiffFields, restoreClearsHistory, useCodeDiff, versionRangeTitle,
} from '@/views/character/snapshotModel';

describe('snapshot display redaction (legacy gate)', () => {
  it('accepts only non-empty opaque current-state tokens', () => {
    expect(hasValidCurrentStateToken('state-token')).toBe(true);
    expect(hasValidCurrentStateToken('  state-token  ')).toBe(true);
    expect(hasValidCurrentStateToken('')).toBe(false);
    expect(hasValidCurrentStateToken('   ')).toBe(false);
    expect(hasValidCurrentStateToken(null)).toBe(false);
    expect(hasValidCurrentStateToken(123)).toBe(false);
  });

  it('redacts nested credentials without hiding non-sensitive display values', () => {
    const redacted = redactSnapshotDisplayValue({
      apiKey: 'api-secret',
      headers: [
        { key: 'Authorization', value: 'Bearer secret' },
        { key: 'Proxy-Authorization', value: 'Basic secret' },
        { key: 'Set-Cookie', value: 'session=secret' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      marker: SNAPSHOT_SECRET_REDACTED,
      session_id: 'session-secret',
      url: 'https://user:pass@example.com/context?access_token=secret#fragment',
      visible: 'kept',
    }, '[hidden]');
    expect(redacted).toEqual({
      apiKey: '[hidden]',
      headers: [
        { key: 'Authorization', value: '[hidden]' },
        { key: 'Proxy-Authorization', value: '[hidden]' },
        { key: 'Set-Cookie', value: '[hidden]' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      marker: '[hidden]',
      session_id: '[hidden]',
      url: 'https://[hidden]@example.com/context?[hidden]',
      visible: 'kept',
    });
  });

  it('uses a function parameter key when redacting scalar plugin values', () => {
    expect(redactSnapshotDisplayValue('secret', '[hidden]', 'clientSecret')).toBe('[hidden]');
    expect(redactSnapshotDisplayValue('secret', '[hidden]', 'Ocp-Apim-Subscription-Key')).toBe('[hidden]');
    expect(redactSnapshotDisplayValue('public', '[hidden]', 'clientId')).toBe('public');
  });

  it('redacts mixed-case name/value credential entries', () => {
    expect(redactSnapshotDisplayValue({
      headers: [{ NAME: 'Authorization', VALUE: 'Bearer live-secret' }, { NaMe: 'Content-Type', VaLuE: 'application/json' }],
    }, '[hidden]')).toEqual({
      headers: [{ NAME: 'Authorization', VALUE: '[hidden]' }, { NaMe: 'Content-Type', VaLuE: 'application/json' }],
    });
  });

  it('redacts capability URL path secrets while preserving public route identity', () => {
    const redacted = redactSnapshotDisplayValue({
      slackUrl: 'https://hooks.slack.com/services/T00000000/B00000000/slack-secret',
      slackGovUrl: 'https://hooks.slack-gov.com/services/T00000000/B00000000/slack-gov-secret',
      discordEndpoint: 'https://discord.com/api/webhooks/123456789/discord-secret',
      telegramUri: 'https://api.telegram.org/bot123456789:telegram-secret/sendMessage',
      telegramFileUri: 'https://api.telegram.org/file/bot123456789:telegram-file-secret/documents/file.txt',
      callbackUrl: 'https://events.example.com/api/webhook/generic-secret/delivery',
      hooksEndpoint: 'https://events.example.com/v1/hooks/hook-secret/status',
      hookEndpoint: 'https://events.example.com/v1/hook/singular-secret/status',
      webhooksEndpoint: 'https://events.example.com/v1/webhooks/plural-secret/status',
      relativeUrl: '/api/webhooks/relative-secret/continuation',
      nested: { deliveryWebhook: { options: { target: 'https://events.example.com/incoming/nested-secret', relativeTarget: '/incoming/nested-relative-secret' } } },
      protocolRelativeUrl: '//protocol-user:protocol-pass@example.com/context',
      jdbcUrl: 'jdbc:mysql://jdbc-user:jdbc-pass@example.com/database',
      webhook: 'https://capability.example.com/public-prefix/key-secret',
      restUrl: 'https://api.example.com/v1/users/customer-123',
      similarMarkerUrl: 'https://api.example.com/v1/webhook-settings/public-value',
    }, '[hidden]');
    expect(redacted).toEqual({
      slackUrl: 'https://hooks.slack.com/services/T00000000/B00000000/[hidden]',
      slackGovUrl: 'https://hooks.slack-gov.com/services/T00000000/B00000000/[hidden]',
      discordEndpoint: 'https://discord.com/api/webhooks/123456789/[hidden]',
      telegramUri: 'https://api.telegram.org/bot123456789:[hidden]/sendMessage',
      telegramFileUri: 'https://api.telegram.org/file/bot123456789:[hidden]/documents/file.txt',
      callbackUrl: 'https://events.example.com/api/webhook/[hidden]',
      hooksEndpoint: 'https://events.example.com/v1/hooks/[hidden]',
      hookEndpoint: 'https://events.example.com/v1/hook/[hidden]',
      webhooksEndpoint: 'https://events.example.com/v1/webhooks/[hidden]',
      relativeUrl: '/api/webhooks/[hidden]',
      nested: { deliveryWebhook: { options: { target: 'https://events.example.com/incoming/[hidden]', relativeTarget: '/incoming/[hidden]' } } },
      protocolRelativeUrl: '//[hidden]@example.com/context',
      jdbcUrl: 'jdbc:mysql://[hidden]@example.com/database',
      webhook: 'https://capability.example.com/public-prefix/[hidden]',
      restUrl: 'https://api.example.com/v1/users/customer-123',
      similarMarkerUrl: 'https://api.example.com/v1/webhook-settings/public-value',
    });
    const text = JSON.stringify(redacted);
    for (const secret of ['slack-secret', 'slack-gov-secret', 'discord-secret', 'telegram-secret', 'telegram-file-secret', 'generic-secret',
      'hook-secret', 'singular-secret', 'plural-secret', 'relative-secret', 'nested-secret', 'key-secret']) {
      expect(text.includes(secret)).toBe(false);
    }
  });

  it('normalizes object keys without erasing ordered-list changes', () => {
    const before = [{ url: 'https://first.example', headers: { Zeta: '2', Accept: 'json' } }, { url: 'https://second.example' }];
    const sameOrder = [{ headers: { Accept: 'json', Zeta: '2' }, url: 'https://first.example' }, { url: 'https://second.example' }];
    const reversed = [...sameOrder].reverse();
    expect(normalizeSnapshotOrderedValue(before)).toEqual(normalizeSnapshotOrderedValue(sameOrder));
    expect(normalizeSnapshotOrderedValue(before)).not.toEqual(normalizeSnapshotOrderedValue(reversed));
  });
});

describe('snapshot diffs', () => {
  const en = {
    'agentSnapshot.emptyValue': 'None', 'agentSnapshot.secretRedacted': 'Secret redacted', 'agentSnapshot.before': 'Before', 'agentSnapshot.after': 'After',
    'agentSnapshot.field.functions': 'Functions', 'agentSnapshot.field.ttsRate': 'Speed', 'agentSnapshot.function.added': 'Enabled',
    'agentSnapshot.function.removed': 'Disabled', 'agentSnapshot.function.updated': 'Parameters changed', 'agentSnapshot.function.enabled': 'Enabled',
    'agentSnapshot.function.disabled': 'Disabled', 'agentSnapshot.function.disabledNote': 'This function is disabled', 'agentSnapshot.function.noParams': 'No parameters required',
    'agentSnapshot.model.Memory_nomem': 'No memory',
  };
  const text = createSnapshotText({ t: (k) => en[k] || k, te: (k) => k in en, meta: { plugins: {}, models: { LLM_A: 'Model A' }, voices: {}, words: {} } });

  it('uses the backend changed fields for adjacent versions and compares everything otherwise', () => {
    const before = { ttsRate: '10', agentName: 'a', tagNames: ['x', 'y'] };
    const after = { ttsRate: 10, agentName: 'b', tagNames: ['y', 'x'] };
    expect(resolveDiffFields(before, after, ['agentName', 'restore', 'tags'])).toEqual(['agentName', 'tagNames']);
    expect(resolveDiffFields(before, after, [], [], true)).toEqual(['agentName']);
    expect(isSameFieldValue('summaryMemory', null, '  ')).toBe(true);
  });

  it('reports plugins that were turned on, off or changed, and hides secrets', () => {
    const items = text.diffItems(
      { functions: [{ pluginId: 'A', paramInfo: '{"api_key":"s1","city":"Dhaka"}' }, { pluginId: 'B', paramInfo: {} }] },
      { functions: [{ pluginId: 'A', paramInfo: { api_key: 's2', city: 'Khulna' } }, { pluginId: 'C', paramInfo: {} }] },
      ['functions'],
    );
    const changes = items[0].functionChanges;
    expect(changes.map((c) => c.type)).toEqual(['updated', 'removed', 'added']);
    const city = changes[0].after.params.find((p) => p.key === 'city');
    expect(city).toMatchObject({ value: 'Khulna', changed: true });
    expect(changes[0].after.params.find((p) => p.key === 'api_key').value).toBe('Secret redacted');
  });

  it('names models and shows empty values plainly', () => {
    const items = text.diffItems({ llmModelId: 'LLM_A', memModelId: 'Memory_nomem' }, { llmModelId: '', memModelId: 'Memory_x' }, ['llmModelId', 'memModelId']);
    expect(items[0]).toMatchObject({ beforeText: 'Model A', afterText: 'None' });
    expect(items[1].beforeText).toBe('No memory');
  });

  it('renders prompt Markdown escaped', () => {
    const html = renderMarkdown('# Hi\n- **bold** <b>x</b>\n- two', 'None');
    expect(html).toBe('<h1>Hi</h1><ul><li><strong>bold</strong> &lt;b&gt;x&lt;/b&gt;</li><li>two</li></ul>');
    expect(renderMarkdown('  ', 'None')).toContain('None');
  });

  it('warns when a restore turns memory off', () => {
    expect(restoreClearsHistory({ beforeSnapshotData: { memModelId: 'Memory_mem_local_short' }, afterSnapshotData: { memModelId: 'Memory_nomem' } })).toBe(true);
    expect(restoreClearsHistory({ beforeSnapshotData: { memModelId: 'Memory_nomem' }, afterSnapshotData: { memModelId: 'Memory_nomem' } })).toBe(false);
    expect(restoreClearsHistory(null)).toBe(false);
  });

  it('chooses the code diff for prompts, memory and structured values', () => {
    expect(useCodeDiff({ single: false, displayType: 'markdown' })).toBe(true);
    expect(useCodeDiff({ single: false, displayType: 'text', field: 'summaryMemory' })).toBe(true);
    expect(useCodeDiff({ single: true, displayType: 'markdown' })).toBe(false);
    expect(codeDiffLanguage({ field: 'contextProviders', displayType: 'text' })).toBe('json');
    expect(versionRangeTitle('Restore', 4, 2)).toBe('Restore #4 → #2');
  });
});
