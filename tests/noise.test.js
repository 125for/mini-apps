'use strict';

const {
  NOISE_TYPES, clampVolume, gainValue, generateNoise, timerEndsAt, remainingLabel
} = require('../apps/noise/noise.js');

module.exports = (t) => {
  t.test('clampVolume / gainValue 感知音量曲线', (a) => {
    a.equal(clampVolume(0.5), 0.5);
    a.equal(clampVolume(-1), 0);
    a.equal(clampVolume(2), 1);
    a.equal(clampVolume('x'), 1, '非法值回退为满音量');
    a.equal(gainValue(0), 0);
    a.equal(gainValue(1), 1);
    a.equal(gainValue(0.5), 0.25, '平方曲线');
  });

  t.test('generateNoise 各类型样本有限且有界 [-1,1]', (a) => {
    const rng = () => 0.73;
    for (const type of Object.keys(NOISE_TYPES)) {
      const data = generateNoise(type, 0.01, 44100, rng);
      a.equal(data.length, 441, type + ' 样本数应为采样率×秒数');
      for (const v of data) {
        a.ok(Number.isFinite(v), type + ' 样本应有限');
        a.ok(v >= -1 && v <= 1, type + ' 样本应夹幅到 [-1,1]');
      }
    }
    a.equal(generateNoise('nope', 1, 44100, rng), null, '未知类型返回 null');
    a.equal(generateNoise('white', 0.5, 8000, () => 0.5).length, 4000, '自定义采样率与时长');
  });

  t.test('同一种子下不同类型波形不同', (a) => {
    const rng = () => 0.73;
    const white = generateNoise('white', 0.01, 44100, rng);
    const pink = generateNoise('pink', 0.01, 44100, rng);
    const brown = generateNoise('brown', 0.01, 44100, rng);
    a.ok(white[100] !== pink[100], '白与粉不同');
    a.ok(pink[100] !== brown[100], '粉与棕不同');
  });

  t.test('海浪包含缓慢的包络起伏', (a) => {
    const waves = generateNoise('waves', 2, 1000, () => 0.73);
    a.equal(waves.length, 2000);
    a.ok(Math.abs(waves[0] - waves[1999]) > 0.01, '首尾包络应有差异');
  });

  t.test('timerEndsAt / remainingLabel', (a) => {
    a.equal(timerEndsAt(15, 1000), 901000);
    a.equal(timerEndsAt(0, 1000), null, '0 表示不定时');
    a.equal(timerEndsAt(-5, 1000), null);
    a.equal(timerEndsAt('x', 1000), null);
    a.equal(remainingLabel(900000), '15:00');
    a.equal(remainingLabel(59000), '00:59');
    a.equal(remainingLabel(1), '00:01');
    a.equal(remainingLabel(0), '00:00');
    a.equal(remainingLabel(-5), '00:00');
    a.equal(remainingLabel('x'), '00:00');
  });
};
