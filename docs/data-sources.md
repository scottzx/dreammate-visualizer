# 观察来源配置

复制根目录的 `observer.config.example.json` 到 `observer.config.json`，修改后重启后端。未提供配置时，仅以 `http://127.0.0.1:36908` 为种子，读取种子 `/nodes` 及发现节点的 `/manifest`、`/health`；已报备 Skill Manager 的节点会读取 `/skills` 分页目录。没有网关时保留来源失败与目录未核验，不启动现网服务。

配置字段：

| 字段 | 含义 |
| --- | --- |
| `listenHosts` | HTTP 页面与 API 的监听 IP 列表，默认回环；本机配置为回环 + Tailscale IP，支持 1–8 项并去重 |
| `nodeUrls` | 明确的 HTTP(S) Node 种子列表，不能包含凭据、路径或查询参数 |
| `timeoutMs` | 单次读取超时，默认 3000，范围 300–10000 ms |
| `refreshIntervalMs` | 后端采样间隔，默认 180000（3 分钟），范围 3000–600000 ms；示例配置为 180000 |
| `staleAfterMs` | 缓存与探活证据的新鲜度窗口，默认 540000 ms（9 分钟） |
| `maxNodes` | 一次发现上限，默认 24；截断明确标注部分覆盖 |
| `maxPages` | 每个来源本轮最多读取页数，默认 5；未排空的事件下轮继续 |
| `acpSources` | 显式授权的 Gateway / Node 服务与 origin 范围；默认为空 |
| `sessions` | 可选的本机 `1session` 会话来源：`enabled`、`command`、`scope`、`sinceHours`、`maxSessions`、`maxTurns`、`maxCalls`、`timeoutMs`；默认关闭 |

Node 读取最多 6 个并发设备；远端无法连接时给出有界失败。地址簿的网络状态与直接网关探活分开保存，不能根据 tailnet 在线推测服务健康。服务只有存在合法、窗口内的探活时间才显示当前可用；不主动执行方法来验证健康。

刷新频率分两层：后端按 `refreshIntervalMs` 采样并写入最新快照，页面按快照声明的周期读取，且另有 3 分钟硬下限。把 `refreshIntervalMs` 配得比 3 分钟更短，只会让后端采取得更密，界面仍每 3 分钟才拉取一次；页面不会因后台采样而高频重绘。地址簿里消失的设备会继续探查 `staleAfterMs` 对应的时长，超时后才移出观察范围。

## 可选 ACP 读取范围

每项 ACP 来源必须提供独立配置 `id` 和真实 `originSessionId`。不要填写猜测的 ID。`url` 是实际 Gateway 基址；经 Node 转发时改用 `nodeUrl` 与实际报备的 `serviceId`。以下是结构模板，占位值必须替换后才可用于运行配置：

```json
{
  "id": "authorized-workstream",
  "name": "已授权工作流",
  "url": "http://127.0.0.1:12345",
  "originSessionId": "REPLACE_WITH_AUTHORIZED_ORIGIN"
}
```

端口 12345 只是模板，不代表发现到的服务地址。转发结构为：

```json
{
  "id": "authorized-node-workstream",
  "nodeUrl": "http://127.0.0.1:36908",
  "serviceId": "a2a-gateway",
  "originSessionId": "REPLACE_WITH_AUTHORIZED_ORIGIN",
  "jobId": "OPTIONAL_JOB_FILTER"
}
```

`jobId` 可省略；填写时事件游标与该过滤范围绑定。后端只通过 POST `/invoke` 或 `/services/:id/invoke` 调用白名单 `execution_list` / `execution_events`；HTTP POST 仅是来源读取方法的传输，不增加业务写入能力。

工作单按公开 `limit/offset` 分页，事件按 `sourceId/originSessionId/jobId` 范围维护 sequence。源身份变化时清除旧游标与事件，从 0 对账；空页不清空旧游标。事件缓存最多保留 300 条用于近期展示。游标与快照是进程内缓存，重启后重建；当前没有持久回放数据库。

ACP 实际设备、会话、轮次关系只采纳显式字段，缺失时显示未确认；不会根据目标名称或文本相似度连线。本次默认运行未配置真实 ACP origin，适配器通过本地契约夹具验证，没有宣称已接入全网工作单。

## 可选会话读取与航次

```json
{
  "sessions": { "enabled": true, "command": "1session", "scope": "~", "sinceHours": 24,
    "maxSessions": 12, "maxTurns": 8, "maxCalls": 24, "timeoutMs": 6000 }
}
```

启用后，观察后端以 `execFile` 调用本机 `1session` 的 `projects` / `list` / `turns` / `turn` 只读命令，不经过 shell，也不写会话文件。读取范围是 `scope` 与 `sinceHours`，并按 `maxSessions`、`maxTurns`、`maxCalls` 限制命令次数；单条会话失败只降低覆盖状态，不伪造成零。会话按 60 秒缓存。后台 launchd 的默认 PATH 很窄，`npm run service:install` 会把当前 Node 目录与 `/opt/homebrew/bin` 写入 plist 的 PATH；也可把 `command` 配成绝对路径。

