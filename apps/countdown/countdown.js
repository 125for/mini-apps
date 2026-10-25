/* 倒数日 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const TITLE_MAX_LEN = 50;
const STORAGE_KEY = 'countdown.events.v1';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* 仅接受 YYYY-MM-DD 且为真实存在的日期（拒绝 2026-02-30 之类） */
function parseDate(input) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input == null ? '' : input));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* 正数=未来还有 N 天，0=今天，负数=已过 N 天 */
function daysUntil(dateStr, today) {
  const target = parseDate(dateStr);
  if (!target) return null;
  const base = startOfDay(typeof today === 'number' ? today : Date.now());
  return Math.round((startOfDay(target.getTime()) - base) / 86400000);
}

/* 每年重复：返回从今天看下一次出现的日期字符串 */
function nextOccurrence(dateStr, today) {
  const target = parseDate(dateStr);
  if (!target) return null;
  const now = new Date(typeof today === 'number' ? today : Date.now());
  let candidate = new Date(now.getFullYear(), target.getMonth(), target.getDate());
  if (startOfDay(candidate.getTime()) < startOfDay(now.getTime())) {
    candidate = new Date(now.getFullYear() + 1, target.getMonth(), target.getDate());
  }
  return candidate.getFullYear() + '-' + pad2(candidate.getMonth() + 1) + '-' + pad2(candidate.getDate());
}

function describeDays(days) {
  if (days === 0) return { prefix: '', text: '就是今天' };
  if (days > 0) return { prefix: '还有', text: days + ' 天' };
  return { prefix: '已过', text: -days + ' 天' };
}

function createEvent(title, date, repeatAnnually, id) {
  const t = String(title == null ? '' : title).trim();
  if (!t || t.length > TITLE_MAX_LEN) return null;
  if (!parseDate(date)) return null;
  return {
    id: id == null ? generateId() : String(id),
    title: t,
    date: String(date),
    repeatAnnually: Boolean(repeatAnnually)
  };
}

function removeEvent(events, id) {
  return events.filter((e) => e.id !== id);
}

/* 未来的由近到远；已过期且不重复的排在最后、越近过期越靠前 */
function sortEvents(events, today) {
  function keyOf(e) {
    const effective = e.repeatAnnually ? nextOccurrence(e.date, today) : e.date;
    const d = daysUntil(effective, today);
    if (d === null) return Number.MAX_SAFE_INTEGER;
    return d < 0 ? 1000000000 - d : d;
  }
  return events.slice().sort((a, b) => keyOf(a) - keyOf(b));
}

function isValidEvent(e) {
  return Boolean(e) && typeof e === 'object'
    && typeof e.id === 'string' && e.id.length > 0
    && typeof e.title === 'string' && e.title.trim().length > 0
    && e.title.trim().length <= TITLE_MAX_LEN
    && typeof e.date === 'string'
    && parseDate(e.date) !== null
    && typeof e.repeatAnnually === 'boolean';
}

function loadEvents(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEvent);
  } catch (e) {
    return [];
  }
}

function saveEvents(storage, events) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initCountdown(doc, storage) {
  const form = doc.getElementById('eventForm');
  const titleInput = doc.getElementById('titleInput');
  const dateInput = doc.getElementById('dateInput');
  const repeatInput = doc.getElementById('repeatInput');
  const list = doc.getElementById('eventList');
  const empty = doc.getElementById('emptyState');

  let events = loadEvents(storage);

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    list.textContent = '';
    const now = Date.now();
    const sorted = sortEvents(events, now);
    empty.hidden = sorted.length !== 0;
    for (const ev of sorted) {
      const effectiveDate = ev.repeatAnnually ? nextOccurrence(ev.date, now) : ev.date;
      const days = daysUntil(effectiveDate, now);
      const info = describeDays(days);
      const li = el('li', 'event' + (days === 0 ? ' today' : days < 0 ? ' past' : ''));

      const when = el('div', 'when');
      if (days === 0) {
        when.appendChild(el('span', 'num-today', '就是今天'));
      } else {
        when.appendChild(el('span', 'num', String(Math.abs(days))));
        when.appendChild(el('span', 'unit', '天'));
      }

      const infoBox = el('div', 'info');
      infoBox.appendChild(el('p', 'title', ev.title + (ev.repeatAnnually ? ' · 每年' : '')));
      infoBox.appendChild(el('p', 'date', (info.prefix ? info.prefix + ' ' : '') + info.text + ' · ' + effectiveDate));

      const del = el('button', 'delete', '删除');
      del.type = 'button';
      del.addEventListener('click', () => {
        events = removeEvent(events, ev.id);
        saveEvents(storage, events);
        render();
      });

      li.append(when, infoBox, del);
      list.appendChild(li);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ev = createEvent(titleInput.value, dateInput.value, repeatInput.checked);
    if (!ev) {
      titleInput.value = '';
      return;
    }
    events = events.concat(ev);
    titleInput.value = '';
    dateInput.value = '';
    repeatInput.checked = false;
    saveEvents(storage, events);
    render();
  });

  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initCountdown(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TITLE_MAX_LEN, STORAGE_KEY, generateId, parseDate, startOfDay, daysUntil,
    nextOccurrence, describeDays, createEvent, removeEvent, sortEvents,
    isValidEvent, loadEvents, saveEvents, initCountdown
  };
}
