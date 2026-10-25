/* 界面冒烟测试：用模拟 DOM 驱动真实的 init 函数，验证绑定、交互与持久化 */
'use strict';

const fs = require('fs');
const path = require('path');
const clock = require('../apps/clock/clock.js');
const todo = require('../apps/todo/todo.js');
const journal = require('../apps/journal/journal.js');
const { fakeDom, fakeStorage } = require('./helpers');

module.exports = (t) => {
  t.test('HTML 中的元素 id 与 JS 引用一一对应', (a) => {
    const appsDir = path.join(__dirname, '..', 'apps');
    for (const app of fs.readdirSync(appsDir)) {
      const dir = path.join(appsDir, app);
      if (!fs.statSync(dir).isDirectory()) continue;
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (m) => m[1]));
      a.ok(ids.size >= 4, app + ' 的 index.html 应包含若干元素 id');

      let referenced = 0;
      for (const jsFile of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(dir, jsFile), 'utf8');
        for (const m of src.matchAll(/getElementById\('([^']+)'\)/g)) {
          referenced += 1;
          a.ok(ids.has(m[1]), app + '/' + jsFile + ' 引用了 index.html 中不存在的 #' + m[1]);
        }
      }
      a.ok(referenced > 0, app + ' 应通过 getElementById 绑定界面');
      a.ok(
        html.includes('<script src="' + app + '.js" defer>'),
        app + ' 的 index.html 应引入 ' + app + '.js'
      );
    }
  });

  t.test('桌面时钟：初始化、刻度、制式与主题切换', (a) => {
    const realSetInterval = global.setInterval;
    global.setInterval = () => 0; /* 阻止定时器挂起测试进程 */
    try {
      const { doc, ids } = fakeDom();
      const store = fakeStorage();
      clock.initClock(doc, store);

      const digital = ids.get('digital');
      a.ok(/^\d{2}:\d{2}:\d{2}$/.test(digital.textContent), '数字时间格式应为 HH:mm:ss，实际: ' + digital.textContent);
      a.ok(/\d{4} 年 \d{1,2} 月 \d{1,2} 日 周[一二三四五六日]/.test(ids.get('dateLine').textContent), '日期应含中文年月日与星期');
      a.equal(ids.get('ticks').children.length, 12, '表盘应有 12 个刻度');

      ids.get('toggle24h').dispatch('click');
      a.ok(/(AM|PM)/.test(digital.textContent), '切换后应为 12 小时制，实际: ' + digital.textContent);
      a.equal(JSON.parse(store._data['clock.prefs.v1']).use24h, false, '偏好应已持久化');

      a.equal(doc.documentElement.attrs['data-theme'], 'dark', '默认深色');
      ids.get('toggleTheme').dispatch('click');
      a.equal(doc.documentElement.attrs['data-theme'], 'light', '点击后应切换为浅色');
      a.equal(JSON.parse(store._data['clock.prefs.v1']).theme, 'light');

      ids.get('toggleSeconds').dispatch('click');
      a.ok(/^\d{2}:\d{2}( AM| PM)?$/.test(digital.textContent), '隐藏秒后格式应为 HH:mm，实际: ' + digital.textContent);
    } finally {
      global.setInterval = realSetInterval;
    }
  });

  t.test('待办清单：添加、XSS 输入按纯文本渲染、完成、删除、筛选', (a) => {
    const { doc, ids } = fakeDom();
    const store = fakeStorage();
    todo.initTodo(doc, store);

    const input = ids.get('todoInput');
    const form = ids.get('todoForm');
    const list = ids.get('todoList');

    input.value = '  买牛奶  ';
    form.dispatch('submit', { preventDefault() {} });
    let saved = JSON.parse(store._data['todo.tasks.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].text, '买牛奶');

    const li = list.children[0];
    a.equal(li.tagName, 'LI');
    a.equal(li.children[1].textContent, '买牛奶');

    /* 恶意输入必须原样作为纯文本渲染 */
    const evil = '<img src=x onerror=alert(1)> <script>bad()</script>';
    input.value = evil;
    form.dispatch('submit', { preventDefault() {} });
    const li2 = list.children[1];
    a.equal(li2.children[1].textContent, evil, '输入应按纯文本保存');
    a.equal(li2.children.length, 3, '结构应为 checkbox + 文本 + 删除按钮');

    /* 完成：勾选第一条 */
    li.children[0].dispatch('change', {});
    saved = JSON.parse(store._data['todo.tasks.v1']);
    a.equal(saved[0].done, true);
    a.equal(list.children[0].className.includes('done'), true, '完成项应有 done 样式类');

    /* 删除第一条（已完成的买牛奶） */
    list.children[0].children[2].dispatch('click', {});
    saved = JSON.parse(store._data['todo.tasks.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].text, evil);

    /* 筛选：未完成的恶意文本条目在"已完成"下不可见 */
    ids.get('filterDone').dispatch('click', {});
    a.equal(list.children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);
    ids.get('filterActive').dispatch('click', {});
    a.equal(list.children.length, 1);
    a.ok(ids.get('counter').textContent.includes('1'), '计数应提示还剩 1 件');
  });

  t.test('极简日志：写入、分组展示、搜索、删除', (a) => {
    const { doc, ids } = fakeDom();
    const store = fakeStorage();
    journal.initJournal(doc, store);

    a.equal(ids.get('entries').children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);

    ids.get('entryText').value = '  今天完成了一件小事  ';
    ids.get('entryForm').dispatch('submit', { preventDefault() {} });
    const saved = JSON.parse(store._data['journal.entries.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].text, '今天完成了一件小事');
    a.equal(ids.get('entryText').value, '', '保存后应清空输入框');

    const section = ids.get('entries').children[0];
    a.equal(section.children[0].textContent, '今天', '分组标题应为今天');
    const entry = section.children[1];
    a.equal(entry.children[1].textContent, '今天完成了一件小事');
    a.ok(/^\d{2}:\d{2}$/.test(entry.children[0].textContent), '条目应显示 HH:mm 时间');

    /* 搜索 */
    const search = ids.get('searchInput');
    search.value = '不存在的内容';
    search.dispatch('input', {});
    a.equal(ids.get('entries').children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);

    search.value = '小事';
    search.dispatch('input', {});
    a.equal(ids.get('entries').children.length, 1);

    /* 删除 */
    ids.get('entries').children[0].children[1].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['journal.entries.v1']).length, 0);
    a.equal(ids.get('entries').children.length, 0);
  });
};
