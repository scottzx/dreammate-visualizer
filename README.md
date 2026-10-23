<p align="center">
  <a href="https://github.com/scottzx/dreammate-visualizer/releases/tag/v0.1.0">
    <img src="docs/assets/yiban-a4.png" alt="一伴 · Personal Agent infra — A4 宣传页" width="92%">
  </a>
</p>

<h1 align="center">一伴 · Personal Agent infra</h1>

<p align="center"><strong>小蓝同学的天生另一半</strong>　·　记忆保存　工具就位　技能在线</p>

<p align="center">
  <a href="https://github.com/scottzx/dreammate-visualizer/releases/tag/v0.1.0"><img src="https://img.shields.io/badge/A4%20%E5%AE%A3%E4%BC%A0%E9%A1%B5-%E4%B8%8B%E8%BD%BD-6FD8EF?style=flat-square" alt="下载 A4 宣传页"></a>
  <img src="https://img.shields.io/badge/License-MIT-6FD8EF?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/Three.js%20%C2%B7%20React%20%C2%B7%20TypeScript-6FD8EF?style=flat-square" alt="Three.js · React · TypeScript">
</p>

> 一台设备接进网络，就成为一个能力节点。换设备、换模型、换工具链，都不用再配置一次。

|  |  |
| --- | --- |
| **记忆保存** | 上下文、项目与产出留在自己的节点，换设备也不重来。 |
| **工具就位** | 手机、电脑、服务器的能力接上就能调用，不用逐台配置。 |
| **技能在线** | 每个技能包都是一个星点，上线即被发现、被调用。 |

