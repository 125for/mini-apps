'use strict';

const {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, relativeLuminance, contrastRatio, contrastBadge
} = require('../apps/color/color.js');

module.exports = (t) => {
  t.test('hexToRgb 支持三种写法并拒绝非法', (a) => {
    a.deepEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
    a.deepEqual(hexToRgb('abc'), { r: 170, g: 187, b: 204 });
    a.deepEqual(hexToRgb('#ABCDEF'), { r: 171, g: 205, b: 239 });
    a.equal(hexToRgb('#12345'), null);
    a.equal(hexToRgb('#zzzzzz'), null);
    a.equal(hexToRgb('#12345g'), null);
    a.equal(hexToRgb(''), null);
    a.equal(hexToRgb(null), null);
  });

  t.test('rgbToHex 规范化与越界夹取', (a) => {
    a.equal(rgbToHex(255, 0, 0), '#ff0000');
    a.equal(rgbToHex(0, 128, 255), '#0080ff');
    a.equal(rgbToHex(300, -5, 12.6), '#ff000d', '越界值应夹取到 0-255');
  });

  t.test('RGB ↔ HSL 已知值与往返', (a) => {
    a.deepEqual(rgbToHsl(255, 0, 0), { h: 0, s: 100, l: 50 });
    a.deepEqual(rgbToHsl(0, 0, 255), { h: 240, s: 100, l: 50 });
    a.deepEqual(rgbToHsl(128, 128, 128), { h: 0, s: 0, l: 50 });
    a.deepEqual(hslToRgb(0, 100, 50), { r: 255, g: 0, b: 0 });
    a.deepEqual(hslToRgb(120, 100, 25), { r: 0, g: 128, b: 0 });
    a.deepEqual(hslToRgb(210, 100, 50), { r: 0, g: 128, b: 255 });
    a.deepEqual(hslToRgb(390, 50, 50), hslToRgb(30, 50, 50), '色相应按 360 取模');
    for (const rgb of [{ r: 12, g: 200, b: 77 }, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 90, g: 100, b: 110 }]) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const back = hslToRgb(hsl.h, hsl.s, hsl.l);
      a.ok(
        Math.abs(back.r - rgb.r) <= 3 && Math.abs(back.g - rgb.g) <= 3 && Math.abs(back.b - rgb.b) <= 3,
        '整数 HSL 往返误差应在 3 以内'
      );
    }
  });

  t.test('相对亮度与对比度（WCAG 公式）', (a) => {
    a.ok(Math.abs(relativeLuminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-9);
    a.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
    a.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 1e-9);
    a.ok(Math.abs(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 }) - 1) < 1e-9);
    const gray = hexToRgb('#808080');
    a.ok(Math.abs(contrastRatio(gray, { r: 255, g: 255, b: 255 }) - 3.95) < 0.02, '中灰对白约 3.95');
  });

  t.test('对比度评级', (a) => {
    a.equal(contrastBadge(7).label, 'AAA');
    a.equal(contrastBadge(4.5).label, 'AA');
    a.equal(contrastBadge(3).label, 'AA 大字');
    a.equal(contrastBadge(2.9).label, '不达标');
  });
};
