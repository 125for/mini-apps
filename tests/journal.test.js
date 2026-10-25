'use strict';

const {
  ENTRY_MAX_LEN, createEntry, removeEntry, sortNewestFirst, searchEntries,
  formatDayLabel, formatTimeOfDay, groupByDay, loadEntries, saveEntries
} = require('../apps/journal/journal.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  const now = new Date(2026, 9, 26, 12, 0).getTime();

  t.test('createEntry 校验、裁剪与自定义 id', (a) => {
    const entry = createEntry('  今天写了点东西 ', now, 'id1');
    a.deepEqual(entry, { id: 'id1', text: '今天写了点东西', createdAt: now });
    a.equal(createEntry('', now), null);
    a.equal(createEntry('   ', now), null);
    a.equal(createEntry('x'.repeat(ENTRY_MAX_LEN + 1), now), null);
    a.ok(createEntry('x'.repeat(ENTRY_MAX_LEN), now));
    a.equal(typeof createEntry('自动 id', now).id, 'string');
  });

  t.test('removeEntry 与倒序排序', (a) => {
    const entries = [
      { id: '1', text: '一', createdAt: now },
      { id: '2', text: '二', createdAt: now - 3600e3 },
      { id: '3', text: '三', createdAt: now + 60e3 }
    ];
    a.equal(removeEntry(entries, '2').length, 2);
    a.deepEqual(sortNewestFirst(entries).map((e) => e.id), ['3', '1', '2']);
    a.equal(entries[0].id, '1', '原数组不应被修改');
  });

  t.test('searchEntries 忽略大小写与首尾空白', (a) => {
    const entries = [
      { id: '1', text: 'Hello World', createdAt: 1 },
      { id: '2', text: '今天买了牛奶', createdAt: 2 }
    ];
    a.equal(searchEntries(entries, '  HELLO ').length, 1);
    a.equal(searchEntries(entries, '牛奶').length, 1);
    a.equal(searchEntries(entries, '').length, 2);
    a.equal(searchEntries(entries, '   ').length, 2);
    a.equal(searchEntries(entries, '不存在').length, 0);
  });

  t.test('formatDayLabel 今天 / 昨天 / 具体日期', (a) => {
    a.equal(formatDayLabel(now, now), '今天');
    a.equal(formatDayLabel(new Date(2026, 9, 25, 23, 59).getTime(), now), '昨天');
    a.equal(formatDayLabel(new Date(2026, 9, 20, 8, 0).getTime(), now), '2026 年 10 月 20 日 周二');
    a.equal(formatDayLabel(new Date(2026, 9, 27, 0, 0).getTime(), now), '2026 年 10 月 27 日 周二');
  });

  t.test('formatTimeOfDay 输出 HH:mm', (a) => {
    a.equal(formatTimeOfDay(new Date(2026, 9, 26, 9, 5).getTime()), '09:05');
    a.equal(formatTimeOfDay(new Date(2026, 9, 26, 23, 0).getTime()), '23:00');
  });

  t.test('groupByDay 按天倒序分组，组内倒序', (a) => {
    const entries = [
      { id: 'a', text: '早', createdAt: new Date(2026, 9, 26, 8, 0).getTime() },
      { id: 'b', text: '昨', createdAt: new Date(2026, 9, 25, 20, 0).getTime() },
      { id: 'c', text: '晚', createdAt: new Date(2026, 9, 26, 22, 0).getTime() }
    ];
    const groups = groupByDay(entries, now);
    a.equal(groups.length, 2);
    a.equal(groups[0].label, '今天');
    a.deepEqual(groups[0].entries.map((e) => e.id), ['c', 'a']);
    a.equal(groups[1].label, '昨天');
    a.equal(groups[1].entries[0].id, 'b');
    a.deepEqual(groupByDay([], now), []);
  });

  t.test('存储读写与损坏数据兜底', (a) => {
    const store = fakeStorage();
    const entries = [{ id: '1', text: '一', createdAt: now }];
    saveEntries(store, entries);
    a.deepEqual(loadEntries(store), entries);

    store._data['journal.entries.v1'] = ']]broken';
    a.deepEqual(loadEntries(store), []);

    store._data['journal.entries.v1'] = JSON.stringify([entries[0], 'garbage', { id: '2', text: ' ', createdAt: 1 }]);
    const loaded = loadEntries(store);
    a.equal(loaded.length, 1);
    a.equal(loaded[0].id, '1');
  });
};
