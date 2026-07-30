import type { Emitter } from 'mitt'
import mitt from 'mitt'

import type { Music } from '@/store/useMusicRequest'

export declare interface MittType {
  onOpenTemplateSettings: { template: string }
  onMusicRequestPlayerEnded: { music: Music }
  onMusicRequestPlayNextWaitingMusic: never
  onOBSComponentUpdate: never
  [key: string | symbol]: any
}
// 类型
const emitter: Emitter<MittType> = mitt<MittType>()

// 导出
export default emitter
