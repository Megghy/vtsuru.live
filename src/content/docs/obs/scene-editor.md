---
title: OBS 场景编辑器指南
description: 在网页画布里管理多场景、全局常驻层、原生 OBS 本地源分层顺序和 VTube Studio 机位联动。
category: obs
order: 1
badge: 核心
tags:
  - OBS 场景编辑器
  - VTube Studio
  - 夹心分层
  - 多场景
manageRoute: manage-obsSceneEditor
manageLabel: 打开场景编辑器
---

以前开播最让人头疼的，就是在 OBS 里拉十几个零散浏览器源——想把立绘往前挪一层、把边框调小两像素，或者切个“闲聊 / 游戏 / 歌回”场景，得在 OBS 里点到手酸。**OBS 场景编辑器**就是为了省掉这套体力活做的：你在网页里像做海报一样摆好图层，OBS 里挂着它就够了。

<DocFigure
  src="/docs-images/obs-scene-editor.png"
  title="OBS 场景编辑器工作台（/manage/obs-scene-editor）"
  badge="实机界面"
  caption="左侧管理子场景与图层分组，中间实时拖拽排版，右侧调整分辨率、切场过渡与 OBS 原生滤镜"
/>

## 子场景与全局层

编辑器把画面拆成两块来管：

1. **子场景（Scenes）**：对应你不同直播时段的不同排版，比如「开播待机」「杂谈闲聊」「游戏主画面」「歌回」。切场景时对应布局整体切换。
2. **全局层（Global Layers）**：不管切到哪个子场景都稳稳留在画面上的元素——台标 Logo、常驻 BGM 歌名条、防挡提醒框放这就行，不用每个场景复制一遍。

<DocCallout type="tip" title="组（Group）与异形遮罩">
  图层太多乱掉时可以直接建 Group 折叠管理；任意图层都支持缩放、裁切、透明度以及圆角/异形遮罩，改完保存后 OBS 画面会同步跟上。
</DocCallout>

## 原生本地源与「夹心分层」

纯网页图层好排，但很多时候我们需要**把本地采集的 VTube Studio 模型或游戏窗口夹在两层网页装饰中间**（比如：动态背景在最底 → **你的皮套/游戏画面** → 弹幕机和前景框在最顶）。

这时只要在子场景顶层放一个 **`obs-source`（原生 OBS 源）** 图层作为分层边界：

<DocFigure
  title="夹心分层渲染示意图"
  badge="自动槽位分配"
  caption="编辑器按原生 OBS 源的位置自动切分网页渲染段，OBS 内排好 Z 轴夹心顺序，切场不销毁浏览器源"
>
  <svg viewBox="0 0 720 200" class="w-full h-auto" role="img" aria-label="OBS 夹心分层示意图">
    <rect x="40" y="20" width="640" height="36" rx="8" fill="var(--brand-soft)" stroke="var(--brand)" stroke-width="1.2" />
    <text x="60" y="43" font-size="12" font-weight="600" fill="var(--brand)">最上层 Web 槽位 (slot=1)</text>
    <text x="660" y="43" text-anchor="end" font-size="11" fill="var(--muted-foreground)">弹幕机 · 前景边框 · 通知弹窗</text>
    <rect x="40" y="68" width="640" height="44" rx="8" fill="var(--card)" stroke="var(--foreground)" stroke-width="1.5" stroke-dasharray="5 3" />
    <text x="60" y="95" font-size="12" font-weight="700" fill="var(--foreground)">原生 OBS 本地源 (obs-source)</text>
    <text x="660" y="95" text-anchor="end" font-size="11" fill="var(--muted-foreground)">VTube Studio 虚拟形象 / 游戏画面 / 摄像头</text>
    <rect x="40" y="124" width="640" height="36" rx="8" fill="var(--muted)" stroke="var(--border)" stroke-width="1.2" />
    <text x="60" y="147" font-size="12" font-weight="600" fill="var(--foreground)">底层 Web 槽位 (slot=0)</text>
    <text x="660" y="147" text-anchor="end" font-size="11" fill="var(--muted-foreground)">动态背景 · 直播间底图 · 氛围特效</text>
    <text x="360" y="185" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">无原生源时退化为单个浏览器源；存在原生源时由桌面端经 OBS WebSocket 自动排好层级顺序</text>
  </svg>
</DocFigure>

### 原生源两种控制玩法

选中 `obs-source` 图层后，可以在右侧检查器挑一种控制方式：

* **OBS Transform（默认）**：你在网页画布里把皮套框拖大、移到右下角、裁切掉多余边缘，OBS 里的对应来源就会以中心对齐 `1:1` 同步移动缩放。
* **VTS Preset（机位联动）**：OBS 源本身全屏铺满不动，每次切换子场景（比如从「闲聊」切去「打游戏」），画面通过桌面客户端本地 RPC 自动让 VTube Studio 切换对应**机位预设、表情或热键/宏**，皮套自己切到角落。

<DocCallout type="warning" title="关于 obs-source 的放置规则">
  为了保证 Z 轴切片顺序清晰，<code>obs-source</code> 只能放在子场景顶层，不能塞进 Group 分组里，也不能放进全局层；另外，想要自动排序和 VTS 联动，需要保持桌面客户端在线。
</DocCallout>

<DocActionBar
  title="进画布里试试手？"
  description="打开 OBS 场景编辑器，拖几个挂件摆出你的直播间模板。"
  route-name="manage-obsSceneEditor"
  button-text="打开 OBS 场景编辑器"
/>
