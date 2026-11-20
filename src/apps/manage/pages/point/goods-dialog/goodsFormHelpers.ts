import type { ResponsePointGoodModel, UploadPointGoodsModel } from '@/api/client-types'
import {
  type APIFileModel,
  GoodsSalePhase,
  GoodsStatus,
  GoodsTypes,
  GuardLevel,
  type RequestPointGoodsModel,
  type ResponseSubPointGoodsModel,
  type TempGuardFreeDate,
  type TempSubPointGoodsModel,
  type VirtualAttachmentModel,
  VirtualKeySelectionMode,
} from '@/api/generated/model'
import { FileStore, uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { fromRemoteImageList, getPendingUploadFiles, type UploadImageItem } from '@/shared/ui/image-upload'
import { toast } from '@/shared/utils'
import { addVtsuruLiveWatermark } from '@/shared/utils/imageWatermark'

export type SubItemsSortMode = 'manual' | 'name' | 'price' | 'stock'

export interface GoodsModel {
  goods: UploadPointGoodsModel
  cover: UploadImageItem[]
}

export interface InitializedGoodsDraft {
  model: GoodsModel
  subItemCoverFiles: Record<number, UploadImageItem[]>
  privateAttachments: VirtualAttachmentModel[]
  isAllowedPrivacyPolicy: boolean
  defaultAccordionValues: string[]
}

export interface GoodsValidationError {
  message: string
  accordion?: 'subItems' | 'rules' | 'schedule'
  fieldId?: string
}

let tempSubItemIdSeed = -1

export function nextTempSubItemId() {
  return tempSubItemIdSeed--
}

export function createDefaultGoodsModel(): GoodsModel {
  return {
    goods: {
      name: '',
      price: 100,
      status: GoodsStatus.Normal,
      type: GoodsTypes.Virtual,
      description: '',
      content: '',
      isAllowRebuy: true,
      maxBuyCount: 1,
      count: undefined,
      isPinned: false,
      tags: [],
      virtualKeys: [],
      keySelectionMode: VirtualKeySelectionMode.None,
      subItems: [],
      maxSubItemSelections: 0,
      saleStartTime: undefined,
      saleEndTime: undefined,
      discountPrice: undefined,
      discountStartTime: undefined,
      discountEndTime: undefined,
      setting: {
        allowGuardLevel: GuardLevel.None,
        allowGuardFreeMinLevel: GuardLevel.None,
      },
    },
    cover: [],
  }
}

export function initGoodsDraft(item?: ResponsePointGoodModel, duplicateMode = false): InitializedGoodsDraft {
  if (!item) {
    return {
      model: createDefaultGoodsModel(),
      subItemCoverFiles: {},
      privateAttachments: [],
      isAllowedPrivacyPolicy: false,
      defaultAccordionValues: [],
    }
  }

  const copied = JSON.parse(JSON.stringify(item)) as UploadPointGoodsModel
  const rawSubItems = (item.subItems ?? []) as Array<
    TempSubPointGoodsModel & { count?: number | null; originalPrice?: number }
  >

  // 编辑时需保留未打折前的原价作为基础价格，避免折扣期间保存覆盖原价
  copied.price = item.originalPrice ?? item.price
  copied.collectUrl = copied.collectUrl?.trim() ? copied.collectUrl : undefined
  copied.content = copied.content ?? ''
  copied.description = copied.description ?? ''
  copied.count = copied.count ?? undefined
  copied.saleStartTime = item.saleStartTime ?? undefined
  copied.saleEndTime = item.saleEndTime ?? undefined
  copied.discountPrice = item.discountPrice ?? undefined
  copied.discountStartTime = item.discountStartTime ?? undefined
  copied.discountEndTime = item.discountEndTime ?? undefined

  if (duplicateMode) {
    copied.id = undefined
    copied.name = `${item.name} (副本)`
    copied.status = GoodsStatus.Normal
    copied.isPinned = false
  }

  if (copied.setting?.guardFree && !copied.setting.guardFreeMonths?.length) {
    copied.setting.guardFreeMonths = [copied.setting.guardFree]
    copied.setting.guardFree = undefined
  }
  if (!copied.setting) {
    copied.setting = {
      allowGuardLevel: GuardLevel.None,
      allowGuardFreeMinLevel: GuardLevel.None,
    }
  }
  copied.tags ??= []
  copied.virtualKeys ??= []
  copied.keySelectionMode ??= VirtualKeySelectionMode.None
  copied.maxSubItemSelections ??= 0

  const coversMap: Record<number, UploadImageItem[]> = {}
  copied.subItems = rawSubItems.map((rawSub) => {
    const {
      count: legacyCount,
      originalPrice,
      ...sub
    } = JSON.parse(JSON.stringify(rawSub)) as TempSubPointGoodsModel & {
      count?: number | null
      originalPrice?: number
    }
    const id = duplicateMode ? nextTempSubItemId() : (sub.id ?? nextTempSubItemId())
    const resolvedStock = sub.stock ?? legacyCount ?? undefined
    const isInheritedCover = sub.cover?.id != null && item.cover?.id != null && sub.cover.id === item.cover.id
    let subCover = sub.cover
    if (subCover?.path && !isInheritedCover) {
      coversMap[id] = fromRemoteImageList([subCover], '封面')
    } else {
      coversMap[id] = []
      subCover = undefined
    }
    return {
      ...sub,
      id,
      price: originalPrice ?? sub.price,
      stock: resolvedStock,
      cover: subCover,
      isAllowRebuy: sub.isAllowRebuy ?? undefined,
      maxBuyCount: sub.maxBuyCount ?? undefined,
      description: sub.description ?? undefined,
    }
  })

  const defaultAccordionValues: string[] = []
  if ((copied.subItems?.length ?? 0) > 0) {
    defaultAccordionValues.push('subItems')
  }
  const hasSchedule =
    copied.saleStartTime != null ||
    copied.saleEndTime != null ||
    copied.discountPrice != null ||
    copied.discountStartTime != null ||
    copied.discountEndTime != null
  if (hasSchedule) {
    defaultAccordionValues.push('schedule')
  }
  const hasCustomRules =
    !copied.isAllowRebuy ||
    (copied.maxBuyCount ?? 1) > 1 ||
    (copied.setting.allowGuardLevel ?? GuardLevel.None) !== GuardLevel.None ||
    copied.setting.guardFreeMonths != null
  if (hasCustomRules) {
    defaultAccordionValues.push('rules')
  }

  return {
    model: {
      goods: copied,
      cover: fromRemoteImageList([item.cover], '封面'),
    },
    subItemCoverFiles: coversMap,
    privateAttachments: [...(item.privateAttachments ?? [])],
    isAllowedPrivacyPolicy: true,
    defaultAccordionValues,
  }
}

export function hasDuplicateMonths(months?: TempGuardFreeDate[] | null): boolean {
  if (!months || months.length <= 1) return false
  const seen = new Set<string>()
  for (const m of months) {
    const key = `${m.year}-${m.month}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export function validateGoodsDraft(model: GoodsModel, isAllowedPrivacyPolicy: boolean): GoodsValidationError | null {
  const g = model.goods
  if (!g.name?.trim()) return { message: '请输入礼物名称', fieldId: 'goods-field-name' }
  if (g.price === undefined || g.price === null || g.price < 0) {
    return { message: '所需积分不能小于 0', fieldId: 'goods-field-price' }
  }
  if (g.count !== undefined && g.count !== null && g.count < 0) {
    return { message: '礼物库存不能小于 0', fieldId: 'goods-field-stock' }
  }

  if (g.type === GoodsTypes.Physical) {
    if (g.collectUrl == null && !isAllowedPrivacyPolicy) {
      return { message: '请先阅读并同意本站收货隐私协议', fieldId: 'goods-privacy-policy' }
    }
    if (g.collectUrl != null && !g.collectUrl.trim()) {
      return { message: '请填写站外收集链接', fieldId: 'goods-collect-url' }
    }
  } else if (g.type === GoodsTypes.Virtual) {
    if (!g.content?.trim()) {
      return { message: '请填写虚拟礼物交付内容', fieldId: 'goods-virtual-content' }
    }
  }

  if (g.saleStartTime && g.saleEndTime && g.saleStartTime >= g.saleEndTime) {
    return { message: '停售时间必须晚于开售时间', accordion: 'schedule', fieldId: 'goods-sale-end' }
  }
  if (g.discountPrice != null) {
    if (g.discountPrice < 0) {
      return { message: '折扣积分不能小于 0', accordion: 'schedule', fieldId: 'goods-discount-price' }
    }
    if ((g.price ?? 0) > 0 && g.discountPrice >= (g.price ?? 0)) {
      return { message: '限时折扣积分必须低于原价', accordion: 'schedule', fieldId: 'goods-discount-price' }
    }
  }
  if (g.discountStartTime && g.discountEndTime && g.discountStartTime >= g.discountEndTime) {
    return { message: '折扣结束时间必须晚于开始时间', accordion: 'schedule', fieldId: 'goods-discount-end' }
  }

  for (const sub of g.subItems ?? []) {
    if (!sub.name?.trim()) {
      return { message: '存在未填写名称的款式', accordion: 'subItems', fieldId: `sub-name-${sub.id}` }
    }
    if (sub.price === undefined || sub.price < 0) {
      return {
        message: `款式「${sub.name}」的积分不能小于 0`,
        accordion: 'subItems',
        fieldId: `sub-price-${sub.id}`,
      }
    }
    if (sub.stock !== undefined && sub.stock !== null && sub.stock < 0) {
      return {
        message: `款式「${sub.name}」的库存不能小于 0`,
        accordion: 'subItems',
        fieldId: `sub-stock-${sub.id}`,
      }
    }
    if (sub.maxBuyCount !== undefined && sub.maxBuyCount !== null && sub.maxBuyCount <= 0) {
      return {
        message: `款式「${sub.name}」的单人限购数必须大于 0`,
        accordion: 'subItems',
        fieldId: `sub-max-buy-${sub.id}`,
      }
    }
  }

  if (g.maxBuyCount !== undefined && g.maxBuyCount !== null && g.maxBuyCount <= 0) {
    return { message: '单人最大兑换数量必须大于 0', accordion: 'rules', fieldId: 'goods-max-buy-count' }
  }
  if (hasDuplicateMonths(g.setting?.guardFreeMonths)) {
    return { message: '免费兑换月份不能存在重复月份', accordion: 'rules', fieldId: 'goods-guard-free' }
  }
  if (hasDuplicateMonths(g.setting?.guardLevelMonths)) {
    return {
      message: '限定上舰月份不能存在重复月份',
      accordion: 'rules',
      fieldId: 'goods-guard-level-limit',
    }
  }
  return null
}

async function uploadCover(file: File, shouldWatermark: boolean): Promise<APIFileModel> {
  let fileToUpload = file
  if (shouldWatermark) {
    try {
      fileToUpload = await addVtsuruLiveWatermark(file)
    } catch (err) {
      console.warn('水印添加失败，将使用原图上传:', err)
    }
  }
  const uploaded = await uploadFiles(fileToUpload, FileStore.Goods, (stage: string) => {
    if (stage === UploadStage.Preparing) toast.info('正在处理图片...')
    else if (stage === UploadStage.Uploading) toast.info('正在上传到云存储...')
  })
  if (!uploaded.length) {
    throw new Error('图片上传失败')
  }
  return uploaded[0]
}

async function resolveUploadItemFile(
  items: UploadImageItem[],
  shouldWatermark: boolean,
  existingCover?: APIFileModel,
): Promise<APIFileModel | undefined> {
  if (!items.length) return undefined
  const pendingFiles = getPendingUploadFiles(items)
  if (pendingFiles.length > 0) {
    return await uploadCover(pendingFiles[0], shouldWatermark)
  }
  return existingCover
}

export async function buildGoodsSubmitPayload(params: {
  model: GoodsModel
  subItemCoverFiles: Record<number, UploadImageItem[]>
  privateAttachments: VirtualAttachmentModel[]
  shouldWatermarkCover: boolean
}): Promise<RequestPointGoodsModel> {
  const { model, subItemCoverFiles, privateAttachments, shouldWatermarkCover } = params
  const coverFile = await resolveUploadItemFile(model.cover, shouldWatermarkCover, model.goods.cover)
  const subCoverResults = new Map<number, APIFileModel>()
  for (const sub of model.goods.subItems ?? []) {
    if (sub.id == null) continue
    const items = subItemCoverFiles[sub.id] ?? []
    const resolved = await resolveUploadItemFile(items, shouldWatermarkCover, sub.cover)
    if (resolved) subCoverResults.set(sub.id, resolved)
  }

  const g = JSON.parse(JSON.stringify(model.goods)) as UploadPointGoodsModel
  g.name = g.name?.trim()
  g.description = g.description?.trim() ? g.description.trim() : undefined
  if (g.type === GoodsTypes.Physical) {
    g.collectUrl = g.collectUrl?.trim() ? g.collectUrl.trim() : undefined
  }
  g.cover = coverFile
  g.maxSubItemSelections = g.maxSubItemSelections || undefined

  if (g.keySelectionMode === VirtualKeySelectionMode.None) {
    g.virtualKeys = []
  }
  if (g.setting) {
    g.setting.privateFileIds =
      g.type === GoodsTypes.Virtual && privateAttachments.length > 0 ? privateAttachments.map((f) => f.id) : []
  }

  if (g.subItems) {
    g.subItems = g.subItems.map((sub) => {
      const subId = sub.id
      const resolvedCover = subId != null ? subCoverResults.get(subId) : undefined
      return {
        ...sub,
        id: subId != null && subId > 0 ? subId : undefined,
        name: sub.name?.trim(),
        description: sub.description?.trim() ? sub.description.trim() : undefined,
        cover: resolvedCover,
        isAllowRebuy: sub.isAllowRebuy === g.isAllowRebuy ? undefined : sub.isAllowRebuy,
        maxBuyCount: sub.maxBuyCount === g.maxBuyCount ? undefined : sub.maxBuyCount,
      }
    })
  }

  return g
}

export function buildPreviewGoods(model: GoodsModel): ResponsePointGoodModel {
  const g = model.goods
  const now = Date.now()
  const basePrice = g.price ?? 0
  const isDiscountActive =
    g.discountPrice != null &&
    g.discountPrice >= 0 &&
    g.discountPrice < basePrice &&
    (!g.discountStartTime || now >= g.discountStartTime) &&
    (!g.discountEndTime || now <= g.discountEndTime)
  const effectivePrice = isDiscountActive ? g.discountPrice! : basePrice
  const ratio = isDiscountActive && basePrice > 0 ? Math.max(0, Math.min(1, effectivePrice / basePrice)) : 1

  const salePhase =
    g.saleStartTime && now < g.saleStartTime
      ? GoodsSalePhase.NotStarted
      : g.saleEndTime && now > g.saleEndTime
        ? GoodsSalePhase.Ended
        : GoodsSalePhase.Active

  const coverUrl = model.cover[0]?.url || g.cover?.path
  const hasGuardFree = g.setting?.guardFreeMonths != null
  const baseSetting = g.setting ?? {
    allowGuardLevel: GuardLevel.None,
    allowGuardFreeMinLevel: GuardLevel.None,
  }
  const previewSubItems: ResponseSubPointGoodsModel[] = (g.subItems ?? []).map((sub, idx) => {
    const subOriginal = sub.price ?? 0
    return {
      id: sub.id ?? -(idx + 1),
      name: sub.name?.trim() || `款式 #${idx + 1}`,
      originalPrice: subOriginal,
      price: isDiscountActive ? Number((subOriginal * ratio).toFixed(2)) : subOriginal,
      count: sub.stock ?? null,
      description: sub.description ?? undefined,
      tags: g.tags ?? [],
      type: g.type,
      embedCollectUrl: Boolean(g.embedCollectUrl),
      isAllowRebuy: sub.isAllowRebuy ?? g.isAllowRebuy,
      maxBuyCount: sub.maxBuyCount ?? g.maxBuyCount,
      canFreeBuy: hasGuardFree,
      allowGuardLevel: baseSetting.allowGuardLevel ?? GuardLevel.None,
      setting: baseSetting,
    }
  })

  return {
    id: g.id ?? 0,
    name: g.name?.trim() || '未命名礼物',
    description: g.description?.trim() || '暂无描述',
    count: g.count ?? null,
    originalPrice: basePrice,
    price: effectivePrice,
    isOnDiscount: isDiscountActive,
    discountPrice: g.discountPrice ?? null,
    discountStartTime: g.discountStartTime ?? null,
    discountEndTime: g.discountEndTime ?? null,
    saleStartTime: g.saleStartTime ?? null,
    saleEndTime: g.saleEndTime ?? null,
    salePhase,
    tags: g.tags ?? [],
    images: [],
    status: g.status,
    type: g.type,
    isPinned: Boolean(g.isPinned),
    isAllowRebuy: g.isAllowRebuy,
    maxBuyCount: g.maxBuyCount,
    maxSubItemSelections: g.maxSubItemSelections || null,
    createAt: now,
    canFreeBuy: hasGuardFree,
    hasGuardFreePrivilege: hasGuardFree,
    allowGuardLevel: g.setting?.allowGuardLevel ?? GuardLevel.None,
    cover: coverUrl
      ? { id: g.cover?.id ?? 0, name: g.name || 'cover', path: coverUrl, size: 0, store: 'preview' }
      : undefined,
    purchasedCount: 0,
    soldCount: 0,
    hasPurchased: false,
    canPurchase: true,
    subItems: previewSubItems.length > 0 ? previewSubItems : null,
    collectUrl: g.collectUrl ?? undefined,
    virtualKeys: g.virtualKeys ?? [],
    keySelectionMode: g.keySelectionMode,
  }
}

export function formatGoodsPriceText(goods: ResponsePointGoodModel): string {
  const subItems = goods.subItems ?? []
  if (!subItems.length) {
    return goods.price > 0 ? `${goods.price}` : '免费'
  }
  const prices = subItems.map((s) => s.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min <= 0 && max <= 0) return '免费'
  return min === max ? `${min}` : `${min}~${max}`
}
