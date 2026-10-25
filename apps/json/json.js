/* JSON 工具箱 —— 纯函数逻辑 + 界面初始化；逻辑部分可在 Node 中单元测试 */
'use strict';

/* ---------- 纯逻辑 ---------- */

function parseJson(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: '请输入 JSON 内容' };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: describeError(e, text) };
  }
}

/* 尽量给出行列定位，方便找到出错位置 */
function describeError(err, text) {
  const msg = String(err && err.message ? err.message : err);
  const m = /position (\d+)/.exec(msg);
  if (m) {
    const pos = Number(m[1]);
    if (pos >= 0 && pos <= text.length) {
      const upto = text.slice(0, pos);
      const line = (upto.match(/\n/g) || []).length + 1;
      const lastNl = upto.lastIndexOf('\n');
      const col = pos - lastNl; /* lastNl 为 -1 时即第 1 行第 pos+1 列 */
      return '解析失败：第 ' + line + ' 行第 ' + col + ' 列附近（' + msg + '）';
    }
  }
  return '解析失败：' + msg;
}

/* 递归按键名排序，返回新结构 */
function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  return v;
}

function formatJson(text, options) {
  const opts = options || {};
  const res = parseJson(text);
  if (!res.ok) return { ok: false, error: res.error };
  const value = opts.sortKeys ? sortValue(res.value) : res.value;
  const indent = typeof opts.indent === 'number' && opts.indent >= 0 ? opts.indent : 2;
  return { ok: true, output: JSON.stringify(value, null, indent) };
}

function minifyJson(text) {
  const res = parseJson(text);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, output: JSON.stringify(res.value) };
}

/* 统计节点数：对象/数组各算 1 个，再递归累加成员 */
function countNodes(v) {
  if (Array.isArray(v)) return 1 + v.reduce((n, item) => n + countNodes(item), 0);
  if (v !== null && typeof v === 'object') {
    return 1 + Object.keys(v).reduce((n, k) => n + countNodes(v[k]), 0);
  }
  return 1;
}

/* ---------- 界面 ---------- */

function initJson(doc) {
  const input = doc.getElementById('jsonInput');
  const output = doc.getElementById('jsonOutput');
  const message = doc.getElementById('message');
  const stats = doc.getElementById('stats');
  const sortCheck = doc.getElementById('sortKeys');
  const formatBtn = doc.getElementById('formatBtn');
  const minifyBtn = doc.getElementById('minifyBtn');
  const validateBtn = doc.getElementById('validateBtn');
  const copyBtn = doc.getElementById('copyBtn');

  let lastOutput = '';

  function fail(errText) {
    message.textContent = errText;
    message.className = 'message error';
    output.textContent = '';
    stats.textContent = '';
    lastOutput = '';
  }

  function runFormat(minify) {
    const res = minify
      ? minifyJson(input.value)
      : formatJson(input.value, { sortKeys: sortCheck.checked, indent: 2 });
    if (!res.ok) {
      fail(res.error);
      return;
    }
    message.textContent = '✓ JSON 有效';
    message.className = 'message ok';
    output.textContent = res.output;
    lastOutput = res.output;
    const parsed = parseJson(input.value);
    stats.textContent = countNodes(parsed.value) + ' 个节点 · 输出 ' + res.output.length + ' 字符';
  }

  function fallbackCopy(text) {
    try {
      const ta = doc.createElement('textarea');
      ta.value = text;
      if (doc.body) doc.body.appendChild(ta);
      ta.select();
      doc.execCommand('copy');
      if (doc.body) doc.body.removeChild(ta);
    } catch (e) { /* 复制失败时静默 */ }
  }

  formatBtn.addEventListener('click', () => runFormat(false));
  minifyBtn.addEventListener('click', () => runFormat(true));

  validateBtn.addEventListener('click', () => {
    const res = parseJson(input.value);
    if (!res.ok) {
      fail(res.error);
      return;
    }
    message.textContent = '✓ JSON 有效 · ' + countNodes(res.value) + ' 个节点';
    message.className = 'message ok';
  });

  copyBtn.addEventListener('click', () => {
    if (!lastOutput) return;
    const view = doc.defaultView;
    const nav = view && view.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(lastOutput).then(markCopied, () => {
        fallbackCopy(lastOutput);
        markCopied();
      });
    } else {
      fallbackCopy(lastOutput);
      markCopied();
    }
  });

  function markCopied() {
    copyBtn.textContent = '已复制 ✓';
    setTimeout(() => { copyBtn.textContent = '复制结果'; }, 1500);
  }
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  initJson(document);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseJson, describeError, sortValue, formatJson, minifyJson, countNodes, initJson };
}
