/* 抽签决定器 —— 密码学安全随机（拒绝采样消除模偏差）；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const OPTION_MAX_LEN = 50;
const MAX_OPTIONS = 100;

/* 按行解析：去首尾空白、去空行、去重、限长限量 */
function parseOptions(text) {
  const out = [];
  for (const line of String(text == null ? '' : text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.length > OPTION_MAX_LEN) continue;
    if (out.indexOf(t) === -1) out.push(t);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

function createByteSource(bytes) {
  return { bytes: bytes, pos: 0 };
}

/* 拒绝采样：只用落在 size 整数倍上限内的字节，消除模偏差 */
function nextIndex(source, size) {
  const limit = Math.floor(256 / size) * size;
  while (source.pos < source.bytes.length) {
    const b = source.bytes[source.pos];
    source.pos += 1;
    if (b < limit) return b % size;
  }
  return null;
}

function pickOption(options, bytes) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const idx = nextIndex(createByteSource(bytes), options.length);
  if (idx === null) return null;
  return options[idx];
}

/* Fisher-Yates 洗牌，字节不足返回 null */
function shuffleOptions(options, bytes) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const arr = options.slice();
  const source = createByteSource(bytes);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextIndex(source, i + 1);
    if (j === null) return null;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function removeOption(options, value) {
  return options.filter((o) => o !== value);
}

/* ---------- 界面 ---------- */

function initPicker(doc) {
  const input = doc.getElementById('optionInput');
  const drawBtn = doc.getElementById('drawBtn');
  const shuffleBtn = doc.getElementById('shuffleBtn');
  const resultText = doc.getElementById('resultText');
  const drawAgainBtn = doc.getElementById('drawAgainBtn');
  const optionCount = doc.getElementById('optionCount');

  function randomBytes(n) {
    const view = new Uint8Array(n);
    doc.defaultView.crypto.getRandomValues(view);
    return view;
  }

  function currentOptions() {
    return parseOptions(input.value);
  }

  function updateCount() {
    optionCount.textContent = '共 ' + currentOptions().length + ' 个选项';
  }

  function draw() {
    const options = currentOptions();
    if (options.length < 2) {
      resultText.textContent = options.length === 1 ? '只有一个选项，不用抽啦' : '至少需要两个选项（每行一个）';
      drawAgainBtn.hidden = true;
      return;
    }
    let picked = null;
    for (let attempt = 0; attempt < 3 && picked === null; attempt++) {
      picked = pickOption(options, randomBytes(16));
    }
    if (picked === null) {
      resultText.textContent = '抽取失败，请重试';
      drawAgainBtn.hidden = true;
      return;
    }
    resultText.textContent = picked;
    drawAgainBtn.hidden = false;
  }

  /* 排除刚抽中的选项后再抽（抽名字不重复场景） */
  function drawAgain() {
    const options = removeOption(currentOptions(), resultText.textContent);
    input.value = options.join('\n');
    updateCount();
    const remaining = currentOptions();
    if (remaining.length === 0) {
      resultText.textContent = '全部抽完了 🎉';
      drawAgainBtn.hidden = true;
      return;
    }
    if (remaining.length === 1) {
      resultText.textContent = remaining[0] + '（最后一个）';
      drawAgainBtn.hidden = true;
      return;
    }
    draw();
  }

  function shuffle() {
    const options = currentOptions();
    if (options.length < 2) {
      resultText.textContent = '至少需要两个选项';
      drawAgainBtn.hidden = true;
      return;
    }
    let shuffled = null;
    for (let attempt = 0; attempt < 3 && shuffled === null; attempt++) {
      shuffled = shuffleOptions(options, randomBytes(options.length * 8 + 16));
    }
    if (!shuffled) {
      resultText.textContent = '洗牌失败，请重试';
      return;
    }
    input.value = shuffled.join('\n');
    updateCount();
    resultText.textContent = '✓ 已随机排序';
    drawAgainBtn.hidden = true;
  }

  drawBtn.addEventListener('click', draw);
  drawAgainBtn.addEventListener('click', drawAgain);
  shuffleBtn.addEventListener('click', shuffle);
  input.addEventListener('input', updateCount);

  updateCount();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initPicker(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OPTION_MAX_LEN, MAX_OPTIONS, parseOptions, createByteSource, nextIndex,
    pickOption, shuffleOptions, removeOption, initPicker
  };
}
