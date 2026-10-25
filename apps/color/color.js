/* 颜色工具 —— HEX/RGB/HSL 互转与 WCAG 对比度；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

/* 支持 #rgb、#rrggbb、rrggbb；非法返回 null */
function hexToRgb(input) {
  let s = String(input == null ? '' : input).trim();
  if (s[0] === '#') s = s.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16)
  };
}

function clamp255(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, n));
}

function rgbToHex(r, g, b) {
  const to2 = (v) => clamp255(v).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

function rgbToHsl(r, g, b) {
  const rr = clamp255(r) / 255;
  const gg = clamp255(g) / 255;
  const bb = clamp255(b) / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
    else if (max === gg) h = ((bb - rr) / d + 2) * 60;
    else h = ((rr - gg) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  const hh = (((Number(h) % 360) + 360) % 360);
  const ss = Math.min(100, Math.max(0, Number(s))) / 100;
  const ll = Math.min(100, Math.max(0, Number(l))) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/* WCAG 相对亮度 */
function relativeLuminance(rgb) {
  function channel(v) {
    const c = clamp255(v) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* 返回 {label, cls}，cls 用于界面徽章着色 */
function contrastBadge(ratio) {
  if (ratio >= 7) return { label: 'AAA', cls: 'aaa' };
  if (ratio >= 4.5) return { label: 'AA', cls: 'aa' };
  if (ratio >= 3) return { label: 'AA 大字', cls: 'aa-large' };
  return { label: '不达标', cls: 'fail' };
}

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

/* ---------- 界面 ---------- */

function initColor(doc) {
  const colorInput = doc.getElementById('colorInput');
  const hexInput = doc.getElementById('hexInput');
  const swatch = doc.getElementById('swatch');
  const rgbLine = doc.getElementById('rgbLine');
  const hslLine = doc.getElementById('hslLine');
  const lumLine = doc.getElementById('lumLine');
  const contrastBlack = doc.getElementById('contrastBlack');
  const contrastWhite = doc.getElementById('contrastWhite');
  const badgeBlack = doc.getElementById('badgeBlack');
  const badgeWhite = doc.getElementById('badgeWhite');

  if (!hexToRgb(colorInput.value)) {
    colorInput.value = '#5b9dff';
  }
  hexInput.value = colorInput.value.toLowerCase();

  function show(rgb) {
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const lum = relativeLuminance(rgb);
    const withBlack = contrastRatio(rgb, BLACK);
    const withWhite = contrastRatio(rgb, WHITE);

    swatch.setAttribute('style', 'background: ' + hex + ';');
    colorInput.value = hex;
    hexInput.value = hex;
    rgbLine.textContent = 'RGB  ' + rgb.r + ', ' + rgb.g + ', ' + rgb.b;
    hslLine.textContent = 'HSL  ' + hsl.h + '°, ' + hsl.s + '%, ' + hsl.l + '%';
    lumLine.textContent = '相对亮度  ' + lum.toFixed(4);

    contrastBlack.textContent = withBlack.toFixed(2) + ' : 1';
    contrastWhite.textContent = withWhite.toFixed(2) + ' : 1';
    const bb = contrastBadge(withBlack);
    badgeBlack.textContent = bb.label;
    badgeBlack.className = 'badge ' + bb.cls;
    const bw = contrastBadge(withWhite);
    badgeWhite.textContent = bw.label;
    badgeWhite.className = 'badge ' + bw.cls;
  }

  colorInput.addEventListener('input', () => {
    const rgb = hexToRgb(colorInput.value);
    if (rgb) show(rgb);
  });

  hexInput.addEventListener('input', () => {
    const rgb = hexToRgb(hexInput.value);
    if (rgb) show(rgb);
  });

  show(hexToRgb(colorInput.value));
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initColor(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hexToRgb, clamp255, rgbToHex, rgbToHsl, hslToRgb,
    relativeLuminance, contrastRatio, contrastBadge, BLACK, WHITE, initColor
  };
}
