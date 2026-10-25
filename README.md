# Mini Apps · 轻量小应用合集

三个零依赖、开箱即用的网页小工具。纯 HTML / CSS / JavaScript 编写，无构建步骤、无第三方库、无任何网络请求，数据仅保存在浏览器 localStorage 中。

## 应用一览

| 应用 | 功能 |
| --- | --- |
| 🕐 [桌面时钟](apps/clock/index.html) | 模拟表盘 + 数字时间，12/24 小时制、秒显示、明暗主题、全屏模式 |
| ✅ [待办清单](apps/todo/index.html) | 添加 / 完成 / 删除 / 筛选 / 清除已完成，自动本地保存 |
| 📝 [极简日志](apps/journal/index.html) | 随手记录，按天分组展示，关键词搜索，自动本地保存 |

## 在线使用

GitHub Pages：<https://125for.github.io/mini-apps/>

## 本地运行

无需安装任何东西，直接双击 `index.html` 即可；也可以用任意静态服务器：

```bash
python -m http.server 8080
```

然后访问 <http://localhost:8080>。

## 运行测试

```bash
node tests/run-tests.js
```

测试包含三部分，全程无界面弹窗、无网络访问：

- **单元测试** —— 时间格式化、指针角度、任务 / 日志的数据校验与流转等纯函数逻辑
- **界面冒烟测试** —— 用极简的模拟 DOM 驱动真实界面代码，验证交互与持久化
- **安全扫描** —— 静态检查源码，禁止 `innerHTML` / `eval` / 内联事件等危险用法

## 安全与隐私

- 所有用户输入一律通过 `textContent` / `createElement` 渲染，不拼接 HTML，从根源避免 XSS
- localStorage 读取时逐条校验数据结构，损坏数据自动兜底为空
- 零网络请求、零 Cookie、零追踪，数据不离开浏览器
- 每次推送由 GitHub Actions 自动运行全部测试

## English

A collection of three zero-dependency web mini apps: desktop clock, to-do list and simple journal. Pure HTML/CSS/JS, no build step, no network requests; data stays in your browser's localStorage. Run all tests with `node tests/run-tests.js`.

## License

[MIT](./LICENSE)
