'use strict';

const {
  WORK_MS, BREAK_MS, createState, start, pause, remainingOf, isFinished,
  nextPhase, formatClock, bumpStats, pruneStats, loadStats, saveStats, dayKeyTs
} = require('../apps/pomodoro/pomodoro.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  t.test('初始状态为未开始的专注阶段', (a) => {
    a.deepEqual(createState(), { phase: 'work', running: false, endAt: null, remainingMs: WORK_MS });
  });

  t.test('start / pause 的时间计算（不修改原状态）', (a) => {
    const s0 = createState();
    const s1 = start(s0, 1000);
    a.equal(s1.running, true);
    a.equal(s1.endAt, 1000 + WORK_MS);
    a.equal(s0.running, false, '原状态不应被修改');
    const s2 = pause(s1, 1000 + 60000);
    a.equal(s2.running, false);
    a.equal(s2.remainingMs, WORK_MS - 60000);
    a.equal(pause(s2, 9999), s2, '已暂停时 pause 原样返回');
    a.equal(start(s1, 9999), s1, '已运行时 start 原样返回');
    a.equal(pause(start(createState(), 0), 99999999).remainingMs, 0, '超时后暂停剩余为 0');
  });

  t.test('remainingOf / isFinished', (a) => {
    const s = start(createState(), 0);
    a.equal(remainingOf(s, 0), WORK_MS);
    a.equal(remainingOf(s, 10000), WORK_MS - 10000);
    a.equal(remainingOf(s, WORK_MS + 5000), 0, '超时后剩余为 0');
    a.equal(remainingOf(createState(), 12345), WORK_MS, '未开始时返回剩余时长');
    a.equal(isFinished(s, WORK_MS), true);
    a.equal(isFinished(s, WORK_MS - 1), false);
    a.equal(isFinished(pause(s, 100), 0), false, '暂停态永不结束');
  });

  t.test('nextPhase 切换阶段并重置时长', (a) => {
    const brk = nextPhase(createState());
    a.deepEqual(brk, { phase: 'break', running: false, endAt: null, remainingMs: BREAK_MS });
    a.deepEqual(nextPhase(brk), { phase: 'work', running: false, endAt: null, remainingMs: WORK_MS });
  });

  t.test('formatClock 向上取整到秒', (a) => {
    a.equal(formatClock(0), '00:00');
    a.equal(formatClock(1499), '00:02');
    a.equal(formatClock(1500), '00:02');
    a.equal(formatClock(61000), '01:01');
    a.equal(formatClock(WORK_MS), '25:00');
    a.equal(formatClock(BREAK_MS), '05:00');
  });

  t.test('统计：日键、计数、裁剪与损坏数据兜底', (a) => {
    const day = dayKeyTs(new Date(2026, 9, 26, 23, 59).getTime());
    a.equal(day, '2026-10-26');
    let stats = {};
    stats = bumpStats(stats, day);
    stats = bumpStats(stats, day);
    a.deepEqual(stats, { '2026-10-26': 2 });

    const many = {};
    for (let i = 1; i <= 35; i++) many['2026-09-' + String(i).padStart(2, '0')] = i;
    const pruned = pruneStats(many, '2026-10-26', 30);
    a.equal(Object.keys(pruned).length, 30);
    a.equal(pruned['2026-09-06'], 6, '保留最近 30 天');
    a.equal(pruned['2026-09-05'], undefined, '更早的被裁掉');

    const store = fakeStorage();
    saveStats(store, stats);
    a.deepEqual(loadStats(store), stats);
    store._data['pomodoro.stats.v1'] = 'nope';
    a.deepEqual(loadStats(store), {});
    store._data['pomodoro.stats.v1'] = JSON.stringify({ '2026-10-26': 3, 'bad-day': 1, '2026-10-25': 'x' });
    a.deepEqual(loadStats(store), { '2026-10-26': 3 });
  });
};
