// Kit, shell and Today fixes of review round 1: turning the day by keyboard and buttons, the
// date heading, field descriptions, the day table's row buttons and past ink, the table's phone
// select-all, the phone tab bar, the two app languages and Today's routine labels.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TbDateBlock from '@/kit/TbDateBlock.vue';
import TbField from '@/kit/TbField.vue';
import TbInput from '@/kit/TbInput.vue';
import TbDayTable from '@/kit/TbDayTable.vue';
import TbTable from '@/kit/TbTable.vue';
import { TABS } from '@/shell/nav';
import { LANGUAGES, changeLanguage } from '@/i18n';
import i18n from '@/i18n';
import { dayRows } from '@/views/today/todayModel';

const date = new Date(2026, 9, 25, 9, 0);

describe('TbDateBlock', () => {
  it('turns the day with the arrow keys and the chevron buttons when it has labels', async () => {
    const w = mount(TbDateBlock, { props: { date, lang: 'en', prevLabel: 'Previous day', nextLabel: 'Next day', headingLevel: 1 } });
    expect(w.attributes('tabindex')).toBe('0');
    await w.trigger('keydown', { key: 'ArrowRight' });
    await w.trigger('keydown', { key: 'ArrowLeft' });
    const buttons = w.findAll('button');
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Previous day', 'Next day']);
    await buttons[1].trigger('click');
    expect(w.emitted('turn').map((e) => e[0])).toEqual([1, -1, 1]);
    expect(w.find('h1').exists()).toBe(true);
  });

  it('stays a plain date without labels', async () => {
    const w = mount(TbDateBlock, { props: { date, lang: 'en' } });
    expect(w.attributes('tabindex')).toBeUndefined();
    expect(w.find('button').exists()).toBe(false);
    expect(w.find('h1').exists()).toBe(false);
    await w.trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('turn')).toBeUndefined();
  });
});

describe('TbField', () => {
  it('points the control at its hint, then at its error', async () => {
    const w = mount({
      components: { TbField, TbInput },
      props: { error: { type: String, default: '' } },
      template: '<TbField label="Name" hint="Up to 20 letters" :error="error" for-id="nm"><TbInput id="nm" /></TbField>',
    });
    expect(w.find('input').attributes('aria-describedby')).toBe('nm-hint');
    expect(w.find('#nm-hint').exists()).toBe(true);
    await w.setProps({ error: 'Too long' });
    expect(w.find('input').attributes('aria-describedby')).toBe('nm-err');
    expect(w.find('#nm-err').text()).toBe('Too long');
  });

  it('leaves a bare input undescribed', () => {
    const w = mount(TbInput);
    expect(w.find('input').attributes('aria-describedby')).toBeUndefined();
  });
});

describe('TbDayTable', () => {
  const rows = [
    { key: 'a', time: '07:00', title: 'Fajr', ink: 'prayer' },
    { key: 'b', time: '10:00', title: 'Tea', ink: 'routine' },
  ];

  it('opens a row from a named button and marks past rows', async () => {
    const w = mount(TbDayTable, { props: { rows, lang: 'en', nowMinutes: 9 * 60, clickable: true } });
    const open = w.findAll('button.tb-day__open');
    expect(open.map((b) => b.text())).toEqual(['Fajr', 'Tea']);
    expect(w.findAll('tr[tabindex]').length).toBe(0);
    await open[1].trigger('click');
    expect(w.emitted('select')).toHaveLength(1);
    expect(w.emitted('select')[0][0].key).toBe('b');
    expect(w.find('tr.is-past').text()).toContain('Fajr');
    expect(w.find('.tb-day__now').exists()).toBe(true);
  });

  it('draws plain titles when rows do not open', () => {
    const w = mount(TbDayTable, { props: { rows, lang: 'en' } });
    expect(w.find('button').exists()).toBe(false);
  });
});

describe('TbTable', () => {
  const columns = [{ key: 'name', label: 'Name' }, { key: 'actions', label: '' }];
  const rows = [{ id: 1, name: 'One' }];

  it('can leave the phone select-all to the page', () => {
    const on = mount(TbTable, { props: { columns, rows, rowKey: 'id', selectable: true } });
    expect(on.find('.tb-table__selall').exists()).toBe(true);
    const off = mount(TbTable, { props: { columns, rows, rowKey: 'id', selectable: true, phoneSelectAll: false } });
    expect(off.find('.tb-table__selall').exists()).toBe(false);
  });

  it('marks each cell with its column key', () => {
    const w = mount(TbTable, { props: { columns, rows } });
    expect(w.find('td[data-key="actions"]').exists()).toBe(true);
  });
});

describe('shell', () => {
  it('gives the phone five tabs with Messages', () => {
    expect(TABS.map((t) => t.to)).toEqual(['/today', '/day', '/messages', '/look', '/more']);
  });

  it('speaks Bangla and English only', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['bn', 'en']);
    changeLanguage('zh_CN');
    expect(i18n.global.locale).toBe('bn');
    changeLanguage('en');
    expect(i18n.global.locale).toBe('en');
    changeLanguage('bn');
  });
});

describe('Today routine rows', () => {
  it('use the Day page labels, not the doing-now line', () => {
    const view = { settings: { routine: { items: [{ start: '08:00', end: '08:30', activity: 'exercise' }] } } };
    const t = (k) => k;
    const [row] = dayRows(view, date, t);
    expect(row.title).toBe('day.activity.exercise');
    expect(row.stateText).toBe('day.row.routine');
  });
});
