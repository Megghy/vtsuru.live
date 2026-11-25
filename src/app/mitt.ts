import type { Emitter } from 'mitt'
import mitt from 'mitt'

export declare interface MittType {
  onOpenTemplateSettings: { template: string }
  'client:sidebar-auto-collapse': { active: boolean }
  [key: string | symbol]: any
}

const emitter: Emitter<MittType> = mitt<MittType>()

export default emitter
