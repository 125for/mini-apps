/* 密码生成器 —— 密码学安全随机 + 纯逻辑可测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const MIN_LEN = 8;
const MAX_LEN = 64;
const DEFAULT_LEN = 16;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~';
const AMBIGUOUS = '0O1lI';

function buildPool(options) {
  const opts = options || {};
  let pool = '';
  if (opts.lower) pool += LOWER;
  if (opts.upper) pool += UPPER;
  if (opts.digit) pool += DIGITS;
  if (opts.symbol) pool += SYMBOLS;
  if (opts.excludeAmbiguous) {
    pool = pool.split('').filter((c) => AMBIGUOUS.indexOf(c) === -1).join('');
  }
  return pool;
}

/* 逐字节消费随机源；拒绝采样消除模偏差，字节耗尽返回 null */
function createByteSource(bytes) {
  return { bytes: bytes, pos: 0 };
}

function nextIndex(source, size) {
  const limit = Math.floor(256 / size) * size;
  while (source.pos < source.bytes.length) {
    const b = source.bytes[source.pos];
    source.pos += 1;
    if (b < limit) return b % size;
  }
  return null;
}

function entropyBits(length, poolSize) {
  if (!poolSize || length <= 0) return 0;
  return length * Math.log2(poolSize);
}

function strengthLabel(bits) {
  if (bits < 40) return '弱';
  if (bits < 60) return '一般';
  if (bits < 80) return '强';
  return '极强';
}

/* opts: {length, lower, upper, digit, symbol, excludeAmbiguous}
 * bytes: 0-255 随机字节数组（浏览器端来自 crypto.getRandomValues）
 * 保证包含每个所选字符类至少一个字符，再 Fisher-Yates 洗牌 */
function generatePassword(options, bytes) {
  const opts = options || {};
  const length = Number(opts.length);
  const pool = buildPool(opts);
  if (!pool || length < MIN_LEN || length > MAX_LEN) return null;

  const source = createByteSource(bytes);
  const classes = [];
  if (opts.lower) classes.push(LOWER);
  if (opts.upper) classes.push(UPPER);
  if (opts.digit) classes.push(DIGITS);
  if (opts.symbol) classes.push(SYMBOLS);
  const usable = (opts.excludeAmbiguous
    ? classes.map((cls) => cls.split('').filter((c) => AMBIGUOUS.indexOf(c) === -1).join(''))
    : classes
  ).filter((cls) => cls.length > 0);

  const chars = [];
  for (const cls of usable) {
    const idx = nextIndex(source, cls.length);
    if (idx === null) return null;
    chars.push(cls[idx]);
  }
  if (chars.length > length) return null;
  while (chars.length < length) {
    const idx = nextIndex(source, pool.length);
    if (idx === null) return null;
    chars.push(pool[idx]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = nextIndex(source, i + 1);
    if (j === null) return null;
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

/* ---------- 界面 ---------- */

function initPassword(doc) {
  const passwordText = doc.getElementById('passwordText');
  const copyBtn = doc.getElementById('copyBtn');
  const strengthLine = doc.getElementById('strengthLine');
  const generateBtn = doc.getElementById('generateBtn');
  const lengthRange = doc.getElementById('lengthRange');
  const lenValue = doc.getElementById('lenValue');
  const optLower = doc.getElementById('optLower');
  const optUpper = doc.getElementById('optUpper');
  const optDigit = doc.getElementById('optDigit');
  const optSymbol = doc.getElementById('optSymbol');
  const optNoAmbiguous = doc.getElementById('optNoAmbiguous');

  let currentPassword = null;

  function readOptions() {
    return {
      length: Number(lengthRange.value) || DEFAULT_LEN,
      lower: optLower.checked,
      upper: optUpper.checked,
      digit: optDigit.checked,
      symbol: optSymbol.checked,
      excludeAmbiguous: optNoAmbiguous.checked
    };
  }

  function randomBytes(n) {
    const view = new Uint8Array(n);
    doc.defaultView.crypto.getRandomValues(view);
    return view;
  }

  function generate() {
    const opts = readOptions();
    const pool = buildPool(opts);
    if (!pool) {
      currentPassword = null;
      passwordText.textContent = '请至少选择一种字符类型';
      strengthLine.textContent = '—';
      return;
    }
    let password = null;
    for (let attempt = 0; attempt < 3 && password === null; attempt++) {
      password = generatePassword(opts, randomBytes(opts.length * 16));
    }
    if (password === null) {
      currentPassword = null;
      passwordText.textContent = '生成失败，请重试';
      strengthLine.textContent = '—';
      return;
    }
    currentPassword = password;
    passwordText.textContent = password;
    const bits = entropyBits(password.length, pool.length);
    strengthLine.textContent = '长度 ' + password.length + ' · 约 ' + Math.round(bits) + ' 位熵 · ' + strengthLabel(bits);
  }

  function markCopied() {
    copyBtn.textContent = '已复制 ✓';
    setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
  }

  function fallbackCopy(text) {
    try {
      const ta = doc.createElement('textarea');
      ta.value = text;
      if (doc.body) doc.body.appendChild(ta);
      ta.select();
      doc.execCommand('copy');
      if (doc.body) doc.body.removeChild(ta);
    } catch (e) { /* 复制失败时静默 */ }
  }

  copyBtn.addEventListener('click', () => {
    if (!currentPassword) return;
    const view = doc.defaultView;
    const nav = view && view.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(currentPassword).then(markCopied, () => {
        fallbackCopy(currentPassword);
        markCopied();
      });
    } else {
      fallbackCopy(currentPassword);
      markCopied();
    }
  });

  generateBtn.addEventListener('click', generate);
  lengthRange.addEventListener('input', () => {
    lenValue.textContent = lengthRange.value;
    generate();
  });

  generate();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initPassword(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_LEN, MAX_LEN, DEFAULT_LEN, LOWER, UPPER, DIGITS, SYMBOLS, AMBIGUOUS,
    buildPool, createByteSource, nextIndex, entropyBits, strengthLabel,
    generatePassword, initPassword
  };
}
