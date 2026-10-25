'use strict';

const {
  parseTsInput, formatDateTime, weekdayOf, relativeLabel, tsFromDateTime, nowDateTimeValue
} = require('../apps/timestamp/timestamp.js');

module.exports = (t) => {
  t.test('parseTsInput 秒 / 毫秒识别', (a) => {
    a.deepEqual(parseTsInput('1774000000'), { isMs: false, ts: 1774000000 });
    a.deepEqual(parseTsInput(' 1774000000000 '), { isMs: true, ts: 1774000000 });
    a.deepEqual(parseTsInput('999999999999'), { isMs: false, ts: 999999999999 }, '12 位按秒');
    a.equal(parseTsInput('abc'), null);
    a.equal(parseTsInput('12.5'), null);
    a.equal(parseTsInput('-100'), null);
    a.equal(parseTsInput(''), null);
    a.equal(parseTsInput(null), null);
  });

  t.test('formatDateTime / weekdayOf（本地时区往返）', (a) => {
    const ts = tsFromDateTime('2026-10-26T09:05:00');
    a.equal(formatDateTime(ts), '2026-10-26 09:05:00');
    a.equal(weekdayOf(ts), '周一');
    const midnight = tsFromDateTime('2026-01-01T00:00:00');
    a.equal(weekdayOf(midnight), '周四');
  });

  t.test('relativeLabel 相对时间文案', (a) => {
    const now = 1000000;
    a.equal(relativeLabel(now, now), '刚刚');
    a.equal(relativeLabel(now - 30, now), '30 秒前');
    a.equal(relativeLabel(now + 90, now), '1 分钟后');
    a.equal(relativeLabel(now - 7200, now), '2 小时前');
    a.equal(relativeLabel(now + 3 * 86400, now), '3 天后');
  });

  t.test('tsFromDateTime 严格校验', (a) => {
    a.equal(typeof tsFromDateTime('2026-10-26T23:59:59'), 'number');
    a.equal(tsFromDateTime('2026-02-30T00:00'), null, '2 月 30 日不存在');
    a.equal(tsFromDateTime('2026-10-26T24:00'), null, '小时越界');
    a.equal(tsFromDateTime('2026-10-26T12:60'), null, '分钟越界');
    a.equal(tsFromDateTime('bad'), null);
    a.equal(tsFromDateTime(''), null);
    a.equal(tsFromDateTime('2026-10-26T08:30'), tsFromDateTime('2026-10-26T08:30:00'), '秒可省略');
  });

  t.test('nowDateTimeValue 可往返', (a) => {
    const now = new Date(2026, 9, 26, 15, 4, 5).getTime();
    const v = nowDateTimeValue(now);
    a.equal(v, '2026-10-26T15:04:05');
    a.equal(tsFromDateTime(v), Math.floor(now / 1000));
  });
};
