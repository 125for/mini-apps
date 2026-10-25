/* 单位换算 —— 因子表换算（温度为偏移换算）；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

const CATEGORIES = {
  length: {
    name: '长度',
    units: {
      mm: { name: '毫米', symbol: 'mm', factor: 0.001 },
      cm: { name: '厘米', symbol: 'cm', factor: 0.01 },
      m: { name: '米', symbol: 'm', factor: 1 },
      km: { name: '千米', symbol: 'km', factor: 1000 },
      in: { name: '英寸', symbol: 'in', factor: 0.0254 },
      ft: { name: '英尺', symbol: 'ft', factor: 0.3048 },
      yd: { name: '码', symbol: 'yd', factor: 0.9144 },
      mile: { name: '英里', symbol: 'mi', factor: 1609.344 }
    }
  },
  mass: {
    name: '重量',
    units: {
      g: { name: '克', symbol: 'g', factor: 0.001 },
      kg: { name: '千克', symbol: 'kg', factor: 1 },
      t: { name: '吨', symbol: 't', factor: 1000 },
      lb: { name: '磅', symbol: 'lb', factor: 0.45359237 },
      oz: { name: '盎司', symbol: 'oz', factor: 0.028349523125 }
    }
  },
  area: {
    name: '面积',
    units: {
      m2: { name: '平方米', symbol: 'm²', factor: 1 },
      km2: { name: '平方千米', symbol: 'km²', factor: 1000000 },
      ha: { name: '公顷', symbol: 'ha', factor: 10000 },
      mu: { name: '亩', symbol: 'mu', factor: 2000 / 3 },
      ft2: { name: '平方英尺', symbol: 'ft²', factor: 0.09290304 }
    }
  },
  volume: {
    name: '体积',
    units: {
      ml: { name: '毫升', symbol: 'mL', factor: 0.001 },
      l: { name: '升', symbol: 'L', factor: 1 },
      m3: { name: '立方米', symbol: 'm³', factor: 1000 },
      gal: { name: '加仑（美）', symbol: 'gal', factor: 3.785411784 },
      pt: { name: '品脱（美）', symbol: 'pt', factor: 0.473176473 }
    }
  },
  temperature: {
    name: '温度',
    special: true,
    units: {
      c: { name: '摄氏度', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      f: { name: '华氏度', symbol: '°F', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
      k: { name: '开尔文', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 }
    }
  },
  data: {
    name: '数据',
    units: {
      b: { name: '字节', symbol: 'B', factor: 1 },
      kb: { name: '千字节', symbol: 'KB', factor: 1e3 },
      mb: { name: '兆字节', symbol: 'MB', factor: 1e6 },
      gb: { name: '吉字节', symbol: 'GB', factor: 1e9 },
      tb: { name: '太字节', symbol: 'TB', factor: 1e12 },
      kib: { name: '千比字节', symbol: 'KiB', factor: 1024 },
      mib: { name: '兆比字节', symbol: 'MiB', factor: 1048576 },
      gib: { name: '吉比字节', symbol: 'GiB', factor: 1073741824 }
    }
  },
  speed: {
    name: '速度',
    units: {
      ms: { name: '米每秒', symbol: 'm/s', factor: 1 },
      kmh: { name: '千米每小时', symbol: 'km/h', factor: 1 / 3.6 },
      mph: { name: '英里每小时', symbol: 'mph', factor: 0.44704 },
      kn: { name: '节', symbol: 'kn', factor: 1852 / 3600 }
    }
  }
};

const DEFAULT_PAIRS = {
  length: ['m', 'km'],
  mass: ['kg', 'lb'],
  area: ['m2', 'mu'],
  volume: ['l', 'ml'],
  temperature: ['c', 'f'],
  data: ['mb', 'mib'],
  speed: ['kmh', 'ms']
};

/* 数值换算；非法类别/单位/数值返回 null */
function convert(category, value, fromUnit, toUnit) {
  const cat = CATEGORIES[category];
  if (!cat || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const from = cat.units[fromUnit];
  const to = cat.units[toUnit];
  if (!from || !to) return null;
  if (cat.special) {
    const base = from.toBase(value);
    if (typeof base !== 'number' || !Number.isFinite(base)) return null;
    const out = to.fromBase(base);
    return Number.isFinite(out) ? out : null;
  }
  const out = (value * from.factor) / to.factor;
  return Number.isFinite(out) ? out : null;
}

/* 展示用数字：12 位有效数字，去掉浮点噪声与多余的零 */
function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e21 || abs < 1e-9) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(Number(n.toPrecision(12)));
}

/* ---------- 界面 ---------- */

function initConvert(doc) {
  const valueInput = doc.getElementById('valueInput');
  const fromUnit = doc.getElementById('fromUnit');
  const toUnit = doc.getElementById('toUnit');
  const swapBtn = doc.getElementById('swapBtn');
  const resultOutput = doc.getElementById('resultOutput');
  const formulaLine = doc.getElementById('formulaLine');

  let category = 'length';
  const chips = {};
  for (const key of Object.keys(CATEGORIES)) {
    const chip = doc.getElementById('chip-' + key);
    chips[key] = chip;
    chip.addEventListener('click', () => selectCategory(key));
  }

  function fillSelects(key) {
    const units = CATEGORIES[key].units;
    for (const sel of [fromUnit, toUnit]) {
      sel.textContent = '';
      for (const unitKey of Object.keys(units)) {
        const opt = doc.createElement('option');
        opt.value = unitKey;
        opt.textContent = units[unitKey].name + '（' + units[unitKey].symbol + '）';
        sel.appendChild(opt);
      }
    }
    const pair = DEFAULT_PAIRS[key];
    fromUnit.value = pair[0];
    toUnit.value = pair[1];
  }

  function selectCategory(key) {
    if (!CATEGORIES[key]) return;
    category = key;
    for (const k of Object.keys(chips)) {
      chips[k].classList.toggle('active', k === key);
    }
    fillSelects(key);
    update();
  }

  function update() {
    const raw = String(valueInput.value == null ? '' : valueInput.value).trim();
    const num = Number(raw);
    if (!raw || !Number.isFinite(num)) {
      resultOutput.textContent = '—';
      formulaLine.textContent = '';
      return;
    }
    const res = convert(category, num, fromUnit.value, toUnit.value);
    if (res === null) {
      resultOutput.textContent = '—';
      formulaLine.textContent = '';
      return;
    }
    resultOutput.textContent = formatNumber(res);
    const fromU = CATEGORIES[category].units[fromUnit.value];
    const toU = CATEGORIES[category].units[toUnit.value];
    if (fromU && toU) {
      const oneRes = convert(category, 1, fromUnit.value, toUnit.value);
      formulaLine.textContent = '1 ' + fromU.name + ' = ' + formatNumber(oneRes) + ' ' + toU.name;
    }
  }

  swapBtn.addEventListener('click', () => {
    const tmp = fromUnit.value;
    fromUnit.value = toUnit.value;
    toUnit.value = tmp;
    update();
  });

  valueInput.addEventListener('input', update);
  fromUnit.addEventListener('change', update);
  toUnit.addEventListener('change', update);

  selectCategory('length');
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initConvert(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES, DEFAULT_PAIRS, convert, formatNumber, initConvert };
}
