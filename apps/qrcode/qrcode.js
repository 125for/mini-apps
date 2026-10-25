/* 二维码生成器 —— 纯 JavaScript 实现的完整 QR 编码（版本 1-10，字节模式，L/M/Q/H）
 * 依据 ISO/IEC 18004：GF(256) Reed-Solomon 纠错、码字交错、功能图案、格式/版本信息、八种掩码择优。
 * 核心编码函数与渲染分离，可在 Node 中单元测试。 */
'use strict';

/* ---------- 纠错块结构表（ISO/IEC 18004，版本 1-10） ----------
 * 每项为 [每块纠错码字数, [[块数, 每块数据码字数], ...分组]] */
const EC_BLOCKS = {
  1:  { L: [7,  [[1, 19]]],           M: [10, [[1, 16]]],          Q: [13, [[1, 13]]],         H: [17, [[1, 9]]] },
  2:  { L: [10, [[1, 34]]],           M: [16, [[1, 28]]],          Q: [22, [[1, 22]]],         H: [28, [[1, 16]]] },
  3:  { L: [15, [[1, 55]]],           M: [26, [[1, 44]]],          Q: [18, [[2, 17]]],         H: [22, [[2, 13]]] },
  4:  { L: [20, [[1, 80]]],           M: [18, [[2, 32]]],          Q: [26, [[2, 24]]],         H: [16, [[4, 9]]] },
  5:  { L: [26, [[1, 108]]],          M: [24, [[2, 43]]],          Q: [18, [[2, 15], [2, 16]]], H: [22, [[2, 11], [2, 12]]] },
  6:  { L: [18, [[2, 68]]],           M: [16, [[4, 27]]],          Q: [24, [[4, 19]]],         H: [28, [[4, 15]]] },
  7:  { L: [20, [[2, 78]]],           M: [18, [[4, 31]]],          Q: [18, [[2, 14], [4, 15]]], H: [26, [[4, 13], [1, 14]]] },
  8:  { L: [24, [[2, 97]]],           M: [22, [[2, 38], [2, 39]]], Q: [22, [[4, 18], [2, 19]]], H: [26, [[4, 14], [2, 15]]] },
  9:  { L: [30, [[2, 116]]],          M: [22, [[3, 36], [2, 37]]], Q: [20, [[4, 16], [4, 17]]], H: [24, [[4, 12], [4, 13]]] },
  10: { L: [18, [[2, 68], [2, 69]]],  M: [26, [[4, 43], [1, 44]]], Q: [24, [[6, 19], [2, 20]]], H: [28, [[6, 15], [2, 16]]] }
};

/* 各版本对位图案中心坐标 */
const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

const EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const EC_LEVELS = ['L', 'M', 'Q', 'H'];
const MAX_VERSION = 10;

/* ---------- GF(256) 运算（本原多项式 0x11D） ---------- */

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/* 生成多项式 ∏(x - α^i)，大端表示，首项为 1 */
const GENERATOR_CACHE = {};
function rsGeneratorPoly(degree) {
  if (GENERATOR_CACHE[degree]) return GENERATOR_CACHE[degree];
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const a = GF_EXP[i];
    const next = new Array(poly.length + 1).fill(0);
    for (let k = 0; k < next.length; k++) {
      if (k < poly.length) next[k] ^= poly[k];
      if (k >= 1 && k - 1 < poly.length) next[k] ^= gfMul(a, poly[k - 1]);
    }
    poly = next;
  }
  GENERATOR_CACHE[degree] = poly;
  return poly;
}

/* 求余：data·x^degree 除以生成多项式，返回 degree 个纠错码字 */
function rsRemainder(data, degree) {
  const gen = rsGeneratorPoly(degree);
  const res = data.concat(new Array(degree).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return res.slice(data.length);
}

/* 数据码字与纠错码字交错（组内逐块轮转，先数据后纠错） */
function interleaveCodewords(dataBlocks, ecBlocks) {
  const out = [];
  const maxData = Math.max.apply(null, dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) {
      if (i < b.length) out.push(b[i]);
    }
  }
  const maxEc = Math.max.apply(null, ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxEc; i++) {
    for (const b of ecBlocks) {
      if (i < b.length) out.push(b[i]);
    }
  }
  return out;
}

/* ---------- 编码 ---------- */

function getBit(x, i) {
  return ((x >>> i) & 1) !== 0;
}

