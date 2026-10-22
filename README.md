# DreamMate Visualizer

DreamMate 分布式设备与能力网络的独立三维观察应用。第一版围绕“像看工厂大屏一样理解设备、能力与工作协作”实现，只读采集，不承担调度或执行中继。

## 运行

需要 Node.js 22.15+。本项目独立安装依赖，不依赖相邻仓库的构建产物。

```sh
npm ci
npm run dev
```

打开 **http://127.0.0.1:4317**。开发模式同时启动 Vite 页面和 `127.0.0.1:4318` 观察后端。后端默认只读本机 DreamMate Node `http://127.0.0.1:36908` 及其设备地址簿发现的网关；不会启动、停止、报备或修改现网服务。

```sh
npm test
npm run build
npm start
```

生产模式由观察后端在 **http://127.0.0.1:4318** 提供 `dist/` 和 API。`npm start` 前先构建；本机现由 macOS 用户级 launchd 托管，未发布公网。

## macOS 后台托管

本机已安装用户级服务 `com.1agents.dreammate-visualizer`，由 launchd 独立管理，登录后自动启动、退出后自动重启，任务对话结束不会停止服务。

```sh
npm run service:status
# 构建后安装或更新托管；更新 Node 运行时或移动项目后也执行此命令
npm run build
npm run service:install
# 停止并移除托管，保留项目、配置和日志
npm run service:uninstall
```

日志位于 `~/Library/Logs/DreamMateVisualizer/`。服务使用安装时的 Node 绝对路径和本仓 `observer.config.json`。手动运行 `npm start` 或 `npm run dev` 前，先移除当前托管，以释放 4318 端口。

## Tailscale 访问

本机已保存双地址监听配置，`npm start` 会同时提供：

- 本机：**http://127.0.0.1:4318**
- Tailscale：**http://100.64.0.2:4318**

其他设备连接同一 Tailnet、且其网络访问规则允许访问此设备的 4318 端口后，打开 Tailscale 地址即可。页面与 API 共用这一端口。

实际 `observer.config.json` 已被 Git 忽略，其中设置为：

```json
{ "listenHosts": ["127.0.0.1", "100.64.0.2"] }
```

这是监听字段片段，其他数据源配置继续保留。`OBSERVER_HOST` 可临时覆盖为单个监听地址。若 Tailscale 未运行或本机地址发生变化，更新该字段后再启动；任一地址绑定失败会明确退出并释放已绑定的端口。

## 第一版功能

- 等距三维工厂：设备车间、服务工位、持久身份布局、选择高亮、视角复位与有证据的关系线；WebGL 不可用时显示二维设备列表。
- 中文态势界面：节点、服务、声明能力、工作单与执行尝试分别统计；搜索、状态筛选、设备/服务/工作单/事件详情和来源覆盖联动。
- 只读观察后端：Node 地址簿、manifest、health、服务与技能目录；显式配置 origin 的 ACP 工作单和持久事件读取，分页、事件去重、游标隔离与错误诊断。
- 真实与演示切换：默认真实模式；演示模式具有显著标记，独立快照与布局，不写入真实来源，也不充入真实统计。
- 新鲜度与覆盖：未知、离线、不可用、无权限、不支持、部分覆盖和过期保留区别；来源未接入时不伪造运行数量。

## 数据与配置

复制 `observer.config.example.json` 为 `observer.config.json` 后修改，重启后端生效。实际配置已被 Git 忽略。可用 `DREAMMATE_NODE_URL` 指定一个 Node 种子地址，用 `OBSERVER_CONFIG` 指定配置文件路径。

详细字段与 Gateway / Node 转发模板见[来源配置](docs/data-sources.md)。

ACP 只读取配置中明确的 `originSessionId` 范围，支持直连 Gateway 或经已报备的 Node 服务转发；不自动枚举 origin，不建立 ACP 会话控制连接。默认不配置 ACP，因此真实工作单和事件区会显示未接入。`execution_list`、`execution_events` 是读取白名单；不会派单、取消、重试或确认业务结果。

API：

- `GET /api/health`：观察服务状态。
- `GET /api/snapshot?mode=live`：当前真实观察快照。
- `GET /api/snapshot?mode=demo`：显式演示快照。
- API 不提供执行控制或配置写入接口。

来源地址在后端配置，页面不接收任意上游 URL，也不保存共享凭据。默认监听地址由 `listenHosts` 配置；本机已同时绑定 loopback 与 Tailscale 地址，供同一 Tailnet 的设备访问。

## 统计边界

设备地址簿记录不等于在线 Node；Node 在线不等于服务可用，服务可用也不等于角色空闲。无实际忙闲证据时角色状态为未知。CLI 的声明 `up` 不等于已探活。服务过期探活不能视为当前健康。

能力显示 Method 部署实例与 Skill 声明数；未取得完整输入输出契约时，独立能力种类显示未核验。Job 与 Attempt 分开，返工/重试不会额外算成新工作单。执行完成与业务接受分别显示。

现有上游没有完整的全网调用台账或跨 Node 因果追踪，页面会明确显示缺口；未确认关系不补造接力动画。数据覆盖只限当前配置及可达、可见来源，不展示无完整分母的“全网完成率”。

本轮交付聚焦原方案 **M1 观察底座 + M2 整体态势大屏**。M3 的 Session Reader 轮次/调用内容与 Artifact Index 产物下钻，以及 M4 宿主只读事件流、完整因果和历史回放，保留为后续增强；当前不会将这些能力标为已接入。

## 工程结构

```text
src/read-model/  共享展示模型、证据与统计口径
src/adapters/    Node / ACP 只读来源适配
src/observer/    配置、聚合、演示和快照
src/server/      独立观察 HTTP 后端与生产静态服务
src/view/        中文界面、三维沙盘与持久布局
tests/          布局、口径、分页、游标、去重与覆盖测试
```

技术栈为 TypeScript、React、React Three Fiber / Three.js、Vite 与 Node.js，公共协议通过正式 npm 包 `@1agents/dreammate-network@0.5.0` 引用。运行后端故障不会中断节点上的真实执行；无跨仓源码 import、`file:../` 依赖或共享构建。

[已确认设计基线](docs/design.md)保留初始化时的完整方案、概念模型和公开接口证据；[实施计划](docs/implementation-plan.md)记录本轮分工与验收范围。实际验证结果将在[验收记录](docs/verification.md)中登记。
