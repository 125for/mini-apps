'use strict';

const {
  MIN_LEN, MAX_LEN, LOWER, UPPER, DIGITS, SYMBOLS,
  buildPool, createByteSource, nextIndex, entropyBits, strengthLabel, generatePassword
} = require('../apps/password/password.js');

module.exports = (t) => {
  t.test('buildPool 组合字符集与易混淆字符排除', (a) => {
    a.equal(buildPool({ lower: true }), LOWER);
    a.equal(buildPool({}), '');
    a.equal(
      buildPool({ lower: true, upper: true, digit: true, symbol: true }).length,
      26 + 26 + 10 + SYMBOLS.length
    );
    a.equal(buildPool({ digit: true, excludeAmbiguous: true }), '23456789');
    const noAmb = buildPool({ lower: true, upper: true, excludeAmbiguous: true });
    a.ok(!noAmb.includes('l') && !noAmb.includes('I') && !noAmb.includes('O'));
    a.equal(noAmb.length, 25 + 24);
  });

  t.test('nextIndex 拒绝采样消除模偏差', (a) => {
    a.equal(nextIndex(createByteSource([4]), 3), 1, '4 % 3 = 1');
    a.equal(nextIndex(createByteSource([255, 4]), 3), 1, '255 越界被拒绝后取下一个');
    a.equal(nextIndex(createByteSource([255]), 3), null, '字节耗尽返回 null');
    a.equal(nextIndex(createByteSource([6]), 6), 0, '整除边界');
    a.equal(nextIndex(createByteSource([]), 10), null);
  });

  t.test('entropyBits 与 strengthLabel', (a) => {
    a.ok(Math.abs(entropyBits(16, 62) - 16 * Math.log2(62)) < 1e-9);
    a.equal(entropyBits(16, 0), 0);
    a.equal(entropyBits(0, 62), 0);
    a.equal(strengthLabel(39), '弱');
    a.equal(strengthLabel(40), '一般');
    a.equal(strengthLabel(59), '一般');
    a.equal(strengthLabel(60), '强');
    a.equal(strengthLabel(79), '强');
    a.equal(strengthLabel(80), '极强');
  });

  t.test('generatePassword 确定性输出（注入随机字节）', (a) => {
    a.equal(
      generatePassword({ length: 8, lower: true }, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      'aaaaaaaa'
    );
    a.equal(
      generatePassword({ length: 8, digit: true }, [49, 50, 51, 52, 53, 54, 55, 56, 0, 0, 0, 0, 0, 0, 0]),
      '01234569'
    );
  });

  t.test('generatePassword 非法参数与字节不足返回 null', (a) => {
    a.equal(generatePassword({ length: MIN_LEN - 1, lower: true }, [0, 0, 0, 0]), null, '长度低于下限');
    a.equal(generatePassword({ length: MAX_LEN + 1, lower: true }, new Array(512).fill(0)), null, '长度高于上限');
    a.equal(generatePassword({ length: 16 }, new Array(64).fill(0)), null, '未选择任何字符类');
    a.equal(generatePassword({ length: 8, lower: true }, [0, 0, 0]), null, '随机字节不足');
  });

  t.test('generatePassword 输出满足字符集与每类至少一个', (a) => {
    const opts = { length: 20, lower: true, upper: true, digit: true, symbol: true };
    const bytes = [];
    for (let i = 0; i < 512; i++) bytes.push(i % 251);
    const pwd = generatePassword(opts, bytes);
    a.equal(pwd.length, 20);
    const pool = buildPool(opts);
    for (const ch of pwd) a.ok(pool.includes(ch), '字符必须来自所选字符集: ' + ch);
    a.ok(/[a-z]/.test(pwd), '含小写');
    a.ok(/[A-Z]/.test(pwd), '含大写');
    a.ok(/[0-9]/.test(pwd), '含数字');
    a.ok(/[^a-zA-Z0-9]/.test(pwd), '含符号');
  });
};
