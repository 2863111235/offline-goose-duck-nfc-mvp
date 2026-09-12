# 线下鹅鸭杀 NFC 网页 MVP

第一版可运行的局域网验证项目。普通 NTAG213 标签只写入 NDEF URL；iPhone 或安卓碰触标签后打开网页，身份、击杀、任务、冷却和裁判修正都由电脑上的服务端处理。

## 已实现

- 玩家在本机选择测试身份，并以签名 Cookie 保持本局会话；
- 玩家 NFC 名牌落地页与服务端击杀判定；
- 个人 5 分钟击杀冷却、重复提交保护和事件日志；
- 任务点 NFC 落地页、裁判确认和个人 3 分钟重复冷却；
- 裁判 PIN 登录、阶段切换、状态修正、重置本局及 NFC 地址查看；
- SQLite 本地持久化；
- 手机竖屏页面与倒计时展示。

这是受监督的现场 MVP，不是强防作弊系统。静态 NFC URL 可以被复制；所有重要规则仍会在服务端重新校验。

## 本地运行

要求 Node.js 24 或更高版本。数据库使用 Node 自带的 SQLite，不需要安装 Visual Studio、Python 或额外数据库服务；启动时出现 `ExperimentalWarning: SQLite` 属于当前 Node 24 的已知提示。

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

电脑浏览器打开 `http://localhost:3000`。裁判测试 PIN 默认为 `2468`；正式测试前应在 `.env.local` 中修改 PIN 和 `SESSION_SECRET`。

## 手机访问和写 NFC

1. 用 `ipconfig` 找到电脑在当前 Wi-Fi 下的 IPv4 地址。
2. 把 `.env.local` 中的 `PUBLIC_BASE_URL` 改成 `http://电脑IPv4:3000`，例如 `http://192.168.1.20:3000`。
3. 确保手机和电脑在同一 Wi-Fi，并允许 Windows 防火墙放行 Node.js 的专用网络访问。
4. 手机先打开该地址，选择自己的测试身份。
5. 进入 `/admin`，复制玩家名牌和任务点对应的 NFC 地址。
6. 用 NXP TagWriter 等工具把地址作为 NDEF URL 写入 NTAG213 标签。

iPhone 读取普通 NDEF URL 时会显示系统提示，需要玩家点开；网页不能绕过这一步静默执行。

## 验证命令

```powershell
npm test
npm run typecheck
npm run build
```

功能边界见 [MVP 范围](docs/MVP_SCOPE.md)，环境说明见 [环境配置](docs/ENVIRONMENT.md)。完整 NFC 原理文档保留在本地上级工作区；仓库内文档已记录本 MVP 所需约束。

## 当前测试数据

- 房间码：`TEST01`
- 玩家：红鸭、黄鸭、蓝鹅、绿鹅
- 任务点：任务点 A、任务点 B

玩家身份选择页不会展示其他玩家的阵营；本人进入后可在“我的状态”中看到自己的测试身份。
