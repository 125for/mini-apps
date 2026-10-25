/* 测试辅助：模拟 localStorage 与极简 DOM，让界面代码可以脱离浏览器驱动 */
'use strict';

const fs = require('fs');
const path = require('path');

function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    _data: data,
    setItem(key, value) { data[key] = String(value); },
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; }
  };
}

function makeElement(tagName) {
  const children = [];
  const listeners = {};
  let text = '';

  const el = {
    tagName: String(tagName).toUpperCase(),
    children,
    _listeners: listeners,
    value: '',
    checked: false,
    hidden: false,
    className: '',
    type: '',
    title: '',
    attrs: {},
    classList: {
      _set: new Set(),
      add(...cs) { for (const c of cs) this._set.add(c); },
      remove(...cs) { for (const c of cs) this._set.delete(c); },
      toggle(c, force) {
        const next = force === undefined ? !this._set.has(c) : Boolean(force);
        if (next) this._set.add(c);
        else this._set.delete(c);
        return next;
      },
      contains(c) { return this._set.has(c); }
    },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return key in this.attrs ? this.attrs[key] : null; },
    appendChild(child) { children.push(child); return child; },
    append(...items) { children.push(...items); },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event || {});
    },
    focus() {}
  };

  Object.defineProperty(el, 'textContent', {
    get() { return text; },
    set(v) {
      text = String(v);
      children.length = 0; /* 与真实 DOM 一致：设置 textContent 会清空子节点 */
    }
  });

  return el;
}

function fakeDom() {
  const byId = new Map();
  const doc = {
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, makeElement('div'));
      return byId.get(id);
    },
    documentElement: makeElement('html'),
    defaultView: { matchMedia: () => ({ matches: false }) }
  };
  return { doc, ids: byId };
}

function listFiles(dir, out) {
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) listFiles(full, out);
    else out.push(full);
  }
  return out;
}

module.exports = { fakeStorage, fakeDom, listFiles };
