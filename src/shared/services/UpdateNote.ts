import { h, type VNode } from 'vue'

import { ImagePreview } from '@/shared/ui/image-preview'

const NoteImage = (props: { src: string; width?: number; alt?: string }) =>
  h(ImagePreview, {
    src: props.src,
    alt: props.alt || '更新截图',
    wrapperClass: 'block max-w-full my-2',
    class: 'h-auto w-auto max-w-full rounded-md border-border',
    imageClass: 'w-full h-auto object-contain',
    style: props.width ? { maxWidth: `${props.width}px` } : undefined,
  })
const NoteButton = (props: any, context: any) => {
  const { tag, text: _text, type: _type, ...domProps } = props ?? {}
  const isAnchor = tag === 'a' || Boolean(domProps.href)
  return h(
    isAnchor ? 'a' : 'button',
    {
      ...domProps,
      ...(isAnchor && domProps.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
      class:
        'inline-flex items-center justify-center px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer no-underline',
    },
    context?.slots?.default?.() ?? context?.default?.() ?? [],
  )
}

import UpdateNoteContainer from '@/apps/web/components/UpdateNoteContainer.vue'
import { usePersistedStorage } from '@/shared/storage/persist'

export const updateNotes: updateNoteType[] = [
  {
    ver: 14,
    date: '2026.11.22',
    items: [
      {
        type: 'new',
        title: '新增 OBS 组件：小猫打字',
        content: [
          ['OBS 组件库新增 3D 透明背景「小猫打字 (Typing Cat)」挂件，跟随键盘敲击与鼠标操作实时伸爪拍键、点亮键帽并弹出按键标签，同时支持接入 OBS 场景编辑器'],
          ['内置奶牛猫、橘猫、狸花猫、三花猫、白猫、蓝灰猫 6 种花色与 5 套键鼠配色主题，支持各身体部位独立改色（含异瞳）、头戴耳机/项圈/眼镜/皇冠 3D 配饰、19 项体型比例微调、镜头视角调节以及配置文件快捷导入导出'],
          ['支持左手鼠标、隐私盲打、实时 KPM 手速计数、高速狂敲眯眼并甩尾巴打字、打哈欠/舔爪/扑击/猫面包揣手待机、按住摸头互动、闲置打盹、自主打字演示以及直播间弹幕/礼物/舰长事件联动反应'],
          [
            '入口：',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: '/manage/obs-store?component=typing-cat',
                  target: '_blank',
                  type: 'info',
                },
                () => '小猫打字控制台',
              ),
          ],
        ],
      },
    ],
  },
  {
    ver: 13,
    date: '2026.11.21',
    items: [
      {
        type: 'new',
        title: 'OBS 场景编辑器上线',
        content: [
          ['新增「OBS 场景编辑器」，可在网页画布中自由编排多个直播场景与全局常驻层，发布后通过单个 OBS 浏览器源即可实时切换画面'],
          ['内置站内直播组件（弹幕机、提问箱、点歌、点播、排队、抽奖、投票、日程等）、OBS 小挂件（时钟、计时器、字幕、转盘、手柄/键显等）以及图片、文本、走马灯、装饰框等图层，支持站内组件配置复用或独立保存'],
          ['支持画布拖拽缩放旋转、圆角与异形遮罩、框选多选、图层分组（支持嵌套、等比联动缩放与裁切超出）、右键选层及 Alt+点击 穿透选择'],
          ['支持与本地客户端及 OBS WebSocket 双向联动，可一键写入 OBS 浏览器源并跟随场景自动切换'],
          [
            '入口：',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: '/manage/obs-scene-editor',
                  target: '_blank',
                  type: 'info',
                },
                () => 'OBS 场景编辑器',
              ),
          ],
        ],
      },
      {
        type: 'optimize',
        title: '字体库与组件字体',
        content: [['重构字体选择器并补全完整字体库，支持为更多 OBS 组件自定义字体']],
      },
      {
        type: 'optimize',
        title: '图片加载与界面排版',
        content: [['优化图片按需压缩加载与部分管理台界面排版']],
      },
      {
        type: 'fix',
        title: 'OBS 组件显示修复',
        content: [['修复部分 OBS 组件主题切换不生效及透明/极简样式排版异常的问题']],
      },
    ],
  },
  {
    ver: 12,
    date: '2026.8.4',
    items: [
      {
        type: 'optimize',
        title: '日程表更新',
        content: [['加了一堆日程表样式']],
      },
    ],
  },
  {
    ver: 11,
    date: '2026.5.27',
    items: [
      {
        type: 'new',
        title: 'MiMo TTS 自定义音色支持编辑',
        content: [
          ['现在可以修改已创建的自定义音色的导演指令、描述和参考音频'],
          ['自定义音色的音频数据不再依赖浏览器本地存储'],
        ],
      },
      {
        type: 'optimize',
        title: 'MiMo TTS 体验优化',
        content: [
          ['填写 API Key 后试听也走直连，速度更快'],
          ['音色选择下拉框中可直接看到并切换自定义音色'],
          ['各输入项增加了风格标签、导演指令等用法参考'],
        ],
      },
    ],
  },
  {
    ver: 10,
    date: '2026.1.16',
    items: [
      {
        type: 'new',
        title: '自定义页面（区块编辑器）上线',
        content: [
          ['现在可以通过「自定义页面」用区块搭建你的页面内容：支持布局、分组、样式开关与实时预览'],
          [
            '现代化, 高自由度, 简单易用的页面搭建工具\r\n',
            '可以用来完全自定义地搭建页面内容, 包括但不仅限于: 个人介绍, 图集展示, 投稿页, 赞助页等等\r\n\r\n',
            '左侧可以添加新的页面, 右侧可以添加区块, 可以拖拽调整顺序, 拖到一起可以合并成组(布局), 点击区块可以调整参数\r\n',
            '如果有更多的区块建议可以提出, 后续会持续更新\r\n',
            () =>
              h(NoteImage, {
                src: 'https://files.vtsuru.suki.club/updatelog/屏幕截图 2026-01-16 213146.png',
                width: 300,
              }),
          ],
          [
            '入口：',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: '/manage/user-page-builder',
                  target: '_blank',
                  type: 'info',
                },
                () => '自定义页面',
              ),
            '  效果:',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: '/@Megghy',
                  target: '_blank',
                  type: 'info',
                },
                () => '查看效果',
              ),
          ],
        ],
      },
    ],
  },
  {
    ver: 9,
    date: '2025.11.17',
    items: [
      {
        type: 'new',
        title: 'VTsuru Client 新增直播管理功能',
        content: [
          [
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii',
                  target: '_blank',
                  type: 'info',
                },
                () => 'VTsuru Client ',
              ),
            ' 新增直播管理功能, 允许直接开播下播并使用OBS推流, 不再依赖直播姬\r\n',
            () => h(NoteImage, { src: 'https://files.vtsuru.suki.club/updatelog/QQ20251117-182002.png', width: 300 }),
          ],
        ],
      },
    ],
  },
  {
    ver: 8,
    date: '2025.10.16',
    items: [
      {
        type: 'new',
        title: '点播OBS组件新增简洁样式',
        content: [
          [
            '点播OBS组件新增无背景的简洁样式',
            () =>
              h(NoteImage, {
                src: 'https://files.vtsuru.suki.club/updatelog/7c8eab68-43d1-4a93-b927-57ebcdda0e5e.png',
                width: 300,
              }),
          ],
        ],
      },
      {
        type: 'new',
        title: '积分增加每日首次互动(发送弹幕/礼物)给予积分的功能',
        content: [['积分增加每日首次互动(发送弹幕/礼物)给予积分的功能']],
      },
    ],
  },
  {
    ver: 7,
    date: '2025.5.1',
    items: [
      {
        type: 'optimize',
        title: '礼物支持置顶和随机key',
        content: [
          ['积分礼物现在可以对部分进行置顶操作, 置顶的礼物会出现在礼物列表的最前面'],
          ['现在支持为礼物附加key, 可以在兑换礼物之后自动选择一个附加到礼物内容中'],
          ['礼物页面样式优化'],
        ],
      },
      {
        type: 'new',
        title: '签到功能增加排行榜, 允许仅签到',
        content: [
          [
            '签到功能增加排行榜, 可以查看签到天数和签到排名 ',
            () => h(NoteImage, { src: 'https://files.vtsuru.suki.club/updatelog/25_5_1_1.png', width: 300 }),
          ],
          [
            '签到功能增加仅签到功能, 可以只签到不给予积分, 修改设置项',
            () =>
              h(NoteImage, {
                src: 'https://files.vtsuru.suki.club/updatelog/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202025-05-01%20080506.png',
                width: 300,
              }),
          ],
        ],
      },
    ],
  },
  {
    ver: 6,
    date: '2025.4.26',
    items: [
      {
        type: 'new',
        title: '自动操作新增弹幕签到功能',
        content: [
          [
            '客户端新增弹幕签到功能，支持观众通过发送特定指令获得积分 (需扫码登录或者使用CookieCloud才能发送回复',
            () =>
              h(NoteImage, {
                src: 'https://pan.suki.club/d/vtsuru/imgur/0e784480a3016b748af2579b2c492a3b.png',
                width: 300,
              }),
          ],
          [
            '客户端安装方式:',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii',
                  target: '_blank',
                  type: 'info',
                },
                () => '查看介绍',
              ),
          ],
        ],
      },
      {
        type: 'optimize',
        title: '优化',
        content: [['读弹幕现在支持进入直播间消息']],
      },
    ],
  },
  {
    ver: 5,
    date: '2025.4.24',
    items: [
      {
        type: 'new',
        title: '新增弹幕姬管理页面',
        content: [
          [
            '弹幕姬现在可用，兼容 blivechat 样式',
            () =>
              h(NoteImage, {
                src: 'https://files.vtsuru.suki.club/updatelog/屏幕截图 2025-05-01 081550.png',
                width: 300,
              }),
          ],
          [
            '大部分功能都和 blivechat 一致, 不过目前还无法提供本地文件访问, 部分css中需要使用图片等本地资源样式的需要等 EventFetcher 更新相关功能后才能使用\r\n',
            '配置上传之后会自动同步到obs中',
          ],
        ],
      },
    ],
  },
  {
    ver: 4,
    date: '2025.4.22',
    items: [
      {
        type: 'new',
        title: '添加自动操作功能',
        content: [
          [
            'EventFetcher客户端新增多种自动操作类型支持，包括弹幕自动回复、礼物感谢、上舰发送私信、关注感谢、入场欢迎、定时发送和SC感谢等, 可以执行js代码',
            () => h(NoteImage, { src: 'https://pan.suki.club/d/vtsuru/imgur/QQ20250422-221703.png', width: 300 }),
          ],
          [
            '使用模板系统，支持随机回复、自定义表达式和条件判断等\r\n',
            '数据持久化存储，各类操作配置和运行状态不会丢失\r\n\r\n',
            '发送弹幕和私信需要客户端扫码登录, 客户端安装方式:',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii',
                  target: '_blank',
                  type: 'info',
                },
                () => '查看介绍',
              ),
          ],
        ],
      },
    ],
  },
  {
    ver: 3,
    date: '2025.4.15',
    items: [
      {
        type: 'new',
        title: 'Tauri 客户端新增弹幕机功能',
        content: [
          [
            'Tauri 客户端新增弹幕机功能, 可以在自己电脑上显示弹幕礼物等. ',
            '客户端需更新至0.1.2版本, 重启客户端后会自动更新',
            () =>
              h(NoteImage, {
                src: 'https://pan.suki.club/d/vtsuru/imgur/81d76a89-96b8-44e9-be79-6caaa5741f64.png',
                width: 200,
              }),
          ],
        ],
      },
    ],
  },
  {
    ver: 2,
    date: '2025.4.8',
    items: [
      {
        type: 'new',
        title: 'EventFetcher Tauri 客户端开始测试',
        content: [
          [
            '比当前所有 EventFetcher 部署方法都更要简单且支持扫码登录的客户端开始测试力, 支持Windows, Linux, MacOS (后两个没测试过',
          ],
          [
            '安装方式: ',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://www.wolai.com/carN6qvUm3FErze9Xo53ii',
                  target: '_blank',
                  type: 'info',
                },
                () => '查看介绍',
              ),
          ],
          ['当前可能存在一些问题, 可以加入秋秋群 873260337 进行反馈, 有功能需求也可以提出'],
          [],
          [
            '源码: ',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://github.com/Megghy/vtsuru-fetvher-client',
                  target: '_blank',
                  type: 'info',
                },
                () => ' 客户端 Repo ',
              ),
            ' | ',
            () =>
              h(
                NoteButton,
                {
                  text: true,
                  tag: 'a',
                  href: 'https://github.com/Megghy/vtsuru.live/tree/master/src/client',
                  target: '_blank',
                  type: 'info',
                },
                () => ' UI/逻辑 ',
              ),
          ],
          [
            () =>
              h(NoteImage, {
                src: 'https://pan.suki.club/d/vtsuru/imgur/01295402D7FBBF192FE5608179A4A7A6.png',
                width: 200,
              }),
          ],
        ],
      },
    ],
  },
  {
    ver: 1,
    date: '2025.3.18',
    items: [
      {
        title: '歌单',
        type: 'optimize',
        content: [
          [
            '新增一个歌单样式: 列表',
            () =>
              h(NoteImage, {
                src: 'https://pan.suki.club/d/vtsuru/imgur/QQ20250408-134631.png',
                width: 300,
                height: 200,
              }),
          ],
        ],
      },
    ],
  },
]

export const currentUpdateNoteVer = updateNotes.toSorted((a, b) => b.ver - a.ver)[0].ver
export const currentUpdateNote = updateNotes.toSorted((a, b) => b.ver - a.ver)[0].items
export const savedUpdateNoteVer = usePersistedStorage('UpdateNoteVer', 0)

export function checkUpdateNote() {
  if (savedUpdateNoteVer.value < currentUpdateNoteVer) {
    window.$dialog.create({
      title: '更新日志',
      content: UpdateNoteContainer,
      class: 'sm:max-w-[700px]',
      negativeText: '确定',
      positiveText: '下次更新前不再提示',
      onPositiveClick: () => {
        savedUpdateNoteVer.value = currentUpdateNoteVer
      },
      onClose: () => {
        savedUpdateNoteVer.value = currentUpdateNoteVer
      },
    })
  }
}

export type updateType = 'fix' | 'new' | 'optimize' | 'other'
export interface updateNoteType {
  ver: number
  date: string
  items: updateNoteItemType[]
}
export interface updateNoteItemType {
  title?: string | (() => VNode)
  type: updateType
  content: updateNoteItemContentType[]
}
export type updateNoteItemContentType = (() => VNode) | string | updateNoteItemContentType[]
