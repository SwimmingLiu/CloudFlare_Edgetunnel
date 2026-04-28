# `sub-links` edgetunnel 重构与 Cloudflare 自动部署设计

日期：2026-04-28

## 1. 背景

当前工作目录中的 `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js` 已经偏离上游 `cmliu/edgetunnel` 当前主线实现。用户要求以 `cmliu/edgetunnel` 当前 `_worker.js` 为目标基线，将 `vpn.js` 重构为与上游行为基本一致的 Worker，同时在默认值层面保留当前本地使用习惯，并在重构完成后自动部署到 Cloudflare，新建 Worker 项目 `sub-links`。

本次重构明确采用上游单文件 Worker 架构，不再兼容当前 `vpn.js` 的旧路由入口。

## 2. 目标

本次工作的目标如下：

1. 将 `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js` 重构为以上游 `/tmp/cmliu-edgetunnel/_worker.js` 为基线的单文件 Worker。
2. 迁入上游当前主要能力：
   - `/login`
   - `/logout`
   - `/admin`
   - `/admin/*`
   - `/sub`
   - `/version`
   - WebSocket 代理
   - XHTTP 代理
   - gRPC 代理
   - 伪装页/反代页逻辑
   - KV 配置管理
   - 优选订阅生成与订阅转换
3. 放弃当前 `vpn.js` 旧入口兼容，不再保留：
   - `/${UUID}`
   - `/${UUID}/edit`
   - 绑定在 `/${UUID}` 上的 `?clash`、`?sb`、`?proxyip`、`?socks5` 等旧语义
4. 将默认订阅行为调整为“以上游配置模型为主，但默认走当前本地使用的外部订阅生成器和订阅转换后端”。
5. 支持通过 Cloudflare 环境变量覆盖关键配置。
6. 自动在 Cloudflare 创建并部署 Worker 项目 `sub-links`，并配置：
   - `UUID=179ba8dd-3854-4747-b853-fc1868ef3937`
   - KV 绑定 `KV`

## 3. 非目标

以下内容不在本次范围内：

1. 不保留当前 `vpn.js` 的旧路径兼容层。
2. 不尝试在现有 `vpn.js` 上增量拼接上游逻辑。
3. 不维护“双实现”结构，不保留一份旧代码和一份新代码并行。
4. 不额外实现与用户当前目标无关的新功能。
5. 不在本轮设计中引入多文件模块化拆分；部署仍保持单文件 Worker 形态。

## 4. 基线与源码真相

本次以以下文件作为真相来源：

- 上游基线：`/tmp/cmliu-edgetunnel/_worker.js`
- 本地目标文件：`/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js`

设计原则是：

- 运行结构以上游 `_worker.js` 为准。
- 本地 `vpn.js` 只保留最小 patch：
  - 默认值修改
  - 环境变量覆盖
  - 部署文件适配
  - 必要的本地说明

## 5. 重构后的路由面

重构完成后，`vpn.js` 将暴露上游风格路由：

- `/login`
- `/logout`
- `/admin`
- `/admin/config.json`
- `/admin/ADD.txt`
- `/admin/log.json`
- `/admin/check`
- `/admin/getCloudflareUsage`
- `/admin/getADDAPI`
- `/sub`
- `/version`
- WebSocket 请求入口
- gRPC / XHTTP 请求入口

旧版入口将视为废弃，不再作为受支持接口。

## 6. 配置模型

### 6.1 内部模型

内部统一采用上游 `config_JSON` 模型，包括但不限于：

- `UUID`
- `HOST`
- `HOSTS`
- `PATH`
- `协议类型`
- `传输协议`
- `优选订阅生成`
- `订阅转换配置`
- `反代`
- `TG`
- `CF`

### 6.2 默认值调整

在保持上游结构不变的前提下，默认值改为：

- `优选订阅生成.local = false`
- `优选订阅生成.SUB = "https://sub-nodes.pages.dev/?serect_key=swimmingliu"`
- `订阅转换配置.SUBAPI = "https://SUBAPI.fxxk.dedyn.io"`
- `订阅转换配置.SUBCONFIG = "https://raw.githubusercontent.com/SwimmingLiu/ClashConfig/master/ACL4SSR_Online_Full_MultiMode.ini"`
- `订阅转换配置.SUBEMOJI` 保持上游布尔语义，但允许环境变量覆盖
- `优选订阅生成.SUBNAME` 保持默认名称，但允许环境变量覆盖

这意味着重构后的默认行为不是上游默认的“本地优选 IP 库优先”，而是“外部优选订阅生成器优先”。

### 6.3 配置优先级

为满足“可以通过环境变量配置”的要求，配置优先级定义为：

1. 环境变量
2. KV 中的 `config.json` / `tg.json` / `cf.json`
3. 代码内默认值

该优先级只对显式支持的字段生效。这样做的结果是：

- 部署层可直接通过 env 控制关键配置。
- 后台 `/admin` 保存到 KV 的配置，在对应字段没有被 env 覆盖时生效。
- 若某字段同时存在 env 和 KV，则 env 为准。

这是一个有意为之的运维模型。代价是：部分字段在 `/admin` 中修改后，如果同名 env 仍存在，页面保存不会改变该字段的实际运行值。后台页面需要展示的是“合并后的有效配置”，而不是单纯 KV 原始值。

## 7. 环境变量映射

本次需要支持以下环境变量映射到上游配置模型或运行层：

- `UUID`
- `KEY`
- `HOST`
- `PATH`
- `URL`
- `SUB`
- `SUBAPI`
- `SUBCONFIG`
- `SUBEMOJI`
- `SUBNAME`
- `PROXYIP`
- `SOCKS5`
- `GO2SOCKS5`
- `BEST_SUB`
- `DEBUG`

