import { describe, expect, it, vi } from 'vitest'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsSalePhase, GoodsStatus, GoodsTypes, GuardLevel, VirtualKeySelectionMode } from '@/api/generated/model'

vi.mock('@/shared/services/fileUpload', () => ({
  FileStore: { Goods: 'Goods' },
  uploadFiles: vi.fn(async () => []),
  UploadStage: { Preparing: 'preparing', Uploading: 'uploading' },
}))

vi.mock('@/shared/ui/image-upload', () => ({
  fromRemoteImageList: (list: unknown[]) => list.filter(Boolean).map(() => ({ url: 'https://img.test/a.png' })),
  getPendingUploadFiles: () => [],
}))

vi.mock('@/shared/utils', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/shared/utils/imageWatermark', () => ({
  addVtsuruLiveWatermark: vi.fn(async (file: File) => file),
}))

import { buildGoodsSubmitPayload, initGoodsDraft, validateGoodsDraft } from '../goodsFormHelpers'

function makeResponseGoods(overrides?: Partial<ResponsePointGoodModel>): ResponsePointGoodModel {
  return {
    id: 10,
    name: '测试礼盒',
    description: 'desc',
    price: 200,
    originalPrice: 200,
    count: 50,
    tags: ['旧标签'],
    images: [],
    status: GoodsStatus.Normal,
    type: GoodsTypes.Virtual,
    content: '虚拟内容',
    collectUrl: undefined,
    embedCollectUrl: false,
    isPinned: false,
    isAllowRebuy: false,
    maxBuyCount: 0,
    createAt: 0,
    isOnDiscount: false,
    salePhase: GoodsSalePhase.Active,
    canFreeBuy: true,
    hasGuardFreePrivilege: false,
    allowGuardLevel: GuardLevel.Jianzhang,
    setting: {
      allowGuardLevel: GuardLevel.Jianzhang,
      allowGuardFreeMinLevel: GuardLevel.None,
    },
    virtualKeys: [],
    keySelectionMode: VirtualKeySelectionMode.None,
    soldCount: 5,
    purchasedCount: 1,
    hasPurchased: true,
    canPurchase: true,
    subItems: [
      {
        id: 101,
        name: '款式A',
        price: 150,
        originalPrice: 150,
        count: 5,
        tags: ['陈旧子标签'],
        type: GoodsTypes.Physical,
        collectUrl: 'https://stale.example',
        embedCollectUrl: true,
        isAllowRebuy: true,
        maxBuyCount: 3,
        canFreeBuy: true,
        allowGuardLevel: GuardLevel.Zongdu,
        setting: {
          allowGuardLevel: GuardLevel.Zongdu,
          allowGuardFreeMinLevel: GuardLevel.Jianzhang,
        },
      } as any,
    ],
    ...overrides,
  }
}

