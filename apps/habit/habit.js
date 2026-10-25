/* 习惯打卡 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const NAME_MAX_LEN = 30;
const STORAGE_KEY = 'habit.habits.v1';
const GRID_DAYS = 35;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function dayKeyTs(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function createHabit(name, id) {
  const t = String(name == null ? '' : name).trim();
  if (!t || t.length > NAME_MAX_LEN) return null;
  return { id: id == null ? generateId() : String(id), name: t, createdAt: Date.now(), days: [] };
}

function hasDay(days, dayKey) {
  return days.indexOf(dayKey) !== -1;
}

/* 打卡 / 取消打卡，保持升序且不重复 */
function toggleDay(days, dayKey) {
  const idx = days.indexOf(dayKey);
  if (idx !== -1) {
    const next = days.slice();
    next.splice(idx, 1);
    return next;
  }
  return days.concat([dayKey]).sort();
}

/* 连续天数：从今天往回数；今天还没打卡时从昨天数起（不算断签） */
function streakOf(days, now) {
  const set = {};
  for (const k of days) set[k] = true;
  const d = new Date(typeof now === 'number' ? now : Date.now());
  d.setHours(0, 0, 0, 0);
  if (!set[dayKeyTs(d.getTime())]) d.setDate(d.getDate() - 1);
  let count = 0;
  while (set[dayKeyTs(d.getTime())]) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/* 最近 n 天的日期键，由旧到新 */
function lastNDayKeys(n, now) {
  const d = new Date(typeof now === 'number' ? now : Date.now());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(dayKeyTs(d.getTime()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function isValidHabit(h) {
  return Boolean(h) && typeof h === 'object'
    && typeof h.id === 'string' && h.id.length > 0
    && typeof h.name === 'string' && h.name.trim().length > 0
    && h.name.trim().length <= NAME_MAX_LEN
    && typeof h.createdAt === 'number'
    && Array.isArray(h.days)
    && h.days.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
}

function loadHabits(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidHabit).map((h) => ({
      id: h.id,
      name: h.name,
      createdAt: h.createdAt,
      days: Array.from(new Set(h.days)).sort()
    }));
  } catch (e) {
    return [];
  }
}

function saveHabits(storage, habits) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(habits));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initHabit(doc, storage) {
  const form = doc.getElementById('habitForm');
  const nameInput = doc.getElementById('habitInput');
  const list = doc.getElementById('habitList');
  const empty = doc.getElementById('emptyState');

  let habits = loadHabits(storage);

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    list.textContent = '';
    empty.hidden = habits.length !== 0;
    const now = Date.now();
    const today = dayKeyTs(now);
    const gridKeys = lastNDayKeys(GRID_DAYS, now);
    for (const habit of habits) {
      const card = el('li', 'habit');

      const head = el('div', 'habit-head');
      head.appendChild(el('span', 'habit-name', habit.name));
      const streak = streakOf(habit.days, now);
      head.appendChild(el('span', 'streak', streak > 0 ? '🔥 连续 ' + streak + ' 天' : '尚未开始'));

      const doneToday = hasDay(habit.days, today);
      const checkBtn = el('button', 'check' + (doneToday ? ' done' : ''), doneToday ? '已打卡 ✓' : '打卡');
      checkBtn.type = 'button';
      checkBtn.addEventListener('click', () => {
        habit.days = toggleDay(habit.days, today);
        saveHabits(storage, habits);
        render();
      });

      const del = el('button', 'habit-delete', '删除');
      del.type = 'button';
      del.addEventListener('click', () => {
        habits = habits.filter((h) => h.id !== habit.id);
        saveHabits(storage, habits);
        render();
      });

      head.append(checkBtn, del);
      card.appendChild(head);

      const grid = el('div', 'grid');
      for (const key of gridKeys) {
        const cls = 'cell' + (hasDay(habit.days, key) ? ' on' : '') + (key === today ? ' today' : '');
        const cell = el('span', cls);
        cell.title = key;
        grid.appendChild(cell);
      }
      card.appendChild(grid);

      list.appendChild(card);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const habit = createHabit(nameInput.value);
    if (!habit) {
      nameInput.value = '';
      return;
    }
    habits = habits.concat(habit);
    nameInput.value = '';
    saveHabits(storage, habits);
    render();
  });

  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initHabit(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NAME_MAX_LEN, STORAGE_KEY, GRID_DAYS, generateId, dayKeyTs, createHabit,
    hasDay, toggleDay, streakOf, lastNDayKeys, isValidHabit, loadHabits, saveHabits, initHabit
  };
}
