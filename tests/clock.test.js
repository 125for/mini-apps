'use strict';

const { pad2, formatTime, formatDate, handAngles, loadPrefs, savePrefs } = require('../apps/clock/clock.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  t.test('pad2 为个位数补零', (a) => {
    a.equal(pad2(0), '00');
    a.equal(pad2(5), '05');
    a.equal(pad2(23), '23');
  });

  t.test('formatTime 24 小时制', (a) => {
    a.equal(formatTime(new Date(2026, 9, 26, 15, 4, 5)), '15:04:05');
    a.equal(formatTime(new Date(2026, 9, 26, 15, 4, 5), { showSeconds: false }), '15:04');
  });

  t.test('formatTime 12 小时制', (a) => {
    a.equal(formatTime(new Date(2026, 9, 26, 0, 0, 0), { use24h: false }), '12:00:00 AM');
    a.equal(formatTime(new Date(2026, 9, 26, 13, 5, 0), { use24h: false }), '01:05:00 PM');
    a.equal(formatTime(new Date(2026, 9, 26, 12, 30, 0), { use24h: false, showSeconds: false }), '12:30 PM');
  });

  t.test('formatDate 输出中文日期与星期', (a) => {
    a.equal(formatDate(new Date(2026, 9, 26)), '2026 年 10 月 26 日 周一');
    a.equal(formatDate(new Date(2026, 0, 1)), '2026 年 1 月 1 日 周四');
  });

  t.test('handAngles 指针角度', (a) => {
    a.deepEqual(handAngles(new Date(2026, 9, 26, 3, 0, 0)), { hour: 90, minute: 0, second: 0 });
    const angles = handAngles(new Date(2026, 9, 26, 6, 15, 30));
    a.ok(Math.abs(angles.hour - 187.5) < 1e-9, '时针 6:15 应为 187.5 度');
    a.ok(Math.abs(angles.minute - 93) < 1e-9, '分针 15:30 应为 93 度');
    a.equal(angles.second, 180);
    /* 毫秒平滑：半秒时秒针 3 度 */
    a.equal(handAngles(new Date(2026, 9, 26, 3, 0, 0, 500)).second, 3);
  });

  t.test('偏好设置保存与读取（含损坏数据兜底）', (a) => {
    const store = fakeStorage();
    a.deepEqual(loadPrefs(store), { use24h: true, showSeconds: true, theme: null });
    savePrefs(store, { use24h: false, showSeconds: false, theme: 'light' });
    a.deepEqual(loadPrefs(store), { use24h: false, showSeconds: false, theme: 'light' });
    store._data['clock.prefs.v1'] = '{oops';
    a.deepEqual(loadPrefs(store), { use24h: true, showSeconds: true, theme: null });
    store._data['clock.prefs.v1'] = JSON.stringify({ use24h: 'yes', theme: 'blue' });
    a.deepEqual(loadPrefs(store), { use24h: true, showSeconds: true, theme: null });
  });
};
