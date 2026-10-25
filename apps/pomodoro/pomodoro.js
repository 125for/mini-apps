/* 番茄钟 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const WORK_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const STATS_KEY = 'pomodoro.stats.v1';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKeyTs(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function phaseDuration(phase) {
  return phase === 'work' ? WORK_MS : BREAK_MS;
}

function createState() {
  return { phase: 'work', running: false, endAt: null, remainingMs: WORK_MS };
}

function start(state, now) {
  if (state.running) return state;
  return {
    phase: state.phase,
    running: true,
    endAt: now + state.remainingMs,
    remainingMs: state.remainingMs
  };
}

function pause(state, now) {
  if (!state.running) return state;
  return {
    phase: state.phase,
    running: false,
    endAt: null,
    remainingMs: Math.max(0, state.endAt - now)
  };
}

function remainingOf(state, now) {
  return state.running ? Math.max(0, state.endAt - now) : state.remainingMs;
}

function isFinished(state, now) {
  return state.running && state.endAt <= now;
}

function nextPhase(state) {
  const phase = state.phase === 'work' ? 'break' : 'work';
  return { phase: phase, running: false, endAt: null, remainingMs: phaseDuration(phase) };
}

/* 向上取整到秒，避免计时开始的一瞬间就跳秒 */
function formatClock(ms) {
  const s = Math.ceil(ms / 1000);
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}

function bumpStats(stats, dayKey) {
  const next = Object.assign({}, stats);
  next[dayKey] = (typeof next[dayKey] === 'number' ? next[dayKey] : 0) + 1;
  return next;
}

/* 只保留最近 keepDays 天的记录，避免存储无限增长 */
function pruneStats(stats, todayKey, keepDays) {
  const keep = keepDays || 30;
  const keys = Object.keys(stats).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const out = {};
  for (const k of keys.slice(-keep)) out[k] = stats[k];
  return out;
}

function loadStats(storage) {
  try {
    const raw = storage && storage.getItem(STATS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out = {};
    for (const k of Object.keys(data)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof data[k] === 'number' && data[k] >= 0) {
        out[k] = data[k];
      }
    }
    return out;
  } catch (e) {
    return {};
  }
}

function saveStats(storage, stats) {
  try {
    if (storage) storage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) { /* 存储不可用时静默降级为不保存 */ }
}

/* ---------- 界面 ---------- */

function initPomodoro(doc, storage) {
  const phaseLabel = doc.getElementById('phaseLabel');
  const timeText = doc.getElementById('timeText');
  const toggleBtn = doc.getElementById('toggleBtn');
  const resetBtn = doc.getElementById('resetBtn');
  const skipBtn = doc.getElementById('skipBtn');
  const statLine = doc.getElementById('statLine');
  const ring = doc.getElementById('progressRing');

  const CIRCUMFERENCE = 2 * Math.PI * 45;
  ring.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));

  let state = createState();
  let stats = loadStats(storage);
  let audioCtx = null;

  /* 阶段结束时短促提示音（WebAudio 生成，无需音频文件） */
  function beep() {
    try {
      const view = doc.defaultView;
      const Ctx = view && (view.AudioContext || view.webkitAudioContext);
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { /* 音频不可用时静默忽略 */ }
  }

  function render() {
    const now = Date.now();
    if (isFinished(state, now)) {
      if (state.phase === 'work') {
        stats = bumpStats(stats, dayKeyTs(now));
        saveStats(storage, pruneStats(stats, dayKeyTs(now)));
      }
      beep();
      state = start(nextPhase(state), now); /* 阶段结束自动进入下一阶段 */
    }
    const remaining = remainingOf(state, now);
    const total = phaseDuration(state.phase);
    timeText.textContent = formatClock(remaining);
    phaseLabel.textContent = state.phase === 'work'
      ? (state.running ? '专注中' : '准备专注')
      : (state.running ? '休息一下' : '稍事休息');
    toggleBtn.textContent = state.running ? '暂停' : '开始';
    ring.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - remaining / total)));
    const today = stats[dayKeyTs(now)] || 0;
    statLine.textContent = '今天已完成 ' + today + ' 个番茄';
    doc.title = formatClock(remaining) + ' · ' + (state.phase === 'work' ? '番茄钟' : '休息');
  }

  toggleBtn.addEventListener('click', () => {
    if (state.running) {
      state = pause(state, Date.now());
    } else {
      /* 浏览器要求音频必须在用户手势里初始化 */
      try {
        const view = doc.defaultView;
        const Ctx = view && (view.AudioContext || view.webkitAudioContext);
        if (Ctx && !audioCtx) audioCtx = new Ctx();
      } catch (e) { /* 忽略 */ }
      state = start(state, Date.now());
    }
    render();
  });

  resetBtn.addEventListener('click', () => {
    state = createState();
    render();
  });

  skipBtn.addEventListener('click', () => {
    state = nextPhase(state);
    render();
  });

  render();
  setInterval(render, 250);
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initPomodoro(document, typeof localStorage !== 'undefined' ? localStorage : null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WORK_MS, BREAK_MS, STATS_KEY, dayKeyTs, phaseDuration, createState,
    start, pause, remainingOf, isFinished, nextPhase, formatClock,
    bumpStats, pruneStats, loadStats, saveStats, initPomodoro
  };
}
