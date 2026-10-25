'use strict';

const {
  parseAmount, formatMoney, createEntry, removeEntry, monthKeyOf, currentMonthKey,
  shiftMonth, entriesInMonth, sortEntries, summarize, loadEntries, saveEntries
} = require('../apps/expense/expense.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  const now = new Date(2026, 9, 26, 12, 0).getTime();

  t.test('parseAmount 金额解析为分（整数）', (a) => {
    a.equal(parseAmount('12.5'), 1250);
    a.equal(parseAmount(' 8 '), 800);
    a.equal(parseAmount('9999999.99'), 999999999);
    a.equal(parseAmount('0'), null);
    a.equal(parseAmount('-5'), null);
    a.equal(parseAmount('10.567'), null, '最多两位小数');
    a.equal(parseAmount('1,000'), null);
    a.equal(parseAmount('.5'), null);
    a.equal(parseAmount('abc'), null);
    a.equal(parseAmount(''), null);
    a.equal(parseAmount('10000000'), null, '超过上限');
  });

  t.test('formatMoney 千分位格式化', (a) => {
    a.equal(formatMoney(0), '¥0.00');
    a.equal(formatMoney(5), '¥0.05');
    a.equal(formatMoney(100), '¥1.00');
    a.equal(formatMoney(123456), '¥1,234.56');
    a.equal(formatMoney(-250), '-¥2.50');
    a.equal(formatMoney(100000000), '¥1,000,000.00');
  });

  t.test('createEntry 校验与默认日期', (a) => {
    a.deepEqual(
      createEntry('expense', '25.5', ' 午饭 ', '2026-10-25', now, 'e1'),
      { id: 'e1', type: 'expense', cents: 2550, note: '午饭', date: '2026-10-25', createdAt: now }
    );
    a.equal(createEntry('income', '100', '', null, now, 'e2').date, '2026-10-26', '未填日期默认今天');
    a.equal(createEntry('other', '1', '', null, now), null, '类型不合法');
    a.equal(createEntry('expense', '0', '', null, now), null);
    a.equal(createEntry('expense', 'x', '', null, now), null);
    a.equal(createEntry('expense', '1', 'x'.repeat(31), null, now), null, '备注过长');
    a.equal(createEntry('expense', '1', '', '2026-02-30', now), null, '非法日期');
  });

  t.test('月份工具与筛选汇总', (a) => {
    a.equal(monthKeyOf('2026-10-25'), '2026-10');
    a.equal(currentMonthKey(now), '2026-10');
    a.equal(shiftMonth('2026-01', -1), '2025-12');
    a.equal(shiftMonth('2026-12', 1), '2027-01');
    a.equal(shiftMonth('2026-10', 0), '2026-10');
    a.equal(shiftMonth('bad', 1), null);

    const entries = [
      { id: '1', type: 'expense', cents: 1000, note: '', date: '2026-10-01', createdAt: 1 },
      { id: '2', type: 'income', cents: 5000, note: '', date: '2026-10-15', createdAt: 2 },
      { id: '3', type: 'expense', cents: 250, note: '', date: '2026-09-30', createdAt: 3 }
    ];
    a.equal(entriesInMonth(entries, '2026-10').length, 2);
    a.deepEqual(
      summarize(entriesInMonth(entries, '2026-10')),
      { expenseCents: 1000, incomeCents: 5000, balanceCents: 4000 }
    );
    a.deepEqual(summarize([]), { expenseCents: 0, incomeCents: 0, balanceCents: 0 });
    a.equal(removeEntry(entries, '3').length, 2);
  });

  t.test('排序：日期倒序，同日按创建时间倒序', (a) => {
    const entries = [
      { id: 'a', type: 'expense', cents: 1, note: '', date: '2026-10-25', createdAt: 1 },
      { id: 'b', type: 'expense', cents: 1, note: '', date: '2026-10-26', createdAt: 1 },
      { id: 'c', type: 'expense', cents: 1, note: '', date: '2026-10-25', createdAt: 9 }
    ];
    a.deepEqual(sortEntries(entries).map((e) => e.id), ['b', 'c', 'a']);
  });

  t.test('存储读写与损坏兜底', (a) => {
    const store = fakeStorage();
    const entries = [{ id: 'a', type: 'expense', cents: 500, note: 'x', date: '2026-10-26', createdAt: 1 }];
    saveEntries(store, entries);
    a.deepEqual(loadEntries(store), entries);
    store._data['expense.entries.v1'] = 'oops';
    a.deepEqual(loadEntries(store), []);
    store._data['expense.entries.v1'] = JSON.stringify([
      entries[0],
      { id: 'b', type: 'other', cents: 100, note: '', date: '2026-10-26', createdAt: 2 },
      { id: 'c', type: 'expense', cents: 12.5, note: '', date: '2026-10-26', createdAt: 3 }
    ]);
    a.equal(loadEntries(store).length, 1, '类型与金额不合法的记录被过滤');
  });
};
