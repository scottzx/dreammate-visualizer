# 会话航次 · 小飞船可视化（v12）

日期：2026-10-23。范围：把每一次本机 AI 会话与 ACP 工作单视为一次“航次”，在能力宇宙中以小飞船展示“项目目录 → DreamMate MCP 停靠点 → 最后停靠点”的轨迹。只读观察，不调度、不执行、不修改会话。

## 1. 口径

- **一个航次 = 一次会话或一个 ACP 工作单**。普通会话来自本机 `1session` 只读命令覆盖的 Claude / Codex / DSH / Grok / Antigravity 记录；ACP 航次来自已配置授权的 `execution_list` 工作单。
- **起点 = 项目目录**。会话的 workspace 匹配 `1session projects` 发布的 Git/目录项目；匹配不到时使用 workspace 目录名作为未归属项目。绝对路径不进入快照，只保留稳定哈希项目 ID 与项目名。
- **中途停靠点 = 结构化 DreamMate MCP 工具调用**。只有工具名本身属于 DreamMate MCP（如 `dreammate_invoke`、`mcp__dreammate__dreammate_inspect`）的调用才参与解析；参数中的显式 `node` / `service_id` / `method` 映射到快照中的设备与服务。未匹配到目标时保留原始标签并标记“未确认”，不补造设备连线。
- **终点 = 最后一个停靠点**。没有可识别停靠点的航次停在项目起点，并明确说明“这不代表没有工具调用”。
- **连续停靠合并**：连续多次调用同一设备+服务合并为一个停靠点（记录次数与全部方法）；离开后再次返回同一目标算新的停靠点。
- **状态**：会话最近 5 分钟内有更新显示“航行中”，否则“已停靠”；ACP 状态映射自工作单的 `running/queued/input_required` 与终态，未知保持未知。

## 2. 数据契约（展示读模型）

`ObserverSnapshot.voyages?: VoyageView[]`：

| 字段 | 含义 |
| --- | --- |
| `id / nativeId / sourceId` | 带来源命名空间的稳定航次 ID 与原生会话/工作单 ID |
| `kind` | `session` 普通会话 / `acp` ACP 工作单 |
| `provider` | `claude`、`codex`、`dsh`、`grok`、`antigravity`、`acp` |
| `title` | 会话标题或工作单标题；缺失时回退目录名 |
| `projectId / projectName` | 哈希后的项目身份与展示名 |
| `originNodeId` | 起点所在设备（本机节点） |
| `startedAt / updatedAt / status` | 会话起止时间与航次状态 |
| `stops[]` | 按时间排序的停靠点：`nodeId/nodeLabel/serviceId/serviceLabel/method(s)/at/status/calls/resolved/evidence` |
| `destinationNodeId / destinationLabel` | 最后停靠点；无停靠时为起点 |
| `mcpCalls` | 识别到的结构化 MCP 调用次数 |
| `evidence[]` | 来源证据与覆盖说明 |

`Selection` 新增 `{ type: 'voyage'; id }`，选中航次会高亮起点、终点与所有停靠设备。

## 3. 来源与配置

```json
{
  "sessions": {
    "enabled": true,
    "command": "1session",
    "scope": "~",
    "sinceHours": 24,
    "maxSessions": 12,
    "maxTurns": 8,
    "maxCalls": 24,
    "timeoutMs": 6000
  }
}
```

- 默认 `enabled: false`，会话读取必须显式开启。
- 命令通过 `execFile` 执行，不经过 shell；`scope` 支持 `~`、绝对目录或 `global`。
- 来源 `sessions:1session` 的覆盖状态：`ok` 完整读取窗口内会话；`partial` 达到会话/轮次/调用预算或有单条读取失败；`unavailable` 命令不可用或超时；`unsupported` 未启用。
- 读取按 60 秒缓存，会话快照随观察快照每 3 分钟更新。
- ACP 航次不需要额外配置，沿用 `acpSources` 的显式 origin 范围。

## 4. 视觉与动画

- **项目泊位**：本机设备旁按项目身份稳定散列分布的发光小环；同项目航次共用起点，按航次 ID 轻微错开。
- **航线**：起点 → 停靠设备 → 终点的抬升曲线。普通会话青蓝 `#8fe8f2`，ACP 紫色 `#c9a6f2`，错误停靠红 `#ef8f7a`；选中增亮。
- **3 分钟周期**：每次刷新快照就是一次起航。前 4% 周期离港，60% 周期依次航行与停靠；到终点后不熄火，继续围绕目的地做倾斜盘旋，直到下一次快照重演。动画暂停时冻结，不在暂停后补算墙钟时间。位置是视觉示意，不代表执行时长、成功率或业务接受。
- **小飞船**：复用项目已有的星舰 GLB（普通会话 `ship-base`、ACP `ship-advanced`），船长约为设备能力环半径的 1/3，明显小于星环、大于单个 Skill 星点；带同色尾迹与光晕。途中持续飞行，中途停靠改为沿行星切线缓慢漂移，终点做持续盘旋。点击选中航次，右侧“航次”页显示项目、起点、终点、停靠序列与证据。
- **未确认停靠**：没有 `nodeId` 的停靠点放在星系外圈、按停靠 ID 稳定取角，并显示“目标未在当前目录中确认”，不落到任何真实设备上。

## 5. 覆盖边界

- 只解析结构化的 DreamMate MCP 工具调用；`exec` / `bash` 脚本里嵌入的 MCP 调用不计入，避免从文本猜测目标。
- 只读取 `sessions.scope` 与 `sinceHours` 窗口内、`maxSessions/maxTurns/maxCalls` 预算内的会话；不是本机会话全量普查。
- 会话标题来自本地原始记录；标题中的 `/Users/<name>`、`/home/<name>`、`C:\Users\<name>` 会替换为 `~`，绝对路径与原始会话文件路径不进入快照。
- ACP 工作单没有会话内 MCP 调用明细，ACP 航次的停靠点只来自执行尝试的目标设备。
- 航次数量、停靠点数量与 MCP 调用次数是“可见窗口内”的计数，不是全网调用台账、成功率或质量指标。

## 6. 验收

- `npm test`：航次解析、停靠合并、目标解析、终点规则、周期动画、项目匹配、ACP 航次、配置边界全部通过。
- `npm run typecheck`、`npm run build` 通过。
- 演示模式可见 4 个航次（3 普通 + 1 ACP）与对应航线/小飞船；真实模式在启用 `sessions` 后显示本机会话航次。
- 浏览器验收：航次页、详情停靠序列、图例、开关、搜索筛选、暂停冻结与窄屏布局。
