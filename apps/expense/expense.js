/* 记账本 —— 金额以“分”为整数存储，避免浮点误差；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const NOTE_MAX_LEN = 30;
const MAX_CENTS = 999999999; /* 999 万元 */
const STORAGE_KEY = 'expense.entries.v1';

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

/* 仅接受真实存在的 YYYY-MM-DD */
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

/* 解析金额字符串为分（整数），非法返回 null */
function parseAmount(input) {
  const s = String(input == null ? '' : input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const yuan = Math.floor(abs / 100);
  const fen = String(abs % 100).padStart(2, '0');
  return sign + '¥' + yuan.toLocaleString('en-US') + '.' + fen;
}

function createEntry(type, amountInput, note, dateStr, now, id) {
  if (type !== 'expense' && type !== 'income') return null;
  const cents = parseAmount(amountInput);
  if (cents === null) return null;
  const n = String(note == null ? '' : note).trim();
  if (n.length > NOTE_MAX_LEN) return null;
  let date;
  if (dateStr == null || String(dateStr).trim() === '') {
    date = dayKeyTs(typeof now === 'number' ? now : Date.now());
  } else {
    if (!parseDate(String(dateStr))) return null;
    date = String(dateStr);
  }
  return {
    id: id == null ? generateId() : String(id),
    type: type,
    cents: cents,
    note: n,
    date: date,
    createdAt: typeof now === 'number' ? now : Date.now()
  };
}

function removeEntry(entries, id) {
  return entries.filter((e) => e.id !== id);
}

function monthKeyOf(dateStr) {
  return String(dateStr || '').slice(0, 7);
}

function currentMonthKey(now) {
  const d = new Date(typeof now === 'number' ? now : Date.now());
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

/* 月份加减，自动处理跨年 */
function shiftMonth(monthKey, delta) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

function entriesInMonth(entries, monthKey) {
  return entries.filter((e) => monthKeyOf(e.date) === monthKey);
}

/* 同月内按日期倒序，同日再按创建时间倒序 */
function sortEntries(entries) {
  return entries.slice().sort((a, b) => {
    if (a.date === b.date) return b.createdAt - a.createdAt;
    return a.date < b.date ? 1 : -1;
  });
}

function summarize(entries) {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (e.type === 'expense') expense += e.cents;
    else income += e.cents;
  }
  return { expenseCents: expense, incomeCents: income, balanceCents: income - expense };
}

function isValidEntry(e) {
  return Boolean(e) && typeof e === 'object'
    && (e.type === 'expense' || e.type === 'income')
    && typeof e.cents === 'number' && Number.isInteger(e.cents) && e.cents > 0 && e.cents <= MAX_CENTS
    && typeof e.note === 'string' && e.note.trim().length <= NOTE_MAX_LEN
    && typeof e.date === 'string' && parseDate(e.date) !== null
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

function initExpense(doc, storage) {
  const form = doc.getElementById('entryForm');
  const typeExpense = doc.getElementById('typeExpense');
  const typeIncome = doc.getElementById('typeIncome');
  const amountInput = doc.getElementById('amountInput');
  const noteInput = doc.getElementById('noteInput');
  const dateInput = doc.getElementById('dateInput');
  const list = doc.getElementById('entryList');
  const empty = doc.getElementById('emptyState');
  const monthLabel = doc.getElementById('monthLabel');
  const prevMonth = doc.getElementById('prevMonth');
  const nextMonth = doc.getElementById('nextMonth');
  const sumExpense = doc.getElementById('sumExpense');
  const sumIncome = doc.getElementById('sumIncome');
  const sumBalance = doc.getElementById('sumBalance');

  let entries = loadEntries(storage);
  let month = currentMonthKey(Date.now());
  let type = 'expense';

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render() {
    monthLabel.textContent = month.replace('-', ' 年 ') + ' 月';
    const inMonth = entriesInMonth(entries, month);
    const sums = summarize(inMonth);
    sumExpense.textContent = formatMoney(sums.expenseCents);
    sumIncome.textContent = formatMoney(sums.incomeCents);
    sumBalance.textContent = formatMoney(sums.balanceCents);

    list.textContent = '';
    empty.hidden = inMonth.length !== 0;
    for (const e of sortEntries(inMonth)) {
      const li = el('li', 'entry ' + e.type);
      const left = el('div', 'entry-left');
      left.appendChild(el('span', 'badge', e.type === 'expense' ? '支' : '收'));
      const info = el('div', 'info');
      info.appendChild(el('p', 'note', e.note || '（无备注）'));
      info.appendChild(el('p', 'date', e.date));
      left.appendChild(info);

      const amount = el('span', 'amount', (e.type === 'expense' ? '-' : '+') + formatMoney(e.cents));

      const del = el('button', 'delete', '删除');
      del.type = 'button';
      del.addEventListener('click', () => {
        entries = removeEntry(entries, e.id);
        saveEntries(storage, entries);
        render();
      });

      li.append(left, amount, del);
      list.appendChild(li);
    }
  }

  function setType(next) {
    type = next;
    typeExpense.classList.toggle('active', next === 'expense');
    typeIncome.classList.toggle('active', next === 'income');
  }

  typeExpense.addEventListener('click', () => setType('expense'));
  typeIncome.addEventListener('click', () => setType('income'));

  prevMonth.addEventListener('click', () => {
    month = shiftMonth(month, -1) || month;
    render();
  });
  nextMonth.addEventListener('click', () => {
    month = shiftMonth(month, 1) || month;
    render();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const entry = createEntry(type, amountInput.value, noteInput.value, dateInput.value, Date.now());
    if (!entry) {
      amountInput.value = '';
      return;
    }
    entries = entries.concat(entry);
    amountInput.value = '';
    noteInput.value = '';
    saveEntries(storage, entries);
    render();
  });

  dateInput.value = dayKeyTs(Date.now());
  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initExpense(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NOTE_MAX_LEN, MAX_CENTS, STORAGE_KEY, generateId, dayKeyTs, parseDate,
    parseAmount, formatMoney, createEntry, removeEntry, monthKeyOf, currentMonthKey,
    shiftMonth, entriesInMonth, sortEntries, summarize, isValidEntry,
    loadEntries, saveEntries, initExpense
  };
}
