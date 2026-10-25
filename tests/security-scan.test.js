/* 静态安全扫描：检查源码中不存在危险 API 与不安全的 HTML 用法 */
'use strict';

const fs = require('fs');
const path = require('path');
const { listFiles } = require('./helpers');

const ROOT = path.join(__dirname, '..');

module.exports = (t) => {
  const jsFiles = listFiles(path.join(ROOT, 'apps')).filter((f) => f.endsWith('.js'));
  const htmlFiles = listFiles(ROOT).filter((f) => f.endsWith('.html'));

  t.test('扫描范围覆盖全部应用源码', (a) => {
    a.ok(jsFiles.length >= 3, '应至少包含三个应用的 JS 文件');
    a.ok(htmlFiles.length >= 4, '应包含首页与三个应用页');
  });

  t.test('JS 不使用 HTML 注入与动态执行等危险 API', (a) => {
    const banned = [
      [/\binnerHTML\b/, 'innerHTML'],
      [/\bouterHTML\b/, 'outerHTML'],
      [/\binsertAdjacentHTML\b/, 'insertAdjacentHTML'],
      [/\bdocument\.write\b/, 'document.write'],
      [/\beval\s*\(/, 'eval'],
      [/\bnew\s+Function\b/, 'new Function'],
      [/\bfetch\s*\(/, 'fetch（本项目不应有网络请求）'],
      [/\bXMLHttpRequest\b/, 'XMLHttpRequest（本项目不应有网络请求）'],
      [/\bWebSocket\b/, 'WebSocket（本项目不应有网络请求）']
    ];
    for (const file of jsFiles) {
      const src = fs.readFileSync(file, 'utf8');
      for (const [re, name] of banned) {
        a.ok(!re.test(src), path.relative(ROOT, file) + ' 不应使用 ' + name);
      }
    }
  });

  t.test('HTML 无内联事件、javascript: 链接与内联脚本', (a) => {
    for (const file of htmlFiles) {
      const src = fs.readFileSync(file, 'utf8');
      const rel = path.relative(ROOT, file);
      a.ok(!/\son[a-z]+\s*=/i.test(src), rel + ' 不应包含内联事件处理器');
      a.ok(!/javascript\s*:/i.test(src), rel + ' 不应包含 javascript: 链接');
      a.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(src), rel + ' 不应包含无 src 的内联 script');
      a.ok(/<meta\s+charset=["']?utf-8["']?/i.test(src), rel + ' 应声明 utf-8 编码');
    }
  });

  t.test('不存在遗留的敏感文件或依赖清单', (a) => {
    const all = listFiles(ROOT).map((f) => path.relative(ROOT, f));
    for (const rel of all) {
      a.ok(!/(^|[\\/])node_modules([\\/]|$)/.test(rel), '不应包含 node_modules');
      a.ok(!/\.(env|pem|key|log)$/i.test(rel), '不应包含敏感文件: ' + rel);
      a.ok(!/package(-lock)?\.json$/i.test(rel), '本项目零依赖，不应有 package.json');
    }
  });
};
