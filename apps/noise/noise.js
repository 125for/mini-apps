/* 白噪音 —— WebAudio 实时合成（无音频文件）；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const NOISE_TYPES = { white: '白噪音', pink: '粉噪音', brown: '棕噪音', waves: '海浪' };

function clampVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

/* 感知音量曲线：功率与听感近似成正比，用平方做增益 */
function gainValue(volume) {
  const v = clampVolume(volume);
  return v * v;
}

/* 生成指定类型的一段噪音样本（已夹幅到 [-1, 1]）。
 * rng 可注入以便测试；默认 Math.random（此处不承担安全职责）。 */
function generateNoise(type, seconds, sampleRate, rng) {
  if (!Object.prototype.hasOwnProperty.call(NOISE_TYPES, type)) return null;
  const sr = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 44100;
  const sec = typeof seconds === 'number' && seconds > 0 ? seconds : 2;
  const rand = typeof rng === 'function' ? rng : Math.random;
  const n = Math.round(sr * sec);
  const out = new Array(n);

  if (type === 'white') {
    for (let i = 0; i < n; i++) out[i] = clamp(rand() * 2 - 1);
    return out;
  }

  if (type === 'pink') {
    /* Paul Kellet 粉噪音滤波器 */
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      out[i] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11);
      b6 = w * 0.115926;
    }
    return out;
  }

  if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      out[i] = clamp(last * 3.5);
    }
    return out;
  }

  /* waves：棕噪音叠加约 0.09Hz 的缓慢起伏，近似海浪 */
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    const env = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((2 * Math.PI * 0.09 * i) / sr));
    out[i] = clamp(last * 3.5 * env);
  }
  return out;
}

function clamp(v) {
  return Math.min(1, Math.max(-1, v));
}

/* 定时停止：minutes <= 0 表示不定时，返回 null */
function timerEndsAt(minutes, now) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  return (typeof now === 'number' ? now : Date.now()) + m * 60000;
}

function remainingLabel(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '00:00';
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  return String(mm).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ---------- 界面 ---------- */

function initNoise(doc) {
  const volumeRange = doc.getElementById('volumeRange');
  const volumeLabel = doc.getElementById('volumeLabel');
  const timerSelect = doc.getElementById('timerSelect');
  const timerLabel = doc.getElementById('timerLabel');
  const cards = {};
  for (const type of Object.keys(NOISE_TYPES)) {
    cards[type] = {
      btn: doc.getElementById('play-' + type),
      card: doc.getElementById('card-' + type)
    };
    cards[type].btn.addEventListener('click', () => toggle(type));
  }

  let audioCtx = null;
  let current = null; /* { type, source, gain }，音频不可用时为 null */
  let playingType = null;
  let endAt = null;
  let timerInterval = null;

  function ensureCtx() {
    try {
      const view = doc.defaultView;
      const Ctx = view && (view.AudioContext || view.webkitAudioContext);
      if (!Ctx) return null;
      audioCtx = audioCtx || new Ctx();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function stop() {
    if (current) {
      try { current.source.stop(); } catch (e) { /* 已停止时忽略 */ }
      try { current.source.disconnect(); } catch (e) { /* 忽略 */ }
      current = null;
    }
    playingType = null;
    endAt = null;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerLabel.textContent = '';
    for (const type of Object.keys(cards)) {
      cards[type].btn.textContent = '播放';
      cards[type].card.classList.remove('playing');
    }
  }

  function play(type) {
    stop();
    const ctx = ensureCtx();
    if (ctx) {
      const data = generateNoise(type, 4, ctx.sampleRate, Math.random);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(new Float32Array(data));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = gainValue(Number(volumeRange.value) / 100);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      current = { type: type, source: source, gain: gain };
    }
    playingType = type;
    cards[type].btn.textContent = '停止';
    cards[type].card.classList.add('playing');

    endAt = timerEndsAt(Number(timerSelect.value), Date.now());
    if (endAt !== null) {
      timerInterval = setInterval(tickTimer, 1000);
      tickTimer();
    }
  }

  function tickTimer() {
    if (endAt === null) return;
    const ms = endAt - Date.now();
    if (ms <= 0) {
      stop();
      return;
    }
    timerLabel.textContent = '剩余 ' + remainingLabel(ms);
  }

  function toggle(type) {
    if (playingType === type) stop();
    else play(type);
  }

  volumeRange.addEventListener('input', () => {
    volumeLabel.textContent = volumeRange.value + '%';
    if (current) {
      try { current.gain.gain.value = gainValue(Number(volumeRange.value) / 100); } catch (e) { /* 忽略 */ }
    }
  });

  timerSelect.addEventListener('change', () => {
    /* 播放中调整定时：立即按新设置重新计算 */
    if (playingType === null) return;
    endAt = timerEndsAt(Number(timerSelect.value), Date.now());
    if (endAt === null) {
      timerLabel.textContent = '';
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    } else {
      timerLabel.textContent = '剩余 ' + remainingLabel(endAt - Date.now());
      if (!timerInterval) timerInterval = setInterval(tickTimer, 1000);
    }
  });
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initNoise(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NOISE_TYPES, clampVolume, gainValue, generateNoise, timerEndsAt, remainingLabel, initNoise
  };
}
