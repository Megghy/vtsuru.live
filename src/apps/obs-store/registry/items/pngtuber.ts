import { PersonOutline } from '@vicons/ionicons5'

import type { ObsComponentDefinition } from '../types'

export const pngtuberComponent: ObsComponentDefinition = {
  id: 'pngtuber',
  name: 'PNGtuber 反应立绘',
  shortDescription: '麦克风驱动双图立绘，说话时切换张嘴图并附带动效',
  description:
    '上传静止与说话立绘（另有静止眨眼、说话眨眼槽位，共 4 张，可不填），由麦克风音量切换。支持多套表情与快捷键、配件贴饰，以及弹跳、果冻、摇摆等说话动效与呼吸、漂浮待机。',
  category: 'interactive',
  status: 'ready',
  tags: ['PNGtuber', '反应立绘', '麦克风', '弹跳'],
  icon: PersonOutline,
  obsPath: '/obs-store/pngtuber',
  managePath: '/obs-store/pngtuber-manage',
  defaultResolution: { width: 400, height: 500, label: '标准半身立绘 (400×500 px)' },
  supportedResolutions: [
    { width: 400, height: 500, label: '标准半身 (400×500 px)' },
    { width: 500, height: 650, label: '大尺寸 (500×650 px)' },
    { width: 320, height: 380, label: '迷你 Q 版 (320×380 px)' },
  ],
  features: [
    '麦克风音量检测，说话时切换立绘',
    '弹跳 / 果冻 / 摇摆等说话动效，可关闭',
    '待机呼吸与漂浮',
    '音量电平与阈值调节',
    '素材支持 PNG/APNG/GIF/WebP 上传（≤16 MB）或外链，支持镜像与阴影',
  ],
  version: '1.1.0',
  manageComponent: () => import('@/apps/obs-store/components/pngtuber/PngtuberViewer.vue'),
}
