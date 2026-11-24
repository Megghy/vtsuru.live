---
title: 桌面客户端与 EventFetcher 指南
description: 使用桌面客户端获取推流码开播，并运行 EventFetcher 本地采集、透明弹幕浮窗与粉丝查看。
category: getting-started
order: 2
badge: 推荐
tags:
  - 桌面客户端
  - EventFetcher
  - 推流码
  - 透明浮窗
  - 粉丝查看
manageRoute: client-index
manageLabel: 预览客户端界面
---

网页端已经能覆盖大部分挂件和主页能力，但像**获取推流码开播、单屏游戏看透明弹幕浮窗、本地语音转写、连 VTube Studio / OBS 本机进程**这些事，浏览器权限确实够不着，所以就有了基于 Tauri 的 VTsuru 桌面客户端。

<DocActionBar
  title="下载 VTsuru 桌面客户端"
  description="支持 Windows / macOS / Linux，提供国内加速节点直连与 SHA-256 校验。"
  route-name="client-download"
  button-text="前往下载页面"
/>

## 客户端能帮你省掉哪些麻烦

1. **直接拿推流码开播（不用开官方直播姬）**：在客户端里就能改直播标题、选分区、换封面，点一下开播拿到推流地址和推流码，直接用干净的 OBS 推流。
2. **EventFetcher 采集引擎**：稳定连接直播间长连接事件流，把弹幕、礼物、SC、入场、关注、大航海事件实时送给自动操作脚本、浮窗和云端同步。
3. **桌面置顶透明浮窗**：单块显示器打游戏不想切屏看手机？开两个置顶透明窗口（`/danmaku-window` 弹幕窗、`/gift-window` 礼物/舰队排行窗），直接浮在游戏画面角落。
4. **本地 RPC 桥接与粉丝排查**：帮网页端 OBS 场景编辑器直连你本机的 OBS WebSocket，还能在「粉丝查看」里按粉丝量排序排查关注你的大 V 账号。

<DocCallout type="info" title="多账号与凭据管理">
  在客户端的「账号与凭据」页面可以统一管理主账号及多个辅助 B 站账号 Cookie（比如主号开播、小号负责发自动回复弹幕），切换起来不会串号。
</DocCallout>

<DocFigure
  src="/docs-images/client-fetcher.png"
  title="桌面客户端 · EventFetcher 事件采集中心"
  badge="实机界面"
  caption="支持开放平台 / 直接连接双模式，实时监控弹幕长连接心跳、采集统计与底部透明浮窗快捷开关"
/>

## EventFetcher 面板怎么看

在客户端左侧进入 **EventFetcher**，主要关注三个 Tab：

* **连接设置**：确认当前绑定的 B 站凭据有效、直播间状态正常，以及是否将采集到的事件自动同步上报。
* **监控与统计**：实时看今日弹幕数、礼物流水和连接心跳状态；如果感觉断连了，这里一眼能看出是网络波动还是凭据过期。
* **系统与诊断**：遇到玄学问题时，可以在这里查看本地运行日志并反馈排查。

<DocActionBar
  title="想先在网页里看看客户端界面？"
  description="客户端复用站点前端界面，你可以直接点进去了解布局（部分硬件和推流操作仅在桌面端可执行）。"
  route-name="client-index"
  button-text="查看客户端首页"
/>
