'use strict';

const {
  NAME_MAX_LEN, GRID_DAYS, createHabit, hasDay, toggleDay,
  streakOf, lastNDayKeys, loadHabits, saveHabits
} = require('../apps/habit/habit.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  const now = new Date(2026, 9, 26, 20, 0).getTime();

  t.test('createHabit 校验与裁剪', (a) => {
    const h = createHabit('  每天阅读 ', 'h1');
    a.equal(h.id, 'h1');
    a.equal(h.name, '每天阅读');
    a.deepEqual(h.days, []);
    a.equal(typeof h.createdAt, 'number');
    a.equal(typeof createHabit('自动').id, 'string');
    a.equal(createHabit(''), null);
    a.equal(createHabit('   '), null);
    a.equal(createHabit('x'.repeat(NAME_MAX_LEN + 1)), null);
    a.ok(createHabit('x'.repeat(NAME_MAX_LEN)));
  });

  t.test('toggleDay / hasDay 添加、移除并保持升序', (a) => {
    a.deepEqual(toggleDay([], '2026-10-26'), ['2026-10-26']);
    a.deepEqual(toggleDay(['2026-10-26'], '2026-10-26'), []);
    a.deepEqual(toggleDay(['2026-10-26'], '2026-10-25'), ['2026-10-25', '2026-10-26']);
    a.equal(hasDay(['2026-10-26'], '2026-10-26'), true);
    a.equal(hasDay(['2026-10-26'], '2026-10-25'), false);
  });

  t.test('streakOf 连续天数（今天未打卡不断签）', (a) => {
    a.equal(streakOf(['2026-10-24', '2026-10-25', '2026-10-26'], now), 3);
    a.equal(streakOf(['2026-10-24', '2026-10-25'], now), 2, '今天没打则从昨天数');
    a.equal(streakOf(['2026-10-26', '2026-10-24'], now), 1, '断一天只算今天');
    a.equal(streakOf(['2026-10-25'], now), 1);
    a.equal(streakOf(['2026-10-20'], now), 0, '太久之前的不算');
    a.equal(streakOf([], now), 0);
  });

  t.test('lastNDayKeys 最近 N 天由旧到新（含跨月）', (a) => {
    a.deepEqual(lastNDayKeys(3, now), ['2026-10-24', '2026-10-25', '2026-10-26']);
    a.deepEqual(lastNDayKeys(1, now), ['2026-10-26']);
    a.equal(lastNDayKeys(GRID_DAYS, now).length, GRID_DAYS);
    a.equal(lastNDayKeys(GRID_DAYS, now)[GRID_DAYS - 1], '2026-10-26');
    const nov = new Date(2026, 10, 2, 9, 0).getTime();
    a.deepEqual(lastNDayKeys(4, nov), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  t.test('存储读写：去重排序与损坏兜底', (a) => {
    const store = fakeStorage();
    const habits = [{ id: 'a', name: 'A', createdAt: 1, days: ['2026-10-25', '2026-10-26'] }];
    saveHabits(store, habits);
    a.deepEqual(loadHabits(store), habits);

    store._data['habit.habits.v1'] = 'x';
    a.deepEqual(loadHabits(store), []);

    store._data['habit.habits.v1'] = JSON.stringify([
      { id: 'a', name: 'A', createdAt: 1, days: ['2026-10-26', 'bad'] },
      { id: 'b', name: ' ', createdAt: 2, days: [] }
    ]);
    a.deepEqual(loadHabits(store), [], '非法数据应被整体过滤');

    store._data['habit.habits.v1'] = JSON.stringify([
      { id: 'a', name: 'A', createdAt: 1, days: ['2026-10-26', '2026-10-25', '2026-10-26'] }
    ]);
    a.deepEqual(loadHabits(store)[0].days, ['2026-10-25', '2026-10-26'], '天去重并排序');
  });
};
