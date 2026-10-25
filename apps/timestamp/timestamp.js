/* 时间戳转换 —— Unix 时间戳与日期互转；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/* 解析输入：13 位及以上视为毫秒，其余视为秒 */
function parseTsInput(input) {
  const s = String(input == null ? '' : input).trim();
  if (!/^\d{1,16}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  return { isMs: n >= 1e12, ts: n >= 1e12 ? Math.floor(n / 1000) : n };
}

function formatDateTime(tsSec) {
  const d = new Date(tsSec * 1000);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

function weekdayOf(tsSec) {
  return WEEKDAY_NAMES[new Date(tsSec * 1000).getDay()];
}

function relativeLabel(tsSec, now) {
  const base = typeof now === 'number' ? now : Math.floor(Date.now() / 1000);
  const diff = tsSec - base;
  const abs = Math.abs(diff);
  const suffix = diff < 0 ? '前' : '后';
  if (abs < 10) return '刚刚';
  if (abs < 60) return Math.floor(abs) + ' 秒' + suffix;
  if (abs < 3600) return Math.floor(abs / 60) + ' 分钟' + suffix;
  if (abs < 86400) return Math.floor(abs / 3600) + ' 小时' + suffix;
  return Math.floor(abs / 86400) + ' 天' + suffix;
}

/* datetime-local 的值（YYYY-MM-DDTHH:mm[:ss]）→ 秒级时间戳，非法返回 null */
function tsFromDateTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value == null ? '' : value).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const ss = m[6] ? Number(m[6]) : 0;
  if (hh > 23 || mi > 59 || ss > 59) return null;
  const dt = new Date(y, mo - 1, d, hh, mi, ss);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return Math.floor(dt.getTime() / 1000);
}

/* 当前本地时间对应的 datetime-local 值 */
function nowDateTimeValue(now) {
  const d = new Date(typeof now === 'number' ? now : Date.now());
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

/* ---------- 界面 ---------- */

function initTimestamp(doc) {
  const nowText = doc.getElementById('nowText');
  const nowTs = doc.getElementById('nowTs');
  const tsInput = doc.getElementById('tsInput');
  const tsNowBtn = doc.getElementById('tsNowBtn');
  const tsDateLine = doc.getElementById('tsDateLine');
  const tsWeekLine = doc.getElementById('tsWeekLine');
  const tsRelLine = doc.getElementById('tsRelLine');
  const dateInput = doc.getElementById('dateInput');
  const dateNowBtn = doc.getElementById('dateNowBtn');
  const tsSecLine = doc.getElementById('tsSecLine');
  const tsMsLine = doc.getElementById('tsMsLine');

  function renderNow() {
    const now = Math.floor(Date.now() / 1000);
    nowText.textContent = formatDateTime(now);
    nowTs.textContent = now + '（秒）· ' + now * 1000 + '（毫秒）';
  }

  function renderTs() {
    const parsed = parseTsInput(tsInput.value);
    if (!parsed) {
      tsDateLine.textContent = tsInput.value.trim() ? '格式无效：请输入纯数字时间戳' : '—';
      tsWeekLine.textContent = '—';
      tsRelLine.textContent = '—';
      return;
    }
    tsDateLine.textContent = formatDateTime(parsed.ts) + (parsed.isMs ? '（识别为毫秒）' : '（识别为秒）');
    tsWeekLine.textContent = '星期：' + weekdayOf(parsed.ts);
    tsRelLine.textContent = '相对：' + relativeLabel(parsed.ts, Math.floor(Date.now() / 1000));
  }

  function renderDate() {
    const ts = tsFromDateTime(dateInput.value);
    if (ts === null) {
      tsSecLine.textContent = dateInput.value ? '格式无效' : '—';
      tsMsLine.textContent = '—';
      return;
    }
    tsSecLine.textContent = ts + '（秒）';
    tsMsLine.textContent = ts * 1000 + '（毫秒）';
  }

  tsInput.addEventListener('input', renderTs);
  tsNowBtn.addEventListener('click', () => {
    tsInput.value = String(Math.floor(Date.now() / 1000));
    renderTs();
  });
  dateInput.addEventListener('input', renderDate);
  dateNowBtn.addEventListener('click', () => {
    dateInput.value = nowDateTimeValue(Date.now());
    renderDate();
  });

  dateInput.value = nowDateTimeValue(Date.now());
  renderNow();
  renderTs();
  renderDate();
  setInterval(renderNow, 1000);
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initTimestamp(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseTsInput, formatDateTime, weekdayOf, relativeLabel, tsFromDateTime, nowDateTimeValue, initTimestamp
  };
}
