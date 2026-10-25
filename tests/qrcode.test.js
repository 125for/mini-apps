'use strict';

const {
  EC_BLOCKS, EC_FORMAT_BITS, charCountBits, utf8Bytes, gfMul, GF_EXP,
  rsRemainder, interleaveCodewords, encodeCodewords, buildMatrix
} = require('../apps/qrcode/qrcode.js');

/* 标准教程的版本 5-Q 例题：62 个数据码字 + 72 个纠错码字，已交错（ISO/IEC 18004 示例） */
const GOLDEN_V5Q = [
  67, 246, 182, 70, 85, 246, 230, 247, 70, 66, 247, 118, 134, 7, 119, 86,
  87, 118, 50, 194, 38, 134, 7, 6, 85, 242, 118, 151, 194, 7, 134, 50,
  119, 38, 87, 224, 50, 86, 38, 236, 6, 22, 82, 17, 18, 198, 6, 236, 6,
  199, 134, 17, 103, 146, 151, 236, 38, 6, 50, 17, 7, 236, 213, 87, 148,
  140, 199, 204, 116, 100, 11, 96, 177, 250, 45, 60, 212, 247, 115, 202, 76,
  108, 247, 182, 133, 131, 241, 124, 75, 37, 223, 157, 242, 104, 229, 200, 238,
  253, 248, 134, 76, 113, 154, 27, 195, 111, 117, 129, 230, 235, 154, 209, 189,
  197, 111, 17, 10, 83, 86, 163, 108, 6, 161, 163, 240, 205, 111, 120, 192,
  89, 39, 133, 141, 74
];

