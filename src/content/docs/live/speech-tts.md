---
title: 多引擎读弹幕 (TTS)
description: 支持 MiMo 导演指令音色、Azure、CosyVoice、OpenAI、Qwen 及浏览器本地语音，把控播报队列与防刷屏门槛。
category: live
order: 2
tags:
  - 读弹幕
  - TTS
  - MiMo
  - Azure
  - CosyVoice
manageRoute: manage-speech
manageLabel: 打开读弹幕设置
---

打游戏或者画画顾不上盯弹幕区时，开个读弹幕就能边操作边和观众聊起来。为了照顾不同预算和声音偏好，这里接了好几套不同的语音合成（TTS）引擎。

<DocFigure
  src="/docs-images/speech-manage.png"
  title="弹幕朗读与语音播报控制台"
  badge="实机界面"
  caption="支持 CosyVoice3、MiMo TTS、Grok TTS、千问 TTS、Azure、OpenAI 兼容与本地语音等多引擎一键切换试听"
/>

## 支持哪些语音引擎

* **云端 AI 语音**：
  * **MiMo**：支持自定义音色以及写**导演指令**控制情绪、语气和语速（想要傲娇一点、温柔一点或播音腔都可以用提示词调）。
  * **Azure / CosyVoice3 / 千问 TTS / Grok TTS / OpenAI 兼容 / 自定义 API**：覆盖站内托管、国内云服务与直连/自建端点，音色库可直接在右侧试听。
* **浏览器 / 系统本地语音**：不消耗外部 API 额度，打开即可使用，适合轻量测试或备用。

> 快捷键提示：朗读运行中可随时按 `Ctrl + 空格` 暂停、`Ctrl + N` 跳过当前一条、`Ctrl + Q` 清空待播队列。

## 怎么防止弹幕刷屏炸麦

在「读弹幕」配置页面里，建议开播前顺手检查这几道防线：

1. **身份与门槛过滤**：可以设为仅读粉丝牌 ≥ N 级、舰长、或单句达到一定字数上限的弹幕，也可以单独打开礼物 / SC 感谢播报。
2. **关键词与屏蔽词**：过滤纯表情刷屏、重复口令（比如抽奖期间刷的统一弹幕）和违规词。
3. **单人冷却 & 最大队列长度**：如果同时涌进十几条弹幕，队列太长会导致播报严重滞后（播到三分钟前的弹幕就太出戏了），设好最大排队条数和单用户冷却秒数会舒服很多。

<DocCallout type="tip" title="OBS 单独控音量">
  如果你是在 OBS 浏览器源里开读弹幕网页（而不是在本机浏览器标签页直接出声），记得在 OBS 浏览器源属性里勾选「通过 OBS 控制音频」，这样混音器里就能单独给 TTS 压音量或一键静音。
</DocCallout>

<DocActionBar
  title="去试听一下不同音色"
  description="进入读弹幕设置页，选择语音引擎并发送一条测试弹幕听听效果。"
  route-name="manage-speech"
  button-text="打开读弹幕设置"
/>
