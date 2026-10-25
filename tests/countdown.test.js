'use strict';

const {
  parseDate, daysUntil, nextOccurrence, describeDays, createEvent,
  removeEvent, sortEvents, loadEvents, saveEvents
} = require('../apps/countdown/countdown.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  const now = new Date(2026, 9, 26, 15, 30).getTime();

  t.test('parseDate 只接受真实存在的 YYYY-MM-DD', (a) => {
    a.equal(parseDate('2026-10-26').getDate(), 26);
    a.equal(parseDate('2026-02-29'), null, '2026 非闰年');
    a.equal(parseDate('2024-02-29').getMonth(), 1, '2024 闰年 2 月 29 日有效');
    a.equal(parseDate('2026-02-30'), null);
    a.equal(parseDate('2026-13-01'), null);
    a.equal(parseDate('2026-1-1'), null, '月日必须两位');
    a.equal(parseDate('2026/10/26'), null);
    a.equal(parseDate(''), null);
  });

  t.test('daysUntil 计算自然日差', (a) => {
    a.equal(daysUntil('2026-10-26', now), 0);
    a.equal(daysUntil('2026-10-27', now), 1);
    a.equal(daysUntil('2026-10-25', now), -1);
    a.equal(daysUntil('2027-10-26', now), 365);
    a.equal(daysUntil('bad', now), null);
  });

  t.test('nextOccurrence 每年重复的下一次出现', (a) => {
    a.equal(nextOccurrence('2026-10-26', now), '2026-10-26', '今天即下一次');
    a.equal(nextOccurrence('2026-12-31', now), '2026-12-31', '今年未过');
    a.equal(nextOccurrence('1990-06-15', now), '2027-06-15', '今年已过取明年');
    a.equal(nextOccurrence('oops', now), null);
  });

  t.test('describeDays 文案', (a) => {
    a.deepEqual(describeDays(0), { prefix: '', text: '就是今天' });
    a.deepEqual(describeDays(5), { prefix: '还有', text: '5 天' });
    a.deepEqual(describeDays(-3), { prefix: '已过', text: '3 天' });
  });

  t.test('createEvent 校验与裁剪', (a) => {
    a.deepEqual(
      createEvent('  生日 ', '1990-06-15', true, 'id9'),
      { id: 'id9', title: '生日', date: '1990-06-15', repeatAnnually: true }
    );
    a.equal(typeof createEvent('测试', '2026-10-26').id, 'string');
    a.equal(createEvent('', '2026-10-26'), null);
    a.equal(createEvent(null, '2026-10-26'), null);
    a.equal(createEvent('   ', '2026-10-26'), null);
    a.equal(createEvent('x'.repeat(51), '2026-10-26'), null, '标题过长');
    a.equal(createEvent('标题', '2026-02-30'), null, '非法日期');
  });

  t.test('sortEvents 未来由近到远，过期靠后', (a) => {
    const events = [
      { id: '1', title: '远', date: '2027-01-01', repeatAnnually: false },
      { id: '2', title: '近', date: '2026-10-28', repeatAnnually: false },
      { id: '3', title: '过期', date: '2026-10-20', repeatAnnually: false },
      { id: '4', title: '每年', date: '1990-10-27', repeatAnnually: true }
    ];
    a.deepEqual(sortEvents(events, now).map((e) => e.id), ['4', '2', '1', '3']);
    a.equal(removeEvent(events, '3').length, 3);
  });

  t.test('存储读写与损坏数据兜底', (a) => {
    const store = fakeStorage();
    const events = [{ id: 'a', title: 'A', date: '2026-12-25', repeatAnnually: false }];
    saveEvents(store, events);
    a.deepEqual(loadEvents(store), events);
    store._data['countdown.events.v1'] = 'xxx';
    a.deepEqual(loadEvents(store), []);
    store._data['countdown.events.v1'] = JSON.stringify([
      events[0],
      { id: 'b', title: 'B', date: '2026-02-30', repeatAnnually: false },
      'garbage'
    ]);
    a.equal(loadEvents(store).length, 1);
  });
};
