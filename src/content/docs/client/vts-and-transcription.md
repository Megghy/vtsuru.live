---
title: VTS 联动与本地语音转写
description: 在桌面客户端里触发 VTube Studio 表情、热键与机位，并通过本地语音转写生成 OBS 实时字幕与场次文稿。
category: client
order: 2
tags:
  - VTube Studio
  - VTS
  - 语音转写
  - 同传字幕
  - 场次复盘
manageRoute: client-vts
manageLabel: 查看 VTS 控制界面
---

这两个功能都重度依赖本机硬件或本地进程，所以放在了桌面客户端里实现。

<DocFigure
  src="/docs-images/client-vts.png"
  title="客户端 · VTube Studio 控制中心"
  badge="实机界面"
  caption="直连本机 VTS WebSocket，将常用表情、热键、宏、机位预设或滤镜集中到操作台一键切换"
/>

## 1. VTube Studio 控制（`/client/vts`）

连上本机运行中的 VTube Studio（开启 API 插件端口并点一次允许授权）后，你可以在客户端里做到：

* **可视化热键与表情面板**：读取你模型里配置好的所有热键、表情和动作，不用死记十几个组合键，点一下就能触发。
* **联合 OBS 场景编辑器**：配合 OBS 场景编辑器的 `vts-preset` 模式，切换「闲聊 / 游戏 / 歌回」子场景时自动切好对应 VTS 机位与表情宏。
* **联动自动操作 / 礼物**：也可以把 VTS 热键作为动作节点，实现收到特定礼物或弹幕时自动触发立绘卖萌/变黑/换装等整活效果。

## 2. 本地语音转写与同传字幕（`/client/transcription`）

* **本机识别，低延迟**：直接在本地麦克风采集音频做实时语音识别，不把你的原始录音传给第三方转录云服务。
* **直接推给 OBS 字幕条**：开启后，你说出的每一句话都会实时滚动出现在 OBS 组件库的 **实时语音字幕条（`subtitle`）** 上，外语杂谈、助听友好或做切片时特别直观。
* **自动保存为场次文稿**：播完之后，带时间戳的完整语音识别文稿会自动保存到对应的 **直播记录** 场次详情里，想找刚才哪一分钟聊了什么梗，直接搜关键字就能定位。

<DocActionBar
  title="了解 VTS 控制与转写界面"
  description="前往客户端 VTS 控制面板查看连接状态与热键映射（完整控制需在桌面客户端运行）。"
  route-name="client-vts"
  button-text="查看 VTS 控制面板"
/>
