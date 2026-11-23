---
title: 5 分钟快速上手
description: 绑定 B 站身份、接通直播间事件，并把第一个 VTsuru 浏览器源贴进 OBS 里跑起来。
category: getting-started
order: 1
badge: 必读
tags:
  - 快速开始
  - OBS
  - 身份码
  - Token
manageRoute: manage-index
manageLabel: 进入管理面板
---

VTsuru 一开始只是我因为受不了每次开播都要在十几个插件里来回切、干脆自己顺手搓的直播工具小站。核心思路很简单：**网页里配好样式和规则，OBS 里只用贴链接，有需要再配个桌面端补齐本地能力。**

照着下面三步走，5 分钟就能把第一个透明小组件挂到直播画面上。

<DocFigure
  title="VTsuru 整体工作流架构"
  badge="原理示意"
  caption="网页后台负责配置与样式，OBS 通过浏览器源渲染透明画面，桌面客户端负责本地语音/推流/VTube Studio 桥接"
>
  <svg viewBox="0 0 760 210" class="w-full h-auto" role="img" aria-label="VTsuru 工作流架构图">
    <rect x="16" y="28" width="210" height="154" rx="12" fill="var(--card)" stroke="var(--border)" stroke-width="1.5" />
    <text x="121" y="60" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">1. 网页工作台 (/manage)</text>
    <text x="121" y="88" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">绑定 B 站身份与直播间</text>
    <text x="121" y="108" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">配置弹幕机 / 挂件 / 积分规则</text>
    <text x="121" y="128" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">编排 OBS 多场景与个人主页</text>
    <rect x="46" y="144" width="150" height="24" rx="6" fill="var(--brand-soft)" />
    <text x="121" y="160" text-anchor="middle" font-size="11" font-weight="600" fill="var(--brand)">云端实时同步配置</text>
    <path d="M232 105 L272 105" stroke="var(--brand)" stroke-width="2" stroke-dasharray="4 3" />
    <polygon points="272,100 282,105 272,110" fill="var(--brand)" />
    <rect x="286" y="28" width="210" height="154" rx="12" fill="var(--card)" stroke="var(--brand)" stroke-width="1.5" />
    <text x="391" y="60" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">2. OBS 浏览器源 (/obs)</text>
    <text x="391" y="88" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">复制组件 URL 添加到 OBS</text>
    <text x="391" y="108" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">透明背景实时渲染互动画面</text>
    <text x="391" y="128" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">支持单源多场景无缝切换</text>
    <rect x="316" y="144" width="150" height="24" rx="6" fill="var(--muted)" />
    <text x="391" y="160" text-anchor="middle" font-size="11" font-weight="600" fill="var(--foreground)">改完样式免重启自动生效</text>
    <path d="M502 105 L542 105" stroke="var(--muted-foreground)" stroke-width="2" stroke-dasharray="4 3" />
    <polygon points="542,100 552,105 542,110" fill="var(--muted-foreground)" />
    <rect x="556" y="28" width="188" height="154" rx="12" fill="var(--card)" stroke="var(--border)" stroke-width="1.5" />
    <text x="650" y="60" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">3. 桌面客户端 (可选)</text>
    <text x="650" y="88" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">一键开播与获取推流码</text>
    <text x="650" y="108" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">自动回复 / 感谢 / 签到脚本</text>
    <text x="650" y="128" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">本地语音同传 &amp; VTS 联动</text>
    <rect x="580" y="144" width="140" height="24" rx="6" fill="var(--muted)" />
    <text x="650" y="160" text-anchor="middle" font-size="11" font-weight="600" fill="var(--foreground)">原生硬件与本地 RPC 桥接</text>
  </svg>
</DocFigure>

<DocFigure
  src="/docs-images/manage-dashboard.png"
  title="管理面板（/manage）实机界面"
  badge="工作台总览"
  caption="在管理面板可以查看常用快捷入口、B 站绑定状态、身份码连接情况与 Event Fetcher 状态（点击可放大）"
/>

## 三步开跑

<DocSteps>
  <DocStep title="登录并认领你的 B 站身份" badge="必需">
    进到管理面板后，按提示扫码或验证绑定 B 站账号。顺带一提，绑定完之后系统就会给你分配一个专属个人门户地址（比如 <code>https://vtsuru.live/@你的名字</code>），以后个人页、歌单、棉花糖都在这。
  </DocStep>
  <DocStep title="填好直播间身份码（接通事件流）" badge="关键">
    在管理面板把直播间身份码填好，服务端才能稳定收到直播间的弹幕、礼物、SC 和上舰事件。弹幕机、点歌、积分商城、排队投票都指望这条链路吃饭。
  </DocStep>
  <DocStep title="复制浏览器源 URL 丢进 OBS" badge="上屏">
    无论你配的是弹幕机、OBS 场景编辑器还是时钟/计数器小挂件，页面上都会给你一条专属链接。去 OBS 里新建「浏览器」来源，把链接贴进去就行——全站 <code>/obs/*</code> 和 <code>/obs-store/*</code> 都是默认透明底，不用自己折腾去背 CSS。
  </DocStep>
</DocSteps>

## OBS 浏览器源顺手调一下

| 设置项 | 建议怎么填 | 为什么 |
| :--- | :--- | :--- |
| 宽度 / 高度 | 按画布来（例如 `1920 × 1080`）或挂件自身尺寸 | 场景编辑器建议直接给满 `1920 × 1080` |
| 自定义 CSS | **直接清空** | 页面自带透明背景，留着 OBS 默认那段反而可能盖住样式 |
| 不可见时关闭源 | **建议取消勾选** | 这样你在 OBS 里切场景时不会把 WebSocket 连接断开重连 |
| 通过 OBS 控制音频 | 读弹幕 / 点播组件推荐勾上 | 方便你在 OBS 混音器里单独压一压 TTS 或点播音量 |

<DocCallout type="warning" title="播教程或截屏时留意一下 Token 链接">
  浏览器源链接里带着你的个人鉴权 Token，如果录屏调参数，记得别把链接完整露在画面里；万一不小心露了也没事，回管理面板重置一次 Token 即可。
</DocCallout>

<DocActionBar
  title="先去管理面板看一眼状态？"
  description="检查 B 站绑定、身份码连接情况，或者拿一条测试链接先跑跑看。"
  route-name="manage-index"
  button-text="打开管理面板"
/>