**这个仓库是什么**：一伴的能力宇宙，用三维方式把一个能力网络里的设备、服务、方法与技能画出来——设备是星球，环上每颗星是一个可见技能，连线是它们之间真实可达的路径。A4 宣传页的源文件在 [`docs/brochure`](docs/brochure)，成品在 [Releases](https://github.com/scottzx/dreammate-visualizer/releases/tag/v0.1.0)。

---

## DreamMate Visualizer
DreamMate 分布式设备与能力网络的独立三维观察应用。设备星体采用通透戴森球、恒星内核和细能力星环；服务能力作为卫星，每个可见 Skill 包作为一个星点，球面颜色表示已测项目存储占比。宇宙驾驶舱包含设备星球、平面基地与建筑观察，只读采集，不承担调度或执行中继。

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

## 两种界面模式

- **工作台（默认）**：左侧 `观察台` 常驻，页签切换概览 / 设备 / 能力 / 工作 / 航次 / 事件。概览用 2×3 紧凑指标一屏放下，设备与服务列表一屏约 5 条；选中对象后，右侧按需打开 `对象与证据`，关闭即回到舞台。面板贴合页头与页脚，不再占用顶部标题区。
- **展示（`?display=1` 或顶栏展示图标）**：隐藏顶栏、页脚、搜索与刷新控件，只保留标题、演示标记、场景工具和底部统计；目录与详情改为带遮罩的抽屉，`Esc`、点击遮罩或关闭按钮退出。落地页 iframe 使用该模式并自动把镜头拉近一档；页面被嵌入时不显示“退出展示”。

桌面宽度 ≥1100 时工作台默认展开观察台；更窄或手机默认收起，保留完整的 16:9 沙盘。两种模式共用同一套面板与数据，不复制状态。

## GitHub Pages 落地页、技术说明与交互演示

落地页直接发布 `main` 分支的 `docs/`（`docs/.nojekyll` 关闭 Jekyll 处理）：

- **https://scottzx.github.io/dreammate-visualizer/**：一页宣传页，含技术构建摘要与仓库导航
- **https://scottzx.github.io/dreammate-visualizer/network/**：技术设计说明，覆盖分层、一次调用、实体关系与进度边界
- **https://scottzx.github.io/dreammate-visualizer/demo/**：可交互的能力宇宙演示

首页按「一句话是什么 → 三个词 → 技术构建 → 交互演示 → 仓库地图」组织，技术说明子页是公开摘要，不发布设计册全文。

设计册原文在私有仓 `scottzx/dreammate_world_plan`。公开站不链接该私有仓，也不复制其中的内网地址、内部路径、版本与业务系统细节；技术说明只保留可公开的结构与证据边界。设计变更时先改私有仓，再同步这页摘要。

演示页是独立于观察后端的纯静态构建。`npm run build:demo` 设置 `VITE_STANDALONE_DEMO=1`，以相对路径把页面、`assets/` 与 `models/` 输出到 `docs/demo/`。它不请求 `/api`：设备、项目、会话与航次由浏览器端按隔离演示场景生成，并保持 3 分钟一次的航次周期；Skill 文档同样在本地构造并标记为演示。该构建只提供演示模式，不包含真实来源切换。

演示场景包含 **7 台设备、14 个服务、20 个 Skill 星点、8 个航次**（7 个普通会话 + 1 个 ACP），以及对应的 7 个工作单、10 条事件和 5 个项目；新增家庭存储阵列（2.05 TB）与云端推理集群两颗星球，让星环、星点和飞船的层次更满。

落地页的 `#demo` 区域用 iframe 懒加载 `demo/?display=1`（展示模式），窄屏改为静态海报 `docs/assets/demo-poster.jpg` 并链接到独立页面。修改演示界面后重新生成并一起提交：

```sh
npm run build:demo
```

演示构建约 6.4 MB（含 10 个 GLB 模型），仍在 GitHub Pages 站点容量限制内。

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

日志位于 `~/Library/Logs/DreamMateVisualizer/`。服务使用安装时的 Node 绝对路径和本仓 `observer.config.json`；plist 同时写入 Node 与 `/opt/homebrew/bin` 的 PATH，供可选的 `1session` 会话来源使用。升级 Node 或 CLI 后重新执行 `service:install`。手动运行 `npm start` 或 `npm run dev` 前，先移除当前托管，以释放 4318 端口。

## Tailscale 访问

本机已保存本地与 Tailscale 双监听配置。使用服务域名访问：

- 本机：**http://localhost:4318**
- Tailscale：[打开能力宇宙](http://scott-mac.tailfb4720.ts.net:4318/)

其他设备连接同一 Tailnet、且其网络访问规则允许访问此设备的 4318 端口后，可通过该域名访问。页面与 API 共用端口。

实际监听地址保存在被 Git 忽略的 `observer.config.json` 的 `listenHosts` 中，不在文档中公布。`OBSERVER_HOST` 可临时覆盖为单个监听地址。若本机网络地址变化，更新配置后再启动；任一地址绑定失败会明确退出并释放已绑定的端口。

## 宇宙驾驶舱

- IP 隐私：页面、设备详情、网卡、DERP 图例和来源证据均隐藏 IP；真实和演示快照在后端统一脱敏后再发给浏览器。设备名称、服务域名与关联关系保留，地址型标识使用不可逆的关联标识。详见 [IP 隐私](docs/ip-privacy-v9.md)。
- 立体轨道与自转：各星系、设备有独立倾角和朝向，沿相互错开的椭圆星轨运行；球体自转轴、转速和能力星环也按设备区分。两层运动保持服务中心关系，星轨与实际运动使用同一计算。详见 [立体轨道](docs/spatial-orbits-v10.md)。
- 服务域名与两级公转：当前启动、打开的服务入口对应的设备是小太阳系中心，可与它直连的设备围绕它做小公转；整个小星系和远端节点再围绕 DERP 总中心做较慢的大公转。服务别名指向同一设备时保留相同中心身份，入口所属设备变化时重新确定中心。小轨道随设备数量增长，大轨道自动留足星系间距。金色表示观测的 DERP 中继路径，蓝色表示直连，淡线为对等关系示意。支持“服务太阳系”跟随近看、全部星系总览、暂停与缩放。详见 [服务星系布局](docs/service-galaxies-v8.md)。
- 固定 16:9 沙盘与叠加 HUD：设备文字标签默认隐藏，鼠标靠近星球后只展示对应标签；移入标签可点击，离开或拖动星空时收起。点击对象查看左右指标与详情，竖屏保持沙盘比例和观察尺度，左右移动浏览。
- 星球平面基地与建筑观察：服务工厂、技能学院、智能体驻地、项目工坊；统一建筑占地与总高度，附件表达规模。实况项目未接入时明确保留占位，演示项目独立。
- 可复用模型：10 个真实 GLB，与源几何构造器、材料和接口一同维护。模型图鉴可旋转查看并下载资产。
- 中文态势界面：节点、服务、声明能力、工作单与执行尝试分别统计；搜索、状态筛选、对象详情和来源覆盖联动。
- 会话航次：每一次本机会话或 ACP 工作单是一艘小飞船，大小约为设备能力环半径的 1/3，从项目目录泊位出发，在结构化 DreamMate MCP 调用解析出的设备停靠，最后停靠点即终点；到终点后继续围绕目的地盘旋，每个 3 分钟刷新周期重演一次起航。详见 [会话航次](docs/session-voyages-v12.md)。
- 只读观察后端：Node 地址簿、manifest、health、服务与技能目录；显式配置 origin 的 ACP 工作单和持久事件读取，分页、事件去重、游标隔离与错误诊断；可选的本机 `1session` 会话与轮次读取。
- 真实与演示切换：默认真实模式；演示模式具有显著标记，独立快照与布局，不写入真实来源，也不充入真实统计。
- 新鲜度与覆盖：未知、离线、不可用、无权限、不支持、部分覆盖和过期保留区别；来源未接入时不伪造运行数量。

打开 **`/?view=models`** 查看三维模型图鉴。`npm run assets:build` 重建 `public/models/universe-v1/`；模型源和复用接口见 [素材说明](src/visual-assets/README.md)，本轮布局与验收约束见 [第二版方案](docs/universe-v2.md)。

星空操作：鼠标拖动旋转、滚轮缩放；触屏单指旋转、双指缩放或平移。竖屏使用独立横移条移动 16:9 视窗。点击查看设备，双击进入基地；“服务太阳系”近看当前入口，“星系总览”看全部小星系。拉远后可从对象目录选择设备，再点“聚焦星球”。两层轨道公式与验证见 [服务星系布局](docs/service-galaxies-v8.md)；原导航实现记录保存在 [三维星系导航](docs/space-navigation-v4.md)。

设备球体已改为通透戴森球壳、恒星内核与粒子环。**球体体积与设备存储总容量成正比**：64G、128G、256G、512G 的体积为 1∶2∶4∶8。未采集到存储容量统一默认 128G，并标记“默认”；取得真实值后自动替换。详情显示采集来源及时间。见 [设备存储与球体比例](docs/storage-sizing-v6.md)。

细星环的每颗卫星对应一个可见服务，可以点击查看方法；点击 Skill 星点在右侧栏阅读完整文档，支持 Markdown 排版与滚动阅读，服务目录中的 Skill 条目也支持点击及键盘操作。星点按同节点 Skill ID 去重。球面蓝色为业务智能体项目存储，绿色为感知项目存储，灰色为未探查或未归属。项目占比使用实际采集的设备总容量，默认128G不参与计算。当前可测量显式配置的本机项目目录，其他设备保持未知，见 [星环、星点与项目存储配置](docs/capability-rings-v7.md)。

## 数据与配置

复制 `observer.config.example.json` 为 `observer.config.json` 后修改，重启后端生效。实际配置已被 Git 忽略。可用 `DREAMMATE_NODE_URL` 指定一个 Node 种子地址，用 `OBSERVER_CONFIG` 指定配置文件路径。

默认每 3 分钟采集一次。页面在前台时按快照声明的周期读取，最少间隔 3 分钟；后端配置更慢时随之延长。请求结束后再等待下一周期，避免慢请求重叠。标签页切到后台时暂停自动读取，回到前台且已到期时补读一次；手动刷新立即重新采集。界面时钟独立更新，不再每秒触发整个页面与三维组件重新渲染。

宇宙动画最高每秒绘制 30 帧；暂停后按需绘制，标签页隐藏时停止绘制。协作证据连线复用图形缓冲区。设备地址簿暂时变空或缩小时，观察器会继续探查已知地址；不可达时保留缓存并标记状态，避免整片星空突然只剩本机。

详细字段与 Gateway / Node 转发模板见[来源配置](docs/data-sources.md)。

ACP 只读取配置中明确的 `originSessionId` 范围，支持直连 Gateway 或经已报备的 Node 服务转发；不自动枚举 origin，不建立 ACP 会话控制连接。默认不配置 ACP，因此真实工作单和事件区会显示未接入。`execution_list`、`execution_events` 是读取白名单；不会派单、取消、重试或确认业务结果。

会话航次默认关闭。复制示例配置后设置 `sessions.enabled: true`，观察后端会通过本机 `1session` 只读命令读取 `sessions.scope` 与 `sinceHours` 窗口内的结构化会话，识别其中直接调用的 DreamMate MCP 工具，并把显式 `node` / `service_id` 映射到当前设备与服务。不解析 `exec` / `bash` 脚本内嵌的调用，不返回绝对 workspace 路径；命令不经过 shell。字段与覆盖边界见[会话航次](docs/session-voyages-v12.md)。

API：

- `GET /api/health`：观察服务状态。
- `GET /api/snapshot?mode=live`：当前真实观察快照，包含 `voyages`。
- `GET /api/snapshot?mode=demo`：显式演示快照。
- API 不提供执行控制或配置写入接口。

来源地址在后端配置，页面不接收任意上游 URL，也不保存共享凭据。默认监听地址由 `listenHosts` 配置；本机已同时绑定 loopback 与 Tailscale 地址，供同一 Tailnet 的设备访问。

## 统计边界

设备地址簿记录不等于在线 Node；Node 在线不等于服务可用，服务可用也不等于角色空闲。无实际忙闲证据时角色状态为未知。CLI 的声明 `up` 不等于已探活。服务过期探活不能视为当前健康。

能力显示 Method 部署实例与 Skill 声明数；未取得完整输入输出契约时，独立能力种类显示未核验。Job 与 Attempt 分开，返工/重试不会额外算成新工作单。执行完成与业务接受分别显示。

现有上游没有完整的全网调用台账或跨 Node 因果追踪，页面会明确显示缺口；未确认关系不补造接力动画。数据覆盖只限当前配置及可达、可见来源，不展示无完整分母的“全网完成率”。

观察数据仍聚焦原方案 **M1 观察底座 + M2 整体态势大屏**。第二版增强三维模型和驾驶舱；M3 的本机会话航次（1session 摘要 + 结构化 MCP 调用）已作为增强接入，但会话原始内容下钻、Artifact Index 产物定位，以及 M4 宿主只读事件流、完整因果和历史回放，仍保留为后续增强。演示模式内的项目与宿主占比不代表这些来源已接入。

## 工程结构

```text
src/read-model/  共享展示模型、证据与统计口径
src/adapters/    Node / ACP 只读来源适配
src/observer/    配置、聚合、演示和快照
src/server/      独立观察 HTTP 后端与生产静态服务
src/view/        中文界面、三维沙盘与持久布局
src/visual-assets/ 模型构造器、共享加载器与复用规范
public/models/  可直接加载或下载的 GLB 三维资产
tests/          布局、口径、分页、游标、去重与覆盖测试
```

技术栈为 TypeScript、React、React Three Fiber / Three.js、Vite 与 Node.js，公共协议通过正式 npm 包 `@1agents/dreammate-network@0.5.0` 引用。运行后端故障不会中断节点上的真实执行；无跨仓源码 import、`file:../` 依赖或共享构建。

[已确认设计基线](docs/design.md)保留初始化时的完整方案、概念模型和公开接口证据；[实施计划](docs/implementation-plan.md)记录本轮分工与验收范围。实际验证结果将在[验收记录](docs/verification.md)中登记。

## 许可证

本项目采用 [MIT 许可证](LICENSE)，版权归 scottzx 所有。