function dataCodewordCount(version, level) {
  const groups = EC_BLOCKS[version][level][1];
  let n = 0;
  for (const pair of groups) n += pair[0] * pair[1];
  return n;
}

function charCountBits(version) {
  return version <= 9 ? 8 : 16;
}

function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(String(text)));
}

/* 文本 → 交错后的完整码字序列；超出版本 10 容量返回 null */
function encodeCodewords(text, level) {
  if (EC_LEVELS.indexOf(level) === -1) return null;
  const bytes = utf8Bytes(text);
  for (let version = 1; version <= MAX_VERSION; version++) {
    const capBits = dataCodewordCount(version, level) * 8;
    if (4 + charCountBits(version) + bytes.length * 8 > capBits) continue;

    const bits = [];
    function pushBits(value, n) {
      for (let i = n - 1; i >= 0; i--) bits.push(getBit(value, i) ? 1 : 0);
    }
    pushBits(4, 4); /* 字节模式 */
    pushBits(bytes.length, charCountBits(version));
    for (const b of bytes) pushBits(b, 8);

    const term = Math.min(4, capBits - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }
    let pad = 0xec;
    while (data.length < capBits / 8) {
      data.push(pad);
      pad = pad === 0xec ? 0x11 : 0xec;
    }

    const spec = EC_BLOCKS[version][level];
    const ecPer = spec[0];
    const dataBlocks = [];
    let p = 0;
    for (const pair of spec[1]) {
      for (let b = 0; b < pair[0]; b++) {
        dataBlocks.push(data.slice(p, p + pair[1]));
        p += pair[1];
      }
    }
    const ecBlocks = dataBlocks.map((blk) => rsRemainder(blk, ecPer));
    return {
      version: version,
      level: level,
      codewords: interleaveCodewords(dataBlocks, ecBlocks),
      dataBlocks: dataBlocks,
      ecBlocks: ecBlocks
    };
  }
  return null;
}

/* ---------- 矩阵构建 ---------- */

function buildMatrix(text, level) {
  const enc = encodeCodewords(text, level);
  if (!enc) return null;
  const version = enc.version;
  const size = 17 + 4 * version;
  const modules = [];
  const isFunc = [];
  for (let r = 0; r < size; r++) {
    modules.push(new Array(size).fill(false));
    isFunc.push(new Array(size).fill(false));
  }
  function set(x, y, dark) {
    modules[y][x] = dark;
    isFunc[y][x] = true;
  }

  /* 时序图案（先画，随后定位图案覆盖其角落部分） */
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  /* 三个定位图案（含分隔区），中心坐标 */
  function drawFinder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  /* 对位图案（跳过与定位图案重叠的角） */
  const align = ALIGNMENT[version];
  for (const ry of align) {
    for (const rx of align) {
      const corner = (ry === 6 && rx === 6) ||
        (ry === 6 && rx === size - 7) ||
        (ry === size - 7 && rx === 6);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(rx + dx, ry + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  /* 版本信息（版本 7 及以上，BCH(18,6)） */
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }

  /* 格式信息（BCH(15,5) + 掩码 0x5412），先以掩码 0 占位，选定后重画 */
  function drawFormat(mask) {
    const data = (EC_FORMAT_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, getBit(bits, i));
    set(8, 7, getBit(bits, 6));
    set(8, 8, getBit(bits, 7));
    set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, getBit(bits, i));
    set(8, size - 8, true); /* 固定暗模块 */
  }
  drawFormat(0);

  /* 之字形放置码字位（跳过功能模块，两列一组向上/向下交替） */
  const codewords = enc.codewords;
  let bitPos = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && bitPos < codewords.length * 8) {
          modules[y][x] = getBit(codewords[bitPos >>> 3], 7 - (bitPos & 7));
          bitPos += 1;
        }
      }
    }
  }

  /* 掩码公式（i=行 y，j=列 x） */
  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  }

  function applyMask(mask) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  }

  /* 罚分：N1 长同色串 / N2 2x2 同色块 / N3 类定位图案 / N4 明暗比例 */
  function penaltyScore() {
    let result = 0;
    for (let y = 0; y < size; y++) {
      let runLen = 1;
      for (let x = 1; x < size; x++) {
        if (modules[y][x] === modules[y][x - 1]) {
          runLen += 1;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result += 1;
        } else {
          runLen = 1;
        }
      }
    }
    for (let x = 0; x < size; x++) {
      let runLen = 1;
      for (let y = 1; y < size; y++) {
        if (modules[y][x] === modules[y - 1][x]) {
          runLen += 1;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result += 1;
        } else {
          runLen = 1;
        }
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
      }
    }
    const PAT_A = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const PAT_B = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    function matchAt(get, start, pat) {
      for (let k = 0; k < 11; k++) {
        if (get(start + k) !== pat[k]) return false;
      }
      return true;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x <= size - 11; x++) {
        if (matchAt((i) => (modules[y][i] ? 1 : 0), x, PAT_A)) result += 40;
        if (matchAt((i) => (modules[y][i] ? 1 : 0), x, PAT_B)) result += 40;
      }
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y <= size - 11; y++) {
        if (matchAt((i) => (modules[i][x] ? 1 : 0), y, PAT_A)) result += 40;
        if (matchAt((i) => (modules[i][x] ? 1 : 0), y, PAT_B)) result += 40;
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark += 1;
      }
    }
    const k = Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5);
    result += k * 10;
    return result;
  }

  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    const score = penaltyScore();
    applyMask(m); /* 撤销（异或自逆） */
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
    }
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return {
    version: version,
    level: level,
    size: size,
    mask: bestMask,
    modules: modules,
    isFunc: isFunc,
    codewords: codewords
  };
}

