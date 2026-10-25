'use strict';

const { CATEGORIES, convert, formatNumber } = require('../apps/convert/convert.js');

module.exports = (t) => {
  t.test('涵盖七大类、单位定义齐全', (a) => {
    const keys = Object.keys(CATEGORIES);
    a.ok(keys.length >= 7);
    a.equal(CATEGORIES.length.units.mile.factor, 1609.344);
    a.equal(CATEGORIES.data.units.mib.factor, 1048576);
    a.equal(CATEGORIES.temperature.special, true);
    a.ok(CATEGORIES.area.units.mu.factor > 666 && CATEGORIES.area.units.mu.factor < 667);
  });

  t.test('长度与重量换算', (a) => {
    a.equal(convert('length', 1, 'm', 'cm'), 100);
    a.ok(Math.abs(convert('length', 12, 'in', 'ft') - 1) < 1e-12, '12 英寸 = 1 英尺');
    a.equal(convert('length', 1, 'mile', 'm'), 1609.344);
    a.ok(Math.abs(convert('mass', 1, 'kg', 'lb') - 2.2046226218487757) < 1e-9);
    a.equal(convert('mass', 16, 'oz', 'lb'), 1, '16 盎司 = 1 磅');
  });

  t.test('面积（含亩）、体积、速度', (a) => {
    a.equal(convert('area', 1, 'ha', 'm2'), 10000);
    a.ok(Math.abs(convert('area', 2000, 'm2', 'mu') - 3) < 1e-9, '2000 平方米 = 3 亩');
    a.equal(convert('volume', 1, 'gal', 'l'), 3.785411784);
    a.ok(Math.abs(convert('speed', 3.6, 'kmh', 'ms') - 1) < 1e-12);
    a.ok(Math.abs(convert('speed', 1, 'kn', 'kmh') - 1.852) < 1e-9);
  });

  t.test('温度换算（含偏移的非线性换算）', (a) => {
    a.equal(convert('temperature', 0, 'c', 'f'), 32);
    a.equal(convert('temperature', 100, 'c', 'f'), 212);
    a.equal(convert('temperature', -40, 'f', 'c'), -40, '-40 两种温标相等');
    a.equal(convert('temperature', 0, 'c', 'k'), 273.15);
    a.ok(Math.abs(convert('temperature', 100, 'k', 'c') + 173.15) < 1e-9);
    a.ok(Math.abs(convert('temperature', 300, 'k', 'f') - 80.33) < 1e-9);
  });

  t.test('数据存储（1000 与 1024 进制并存）', (a) => {
    a.equal(convert('data', 1, 'mib', 'b'), 1048576);
    a.equal(convert('data', 1, 'mb', 'b'), 1000000);
    a.equal(convert('data', 1, 'gib', 'mib'), 1024);
  });

  t.test('非法输入返回 null', (a) => {
    a.equal(convert('nope', 1, 'm', 'cm'), null);
    a.equal(convert('length', NaN, 'm', 'cm'), null);
    a.equal(convert('length', Infinity, 'm', 'cm'), null);
    a.equal(convert('length', 1, 'xx', 'cm'), null);
    a.equal(convert('length', 1, 'm', 'yy'), null);
  });

  t.test('formatNumber 消除浮点噪声', (a) => {
    a.equal(formatNumber(0.30000000000000004), '0.3');
    a.equal(formatNumber(3.280839895013123), '3.28083989501');
    a.equal(formatNumber(100), '100');
    a.equal(formatNumber(0), '0');
    a.equal(formatNumber(-2.5), '-2.5');
    a.equal(formatNumber(1e21), '1e+21');
    a.equal(formatNumber(1e-10), '1e-10');
    a.equal(formatNumber('x'), '—');
  });
};
