# DreamMate Visualizer

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
- 只读观察后端：Node 地址簿、manifest、health、服务与技能目录；显式配置 origin 的 ACP 工作单和持久事件读取，分页、事件去重、游标隔离与错误诊断。
- 真实与演示切换：默认真实模式；演示模式具有显著标记，独立快照与布局，不写入真实来源，也不充入真实统计。
- 新鲜度与覆盖：未知、离线、不可用、无权限、不支持、部分覆盖和过期保留区别；来源未接入时不伪造运行数量。

打开 **`/?view=models`** 查看三维模型图鉴。`npm run assets:build` 重建 `public/models/universe-v1/`；模型源和复用接口见 [素材说明](src/visual-assets/README.md)，本轮布局与验收约束见 [第二版方案](docs/universe-v2.md)。

星空操作：鼠标拖动旋转、滚轮缩放；触屏单指旋转、双指缩放或平移。竖屏使用独立横移条移动 16:9 视窗。点击查看设备，双击进入基地；“服务太阳系”近看当前入口，“星系总览”看全部小星系。拉远后可从对象目录选择设备，再点“聚焦星球”。两层轨道公式与验证见 [服务星系布局](docs/service-galaxies-v8.md)；原导航实现记录保存在 [三维星系导航](docs/space-navigation-v4.md)。

设备球体已改为通透戴森球壳、恒星内核与粒子环。**球体体积与设备存储总容量成正比**：64G、128G、256G、512G 的体积为 1∶2∶4∶8。未采集到存储容量统一默认 128G，并标记“默认”；取得真实值后自动替换。详情显示采集来源及时间。见 [设备存储与球体比例](docs/storage-sizing-v6.md)。

细星环的每颗卫星对应一个可见服务，可以点击查看方法；星点按同节点 Skill ID 去重。球面蓝色为业务智能体项目存储，绿色为感知项目存储，灰色为未探查或未归属。项目占比使用实际采集的设备总容量，默认128G不参与计算。当前可测量显式配置的本机项目目录，其他设备保持未知，见 [星环、星点与项目存储配置](docs/capability-rings-v7.md)。

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

观察数据仍聚焦原方案 **M1 观察底座 + M2 整体态势大屏**。第二版增强三维模型和驾驶舱；M3 的真实项目/会话、Session Reader 轮次/调用内容与 Artifact Index 产物下钻，以及 M4 宿主只读事件流、完整因果和历史回放，保留为后续增强。演示模式内的项目与宿主占比不代表这些来源已接入。

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