describe('goodsFormHelpers', () => {
  it('initGoodsDraft 与 buildGoodsSubmitPayload 剥离服务端从主商品继承的陈旧子项字段', async () => {
    const item = makeResponseGoods()
    const draft = initGoodsDraft(item, false)
    const draftSub = draft.model.goods.subItems?.[0] as unknown as Record<string, unknown>

    expect(draftSub.id).toBe(101)
    expect(draftSub.name).toBe('款式A')
    expect(draftSub.stock).toBe(5)
    expect('type' in draftSub).toBe(false)
    expect('tags' in draftSub).toBe(false)
    expect('collectUrl' in draftSub).toBe(false)
    expect('setting' in draftSub).toBe(false)
    expect('canFreeBuy' in draftSub).toBe(false)
    expect('allowGuardLevel' in draftSub).toBe(false)

    // 运行时即便被意外附加继承字段，提交载荷构建也应再次剥离
    draftSub.type = GoodsTypes.Physical
    draftSub.tags = ['污染']
    const payload = await buildGoodsSubmitPayload({
      model: draft.model,
      subItemCoverFiles: draft.subItemCoverFiles,
      privateAttachments: draft.privateAttachments,
      shouldWatermarkCover: false,
    })
    const sentSub = payload.subItems?.[0] as unknown as Record<string, unknown>
    expect('type' in sentSub).toBe(false)
    expect('tags' in sentSub).toBe(false)
    expect('setting' in sentSub).toBe(false)
  })

  it('initGoodsDraft 仅在非复制模式直接收集实体商品时预设同意隐私协议', () => {
    expect(initGoodsDraft(makeResponseGoods({ type: GoodsTypes.Virtual }), false).isAllowedPrivacyPolicy).toBe(false)
    expect(
      initGoodsDraft(makeResponseGoods({ type: GoodsTypes.Physical, collectUrl: 'https://form.test' }), false)
        .isAllowedPrivacyPolicy,
    ).toBe(false)
    expect(
      initGoodsDraft(makeResponseGoods({ type: GoodsTypes.Physical, collectUrl: undefined }), false)
        .isAllowedPrivacyPolicy,
    ).toBe(true)
    expect(
      initGoodsDraft(makeResponseGoods({ type: GoodsTypes.Physical, collectUrl: undefined }), true)
        .isAllowedPrivacyPolicy,
    ).toBe(false)
  })

  it('validateGoodsDraft 当禁止重复兑换时忽略 maxBuyCount<=0，允许重购时严格校验', () => {
    const draft = initGoodsDraft(makeResponseGoods({ isAllowRebuy: false, maxBuyCount: 0 }), false)
    draft.model.goods.subItems = []
    expect(validateGoodsDraft(draft.model, false)).toBeNull()

    draft.model.goods.isAllowRebuy = true
    expect(validateGoodsDraft(draft.model, false)?.fieldId).toBe('goods-max-buy-count')
  })

  it('buildGoodsSubmitPayload 按当前类型剥离跨类型交付字段且不修改原草稿', async () => {
    const base = initGoodsDraft(makeResponseGoods({ type: GoodsTypes.Virtual }), false)
    base.model.goods.collectUrl = 'https://external.example/form'
    base.model.goods.embedCollectUrl = true
    base.model.goods.content = '虚拟激活码 {key}'
    base.model.goods.keySelectionMode = VirtualKeySelectionMode.Random
    base.model.goods.virtualKeys = ['K1', 'K2']
    base.model.goods.serviceConfig = { fields: [], rules: '规则', paused: false }
    base.privateAttachments = [{ id: 88, name: 'guide.pdf', size: 1024 }]

    base.model.goods.type = GoodsTypes.Physical
    const physicalPayload = await buildGoodsSubmitPayload({
      model: base.model,
      subItemCoverFiles: base.subItemCoverFiles,
      privateAttachments: base.privateAttachments,
      shouldWatermarkCover: false,
    })
    expect(physicalPayload.collectUrl).toBe('https://external.example/form')
    expect(physicalPayload.embedCollectUrl).toBe(true)
    expect(physicalPayload.content).toBeUndefined()
    expect(physicalPayload.virtualKeys).toEqual([])
    expect(physicalPayload.keySelectionMode).toBe(VirtualKeySelectionMode.None)
    expect(physicalPayload.setting.privateFileIds).toEqual([])
    expect(physicalPayload.serviceConfig).toBeUndefined()

    // 切回虚拟类型时原有草稿应完好保留并正常序列化
    base.model.goods.type = GoodsTypes.Virtual
    const virtualPayload = await buildGoodsSubmitPayload({
      model: base.model,
      subItemCoverFiles: base.subItemCoverFiles,
      privateAttachments: base.privateAttachments,
      shouldWatermarkCover: false,
    })
    expect(virtualPayload.content).toBe('虚拟激活码 {key}')
    expect(virtualPayload.virtualKeys).toEqual(['K1', 'K2'])
    expect(virtualPayload.keySelectionMode).toBe(VirtualKeySelectionMode.Random)
    expect(virtualPayload.setting.privateFileIds).toEqual([88])
    expect(virtualPayload.collectUrl).toBeUndefined()
    expect(virtualPayload.embedCollectUrl).toBeUndefined()
    expect(virtualPayload.serviceConfig).toBeUndefined()

    base.model.goods.type = GoodsTypes.Service
    const servicePayload = await buildGoodsSubmitPayload({
      model: base.model,
      subItemCoverFiles: base.subItemCoverFiles,
      privateAttachments: base.privateAttachments,
      shouldWatermarkCover: false,
    })
    expect(servicePayload.serviceConfig).toEqual({ fields: [], rules: '规则', paused: false })
    expect(servicePayload.collectUrl).toBeUndefined()
    expect(servicePayload.content).toBeUndefined()
    expect(servicePayload.setting.privateFileIds).toEqual([])
    // 原草稿对象不应被序列化逻辑污染
    expect(base.model.goods.content).toBe('虚拟激活码 {key}')
    expect(base.privateAttachments).toHaveLength(1)
  })
})
