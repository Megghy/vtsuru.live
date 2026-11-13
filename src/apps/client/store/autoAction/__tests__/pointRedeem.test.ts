import { describe, expect, it } from 'vitest'

import { resolveAudioPlayUrl } from '../modules/audioPlayer'
import { matchesPointRedeemTrigger, normalizePointRedeemEvent } from '../modules/pointRedeem'
import { ActionType, Priority, TriggerType, type AutoActionItem } from '../types'

function makePointAction(partial?: Partial<AutoActionItem['triggerConfig']>): AutoActionItem {
  return {
    id: 'p-1',
    name: '积分兑换测试',
    enabled: true,
    triggerType: TriggerType.POINT_REDEEM,
    actionType: ActionType.PLAY_AUDIO,
    template: '',
    priority: Priority.NORMAL,
    logicalExpression: '',
    ignoreCooldown: false,
    executeCommand: '',
    triggerConfig: {
      ...partial,
    },
    actionConfig: {
      audioSource: 'https://example.com/sfx.mp3',
      audioVolume: 0.8,
    },
  }
}

describe('pointRedeem module', () => {
  it('能兼容 PascalCase 和 camelCase Hub 载荷规范化', () => {
    const order = normalizePointRedeemEvent({
      OrderId: 101,
      GoodsId: 22,
      GoodsName: '拍桌音效',
      Count: 2,
      Point: 50,
      BuyerName: '测试观众',
      BuyerUid: 123456,
      SelectedSubItems: ['默认款 x2'],
      Remark: '响一点',
    })
    expect(order.orderId).toBe(101)
    expect(order.goodsId).toBe(22)
    expect(order.goodsName).toBe('拍桌音效')
    expect(order.isFree).toBe(false)
    expect(order.subItems).toBe('默认款 x2')
  })

  it('按商品 ID、关键词和免费开关过滤', () => {
    const paidOrder = normalizePointRedeemEvent({
      goodsId: 10,
      goodsName: '变声惩罚券',
      point: 100,
    })
    const freeOrder = normalizePointRedeemEvent({
      goodsId: 11,
      goodsName: '舰长月度壁纸',
      point: 0,
    })

    expect(matchesPointRedeemTrigger(makePointAction({ pointGoodsIds: [10] }), paidOrder)).toBe(true)
    expect(matchesPointRedeemTrigger(makePointAction({ pointGoodsIds: [99] }), paidOrder)).toBe(false)
    expect(matchesPointRedeemTrigger(makePointAction({ pointGoodsNameKeywords: ['惩罚'] }), paidOrder)).toBe(true)
    expect(matchesPointRedeemTrigger(makePointAction({ pointGoodsNameKeywords: ['音效'] }), paidOrder)).toBe(false)
    expect(matchesPointRedeemTrigger(makePointAction({ pointIncludeFree: false }), freeOrder)).toBe(false)
    expect(matchesPointRedeemTrigger(makePointAction({ pointIncludeFree: true }), freeOrder)).toBe(true)
  })
})

describe('audioPlayer module', () => {
  it('透传远程与虚拟协议 URL', async () => {
    expect(await resolveAudioPlayUrl('https://cdn.example.com/sound.mp3')).toBe('https://cdn.example.com/sound.mp3')
    expect(await resolveAudioPlayUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123')
  })

  it('空音频路径抛出错误', async () => {
    await expect(resolveAudioPlayUrl('   ')).rejects.toThrow('未配置音效文件或 URL')
  })
})
