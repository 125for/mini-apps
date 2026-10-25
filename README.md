# Mini Apps · 轻量小应用合集

十二个零依赖、开箱即用的网页小工具，同时提供 **Windows 桌面启动器**（双击 exe 即用）。应用本体为纯 HTML / CSS / JavaScript，无构建步骤、无第三方库、无任何网络请求，数据仅保存在浏览器 localStorage 中。

## 应用一览

| 应用 | 功能 |
| --- | --- |
| 🕐 [桌面时钟](apps/clock/index.html) | 模拟表盘 + 数字时间（秒针毫秒级平滑），12/24 小时制、明暗主题、全屏 |
| ✅ [待办清单](apps/todo/index.html) | 添加 / 完成 / 删除 / 筛选 / 清除已完成，自动本地保存 |
| 📝 [极简日志](apps/journal/index.html) | Ctrl+Enter 快速记录，按天分组，关键词搜索 |
| 🍅 [番茄钟](apps/pomodoro/index.html) | 25 分钟专注 + 5 分钟休息自动轮换，进度环、提示音、当日统计 |
| ⏳ [倒数日](apps/countdown/index.html) | 重要日子倒计时，未来由近到远排序，支持每年重复 |
| 🔑 [密码生成器](apps/password/index.html) | 密码学安全随机（拒绝采样消除模偏差），可调长度与字符集，熵强度评估 |
| 🔥 [习惯打卡](apps/habit/index.html) | 每日打卡、连续天数（streak）统计、最近 35 天打卡格 |
| 💰 [记账本](apps/expense/index.html) | 收支记录、按月浏览、月度汇总，金额以"分"为整数存储避免浮点误差 |
| 🧰 [JSON 工具箱](apps/json/index.html) | 格式化 / 压缩 / 校验（错误行列定位）、键名递归排序、节点统计 |
| 📏 [单位换算](apps/convert/index.html) | 长度、重量、面积（含亩）、体积、温度、数据（1000/1024 并存）、速度 |
| 🎲 [抽签决定器](apps/picker/index.html) | 密码学安全随机抽取，支持排除已抽（不重复抽签）与整组洗牌 |
| 🌊 [白噪音](apps/noise/index.html) | 白 / 粉 / 棕噪音与海浪，WebAudio 实时合成（无音频文件），定时停止 |

## 在线使用

GitHub Pages：<https://125for.github.io/mini-apps/>

## Windows 桌面版（双击 exe 即用）

到 [Releases](https://github.com/125for/mini-apps/releases) 下载最新版 `mini-apps-windows-desktop.zip`，解压后双击任意 exe 即可：

```
时钟 · 待办 · 日志 · 番茄钟 · 倒数日 · 密码生成器
习惯打卡 · 记账本 · JSON工具箱 · 单位换算 · 抽签决定器 · 白噪音 · MiniApps（合集首页）
```

- exe 是 **6.5 KB** 的轻量启动器，调用系统自带 Edge / Chrome 的应用窗口模式（无地址栏、无标签页，看起来就像桌面应用），**无需安装任何运行时**
- 找不到 Edge / Chrome 时自动退回系统默认打开方式
- 未签名 exe 首次运行可能触发 SmartScreen 提示：点击"更多信息"→"仍要运行"即可

本地重新构建桌面启动器（使用 Windows 自带的 .NET Framework 编译器）：

```bat
desktop\build.cmd
```

## 本地运行（网页版）

无需安装任何东西，直接双击 `index.html` 即可；也可以用任意静态服务器：

```bash
python -m http.server 8080
```

然后访问 <http://localhost:8080>。

## 运行测试

```bash
node tests/run-tests.js
```

88 个用例，包含四部分，全程无界面弹窗、无网络访问：

- **单元测试** —— 各应用的纯函数逻辑（时间格式化、日期计算、金额与随机采样、换算因子表、噪音合成、状态机、streak 计算等）
- **界面冒烟测试** —— 用极简模拟 DOM 驱动真实界面代码，验证交互与持久化
- **静态安全扫描** —— 禁止 `innerHTML` / `eval` / 内联事件等危险用法，检查桌面启动器无网络 API
- **构建产物检查** —— 桌面启动器 exe 已构建且体积小于 128KB

CI（GitHub Actions）在每次推送时于 Ubuntu 运行全部测试、于 Windows 重新构建桌面启动器。

## 安全与隐私

- 所有用户输入一律通过 `textContent` / `createElement` 渲染，不拼接 HTML，从根源避免 XSS
- 随机类应用（密码、抽签）使用 `crypto.getRandomValues` 并以拒绝采样消除模偏差
- localStorage 读取时逐条校验数据结构，损坏数据自动兜底为空
- 零网络请求、零 Cookie、零追踪；桌面启动器同样无任何网络行为，数据不离开本机

## English

Twelve zero-dependency web mini apps (clock, to-do, journal, pomodoro, countdown, password generator, habit tracker, expense book, JSON toolkit, unit converter, random picker, white noise) plus tiny Windows launcher exes (~6.5 KB each) that open them in Edge/Chrome app-window mode. Pure HTML/CSS/JS, no build step, no network requests; data stays in your browser's localStorage. Run all 88 tests with `node tests/run-tests.js`.

## License

[MIT](./LICENSE)
