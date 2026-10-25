'use strict';

const { parseJson, sortValue, formatJson, minifyJson, countNodes } = require('../apps/json/json.js');

module.exports = (t) => {
  t.test('parseJson 有效与无效输入', (a) => {
    const ok = parseJson('{"a":1}');
    a.equal(ok.ok, true);
    a.deepEqual(ok.value, { a: 1 });
    a.equal(parseJson('[1, 2, 3]').value.length, 3);

    const bad = parseJson('{bad');
    a.equal(bad.ok, false);
    a.ok(String(bad.error).includes('解析失败'), '错误信息应有统一前缀');

    a.equal(parseJson('').error, '请输入 JSON 内容');
    a.equal(parseJson('   ').error, '请输入 JSON 内容');
    a.equal(parseJson(null).error, '请输入 JSON 内容');
  });

  t.test('sortValue 递归按键名排序', (a) => {
    a.deepEqual(sortValue({ b: 1, a: { d: 3, c: 2 } }), { a: { c: 2, d: 3 }, b: 1 });
    a.deepEqual(sortValue([2, 1]), [2, 1], '数组保持原顺序');
    a.equal(sortValue('x'), 'x');
    a.equal(sortValue(null), null);
  });

  t.test('formatJson 缩进与键排序', (a) => {
    const res = formatJson('{"b":1,"a":2}', {});
    a.equal(res.ok, true);
    a.ok(res.output.includes('\n  "b"'), '默认两空格缩进');
    a.ok(res.output.includes('"a": 2'), '键值对完整保留');

    const sorted = formatJson('{"b":1,"a":2,"c":3}', { sortKeys: true });
    a.ok(sorted.output.indexOf('"a"') < sorted.output.indexOf('"b"'));
    a.ok(sorted.output.indexOf('"b"') < sorted.output.indexOf('"c"'));

    a.equal(formatJson('{"a": 1}', { indent: 0 }).output, '{"a":1}');

    const nested = formatJson('{"z":{"y":2,"x":1}}', { sortKeys: true });
    a.ok(nested.output.indexOf('"x"') < nested.output.indexOf('"y"'), '嵌套对象也排序');

    a.equal(formatJson('{oops', {}).ok, false);
  });

  t.test('minifyJson 压缩', (a) => {
    const res = minifyJson('{"a":  1, "b": [1,  2]}');
    a.equal(res.ok, true);
    a.equal(res.output, '{"a":1,"b":[1,2]}');
    a.equal(minifyJson('oops').ok, false);
  });

  t.test('countNodes 节点统计', (a) => {
    a.equal(countNodes(1), 1);
    a.equal(countNodes(null), 1);
    a.equal(countNodes('x'), 1);
    a.equal(countNodes({}), 1);
    a.equal(countNodes([1, 2]), 3);
    a.equal(countNodes({ a: 1, b: { c: 2 } }), 4);
    a.equal(countNodes([1, [2, [3]]]), 6);
  });
};