/* ---------- 界面 ---------- */

function initQrcode(doc) {
  const textInput = doc.getElementById('textInput');
  const levelSelect = doc.getElementById('levelSelect');
  const qrInfo = doc.getElementById('qrInfo');
  const qrContainer = doc.getElementById('qrContainer');
  const downloadBtn = doc.getElementById('downloadBtn');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const QUIET = 4;
  const SCALE = 8;
  let current = null;

  function render() {
    const text = String(textInput.value == null ? '' : textInput.value);
    qrContainer.textContent = '';
    if (!text.trim()) {
      current = null;
      qrInfo.textContent = '请输入内容，二维码将实时生成';
      return;
    }
    const result = buildMatrix(text, levelSelect.value);
    if (!result) {
      current = null;
      qrInfo.textContent = '内容过长：超出所选纠错级别在版本 10 下的容量，请精简内容或降低纠错级别';
      return;
    }
    current = result;
    qrInfo.textContent = '版本 ' + result.version + ' · 纠错 ' + result.level +
      ' · ' + result.size + ' × ' + result.size + ' 模块 · 掩码 ' + result.mask;

    const dim = (result.size + QUIET * 2) * SCALE;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + dim + ' ' + dim);
    svg.setAttribute('width', String(dim));
    svg.setAttribute('height', String(dim));
    svg.setAttribute('class', 'qr-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '生成的二维码');
    for (let y = 0; y < result.size; y++) {
      for (let x = 0; x < result.size; x++) {
        if (!result.modules[y][x]) continue;
        const r = doc.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', String((x + QUIET) * SCALE));
        r.setAttribute('y', String((y + QUIET) * SCALE));
        r.setAttribute('width', String(SCALE));
        r.setAttribute('height', String(SCALE));
        svg.appendChild(r);
      }
    }
    qrContainer.appendChild(svg);
  }

  function downloadPng() {
    if (!current) return;
    try {
      const canvas = doc.createElement('canvas');
      if (typeof canvas.getContext !== 'function') return;
      const dim = (current.size + QUIET * 2) * 10;
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = '#000000';
      for (let y = 0; y < current.size; y++) {
        for (let x = 0; x < current.size; x++) {
          if (current.modules[y][x]) {
            ctx.fillRect((x + QUIET) * 10, (y + QUIET) * 10, 10, 10);
          }
        }
      }
      const url = canvas.toDataURL('image/png');
      const a = doc.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      a.click();
    } catch (e) { /* 环境不支持画布时静默忽略 */ }
  }

  textInput.addEventListener('input', render);
  levelSelect.addEventListener('change', render);
  downloadBtn.addEventListener('click', downloadPng);

  render();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initQrcode(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EC_BLOCKS, ALIGNMENT, EC_FORMAT_BITS, EC_LEVELS, MAX_VERSION,
    GF_EXP, GF_LOG, gfMul, rsGeneratorPoly, rsRemainder, interleaveCodewords,
    dataCodewordCount, charCountBits, utf8Bytes, encodeCodewords, buildMatrix, initQrcode
  };
}
