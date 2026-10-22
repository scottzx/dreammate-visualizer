# 观察来源配置

复制根目录的 `observer.config.example.json` 到 `observer.config.json`，修改后重启后端。未提供配置时，仅以 `http://127.0.0.1:36908` 为种子，读取种子 `/nodes` 及发现节点的 `/manifest`、`/health`；已报备 Skill Manager 的节点会读取 `/skills` 分页目录。没有网关时保留来源失败与目录未核验，不启动现网服务。

配置字段：

| 字段 | 含义 |
| --- | --- |
| `listenHosts` | HTTP 页面与 API 的监听 IP 列表，默认回环；本机配置为回环 + Tailscale IP，支持 1–8 项并去重 |
| `nodeUrls` | 明确的 HTTP(S) Node 种子列表，不能包含凭据、路径或查询参数 |
| `timeoutMs` | 单次读取超时，默认 3000，范围 300–10000 ms |
| `refreshIntervalMs` | 后端采样间隔，默认 10000，范围 3000–120000 ms；示例配置为 15000 |
| `staleAfterMs` | 缓存与探活证据的新鲜度窗口，默认 45000 ms |
| `maxNodes` | 一次发现上限，默认 24；截断明确标注部分覆盖 |
| `maxPages` | 每个来源本轮最多读取页数，默认 5；未排空的事件下轮继续 |
| `acpSources` | 显式授权的 Gateway / Node 服务与 origin 范围；默认为空 |

Node 读取最多 6 个并发设备；远端无法连接时给出有界失败。地址簿的网络状态与直接网关探活分开保存，不能根据 tailnet 在线推测服务健康。服务只有存在合法、窗口内的探活时间才显示当前可用；不主动执行方法来验证健康。

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

## 进程与 API

`OBSERVER_CONFIG` 指定配置路径，`DREAMMATE_NODE_URL` 覆盖 Node 种子。`OBSERVER_PORT` 修改后端端口，`listenHosts` 默认 `["127.0.0.1"]`，本机持久配置额外包含 `100.64.0.2`；`OBSERVER_HOST` 可覆盖为单个地址。开发时 Vite 代理固定到 4318，如修改后端端口需同时调整 `vite.config.ts`；生产静态服务使用自己的实际监听地址。

`GET /api/snapshot?mode=live&refresh=1` 请求重新观察；并发刷新复用进行中的采集。`mode=demo` 是完全隔离的构造快照，不能向真实来源写数据。观察服务不提供修改来源、调度或控制执行的 HTTP 接口。
