import { Trophy } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const giftBoardComponent: ObsComponentDefinition = {
  id: 'gift-board',
  name: '本场感谢榜与舰长墙 (Gift Board)',
  shortDescription: '本场投喂排行 Top 1 Boss 置顶、实时投喂合并感谢流与本场大航海舰长墙，支持定时轮播',
  description:
    '专为主播打造的直播间投喂感谢与大航海展示看板。支持本场付费排行（Top 1 Boss 皇冠高亮 + 金银铜徽章）、实时礼物/SC/上舰合并感谢流、本场新舰长墙 3 种视图与自动轮播模式，可一键拉取本场排行并实时追踪直播间事件更新。',
  category: 'widget',
  status: 'ready',
  tags: ['感谢榜', '舰长墙', '投喂排行', '大航海', '实时同步'],
  icon: Trophy,
  obsPath: '/obs-store/gift-board',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=gift-board',
  defaultResolution: { width: 360, height: 440, label: '标准竖版榜单 (360×440 px)' },
  supportedResolutions: [
    { width: 360, height: 440, label: '标准竖版 (360×440 px)' },
    { width: 420, height: 520, label: '大号榜单 (420×520 px)' },
    { width: 300, height: 380, label: '紧凑侧栏 (300×380 px)' },
  ],
  features: [
    '支持本场投喂排行、实时合并感谢流、本场舰长墙及定时轮播 4 种展示模式',
    'Top 1 榜一 Boss 皇冠置顶高亮，2/3 名银铜徽章与总督/提督/舰长等级色标',
    '支持一键拉取当前场次付费排行，并开启直播间礼物/SC/上舰实时合并追踪',
    '内置空数据示例占位与模拟投喂功能，未开播即可在场景编辑器中完成视觉排版',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/gift-board/GiftBoardViewer.vue'),
}
