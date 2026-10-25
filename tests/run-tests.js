/* 极简测试运行器：node tests/run-tests.js
 * 自动发现并运行 tests/*.test.js；失败时以非零码退出。
 * 全程纯 Node，无界面弹窗、无网络访问。 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const A = assert.strict;
const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

if (files.length === 0) {
  console.error('未找到任何测试文件');
  process.exitCode = 1;
}

let passed = 0;
const failures = [];

for (const file of files) {
  const suite = require(path.join(dir, file));
  const label = file.replace(/\.test\.js$/, '');
  suite({
    test(name, fn) {
      try {
        fn(A);
        passed += 1;
        console.log('  ok   ' + label + ' - ' + name);
      } catch (err) {
        failures.push(label + ' - ' + name + ': ' + err.message);
        console.log('  FAIL ' + label + ' - ' + name);
        console.log('       ' + String(err.message).split('\n')[0]);
      }
    }
  });
}

console.log('');
if (failures.length > 0) {
  console.log('FAILED: ' + failures.length + ' 个用例失败（通过 ' + passed + ' 个）');
  for (const f of failures) console.log('  - ' + f);
  process.exitCode = 1;
} else {
  console.log('PASSED: 全部 ' + passed + ' 个用例通过');
}
