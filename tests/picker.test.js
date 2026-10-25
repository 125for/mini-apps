'use strict';

const {
  parseOptions, createByteSource, nextIndex, pickOption, shuffleOptions, removeOption
} = require('../apps/picker/picker.js');

module.exports = (t) => {
  t.test('parseOptions 按行解析、去重、过滤', (a) => {
    a.deepEqual(parseOptions(' 火锅 \n\n烤肉\n火锅\n  '), ['火锅', '烤肉']);
    a.deepEqual(parseOptions(''), []);
    a.deepEqual(parseOptions(null), []);
    a.equal(parseOptions('x'.repeat(51)).length, 0, '超长行忽略');
    const many = [];
    for (let i = 0; i < 105; i++) many.push('选项' + i);
    a.equal(parseOptions(many.join('\n')).length, 100, '最多 100 个');
  });

  t.test('nextIndex 拒绝采样', (a) => {
    a.equal(nextIndex(createByteSource([4]), 3), 1);
    a.equal(nextIndex(createByteSource([255, 2]), 3), 2, '越界字节被拒绝后取下一个');
    a.equal(nextIndex(createByteSource([255]), 3), null, '字节耗尽返回 null');
  });

  t.test('pickOption 注入字节的确定性抽取', (a) => {
    a.equal(pickOption(['a', 'b', 'c'], [0]), 'a');
    a.equal(pickOption(['a', 'b', 'c'], [2]), 'c');
    a.equal(pickOption(['a', 'b', 'c'], [255, 1]), 'b');
    a.equal(pickOption([], [0]), null);
    a.equal(pickOption(['a', 'b'], []), null, '字节不足返回 null');
  });

  t.test('shuffleOptions 是排列且确定性', (a) => {
    a.deepEqual(shuffleOptions(['a', 'b', 'c'], [0, 0, 0]), ['b', 'c', 'a']);
    const shuffled = shuffleOptions(['a', 'b', 'c', 'd', 'e'], [7, 3, 250, 1, 9, 4, 0, 2]);
    a.deepEqual(shuffled.slice().sort(), ['a', 'b', 'c', 'd', 'e'].slice().sort(), '洗牌后仍是同一批元素');
    a.equal(shuffled.length, 5);
    a.equal(shuffleOptions([], [0]), null);
    a.deepEqual(shuffleOptions(['only'], [0]), ['only']);
    a.equal(shuffleOptions(['a', 'b'], []), null, '字节不足返回 null');
    a.deepEqual(removeOption(['a', 'b', 'a'], 'a'), ['b']);
  });
};
