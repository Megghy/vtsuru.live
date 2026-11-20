import { describe, expect, it } from 'vitest'

import type { ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { GoodsTypes, PointOrderStatus } from '@/api/generated/model'

import { parseExpressCsvRows } from '../pointExpressCsv'

function makeOrder(id: number, type = GoodsTypes.Physical): ResponsePointOrder2OwnerModel {
  return {
    id,
    type,
    status: PointOrderStatus.Pending,
    trackingNumber: '',
    expressCompany: '',
    customer: { name: `买家${id}` },
    goods: { name: `礼物${id}` },
  } as ResponsePointOrder2OwnerModel
}

describe('pointExpressCsv', () => {
  it('解析导出模板列序时，订单号列不被误判为快递单号列', () => {
    const orderMap = new Map([
      [1024, makeOrder(1024)],
      [2048, makeOrder(2048)],
    ])
    const csv = [
      '订单号,用户名,礼物,收件人,联系电话,收货地址,快递公司,快递单号',
      '1024,张三,亚克力立牌,张三,13800000000,北京市,中通,ZT987654321',
      '#2048,李四,"定制立牌,黑色",李四,13900000000,上海市,顺丰,SF123456789',
    ].join('\n')

    const rows = parseExpressCsvRows(csv, orderMap, '顺丰')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      orderId: 1024,
      expressCompany: '中通',
      trackingNumber: 'ZT987654321',
      error: undefined,
    })
    expect(rows[1]).toMatchObject({
      orderId: 2048,
      expressCompany: '顺丰',
      trackingNumber: 'SF123456789',
      error: undefined,
    })
  })

  it('无独立单号列且存在订单号+公司两列时，不把订单号回填为快递单号', () => {
    const orderMap = new Map([[1001, makeOrder(1001)]])
    const csv = ['订单号,快递公司', '1001,圆通'].join('\n')

    const rows = parseExpressCsvRows(csv, orderMap, '顺丰')
    expect(rows).toHaveLength(1)
    expect(rows[0].trackingNumber).toBe('')
    expect(rows[0].error).toBe('缺少快递单号')
  })

  it('仅含订单号+快递单号两列表头（或附带无关列）时，自动补全默认快递公司且不丢失单号', () => {
    const orderMap = new Map([
      [1002, makeOrder(1002)],
      [1003, makeOrder(1003)],
    ])
    const rows2 = parseExpressCsvRows(['订单号,快递单号', '1002,SF998877'].join('\n'), orderMap, '京东')
    expect(rows2).toHaveLength(1)
    expect(rows2[0]).toMatchObject({
      orderId: 1002,
      expressCompany: '京东',
      trackingNumber: 'SF998877',
      error: undefined,
    })

    const rows3 = parseExpressCsvRows(['订单号,快递单号,收件人', '1003,YT112233,王五'].join('\n'), orderMap, '圆通')
    expect(rows3[0]).toMatchObject({
      orderId: 1003,
      expressCompany: '圆通',
      trackingNumber: 'YT112233',
      error: undefined,
    })
  })

  it('无表头两列粘贴自动补全默认快递公司', () => {
    const orderMap = new Map([[3001, makeOrder(3001)]])
    const rows = parseExpressCsvRows('3001\tYT555666', orderMap, '韵达')
    expect(rows[0]).toMatchObject({
      orderId: 3001,
      expressCompany: '韵达',
      trackingNumber: 'YT555666',
      error: undefined,
    })
  })
})