航次只识别工具名本身属于 DreamMate MCP 的结构化调用（如 `dreammate_invoke`、`mcp__dreammate__*`），并用参数中显式的 `node` / `service_id` / `method` 匹配当前设备和服务；`exec` / `bash` 脚本内嵌的调用不解析。没有目标字段的调用落在本地 MCP 网关；目标不在当前目录时保留原始标签并标记未确认。绝对 workspace 路径不进入快照，只发布哈希项目 ID 与目录名。ACP 航次的停靠点只来自执行尝试的明确目标设备，不补造会话内 MCP 调用。详见[会话航次](session-voyages-v12.md)。

## 进程与 API

`OBSERVER_CONFIG` 指定配置路径，`DREAMMATE_NODE_URL` 覆盖 Node 种子。`OBSERVER_PORT` 修改后端端口，`listenHosts` 默认 `["127.0.0.1"]`，本机持久配置额外包含 `<观察机 Tailscale 地址>`；`OBSERVER_HOST` 可覆盖为单个地址。开发时 Vite 代理固定到 4318，如修改后端端口需同时调整 `vite.config.ts`；生产静态服务使用自己的实际监听地址。

`GET /api/snapshot?mode=live&refresh=1` 请求重新观察；并发刷新复用进行中的采集。`mode=demo` 是完全隔离的构造快照，不能向真实来源写数据。观察服务不提供修改来源、调度或控制执行的 HTTP 接口。


## 设备存储总容量与星球体积

`NodeView.storage` 记录设备的存储总容量，独立保存字节数、观测时间、来源和 observed/cached 状态。RAM、剩余存储、已用空间和主机名都不参与球体大小计算。旧 `memory` 字段不会转换成存储容量。

Node manifest 可上报：

```json
{
  "metadata": {
    "hardware": { "storage_total_bytes": 512000000000 }
  }
}
```

兼容 `metadata.storage_total_bytes`、`metadata.hardware.disk_total_bytes`、`metadata.hardware.storage_total_gb`（十进制 GB）和 `metadata.hardware.storage_total_gib`（二进制 GiB）。字节字段优先，最终字节数必须为正、有限的安全整数。同一设备暂时缺字段或读取失败时保留旧容量和原观测时间并标记缓存；同 URL 更换设备身份后不复用旧存储或技能目录。

配置 `localNodeId` 可显式绑定观察进程所在设备的原生 Node ID。本机 macOS 通过 `diskutil list -plist internal physical` 只读采集内置物理磁盘，使用系统 `plutil` 解码，最多等待 3 秒；多块内置物理磁盘求和，同一磁盘按身份去重，不计外接盘，不重复加 APFS 分区、容器或卷。Mac 本轮实测总容量为 500277792768 字节（约 500.3GB）。未绑定的远端设备不会套用观察机磁盘容量。其他平台的观察机目前使用 Node 上报值或默认值，本机自动磁盘采集限 macOS。

显示采用存储设备常用十进制单位：1 GB = 10⁹ 字节、1 TB = 10¹² 字节。统一半径为 `1.8 × cbrt(totalBytes / (64 × 10⁹))`，因此 64G、128G、256G、512G 的体积为 1∶2∶4∶8。缺失或无效容量在显示侧统一默认 128GB，标注“默认”；API 的真实容量仍保持未知，采集到有效值后自动替换。不会按服务数、中心身份或当前列表的最大值改变比例。演示容量为隔离示例。

## 本机项目存储目录

通过 `localNodeId` 绑定本机设备后，可配置 `localProjects: [{id, name, path, category}]`；`path` 必须是明确的项目绝对目录，`category` 为 `business-agent`、`perception` 或 `other`。配置示例、读取边界与图形语义见 [能力星环与项目存储](capability-rings-v7.md)。

快照 `projects[].storage[]` 包含 `nodeId/category/bytes/status/observedAt/source/metric/path`。当前 `source` 为 `observer-directory`，`metric` 固定为 `allocated-disk-bytes`；失败时 `bytes: null`，不记作0。不将会话数、Skill 数、RAM、默认128G或其他设备目录当作存储占比。`sources` 新增 `kind: projects`，覆盖状态只表示配置目录采集情况，不能表示全设备项目已完整枚举。


## 基础设备信息

Node 在原有 manifest 的 `metadata.device` 中附带 `dreammate.device.v1`：设备型号、系统名称与版本、架构、主机名，以及本地非回环网卡的名称、IP、子网掩码和 MAC。观察服务直接使用这份信息，不新增节点间探测、路由/邻居查询、局域网判断或分组。原有设备列表、网关探活和 Tailscale 路径展示继续使用原有逻辑。

设备详情只展示基本字段，本地网卡明细默认折叠；旧节点没有上报时显示未提供。来源失败时保留带缓存标记的信息，同 URL 更换节点身份后不复用旧设备数据。这些字段不参与设备磁盘容量和星球体积计算。
