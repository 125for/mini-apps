'use strict';

const {
  TASK_MAX_LEN, createTask, toggleTask, removeTask,
  filterTasks, remainingCount, loadTasks, saveTasks
} = require('../apps/todo/todo.js');
const { fakeStorage } = require('./helpers');

module.exports = (t) => {
  t.test('createTask 去除首尾空白并生成 id', (a) => {
    const task = createTask('  买牛奶  ');
    a.equal(task.text, '买牛奶');
    a.equal(task.done, false);
    a.equal(typeof task.id, 'string');
    a.ok(task.id.length > 0);
    a.equal(typeof task.createdAt, 'number');
    a.equal(createTask('自定义', 'id-1').id, 'id-1');
  });

  t.test('createTask 拒绝空白与超长输入', (a) => {
    a.equal(createTask(''), null);
    a.equal(createTask('   \t '), null);
    a.equal(createTask(null), null);
    a.equal(createTask('x'.repeat(TASK_MAX_LEN + 1)), null);
    a.ok(createTask('x'.repeat(TASK_MAX_LEN)));
  });

  t.test('toggleTask 只翻转目标任务且不改动原数组', (a) => {
    const original = [
      { id: 'a', text: 'A', done: false, createdAt: 1 },
      { id: 'b', text: 'B', done: true, createdAt: 2 }
    ];
    const next = toggleTask(original, 'a');
    a.equal(next[0].done, true);
    a.equal(next[1].done, true);
    a.equal(original[0].done, false, '原数组不应被修改');
    a.notEqual(next[0], original[0], '应返回新对象');
  });

  t.test('removeTask / filterTasks / remainingCount', (a) => {
    const tasks = [
      { id: 'a', text: 'A', done: false, createdAt: 1 },
      { id: 'b', text: 'B', done: true, createdAt: 2 },
      { id: 'c', text: 'C', done: false, createdAt: 3 }
    ];
    a.equal(removeTask(tasks, 'b').length, 2);
    a.equal(filterTasks(tasks, 'all').length, 3);
    a.equal(filterTasks(tasks, 'active').length, 2);
    a.equal(filterTasks(tasks, 'done').length, 1);
    a.equal(filterTasks(tasks, 'unknown-filter').length, 3);
    a.equal(remainingCount(tasks), 2);
    a.equal(remainingCount([]), 0);
  });

  t.test('localStorage 读写与损坏数据兜底', (a) => {
    const store = fakeStorage();
    const tasks = [{ id: 'a', text: 'A', done: false, createdAt: 1 }];
    saveTasks(store, tasks);
    a.deepEqual(loadTasks(store), tasks);

    store._data['todo.tasks.v1'] = 'not json';
    a.deepEqual(loadTasks(store), []);

    store._data['todo.tasks.v1'] = JSON.stringify('i am not an array');
    a.deepEqual(loadTasks(store), []);

    store._data['todo.tasks.v1'] = JSON.stringify([
      { id: 'a', text: 'A', done: false, createdAt: 1 },
      'garbage',
      { id: '', text: 'x', done: false, createdAt: 2 },
      { id: 'b', text: 'B', done: 'maybe', createdAt: 3 }
    ]);
    const loaded = loadTasks(store);
    a.equal(loaded.length, 1);
    a.equal(loaded[0].id, 'a');
  });
};
