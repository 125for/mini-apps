/* 极简日志 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const ENTRY_MAX_LEN = 5000;
const STORAGE_KEY = 'journal.entries.v1';

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* 空白或超长输入返回 null，由调用方决定如何提示 */
function createEntry(text, now, id) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed || trimmed.length > ENTRY_MAX_LEN) return null;
  return {
    id: id == null ? generateId() : String(id),
    text: trimmed,
    createdAt: typeof now === 'number' ? now : Date.now()
  };
}

function removeEntry(entries, id) {
  return entries.filter((e) => e.id !== id);
}

function sortNewestFirst(entries) {
  return entries.slice().sort((a, b) => b.createdAt - a.createdAt);
}

function searchEntries(entries, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.text.toLowerCase().includes(q));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(ts, now) {
  const today = startOfDay(typeof now === 'number' ? now : Date.now());
  const diffDays = Math.round((today - startOfDay(ts)) / 86400000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  const d = new Date(ts);
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + WEEKDAY_NAMES[d.getDay()];
}

function formatTimeOfDay(ts) {
  const d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* 按天倒序分组，组内按时间倒序 */
function groupByDay(entries, now) {
  const groups = [];
  let current = null;
  for (const entry of sortNewestFirst(entries)) {
    const key = dayKey(entry.createdAt);
    if (!current || current.key !== key) {
      current = { key: key, label: formatDayLabel(entry.createdAt, now), entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }
  return groups;
}

function isValidEntry(e) {
  return Boolean(e) && typeof e === 'object'
    && typeof e.id === 'string' && e.id.length > 0
    && typeof e.text === 'string' && e.text.trim().length > 0
    && e.text.trim().length <= ENTRY_MAX_LEN
    && typeof e.createdAt === 'number';
}

function loadEntries(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEntry);
  } catch (e) {
    return [];
  }
}

function saveEntries(storage, entries) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initJournal(doc, storage) {
  const form = doc.getElementById('entryForm');
  const textarea = doc.getElementById('entryText');
  const charCounter = doc.getElementById('charCounter');
  const searchInput = doc.getElementById('searchInput');
  const container = doc.getElementById('entries');
  const empty = doc.getElementById('emptyState');

  let entries = loadEntries(storage);

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    container.textContent = '';
    const visible = searchEntries(entries, searchInput.value);
    const groups = groupByDay(visible, Date.now());
    for (const group of groups) {
      const section = el('section', 'day');
      section.appendChild(el('h2', 'day-label', group.label));
      for (const entry of group.entries) {
        const item = el('article', 'entry');
        item.appendChild(el('time', 'entry-time', formatTimeOfDay(entry.createdAt)));
        item.appendChild(el('p', 'entry-text', entry.text));
        const del = el('button', 'entry-delete', '删除');
        del.type = 'button';
        del.addEventListener('click', () => {
          entries = removeEntry(entries, entry.id);
          saveEntries(storage, entries);
          render();
        });
        item.appendChild(del);
        section.appendChild(item);
      }
      container.appendChild(section);
    }

    const q = String(searchInput.value == null ? '' : searchInput.value).trim();
    empty.textContent = q ? '没有匹配「' + q + '」的日志' : '还没有日志，写下第一条吧 ✍️';
    empty.hidden = visible.length !== 0;
  }

  function updateCounter() {
    charCounter.textContent = textarea.value.length + ' / ' + ENTRY_MAX_LEN;
  }

  function submitEntry() {
    const entry = createEntry(textarea.value);
    if (!entry) {
      textarea.value = '';
      updateCounter();
      render();
      return;
    }
    entries = entries.concat(entry);
    textarea.value = '';
    /* 清除搜索，让新日志立即可见 */
    searchInput.value = '';
    updateCounter();
    saveEntries(storage, entries);
    render();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitEntry();
  });

  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submitEntry();
    }
  });

  textarea.addEventListener('input', updateCounter);
  searchInput.addEventListener('input', render);

  updateCounter();
  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initJournal(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ENTRY_MAX_LEN, STORAGE_KEY, generateId, createEntry, removeEntry, sortNewestFirst,
    searchEntries, formatDayLabel, formatTimeOfDay, dayKey, groupByDay,
    isValidEntry, loadEntries, saveEntries, initJournal
  };
}
