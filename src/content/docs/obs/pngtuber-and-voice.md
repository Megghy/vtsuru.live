---
title: PNGtuber 与多人连麦头像
description: 不用昂贵 Live2D 也能开播：支持音频驱动立绘、表情热键、模型包导入，以及 6 位房间码多人联动同屏。
category: obs
order: 4
tags:
  - PNGtuber
  - 反应立绘
  - 多人联动
  - 语音头像
manageRoute: manage-obsStore
manageLabel: 在组件库打开 PNGtuber
---

有时候懒得开面捕、电脑性能吃紧，或者和朋友临时连麦搞企划，不想只放一张死板的静态图——**PNGtuber 反应立绘**和 **Voice Avatars（多人连麦头像）** 就是专门解决这个的。

<DocFigure
  src="/docs-images/pngtuber-manage.png"
  title="PNGtuber 反应立绘控制台"
  badge="实机界面"
  caption="可调节开口/闭口阈值、噪声抑制与麦克风增益，右侧透明棋盘格实时预览立绘状态并支持 6 位房间码多人联动"
/>

## PNGtuber 反应立绘能做到什么程度

* **基础双态 / 四态图**：根据麦克风音量阈值实时切换闭嘴、张嘴、眨眼等立绘状态，自带轻微弹跳与呼吸动效，画面马上活起来。
* **多表情组 & 全局热键**：可以提前配好多组不同表情或配饰（比如开心、汗流浃背、戴墨镜），开播打游戏时按快捷键秒切。
* **模型包导入导出**：做好的整套立绘、参数与表情可以打包导出分享或备份。
* **6 位房间码多人同屏**：输入同一个 6 位房间码，就可以把几个一起连麦的小伙伴立绘放进同一个 OBS 画面里，谁说话谁就亮灯跳动！

<DocCallout type="info" title="浏览器限制 vs 桌面端热键">
  在普通浏览器里开控制台时，页面失去焦点（比如你正在全屏打游戏）是收不到键盘热键的；如果你需要游戏全程用快捷键切 PNGtuber 表情，建议直接在**桌面客户端 → PNGtuber** 里使用，走系统级全局快捷键。
</DocCallout>

## Voice Avatars（多人语音头像）

如果你们只是几个朋友一起玩联机游戏、狼人杀或者开歌会，不需要整套 PNGtuber 立绘，也可以用 **Voice Avatars**：上传或拉取几位的头像，自动按说话音量高亮边框与轻微弹跳，把链接丢进 OBS 角落就搞定。

<DocActionBar
  title="试着导入两张立绘动起来"
  description="可以直接前往 OBS 组件库找到 PNGtuber 或 Voice Avatars 进行配置。"
  route-name="manage-obsStore"
  button-text="打开 OBS 组件库"
/>
