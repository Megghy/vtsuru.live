import { describe, expect, it, vi } from 'vitest'

import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'

import DanmakuEventEmitter from '../DanmakuClients/DanmakuEventEmitter'

class TestEmitter extends DanmakuEventEmitter {
  public type = 'local' as const

  public Start = async () => ({ success: true, message: '' })
  public Stop = () => undefined
  public emit(data: EventModel) {
    this.emitModel('danmaku', data)
  }
}

const data = {
  type: EventDataTypes.Message,
  uname: 'tester',
  msg: 'hello',
} as EventModel

describe('DanmakuEventEmitter', () => {
  it('isolates listener errors and continues every event channel', () => {
    const emitter = new TestEmitter()
    const rawAll = vi.fn()
    const modelListener = vi.fn()
    const modelAll = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    emitter.on('danmaku', () => {
      throw new Error('broken raw consumer')
    })
    emitter.on('all', rawAll)
    emitter.onEvent('danmaku', modelListener)
    emitter.onEvent('all', modelAll)

    emitter.emit(data)

    expect(modelListener).toHaveBeenCalledWith(data)
    expect(rawAll).toHaveBeenCalledWith(data)
    expect(modelAll).toHaveBeenCalledWith(data)
  })
})
