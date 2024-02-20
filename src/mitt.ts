import mitt, { Emitter } from 'mitt'
import { Music } from './store/useMusicRequest';

declare type MittType<T = any> = {
  onOpenTemplateSettings: {
    template: string,

  },
  onMusicRequestPlayerEnded: {
    music: Music
  }
  onMusicRequestPlayNextWaitingMusic: never
};
// 类型
const emitter: Emitter<MittType> = mitt<MittType>()

// 导出
export default emitter
