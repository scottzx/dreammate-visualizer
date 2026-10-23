# 一伴 · A4 宣传页

横版 A4（297 × 210 mm）单页宣传页的源文件。版式全部用毫米写死，由无头 Chrome 直接渲染成 300 dpi 图片或矢量 PDF；改文案只改 `index.html`，不需要设计软件。

## 渲染

```sh
CHS="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell"

# 300 dpi PNG（3508 × 2480）
"$CHS" --headless --no-sandbox --hide-scrollbars \
  --window-size=1123,794 --force-device-scale-factor=3.1237 \
  --screenshot=yiban-a4-300dpi.png --virtual-time-budget=4000 \
  "file://$PWD/index.html"

# 矢量 PDF（文字不栅格化）
"$CHS" --headless --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=yiban-a4-print.pdf --virtual-time-budget=4000 \
  "file://$PWD/index.html"
```

## 版式

| 区块 | 内容 |
| --- | --- |
| 品牌 | 一伴 · YIBAN |
| 主标题 | 小蓝同学的 / 天生另一半（第二行取青） |
| 副标题 | Personal Agent infra ／ 个人智能体基础设施 |
| 导语 | 一台设备接进网络，就成为一个能力节点。换设备、换模型、换工具链，都不用再配置一次。 |
| 三行释义 | 记忆保存 ／ 工具就位 ／ 技能在线 |
| 主视觉 | 能力宇宙里的设备星球与技能星环，右侧满版裁切 |
| 收尾 | 一张网，装下你所有的智能体 |
| 右下角 | 发布页二维码 + 扫码提示 |

## 素材

| 文件 | 来源 |
| --- | --- |
| `assets/universe-focus.jpg` | 能力宇宙界面截图（设备星球 + 技能星环） |
| `assets/qr-release.svg` | `qrencode -t SVG -l M -m 2 "https://github.com/scottzx/dreammate-visualizer/releases/tag/v0.1.0"`，41 × 41 模块，已用 Vision 解码验证 |

二维码指向固定 tag 页，不随新版本变化；换 tag 时重新生成并替换该 SVG 即可。