其中：

- `UUID` 作为本次自动部署的必配变量，值为 `179ba8dd-3854-4747-b853-fc1868ef3937`
- `SUB`、`SUBAPI`、`SUBCONFIG` 在未提供 env 时回退到本次定义的默认值
- `PROXYIP`、`SOCKS5`、`GO2SOCKS5` 保持上游运行机制，但允许直接从 env 注入

## 8. 代码迁移策略

### 8.1 主体替换

`/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js` 将直接替换为以上游 `_worker.js` 为基线的实现，而不是继续沿用当前 `vpn.js` 结构。

### 8.2 最小 patch 规则

在上游基线上仅做以下改动：

1. 修改默认配置值。
2. 增加或修正环境变量覆盖逻辑，使 `SUB`、`SUBAPI`、`SUBCONFIG`、`SUBEMOJI`、`SUBNAME` 等字段可以在运行时覆盖。
3. 添加本仓库部署需要的 `wrangler.toml` 适配。
4. 必要时补充最小注释或说明文档。

### 8.3 不保留旧逻辑

当前 `vpn.js` 中基于：

- `sub-nodes.pages.dev/?serect_key=swimmingliu`
- `/${UUID}`
- `/${UUID}/edit`
- 自定义本地拼装订阅输出

的旧流程不会作为并行逻辑保留；其需求仅通过“默认值迁移”反映到上游模型中。

## 9. Cloudflare 自动部署设计

### 9.1 目标资源

自动化部署将创建或更新以下 Cloudflare 资源：

- Worker：`sub-links`
- KV Namespace：绑定名 `KV`

### 9.2 部署方式

优先使用本地已经配置好的 Cloudflare 凭据，通过 `wrangler` CLI 自动完成：

1. 生成或更新 `wrangler.toml`
2. 创建 KV namespace
3. 写入 KV binding
4. 写入环境变量
5. 执行 `wrangler deploy`

### 9.3 `wrangler.toml`

目标结构：

```toml
name = "sub-links"
main = "vpn.js"
compatibility_date = "2026-04-28"
keep_vars = true

[[kv_namespaces]]
binding = "KV"
id = "<generated>"
```

如果 Cloudflare 平台要求额外字段，则以可成功部署为准做最小增补。

### 9.4 初始环境变量

自动设置：

- `UUID=179ba8dd-3854-4747-b853-fc1868ef3937`

其余变量不强制写入平台，保留代码默认值即可。后续若用户需要，再通过 env 增配。

### 9.5 登录与后台

在只设置 `UUID` 的情况下，上游逻辑仍可生成管理口令链路并进入 `/login` / `/admin`。首次部署后需要验证：

- `/login` 可访问
- 可成功登录
- `/admin` 可加载配置页

## 10. 验证设计

### 10.1 代码验证

至少执行：

- Worker 语法与部署前检查
- `wrangler deploy`

### 10.2 运行验证

部署成功后验证：

1. Worker 地址可访问。
2. `/login` 页面可打开。
3. `/admin` 页面可进入并读取配置。
4. `/sub` 可返回订阅内容。
5. 默认 `SUB`、`SUBAPI`、`SUBCONFIG` 已按本次设计生效。
6. `UUID=179ba8dd-3854-4747-b853-fc1868ef3937` 已生效。

### 10.3 UI 验证

由于本次包含后台页面与登录页，完成后需要进行浏览器级验证：

- 打开登录页
- 登录后台
- 检查配置页面加载
- 触发一次订阅请求

如果页面有明显结构或交互问题，应视为未完成。

## 11. 风险与处理

### 风险 1：环境变量覆盖 KV 造成后台修改“不生效”

这是设计上的明确取舍。解决方式不是改变优先级，而是：

- 在实现时让后台返回的是合并后的有效配置
- 在结果说明中明确哪些字段可被 env 固定

### 风险 2：上游更新频繁，未来再次偏离

本次通过“以上游为主体、仅保留最小 patch”来降低后续同步成本。以后若需要跟进上游，优先做 rebase 式 patch，而不是再次在本地堆叠逻辑。

### 风险 3：本地 Cloudflare 凭据与 `wrangler` 状态不一致

如果 `wrangler` 当前不可直接操作 Cloudflare，则优先检查本地认证状态；若认证缺失，再补登录或使用本机已配置 API 凭据。

## 12. 实施顺序

实施时按以下顺序推进：

1. 用上游 `_worker.js` 替换本地 `vpn.js` 主体。
2. 注入本次定义的默认配置与 env 覆盖。
3. 生成 `wrangler.toml` 并配置 `sub-links`。
4. 创建并绑定 KV。
5. 部署 Worker。
6. 进行 CLI、接口、UI 三层验证。
7. 如部署后仍有配置偏差，再做最小修正并重新验证。

## 13. 完成标准

满足以下条件即视为本次设计对应实现完成：

1. `vpn.js` 已切换为上游 `_worker.js` 风格实现。
2. 默认订阅行为改为：
   - `SUB=https://sub-nodes.pages.dev/?serect_key=swimmingliu`
   - `SUBAPI=https://SUBAPI.fxxk.dedyn.io`
   - `SUBCONFIG=https://raw.githubusercontent.com/SwimmingLiu/ClashConfig/master/ACL4SSR_Online_Full_MultiMode.ini`
3. 通过环境变量可覆盖关键字段。
4. Cloudflare Worker `sub-links` 已创建并部署。
5. `KV` 已创建并绑定。
6. `UUID=179ba8dd-3854-4747-b853-fc1868ef3937` 已配置。
7. `/login`、`/admin`、`/sub` 已通过实际验证。
