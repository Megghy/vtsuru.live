import mitt, { Emitter } from 'mitt'

declare type MittType<T = any> = {
  onOpenTemplateSettings: {
    template: string,
    
  }
};
// 类型
const emitter: Emitter<MittType> = mitt<MittType>()

// 导出
export default emitter