module.exports = (t) => {
  /* ---------- 金标准校验（外部规范数据） ---------- */

  function deinterleaveGolden() {
    const SIZES = [15, 15, 16, 16];
    const dataBlocks = [[], [], [], []];
    const ecBlocks = [[], [], [], []];
    let p = 0;
    for (let i = 0; i < 16; i++) {
      for (let b = 0; b < 4; b++) {
        if (i < SIZES[b]) dataBlocks[b].push(GOLDEN_V5Q[p++]);
      }
    }
    for (let i = 0; i < 18; i++) {
      for (let b = 0; b < 4; b++) ecBlocks[b].push(GOLDEN_V5Q[p++]);
    }
    return { dataBlocks: dataBlocks, ecBlocks: ecBlocks };
  }

  t.test('金标准：反交错还原 5-Q 四块结构', (a) => {
    a.equal(GOLDEN_V5Q.length, 134);
    const g = deinterleaveGolden();
    a.deepEqual(g.dataBlocks.map((b) => b.length), [15, 15, 16, 16]);
    a.deepEqual(g.ecBlocks.map((b) => b.length), [18, 18, 18, 18]);
    a.equal(g.dataBlocks[0][0], 67);
    a.equal(g.ecBlocks[0][0], 213);
    a.equal(g.ecBlocks[0][1], 199);
  });

  t.test('金标准：Reed-Solomon 逐块复现纠错码字', (a) => {
    const g = deinterleaveGolden();
    for (let b = 0; b < 4; b++) {
      a.deepEqual(rsRemainder(g.dataBlocks[b], 18), g.ecBlocks[b], '第 ' + (b + 1) + ' 块');
    }
  });

  t.test('金标准：交错序列完整复现', (a) => {
    const g = deinterleaveGolden();
    a.deepEqual(interleaveCodewords(g.dataBlocks, g.ecBlocks), GOLDEN_V5Q);
  });

  /* ---------- 码表与基础编码 ---------- */

  t.test('纠错块表与各版本总码字数一致', (a) => {
    const TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };
    for (const v of Object.keys(TOTAL)) {
      for (const level of ['L', 'M', 'Q', 'H']) {
        const spec = EC_BLOCKS[v][level];
        let data = 0;
        let blocks = 0;
        for (const pair of spec[1]) {
          blocks += pair[0];
          data += pair[0] * pair[1];
        }
        a.equal(data + blocks * spec[0], TOTAL[v], '版本 ' + v + ' 级别 ' + level);
      }
    }
    a.equal(charCountBits(9), 8);
    a.equal(charCountBits(10), 16);
    a.equal(utf8Bytes('你好').length, 6);
  });

  t.test('版本自动选择与容量上限', (a) => {
    a.equal(encodeCodewords('A', 'L').version, 1);
    a.equal(encodeCodewords('x'.repeat(17), 'L').version, 1, 'v1-L 容量 17 字节');
    a.equal(encodeCodewords('x'.repeat(18), 'L').version, 2);
    a.equal(encodeCodewords('x'.repeat(271), 'L').version, 10, 'v10-L 容量 271 字节');
    a.equal(encodeCodewords('x'.repeat(272), 'L'), null);
    a.equal(encodeCodewords('x'.repeat(213), 'M').version, 10, 'v10-M 容量 213 字节');
    a.equal(encodeCodewords('x'.repeat(214), 'M'), null);
    a.equal(encodeCodewords('hello', 'X'), null, '非法纠错级别');
  });

  /* ---------- 矩阵结构 ---------- */

  t.test('功能图案：定位、分隔、时序、暗模块', (a) => {
    const r = buildMatrix('A', 'M');
    a.equal(r.version, 1);
    a.equal(r.size, 21);
    const corners = [[0, 0], [0, r.size - 7], [r.size - 7, 0]];
    for (const corner of corners) {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          a.equal(
            r.modules[corner[0] + dy][corner[1] + dx],
            dist !== 2 && dist !== 4,
            '定位图案 (' + corner[1] + ',' + corner[0] + ') 内部'
          );
        }
      }
    }
    a.equal(r.modules[7][0], false, '分隔区');
    a.equal(r.modules[0][7], false, '分隔区');
    a.equal(r.modules[6][8], true, '水平时序起始为暗');
    a.equal(r.modules[6][9], false);
    a.equal(r.modules[6][10], true);
    a.equal(r.modules[8][6], true, '垂直时序');
    a.equal(r.modules[9][6], false);
    a.equal(r.modules[r.size - 8][8], true, '固定暗模块');
  });

  t.test('对位图案与版本信息区', (a) => {
    const v5 = buildMatrix('x'.repeat(80), 'L');
    a.equal(v5.version, 5);
    a.equal(v5.modules[30][30], true, 'v5 中心对位图案中心为暗');
    a.equal(v5.modules[30][29], false, '对位图案内环为亮');
    a.equal(v5.modules[30][28], true, '对位图案外环为暗');

    const v1 = buildMatrix('A', 'M');
    a.equal(v1.isFunc[0][v1.size - 11], false, 'v1 无版本信息区');
    const v7 = buildMatrix('x'.repeat(154), 'L');
    a.equal(v7.version, 7);
    a.equal(v7.isFunc[0][v7.size - 11], true, 'v7 有版本信息区');
    a.equal(v7.isFunc[v7.size - 11][0], true, 'v7 左下版本信息区');
  });

  t.test('格式信息：两份一致、BCH 校验、级别与掩码正确', (a) => {
    const r = buildMatrix('HELLO WORLD', 'M');
    function readCopy1() {
      const b = [];
      for (let i = 0; i <= 5; i++) b.push(r.modules[i][8] ? 1 : 0);
      b.push(r.modules[7][8] ? 1 : 0);
      b.push(r.modules[8][8] ? 1 : 0);
      b.push(r.modules[8][7] ? 1 : 0);
      for (let i = 9; i < 15; i++) b.push(r.modules[8][14 - i] ? 1 : 0);
      let v = 0;
      for (let i = 0; i < 15; i++) v |= b[i] << i;
      return v ^ 0x5412;
    }
    function readCopy2() {
      const b = [];
      for (let i = 0; i < 8; i++) b.push(r.modules[8][r.size - 1 - i] ? 1 : 0);
      for (let i = 8; i < 15; i++) b.push(r.modules[r.size - 15 + i][8] ? 1 : 0);
      let v = 0;
      for (let i = 0; i < 15; i++) v |= b[i] << i;
      return v ^ 0x5412;
    }
    const f1 = readCopy1();
    const f2 = readCopy2();
    a.equal(f1, f2, '两份格式信息一致');
    const data = f1 >>> 10;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    a.equal((data << 10) | rem, f1, 'BCH(15,5) 校验通过');
    a.equal(data >>> 3, EC_FORMAT_BITS.M, '纠错级别指示');
    a.equal(data & 7, r.mask, '掩码编号');
  });

  /* ---------- 独立读取链（不复用编码器内部逻辑） ---------- */

  t.test('独立之字形读取 + 解掩码 → 码字一致', (a) => {
    function maskBitLocal(mask, x, y) {
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
    function extract(res) {
      const size = res.size;
      const bits = [];
      const total = res.codewords.length * 8;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5; /* 与编码器一致：跳过第 6 列的突变 */
        for (let vert = 0; vert < size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = ((right + 1) & 2) === 0;
            const y = upward ? size - 1 - vert : vert;
            if (!res.isFunc[y][x] && bits.length < total) {
              let bit = res.modules[y][x] ? 1 : 0;
              if (maskBitLocal(res.mask, x, y)) bit ^= 1;
              bits.push(bit);
            }
          }
        }
      }
      const bytes = [];
      for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
        bytes.push(v);
      }
      return bytes;
    }
    const cases = [
      ['A', 'M'],
      ['HELLO WORLD', 'Q'],
      ['x'.repeat(80), 'M'],
      ['x'.repeat(154), 'L'],
      ['x'.repeat(271), 'L']
    ];
    for (const c of cases) {
      const res = buildMatrix(c[0], c[1]);
      a.ok(res, '应能编码');
      a.deepEqual(extract(res), res.codewords, '版本 ' + res.version + ' @ ' + c[1] + ' 之字形读取复现');
    }
  });

  t.test('伴随式校验：全部纠错码字在 GF(256) 下归零', (a) => {
    function syndromesZero(codewords, version, level) {
      const spec = EC_BLOCKS[version][level];
      const ecPer = spec[0];
      const sizes = [];
      for (const pair of spec[1]) {
        for (let b = 0; b < pair[0]; b++) sizes.push(pair[1]);
      }
      const dataBlocks = sizes.map(() => []);
      const ecBlocks = sizes.map(() => []);
      let p = 0;
      const maxD = Math.max.apply(null, sizes);
      for (let i = 0; i < maxD; i++) {
        for (let b = 0; b < sizes.length; b++) {
          if (i < sizes[b]) dataBlocks[b].push(codewords[p++]);
        }
      }
      for (let i = 0; i < ecPer; i++) {
        for (let b = 0; b < sizes.length; b++) ecBlocks[b].push(codewords[p++]);
      }
      for (let b = 0; b < sizes.length; b++) {
        const cw = dataBlocks[b].concat(ecBlocks[b]);
        const n = cw.length;
        for (let i = 0; i < ecPer; i++) {
          let s = 0;
          for (let j = 0; j < n; j++) {
            if (cw[j] !== 0) s ^= gfMul(cw[j], GF_EXP[(i * (n - 1 - j)) % 255]);
          }
          if (s !== 0) return false;
        }
      }
      return true;
    }
    const cases = [
      ['HELLO WORLD', 'M'],
      ['你好，世界 🌏', 'Q'],
      ['x'.repeat(80), 'M'],
      ['x'.repeat(154), 'L'],
      ['x'.repeat(213), 'M'],
      ['https://125for.github.io/mini-apps/', 'H']
    ];
    for (const c of cases) {
      const enc = encodeCodewords(c[0], c[1]);
      a.ok(syndromesZero(enc.codewords, enc.version, enc.level), c[0].slice(0, 10) + ' @ ' + c[1] + ' v' + enc.version);
    }
  });

  t.test('往返解码：单块版本的文本完整还原', (a) => {
    function decodeText(enc) {
      const bits = [];
      for (const cw of enc.codewords) {
        for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
      }
      let p = 0;
      function read(n) {
        let v = 0;
        for (let i = 0; i < n; i++) v = (v << 1) | bits[p++];
        return v;
      }
      const mode = read(4);
      if (mode !== 4) return null;
      const count = read(charCountBits(enc.version));
      const bytes = [];
      for (let i = 0; i < count; i++) bytes.push(read(8));
      return new TextDecoder().decode(new Uint8Array(bytes));
    }
    const texts = ['A', 'HELLO WORLD', '你好，世界 🌏', 'https://125for.github.io/mini-apps/'];
    for (const text of texts) {
      for (const level of ['L', 'M', 'Q', 'H']) {
        const enc = encodeCodewords(text, level);
        a.ok(enc);
        if (enc.dataBlocks.length === 1) {
          a.equal(decodeText(enc), text, JSON.stringify(text.slice(0, 10)) + ' @ ' + level);
        }
      }
    }
  });
};
