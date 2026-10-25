/* 待办清单 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const TASK_MAX_LEN = 500;
const STORAGE_KEY = 'todo.tasks.v1';

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* 空白或超长输入返回 null，由调用方决定如何提示 */
function createTask(text, id) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed || trimmed.length > TASK_MAX_LEN) return null;
  return {
    id: id == null ? generateId() : String(id),
    text: trimmed,
    done: false,
    createdAt: Date.now()
  };
}

function toggleTask(tasks, id) {
  return tasks.map((t) => (t.id === id ? { id: t.id, text: t.text, done: !t.done, createdAt: t.createdAt } : t));
}

function removeTask(tasks, id) {
  return tasks.filter((t) => t.id !== id);
}

function filterTasks(tasks, filter) {
  if (filter === 'active') return tasks.filter((t) => !t.done);
  if (filter === 'done') return tasks.filter((t) => t.done);
  return tasks;
}

function remainingCount(tasks) {
  return tasks.reduce((n, t) => n + (t.done ? 0 : 1), 0);
}

function isValidTask(t) {
  return Boolean(t) && typeof t === 'object'
    && typeof t.id === 'string' && t.id.length > 0
    && typeof t.text === 'string' && t.text.trim().length > 0
    && t.text.trim().length <= TASK_MAX_LEN
    && typeof t.done === 'boolean'
    && typeof t.createdAt === 'number';
}

function loadTasks(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidTask);
  } catch (e) {
    return [];
  }
}

function saveTasks(storage, tasks) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initTodo(doc, storage) {
  const form = doc.getElementById('todoForm');
  const input = doc.getElementById('todoInput');
  const list = doc.getElementById('todoList');
  const empty = doc.getElementById('emptyState');
  const counter = doc.getElementById('counter');
  const clearDone = doc.getElementById('clearDone');
  const filterButtons = {
    all: doc.getElementById('filterAll'),
    active: doc.getElementById('filterActive'),
    done: doc.getElementById('filterDone')
  };

  let tasks = loadTasks(storage);
  let filter = 'all';

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    list.textContent = '';
    const visible = filterTasks(tasks, filter);
    for (const task of visible) {
      const li = el('li', 'task' + (task.done ? ' done' : ''));

      const check = doc.createElement('input');
      check.type = 'checkbox';
      check.checked = task.done;
      check.addEventListener('change', () => {
        tasks = toggleTask(tasks, task.id);
        saveTasks(storage, tasks);
        render();
      });

      const label = el('span', 'task-text', task.text);

      const del = el('button', 'task-delete', '删除');
      del.type = 'button';
      del.title = '删除这条待办';
      del.addEventListener('click', () => {
        tasks = removeTask(tasks, task.id);
        saveTasks(storage, tasks);
        render();
      });

      li.append(check, label, del);
      list.appendChild(li);
    }

    empty.hidden = visible.length !== 0;
    const remaining = remainingCount(tasks);
    counter.textContent = tasks.length === 0
      ? '暂无待办'
      : remaining === 0 ? '全部完成 🎉' : '还剩 ' + remaining + ' 件未完成';
    clearDone.hidden = !tasks.some((t) => t.done);
    for (const key of Object.keys(filterButtons)) {
      filterButtons[key].classList.toggle('active', key === filter);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const task = createTask(input.value);
    if (!task) {
      input.value = '';
      return;
    }
    tasks = tasks.concat(task);
    input.value = '';
    /* 正在查看"已完成"时新任务不可见，切回全部 */
    if (filter === 'done') filter = 'all';
    saveTasks(storage, tasks);
    render();
  });

  for (const key of Object.keys(filterButtons)) {
    filterButtons[key].addEventListener('click', () => {
      filter = key;
      render();
    });
  }

  clearDone.addEventListener('click', () => {
    tasks = tasks.filter((t) => !t.done);
    saveTasks(storage, tasks);
    render();
  });

  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initTodo(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TASK_MAX_LEN, STORAGE_KEY, generateId, createTask, toggleTask, removeTask,
    filterTasks, remainingCount, isValidTask, loadTasks, saveTasks, initTodo
  };
}
