# 宇宙沙盘模型库

这套模型是原创三维网格。设备球体现已升级为 `dyson-lattice-v3.1`：以小型恒星、稀疏采集面板、经纬骨架和轨道设施呈现设备；早期 PNG 和海陆球体仅保留为设计过程参考。场景加载的是 GLB，可以旋转、光照、遮挡和独立摆放。无图片纹理或外部字体依赖。

## 接口

```tsx
import AssetModel from '../visual-assets/AssetModel';

<AssetModel id="workshop-advanced" scale={0.6} position={[0, 0, 0]} />
```

React 组件通过 `useGLTF` 缓存源资产，每个实例克隆节点树，复用只读几何和材质。场景实例各有自己的位置与旋转。修改某个实例的材质时，需要先单独 clone 材质，避免影响其他实例。

`illuminated={false}` 会为当前实例克隆材质，关闭自发光并调暗表面；状态恢复时还原原有亮度，其他星球不受影响。设备场景优先按 `networkOnline` 点亮，缺少网络状态时使用有效的网关探活结果；离线与未知设备保留可选择的暗色轮廓，光晕、卫星和远景光点同步调暗。

```ts
import { createUniverseModel, UNIVERSE_MODEL_IDS } from './models';
const editableSource = createUniverseModel('ship-base');
```

源构造器每次返回独立的节点、几何和材质，适用于离线导出或需要修改模型本身的场合。

## 坐标和外形规则

| ID | 基准 | 形态 |
| --- | --- | --- |
| `planet-hub` | 球心原点，主体半径约 1，全部外轨细节半径 <1.5 | 暖金恒星、细线经纬骨架、不规则留空的采集面板、蓝色采集片、倾斜中继轨道；内部恒星半径 0.27，球壳半径约 1.02 |
| `planet-peripheral` | 球心原点，主体半径约 1，外部细节半径 <1.5 | 冷蓝恒星与冷色面板，和主星共享同一归一化球壳；相同存储容量以同一大小表达，不因设备角色扩大 |
| `ship-base` / `ship-advanced` | 船体原点，船头朝 −Z，长度约 4 | 双服务舱与后置动力，进阶款加能源耦合器和数据舱 |
| `workshop-base` / `workshop-advanced` | 地面 Y=0，门朝 +Z | 固定占地 4×4，总高 2；升级只改变内部设备和表面细节 |
| `academy` / `service-factory` | 与工坊相同的 4×4×2 外包围盒 | 学院蓝色档案模块，工厂橙色标识与处理罐 |
| `agent-base` / `agent-resident` | 地面 Y=0，面向 +Z，高约 1.8 | 相同工程机器人骨架；常驻款有蓝色肩板、胸章和工具包 |

面板、框架和轨道设施是统一素材的一部分，**不是设备真实项目数量或调用活动**。舰船数量、智能体人数与实时活动由上层场景依据数据单独绑定。模型内的能源光采用 glTF 标准自发光材质；粒子光环、中心光晕与运动由场景控制。重复骨架、面板和轨道模块已合并，两种设备模型各 10 个网格、13480 个三角形，避免按面板片增加绘制调用。

## 生成和验证

```sh
npx tsx scripts/build-models.ts
npx tsx --test tests/models.test.ts
```

输出为 `public/models/universe-v1/`，同时生成包含修订号、尺寸、三角形数与文件大小的 `manifest.json`。资产 ID 和路径保持稳定，客户端可使用 `UNIVERSE_MODEL_REVISION` 作为缓存修订号。单个 GLB 小于 900 KB。测试实际使用 GLTFLoader 回读全部文件，并验证有限坐标、三轴体积、导入前后包围盒、统一建筑尺寸、球壳与内部恒星的尺度分离、自发光内核和紧凑的设备绘制预算。导出只使用 glTF 标准几何与 PBR 材质。
