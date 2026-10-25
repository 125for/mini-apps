/* 桌面时钟 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function timeParts(date) {
  return { hours: date.getHours(), minutes: date.getMinutes(), seconds: date.getSeconds() };
}

function formatTime(date, options) {
  const opts = options || {};
  const use24h = opts.use24h !== false;
  const showSeconds = opts.showSeconds !== false;
  const p = timeParts(date);
  let hours = p.hours;
  let suffix = '';
  if (!use24h) {
    suffix = p.hours < 12 ? ' AM' : ' PM';
    hours = p.hours % 12 || 12;
  }
  const base = pad2(hours) + ':' + pad2(p.minutes);
  return showSeconds ? base + ':' + pad2(p.seconds) + suffix : base + suffix;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDate(date) {
  return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日 ' + WEEKDAY_NAMES[date.getDay()];
}

/* 指针角度（度）；秒针随毫秒平滑移动 */
function handAngles(date) {
  const p = timeParts(date);
  const withMs = p.seconds + date.getMilliseconds() / 1000;
  return {
    hour: (p.hours % 12) * 30 + p.minutes * 0.5,
    minute: p.minutes * 6 + withMs * 0.1,
    second: withMs * 6
  };
}

/* ---------- 偏好设置 ---------- */

const PREFS_KEY = 'clock.prefs.v1';

function defaultPrefs() {
  return { use24h: true, showSeconds: true, theme: null };
}

function loadPrefs(storage) {
  try {
    const raw = storage && storage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return defaultPrefs();
    return {
      use24h: typeof saved.use24h === 'boolean' ? saved.use24h : true,
      showSeconds: typeof saved.showSeconds === 'boolean' ? saved.showSeconds : true,
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : null
    };
  } catch (e) {
    return defaultPrefs();
  }
}

function savePrefs(storage, prefs) {
  try {
    if (storage) storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initClock(doc, storage) {
  const digital = doc.getElementById('digital');
  const dateLine = doc.getElementById('dateLine');
  const hourHand = doc.getElementById('hourHand');
  const minuteHand = doc.getElementById('minuteHand');
  const secondHand = doc.getElementById('secondHand');
  const ticks = doc.getElementById('ticks');
  const button24h = doc.getElementById('toggle24h');
  const buttonSeconds = doc.getElementById('toggleSeconds');
  const buttonTheme = doc.getElementById('toggleTheme');
  const buttonFullscreen = doc.getElementById('fullscreen');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 12; i++) {
    const major = i % 3 === 0;
    const tick = doc.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', '50');
    tick.setAttribute('y1', major ? '3.5' : '5');
    tick.setAttribute('x2', '50');
    tick.setAttribute('y2', major ? '9' : '7');
    tick.setAttribute('transform', 'rotate(' + i * 30 + ' 50 50)');
    tick.setAttribute('class', major ? 'tick major' : 'tick');
    ticks.appendChild(tick);
  }

  const prefs = loadPrefs(storage);
  if (!prefs.theme) {
    prefs.theme = 'dark';
    try {
      const view = doc.defaultView;
      if (view && view.matchMedia && view.matchMedia('(prefers-color-scheme: light)').matches) {
        prefs.theme = 'light';
      }
    } catch (e) { /* 无法探测系统偏好时保持深色 */ }
  }

  function applyTheme() {
    doc.documentElement.setAttribute('data-theme', prefs.theme);
    buttonTheme.textContent = prefs.theme === 'dark' ? '浅色模式' : '深色模式';
  }

  function tick() {
    const now = new Date();
    digital.textContent = formatTime(now, prefs);
    dateLine.textContent = formatDate(now);
    const angles = handAngles(now);
    hourHand.setAttribute('transform', 'rotate(' + angles.hour + ' 50 50)');
    minuteHand.setAttribute('transform', 'rotate(' + angles.minute + ' 50 50)');
    secondHand.setAttribute('transform', 'rotate(' + angles.second + ' 50 50)');
  }

  button24h.addEventListener('click', () => {
    prefs.use24h = !prefs.use24h;
    button24h.classList.toggle('active', prefs.use24h);
    savePrefs(storage, prefs);
    tick();
  });

  buttonSeconds.addEventListener('click', () => {
    prefs.showSeconds = !prefs.showSeconds;
    buttonSeconds.classList.toggle('active', prefs.showSeconds);
    savePrefs(storage, prefs);
    tick();
  });

  buttonTheme.addEventListener('click', () => {
    prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    savePrefs(storage, prefs);
  });

  buttonFullscreen.addEventListener('click', () => {
    try {
      const request = doc.fullscreenElement
        ? doc.exitFullscreen()
        : doc.documentElement.requestFullscreen();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch (e) { /* 环境不支持全屏时静默忽略 */ }
  });

  button24h.classList.toggle('active', prefs.use24h);
  buttonSeconds.classList.toggle('active', prefs.showSeconds);
  applyTheme();
  tick();
  setInterval(tick, 50);
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initClock(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pad2, timeParts, formatTime, formatDate, handAngles, loadPrefs, savePrefs, initClock };
}
