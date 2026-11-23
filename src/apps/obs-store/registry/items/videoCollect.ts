import { Clapperboard } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const videoCollectComponent: ObsComponentDefinition = {
  id: 'video-collect',
  name: '视频征集投稿角标 (Video Collect)',
  shortDescription: '茶话会/投稿鉴赏角标，一键切换当前观看投稿并同步封面、投稿人与留言至 OBS 画面',
  description:
    '专为直播间视频鉴赏茶话会与征集活动打造的 OBS 角标挂件。支持直连活跃视频征集表，在控制台点击上一个/下一个或任一已通过投稿，即可实时在 OBS 画面展示当前视频封面、标题、投稿人、UP 主、推荐留言及当前序号；另支持征集进度倒计时摘要与手动编辑模式。',
  category: 'widget',
  status: 'ready',
  tags: ['视频征集', '茶话会', '投稿鉴赏', '实时切播', '倒计时'],
  icon: Clapperboard,
  obsPath: '/obs-store/video-collect',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=video-collect',
  defaultResolution: { width: 440, height: 150, label: '标准角标 (440×150 px)' },
  supportedResolutions: [
    { width: 440, height: 150, label: '标准角标 (440×150 px)' },
    { width: 520, height: 170, label: '宽幅角标 (520×170 px)' },
    { width: 360, height: 130, label: '紧凑角落 (360×130 px)' },
  ],
  features: [
    '茶话会导播台直接浏览当前活跃征集表下已通过审核的视频列表，一键切播同步至 OBS',
    '自动展示视频封面、时长、标题、投稿观众、UP 主、推荐留言与当前序号（如 3 / 24）',
    '支持切换为征集进度摘要模式，实时展示已收集进度条与截止倒计时',
    '支持手动编辑模式与示例数据预览，无活跃征集活动时也能即时排版测试',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/video-collect/VideoCollectViewer.vue'),
}
