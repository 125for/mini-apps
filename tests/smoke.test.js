/* 界面冒烟测试：用模拟 DOM 驱动真实的 init 函数，验证绑定、交互与持久化 */
'use strict';

const fs = require('fs');
const path = require('path');
const clock = require('../apps/clock/clock.js');
const todo = require('../apps/todo/todo.js');
const journal = require('../apps/journal/journal.js');
const pomodoro = require('../apps/pomodoro/pomodoro.js');
const countdown = require('../apps/countdown/countdown.js');
const password = require('../apps/password/password.js');
const habit = require('../apps/habit/habit.js');
const expense = require('../apps/expense/expense.js');
const json = require('../apps/json/json.js');
const convert = require('../apps/convert/convert.js');
const picker = require('../apps/picker/picker.js');
const noise = require('../apps/noise/noise.js');
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
    global.setInterval = () => 0;
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

    li.children[0].dispatch('change', {});
    saved = JSON.parse(store._data['todo.tasks.v1']);
    a.equal(saved[0].done, true);
    a.equal(list.children[0].className.includes('done'), true, '完成项应有 done 样式类');

    list.children[0].children[2].dispatch('click', {});
    saved = JSON.parse(store._data['todo.tasks.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].text, evil);

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

    const search = ids.get('searchInput');
    search.value = '不存在的内容';
    search.dispatch('input', {});
    a.equal(ids.get('entries').children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);

    search.value = '小事';
    search.dispatch('input', {});
    a.equal(ids.get('entries').children.length, 1);

    ids.get('entries').children[0].children[1].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['journal.entries.v1']).length, 0);
    a.equal(ids.get('entries').children.length, 0);
  });

  t.test('番茄钟：初始化、开始/暂停、跳过、重置', (a) => {
    const realSetInterval = global.setInterval;
    global.setInterval = () => 0;
    try {
      const { doc, ids } = fakeDom();
      pomodoro.initPomodoro(doc, fakeStorage());

      a.equal(ids.get('timeText').textContent, '25:00');
      a.equal(ids.get('phaseLabel').textContent, '准备专注');
      a.equal(ids.get('statLine').textContent, '今天已完成 0 个番茄');

      ids.get('toggleBtn').dispatch('click');
      a.equal(ids.get('toggleBtn').textContent, '暂停');
      a.equal(ids.get('phaseLabel').textContent, '专注中');
      a.ok(String(doc.title).includes('25:00'), '标题应包含剩余时间');

      ids.get('toggleBtn').dispatch('click');
      a.equal(ids.get('toggleBtn').textContent, '开始');

      ids.get('skipBtn').dispatch('click');
      a.equal(ids.get('phaseLabel').textContent, '稍事休息');
      a.equal(ids.get('timeText').textContent, '05:00');

      ids.get('resetBtn').dispatch('click');
      a.equal(ids.get('phaseLabel').textContent, '准备专注');
      a.equal(ids.get('timeText').textContent, '25:00');
    } finally {
      global.setInterval = realSetInterval;
    }
  });

  t.test('倒数日：添加、排序渲染、删除', (a) => {
    const { doc, ids } = fakeDom();
    const store = fakeStorage();
    countdown.initCountdown(doc, store);

    a.equal(ids.get('eventList').children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);

    ids.get('titleInput').value = '  出发去旅行  ';
    ids.get('dateInput').value = '2030-01-01';
    ids.get('eventForm').dispatch('submit', { preventDefault() {} });
    const saved = JSON.parse(store._data['countdown.events.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].title, '出发去旅行');

    const li = ids.get('eventList').children[0];
    a.equal(li.children[1].children[0].textContent, '出发去旅行');
    a.ok(/^\d+$/.test(li.children[0].children[0].textContent), '天数应为数字');
    a.ok(li.children[1].children[1].textContent.includes('还有'), '未来事件应显示还有 N 天');

    ids.get('titleInput').value = '已过的日子';
    ids.get('dateInput').value = '2020-01-01';
    ids.get('eventForm').dispatch('submit', { preventDefault() {} });
    a.equal(ids.get('eventList').children.length, 2);
    a.equal(
      ids.get('eventList').children[0].children[1].children[0].textContent,
      '出发去旅行',
      '未来事件应排在过期事件前'
    );

    ids.get('eventList').children[1].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['countdown.events.v1']).length, 1);
  });

  t.test('密码生成器：生成、长度联动、字符集约束', (a) => {
    const { doc, ids } = fakeDom();
    /* 模拟 DOM 不解析 HTML 属性，按 index.html 的默认勾选预设 */
    doc.getElementById('optLower').checked = true;
    doc.getElementById('optUpper').checked = true;
    doc.getElementById('optDigit').checked = true;
    doc.getElementById('optSymbol').checked = true;
    doc.getElementById('optNoAmbiguous').checked = true;
    password.initPassword(doc);
    const out = ids.get('passwordText');

    a.equal(out.textContent.length, 16, '默认长度 16');
    a.ok(/^[0-9a-zA-Z!@#$%^&*()\-_=+\[\]{};:,.?/~]+$/.test(out.textContent), '只包含所选字符');
    a.ok(ids.get('strengthLine').textContent.includes('位熵'), '应显示熵强度');

    ids.get('lengthRange').value = '8';
    ids.get('lengthRange').dispatch('input', {});
    a.equal(ids.get('lenValue').textContent, '8');
    a.equal(out.textContent.length, 8);

    ids.get('optSymbol').checked = false;
    ids.get('generateBtn').dispatch('click', {});
    a.ok(/^[0-9a-zA-Z]+$/.test(out.textContent), '关闭符号后不应含符号');

    ids.get('optLower').checked = false;
    ids.get('optUpper').checked = false;
    ids.get('optDigit').checked = false;
    ids.get('generateBtn').dispatch('click', {});
    a.equal(out.textContent, '请至少选择一种字符类型');
  });

  t.test('习惯打卡：添加、打卡、取消、删除', (a) => {
    const { doc, ids } = fakeDom();
    const store = fakeStorage();
    habit.initHabit(doc, store);

    a.equal(ids.get('habitList').children.length, 0);
    a.equal(ids.get('emptyState').hidden, false);

    ids.get('habitInput').value = '  每天阅读  ';
    ids.get('habitForm').dispatch('submit', { preventDefault() {} });
    const saved = JSON.parse(store._data['habit.habits.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].name, '每天阅读');

    let card = ids.get('habitList').children[0];
    a.equal(card.children[0].children[0].textContent, '每天阅读');
    a.equal(card.children[1].children.length, 35, '应显示最近 35 天打卡格');
    a.ok(card.children[0].children[1].textContent.includes('尚未开始'));

    card.children[0].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['habit.habits.v1'])[0].days.length, 1);
    card = ids.get('habitList').children[0];
    a.equal(card.children[0].children[2].textContent, '已打卡 ✓');
    a.ok(card.children[0].children[1].textContent.includes('连续 1 天'), '打卡后显示连续天数');
    let onCount = 0;
    for (const cell of card.children[1].children) {
      if (String(cell.className).includes(' on')) onCount += 1;
    }
    a.equal(onCount, 1, '打卡格应点亮一格');

    card.children[0].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['habit.habits.v1'])[0].days.length, 0, '再点一次取消打卡');

    card = ids.get('habitList').children[0];
    card.children[0].children[3].dispatch('click', {});
    a.equal(JSON.parse(store._data['habit.habits.v1']).length, 0);
    a.equal(ids.get('emptyState').hidden, false);
  });

  t.test('记账本：收支记录、类型切换、汇总与删除', (a) => {
    const { doc, ids } = fakeDom();
    const store = fakeStorage();
    expense.initExpense(doc, store);

    a.equal(ids.get('sumExpense').textContent, '¥0.00');
    a.ok(ids.get('monthLabel').textContent.includes('10 月'), '默认当前月份');

    ids.get('typeIncome').dispatch('click', {});
    ids.get('amountInput').value = ' 100.5 ';
    ids.get('noteInput').value = ' 工资 ';
    ids.get('entryForm').dispatch('submit', { preventDefault() {} });
    const saved = JSON.parse(store._data['expense.entries.v1']);
    a.equal(saved.length, 1);
    a.equal(saved[0].cents, 10050, '金额以分为单位');
    a.equal(saved[0].type, 'income');
    a.equal(saved[0].note, '工资');
    a.equal(ids.get('sumIncome').textContent, '¥100.50');
    a.ok(ids.get('entryList').children[0].children[1].textContent.includes('+¥100.50'));

    ids.get('typeExpense').dispatch('click', {});
    ids.get('amountInput').value = '0';
    ids.get('entryForm').dispatch('submit', { preventDefault() {} });
    a.equal(JSON.parse(store._data['expense.entries.v1']).length, 1, '非法金额不写入');

    ids.get('amountInput').value = '25.5';
    ids.get('entryForm').dispatch('submit', { preventDefault() {} });
    a.equal(JSON.parse(store._data['expense.entries.v1']).length, 2);
    a.equal(ids.get('sumExpense').textContent, '¥25.50');
    a.equal(ids.get('sumBalance').textContent, '¥75.00');

    ids.get('entryList').children[0].children[2].dispatch('click', {});
    a.equal(JSON.parse(store._data['expense.entries.v1']).length, 1);
  });

  t.test('JSON 工具箱：格式化、键名排序、压缩、错误提示', (a) => {
    const { doc, ids } = fakeDom();
    json.initJson(doc);

    ids.get('jsonInput').value = '{"b":1,"a":2}';
    ids.get('formatBtn').dispatch('click', {});
    a.ok(ids.get('message').textContent.includes('✓'), '合法 JSON 提示有效');
    a.ok(ids.get('jsonOutput').textContent.includes('"b"'));
    a.ok(ids.get('stats').textContent.includes('节点'));

    ids.get('sortKeys').checked = true;
    ids.get('formatBtn').dispatch('click', {});
    const out = ids.get('jsonOutput').textContent;
    a.ok(out.indexOf('"a"') < out.indexOf('"b"'), '键名排序后 a 在前');

    ids.get('jsonInput').value = '不是 json';
    ids.get('validateBtn').dispatch('click', {});
    a.ok(ids.get('message').textContent.includes('解析失败'));
    a.equal(ids.get('jsonOutput').textContent, '', '失败时清空输出');
    a.equal(ids.get('stats').textContent, '');

    ids.get('jsonInput').value = '{"x": [1,  2]}';
    ids.get('minifyBtn').dispatch('click', {});
    a.equal(ids.get('jsonOutput').textContent, '{"x":[1,2]}');
  });

  t.test('单位换算：类别切换、实时换算、交换与非法输入', (a) => {
    const { doc, ids } = fakeDom();
    convert.initConvert(doc);

    a.equal(ids.get('fromUnit').value, 'm', '默认长度类别');
    a.equal(ids.get('toUnit').value, 'km');
    ids.get('valueInput').value = '1500';
    ids.get('valueInput').dispatch('input', {});
    a.equal(ids.get('resultOutput').textContent, '1.5');
    a.ok(ids.get('formulaLine').textContent.includes('千米'), '应显示换算公式');

    ids.get('chip-temperature').dispatch('click', {});
    a.equal(ids.get('fromUnit').value, 'c');
    a.equal(ids.get('toUnit').value, 'f');
    ids.get('valueInput').value = '100';
    ids.get('valueInput').dispatch('input', {});
    a.equal(ids.get('resultOutput').textContent, '212');

    ids.get('swapBtn').dispatch('click', {});
    a.equal(ids.get('fromUnit').value, 'f');
    a.equal(ids.get('toUnit').value, 'c');
    ids.get('valueInput').value = '212';
    ids.get('valueInput').dispatch('input', {});
    a.equal(ids.get('resultOutput').textContent, '100', '交换后 212°F = 100°C');

    ids.get('valueInput').value = 'abc';
    ids.get('valueInput').dispatch('input', {});
    a.equal(ids.get('resultOutput').textContent, '—', '非法输入显示占位符');
  });

  t.test('抽签决定器：解析、抽取、排除再抽、洗牌', (a) => {
    const { doc, ids } = fakeDom();
    picker.initPicker(doc);
    a.equal(ids.get('optionCount').textContent, '共 0 个选项');

    ids.get('optionInput').value = '火锅\n烤肉\n面条\n火锅';
    ids.get('optionInput').dispatch('input', {});
    a.equal(ids.get('optionCount').textContent, '共 3 个选项', '重复行去重');

    ids.get('drawBtn').dispatch('click', {});
    a.ok(['火锅', '烤肉', '面条'].includes(ids.get('resultText').textContent), '结果必须是选项之一');
    a.equal(ids.get('drawAgainBtn').hidden, false);

    ids.get('drawAgainBtn').dispatch('click', {});
    a.equal(ids.get('optionInput').value.split('\n').length, 2, '排除后剩两个');

    ids.get('drawAgainBtn').dispatch('click', {});
    a.ok(ids.get('resultText').textContent.includes('最后一个'), '剩一个时直接给出');
    a.equal(ids.get('drawAgainBtn').hidden, true);

    ids.get('optionInput').value = '甲\n乙\n丙';
    ids.get('shuffleBtn').dispatch('click', {});
    const lines = ids.get('optionInput').value.split('\n');
    a.deepEqual(lines.slice().sort(), ['甲', '乙', '丙'].slice().sort(), '洗牌后仍是同一批选项');
    a.ok(ids.get('resultText').textContent.includes('已随机排序'));
  });

  t.test('白噪音：播放互斥切换、音量与定时', (a) => {
    const realSetInterval = global.setInterval;
    global.setInterval = () => 0;
    try {
      const { doc, ids } = fakeDom();
      noise.initNoise(doc);

      ids.get('volumeRange').value = '80';
      ids.get('volumeRange').dispatch('input', {});
      a.equal(ids.get('volumeLabel').textContent, '80%');

      ids.get('play-white').dispatch('click', {});
      a.equal(ids.get('play-white').textContent, '停止');

      ids.get('play-pink').dispatch('click', {});
      a.equal(ids.get('play-white').textContent, '播放', '切换后原卡片复位');
      a.equal(ids.get('play-pink').textContent, '停止');

      ids.get('timerSelect').value = '15';
      ids.get('play-white').dispatch('click', {});
      a.ok(ids.get('timerLabel').textContent.includes('15:'), '应显示定时倒计时');
      a.equal(ids.get('play-pink').textContent, '播放', '切换后原卡片复位');

      ids.get('play-white').dispatch('click', {});
      a.equal(ids.get('play-white').textContent, '播放', '再点停止');
      a.equal(ids.get('timerLabel').textContent, '', '停止后清空定时显示');
    } finally {
      global.setInterval = realSetInterval;
    }
  });
};
