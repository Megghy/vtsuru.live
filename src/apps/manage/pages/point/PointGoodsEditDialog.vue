<script setup lang="ts">
import type { ResponsePointGoodModel, UploadPointGoodsModel } from '@/api/client-types'
import {
  type APIFileModel,
  GoodsStatus,
  GoodsTypes,
  GuardLevel,
  type RequestPointGoodsModel,
  type TempGuardFreeDate,
  type TempSubPointGoodsModel,
  type VirtualAttachmentModel,
  VirtualKeySelectionMode,
} from '@/api/generated/model'
import { postApiPointUpdateGoods } from '@/api/generated/point/point'
import { FileStore, uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { fromRemoteImageList, getPendingUploadFiles, ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { addVtsuruLiveWatermark } from '@/shared/utils/imageWatermark'
import { Add24Filled, ArrowDown24Filled, ArrowUp24Filled, Delete24Filled, Info24Regular } from '@vicons/fluent'
import DocumentLock24Regular from '@vicons/fluent/es/DocumentLock24Regular'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import ServiceGoodsConfig from './ServiceGoodsConfig.vue'

type GoodsModalTab = 'basic' | 'subItems' | 'rules'
type SubItemsSortMode = 'manual' | 'name' | 'price' | 'stock'

interface GoodsModel {
  goods: UploadPointGoodsModel
  cover: UploadImageItem[]
}

const props = defineProps<{
  editingGoods?: ResponsePointGoodModel
  existTags: string[]
}>()

const emit = defineEmits<{
  saved: [goods: ResponsePointGoodModel]
}>()

const open = defineModel<boolean>('open', { required: true })

const goodsTypeOptions = [
  { label: '虚拟礼物', value: GoodsTypes.Virtual },
  { label: '实体礼物', value: GoodsTypes.Physical },
  { label: '服务礼物', value: GoodsTypes.Service },
]

const keySelectionModeOptions = [
  { label: '不使用密钥', value: VirtualKeySelectionMode.None },
  { label: '随机分配', value: VirtualKeySelectionMode.Random },
  { label: '顺序分配', value: VirtualKeySelectionMode.Sequential },
]

const guardLevelOptions = [
  { label: '不限', value: GuardLevel.None },
  { label: '舰长', value: GuardLevel.Jianzhang },
  { label: '提督', value: GuardLevel.Tidu },
  { label: '总督', value: GuardLevel.Zongdu },
]

const guardThresholdOptions = [
  { label: '不限', value: GuardLevel.None },
  { label: '舰长及以上', value: GuardLevel.Jianzhang },
  { label: '提督及以上', value: GuardLevel.Tidu },
  { label: '仅总督', value: GuardLevel.Zongdu },
]

const subItemsSortOptions: { label: string; value: SubItemsSortMode }[] = [
  { label: '手动排序', value: 'manual' },
  { label: '按名称排序', value: 'name' },
  { label: '按价格排序', value: 'price' },
  { label: '按库存排序', value: 'stock' },
]

const currentYear = new Date().getFullYear()
const allowedYearOptions = Array.from({ length: 10 }, (_, idx) => {
  const year = currentYear - 2 + idx
  return { label: `${year}年`, value: String(year) }
})
const allowedMonthOptions = Array.from({ length: 12 }, (_, idx) => {
  const month = idx + 1
  return { label: `${month}月`, value: String(month) }
})

let tempSubItemIdSeed = -1

function createDefaultGoodsModel(): GoodsModel {
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
      setting: {
        allowGuardLevel: GuardLevel.None,
        allowGuardFreeMinLevel: GuardLevel.None,
      },
    },
    cover: [],
  }
}

const currentGoodsModel = ref<GoodsModel>(createDefaultGoodsModel())
const subItemCoverFiles = ref<Record<number, UploadImageItem[]>>({})
const goodsModalTab = ref<GoodsModalTab>('basic')
const subItemsSortMode = ref<SubItemsSortMode>('manual')
const shouldWatermarkCover = ref(true)
const isAllowedPrivacyPolicy = ref(false)
const isLoading = ref(false)
const tagInput = ref('')
const virtualKeyInput = ref('')
const privateAttachments = ref<VirtualAttachmentModel[]>([])
const uploadingPrivateFile = ref(false)
const privateFileInputRef = ref<HTMLInputElement>()

const isEditMode = computed(() => Boolean(currentGoodsModel.value.goods.id))
const isDirectCollect = computed(() => currentGoodsModel.value.goods.collectUrl === undefined)
const currentSetting = computed(() => {
  if (!currentGoodsModel.value.goods.setting) {
    currentGoodsModel.value.goods.setting = {
      allowGuardLevel: GuardLevel.None,
      allowGuardFreeMinLevel: GuardLevel.None,
    }
  }
  return currentGoodsModel.value.goods.setting
})

const subItemsForDisplay = computed(() => {
  const list = [...(currentGoodsModel.value.goods.subItems ?? [])]
  if (subItemsSortMode.value === 'name') {
    list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN'))
  } else if (subItemsSortMode.value === 'price') {
    list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  } else if (subItemsSortMode.value === 'stock') {
    list.sort((a, b) => (a.stock ?? Number.MAX_SAFE_INTEGER) - (b.stock ?? Number.MAX_SAFE_INTEGER))
  }
  return list
})

const availableQuickTags = computed(() => {
  const current = new Set(currentGoodsModel.value.goods.tags ?? [])
  return props.existTags.filter((tag) => !current.has(tag))
})

function buildCoverUploadItems(cover?: ResponsePointGoodModel['cover']): UploadImageItem[] {
  return fromRemoteImageList([cover], '封面')
}

function initFromEditingGoods(item?: ResponsePointGoodModel) {
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  shouldWatermarkCover.value = true
  tagInput.value = ''
  virtualKeyInput.value = ''
  subItemCoverFiles.value = {}
  privateAttachments.value = []

  if (!item) {
    currentGoodsModel.value = createDefaultGoodsModel()
    isAllowedPrivacyPolicy.value = false
    return
  }

  const copied = JSON.parse(JSON.stringify(item)) as UploadPointGoodsModel & {
    subItems?: TempSubPointGoodsModel[]
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
  if (!copied.tags) copied.tags = []
  if (!copied.virtualKeys) copied.virtualKeys = []
  if (copied.keySelectionMode === undefined || copied.keySelectionMode === null) {
    copied.keySelectionMode = VirtualKeySelectionMode.None
  }
  if (copied.maxSubItemSelections === null || copied.maxSubItemSelections === undefined) {
    copied.maxSubItemSelections = 0
  }

  const coversMap: Record<number, UploadImageItem[]> = {}
  copied.subItems = (copied.subItems ?? []).map((sub) => {
    const id = sub.id ?? tempSubItemIdSeed--
    if (sub.cover?.path) {
      coversMap[id] = buildCoverUploadItems(sub.cover)
    }
    return { ...sub, id }
  })
  subItemCoverFiles.value = coversMap
  privateAttachments.value = [...(item.privateAttachments ?? [])]
  currentGoodsModel.value = {
    goods: copied,
    cover: buildCoverUploadItems(item.cover),
  }
  isAllowedPrivacyPolicy.value = true
}

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      initFromEditingGoods(props.editingGoods)
    }
  },
  { immediate: true },
)

function addTag(raw?: string) {
  const value = (raw ?? tagInput.value).trim()
  if (!value) return
  const tags = currentGoodsModel.value.goods.tags ?? []
  if (!tags.includes(value)) {
    currentGoodsModel.value.goods.tags = [...tags, value]
  }
  if (!raw) tagInput.value = ''
}

function removeTag(tag: string) {
  currentGoodsModel.value.goods.tags = (currentGoodsModel.value.goods.tags ?? []).filter((t) => t !== tag)
}

function addVirtualKeys() {
  const parts = virtualKeyInput.value
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter(Boolean)
  if (!parts.length) return
  const existing = currentGoodsModel.value.goods.virtualKeys ?? []
  const merged = [...existing]
  for (const key of parts) {
    if (!merged.includes(key)) merged.push(key)
  }
  currentGoodsModel.value.goods.virtualKeys = merged
  virtualKeyInput.value = ''
}

function removeVirtualKey(key: string) {
  currentGoodsModel.value.goods.virtualKeys = (currentGoodsModel.value.goods.virtualKeys ?? []).filter((k) => k !== key)
}

function toggleCollectMode(mode: 'direct' | 'external') {
  if (mode === 'direct') {
    currentGoodsModel.value.goods.collectUrl = undefined
    currentGoodsModel.value.goods.embedCollectUrl = false
  } else {
    currentGoodsModel.value.goods.collectUrl ??= ''
  }
}

function onGoodsTypeChange(type: GoodsTypes) {
  currentGoodsModel.value.goods.type = type
  if (type === GoodsTypes.Service) {
    currentGoodsModel.value.goods.serviceConfig ??= { fields: [], rules: '', paused: false }
    currentGoodsModel.value.goods.content = undefined
    currentGoodsModel.value.goods.collectUrl = undefined
    currentGoodsModel.value.goods.embedCollectUrl = undefined
  } else {
    currentGoodsModel.value.goods.serviceConfig = undefined
  }
}

function addSubItem() {
  const tempId = tempSubItemIdSeed--
  const list = currentGoodsModel.value.goods.subItems ?? []
  list.push({
    id: tempId,
    name: '',
    price: currentGoodsModel.value.goods.price ?? 100,
    stock: undefined,
    description: undefined,
    isAllowRebuy: undefined,
    maxBuyCount: undefined,
  })
  currentGoodsModel.value.goods.subItems = list
  subItemCoverFiles.value[tempId] = []
}

function removeSubItem(subId: number | null | undefined) {
  const list = currentGoodsModel.value.goods.subItems
  if (!list) return
  const idx = list.findIndex((s) => s.id === subId)
  if (idx !== -1) list.splice(idx, 1)
  if (subId !== null && subId !== undefined) {
    delete subItemCoverFiles.value[subId]
  }
}

function moveSubItem(subId: number | null | undefined, direction: -1 | 1) {
  const list = currentGoodsModel.value.goods.subItems
  if (!list || subItemsSortMode.value !== 'manual') return
  const idx = list.findIndex((s) => s.id === subId)
  const target = idx + direction
  if (idx < 0 || target < 0 || target >= list.length) return
  const [item] = list.splice(idx, 1)
  list.splice(target, 0, item)
}

function getSubItemIndex(sub: TempSubPointGoodsModel): number {
  const idx = currentGoodsModel.value.goods.subItems?.findIndex((s) => s.id === sub.id) ?? -1
  return idx >= 0 ? idx + 1 : 0
}

function updateSubItemInheritFlag(sub: TempSubPointGoodsModel, field: 'isAllowRebuy' | 'maxBuyCount', inherit: boolean) {
  if (field === 'isAllowRebuy') {
    sub.isAllowRebuy = inherit ? undefined : true
  } else {
    sub.maxBuyCount = inherit ? undefined : 1
  }
}

function toggleMonthRule(key: 'guardFreeMonths' | 'guardLevelMonths', enabled: boolean) {
  const setting = currentSetting.value
  if (!enabled) {
    setting[key] = undefined
    return
  }
  const now = new Date()
  setting[key] = [{ year: now.getFullYear(), month: now.getMonth() + 1 }]
}

function toggleCurrentMonthOnly(key: 'guardFreeMonths' | 'guardLevelMonths', currentOnly: boolean) {
  const setting = currentSetting.value
  if (currentOnly) {
    setting[key] = []
    return
  }
  const now = new Date()
  setting[key] = [{ year: now.getFullYear(), month: now.getMonth() + 1 }]
}

function addYearMonth(key: 'guardFreeMonths' | 'guardLevelMonths') {
  const setting = currentSetting.value
  const now = new Date()
  setting[key] = [...(setting[key] ?? []), { year: now.getFullYear(), month: now.getMonth() + 1 }]
}

function removeYearMonth(key: 'guardFreeMonths' | 'guardLevelMonths', index: number) {
  const list = currentSetting.value[key]
  if (!list || list.length <= 1) return
  list.splice(index, 1)
}

function updateYearMonthField(
  item: TempGuardFreeDate,
  field: 'year' | 'month',
  raw: unknown,
) {
  const num = Number(raw)
  if (!Number.isFinite(num)) return
  item[field] = num
}

function hasDuplicateMonths(months?: TempGuardFreeDate[] | null): boolean {
  if (!months || months.length <= 1) return false
  const seen = new Set<string>()
  for (const m of months) {
    const key = `${m.year}-${m.month}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function failValidation(message: string, tab?: GoodsModalTab): false {
  toast.error(message)
  if (tab) goodsModalTab.value = tab
  return false
}

function validateGoodsModel(): boolean {
  const g = currentGoodsModel.value.goods
  if (!g.name?.trim()) return failValidation('请输入礼物名称', 'basic')
  if (g.price === undefined || g.price === null || g.price < 0) return failValidation('所需积分不能小于 0', 'basic')
  if (g.count !== undefined && g.count !== null && g.count < 0) return failValidation('礼物库存不能小于 0', 'basic')

  if (g.type === GoodsTypes.Physical) {
    if (g.collectUrl === undefined && !isAllowedPrivacyPolicy.value) {
      return failValidation('请先阅读并同意本站收货隐私协议', 'basic')
    }
    if (g.collectUrl !== undefined && !g.collectUrl.trim()) {
      return failValidation('请填写站外收集链接', 'basic')
    }
  } else if (g.type === GoodsTypes.Virtual) {
    if (!g.content?.trim()) return failValidation('请填写虚拟礼物交付内容', 'basic')
  }

  for (const sub of g.subItems ?? []) {
    if (!sub.name?.trim()) return failValidation('存在未填写名称的款式', 'subItems')
    if (sub.price === undefined || sub.price < 0) return failValidation(`款式「${sub.name}」的积分不能小于 0`, 'subItems')
    if (sub.stock !== undefined && sub.stock !== null && sub.stock < 0) {
      return failValidation(`款式「${sub.name}」的库存不能小于 0`, 'subItems')
    }
    if (sub.maxBuyCount !== undefined && sub.maxBuyCount !== null && sub.maxBuyCount <= 0) {
      return failValidation(`款式「${sub.name}」的单人限购数必须大于 0`, 'subItems')
    }
  }

  if (g.maxBuyCount !== undefined && g.maxBuyCount !== null && g.maxBuyCount <= 0) {
    return failValidation('单人最大兑换数量必须大于 0', 'rules')
  }
  const setting = g.setting
  if (hasDuplicateMonths(setting?.guardFreeMonths)) {
    return failValidation('免费兑换月份不能存在重复月份', 'rules')
  }
  if (hasDuplicateMonths(setting?.guardLevelMonths)) {
    return failValidation('限定上舰月份不能存在重复月份', 'rules')
  }
  return true
}

async function uploadCover(file: File): Promise<APIFileModel> {
  let fileToUpload = file
  if (shouldWatermarkCover.value) {
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
  existingCover?: APIFileModel,
): Promise<APIFileModel | undefined> {
  if (!items.length) return undefined
  const pendingFiles = getPendingUploadFiles(items)
  if (pendingFiles.length > 0) {
    return await uploadCover(pendingFiles[0])
  }
  return existingCover
}

function buildSubmitPayload(coverFile?: APIFileModel, subCoverResults?: Map<number, APIFileModel>): RequestPointGoodsModel {
  const g = JSON.parse(JSON.stringify(currentGoodsModel.value.goods)) as UploadPointGoodsModel
  g.name = g.name?.trim()
  g.description = g.description?.trim() ? g.description.trim() : undefined
  g.cover = coverFile
  g.maxSubItemSelections = g.maxSubItemSelections || undefined

  if (g.keySelectionMode === VirtualKeySelectionMode.None) {
    g.virtualKeys = []
  }
  if (g.setting) {
    g.setting.privateFileIds =
      g.type === GoodsTypes.Virtual && privateAttachments.value.length > 0
        ? privateAttachments.value.map((f) => f.id)
        : []
  }

  if (g.subItems) {
    g.subItems = g.subItems.map((sub) => {
      const subId = sub.id
      const resolvedCover = subId !== null && subId !== undefined ? subCoverResults?.get(subId) : undefined
      return {
        ...sub,
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

async function updateGoods() {
  if (!validateGoodsModel()) return
  isLoading.value = true
  try {
    const coverFile = await resolveUploadItemFile(currentGoodsModel.value.cover, currentGoodsModel.value.goods.cover)
    const subCoverResults = new Map<number, APIFileModel>()
    for (const sub of currentGoodsModel.value.goods.subItems ?? []) {
      if (sub.id === null || sub.id === undefined) continue
      const items = subItemCoverFiles.value[sub.id] ?? []
      const resolved = await resolveUploadItemFile(items, sub.cover)
      if (resolved) subCoverResults.set(sub.id, resolved)
    }

    const payload = buildSubmitPayload(coverFile, subCoverResults)
    const res = await postApiPointUpdateGoods(payload)
    if (res.code === 200 && res.data) {
      toast.success(isEditMode.value ? '修改礼物成功' : '添加礼物成功')
      emit('saved', res.data as ResponsePointGoodModel)
      open.value = false
    } else {
      toast.error(res.message || '保存失败')
    }
  } catch (err) {
    console.error(err)
    toast.error('保存失败')
  } finally {
    isLoading.value = false
  }
}

async function handlePrivateFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length) return
  uploadingPrivateFile.value = true
  try {
    const uploaded = await uploadFiles(files, FileStore.GoodsPrivate)
    for (const file of uploaded) {
      if (!privateAttachments.value.some((existing) => existing.id === file.id)) {
        privateAttachments.value.push({
          id: file.id,
          name: file.name || `附件_${file.id}`,
          size: file.size ?? 0,
        })
      }
    }
    toast.success(`已上传 ${uploaded.length} 个私有附件`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '私有附件上传失败')
  } finally {
    uploadingPrivateFile.value = false
  }
}

function removePrivateAttachment(fileId: number) {
  privateAttachments.value = privateAttachments.value.filter((f) => f.id !== fileId)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
      <DialogHeader class="p-6 pb-2 border-b">
        <DialogTitle>{{ isEditMode ? '修改礼物' : '添加礼物' }}</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        <Tabs v-model="goodsModalTab" class="w-full">
          <TabsList class="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="basic">
              商品与交付
            </TabsTrigger>
            <TabsTrigger value="subItems">
              款式设置 ({{ currentGoodsModel.goods.subItems?.length ?? 0 }})
            </TabsTrigger>
            <TabsTrigger value="rules">
              规则与特权
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" class="space-y-4">
            <div class="text-xs font-semibold text-muted-foreground border-b pb-1">
              基本信息
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="礼物名称"
                required
                v-model="currentGoodsModel.goods.name"
                placeholder="请输入礼物名称"
                :maxlength="200"
              />
              <FormField label="所需积分" required>
                <NumberField
                  :model-value="currentGoodsModel.goods.price ?? 0"
                  :min="0"
                  @update:model-value="currentGoodsModel.goods.price = $event ?? 0"
                />
              </FormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="库存设置">
                <div class="flex items-center gap-3 min-h-8">
                  <div class="flex items-center gap-1.5 shrink-0">
                    <Checkbox
                      id="goods-unlimited-stock"
                      :checked="currentGoodsModel.goods.count === undefined"
                      @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 10)"
                    />
                    <label for="goods-unlimited-stock" class="text-xs cursor-pointer">不限库存</label>
                  </div>
                  <NumberField
                    v-if="currentGoodsModel.goods.count !== undefined"
                    :model-value="currentGoodsModel.goods.count ?? 0"
                    :min="0"
                    class="flex-1"
                    @update:model-value="currentGoodsModel.goods.count = $event ?? 0"
                  />
                </div>
              </FormField>

              <FormField label="展示设置">
                <div class="flex items-center gap-2 min-h-8">
                  <Checkbox
                    id="goods-pinned"
                    :checked="Boolean(currentGoodsModel.goods.isPinned)"
                    @update:checked="(v) => (currentGoodsModel.goods.isPinned = Boolean(v))"
                  />
                  <label for="goods-pinned" class="text-xs cursor-pointer">在礼物列表顶部置顶显示</label>
                </div>
              </FormField>
            </div>

            <FormField
              label="礼物描述"
              type="textarea"
              v-model="currentGoodsModel.goods.description"
              placeholder="可选，输入关于礼物的详细介绍与说明"
              :maxlength="500"
              :rows="3"
              :extra="`${(currentGoodsModel.goods.description ?? '').length}/500`"
            />

            <FormField label="分类标签" extra="可用于前台礼物筛选与分组展示">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Input
                    v-model="tagInput"
                    placeholder="输入标签名后按回车或点击添加"
                    class="flex-1"
                    @keydown.enter.prevent="addTag()"
                  />
                  <Button type="button" variant="outline" :disabled="!tagInput.trim()" @click="addTag()">
                    添加
                  </Button>
                </div>
                <div v-if="currentGoodsModel.goods.tags?.length" class="flex flex-wrap gap-1.5">
                  <Tag
                    v-for="tag in currentGoodsModel.goods.tags"
                    :key="tag"
                    type="primary"
                    closable
                    @close="removeTag(tag)"
                  >
                    {{ tag }}
                  </Tag>
                </div>
                <div v-if="availableQuickTags.length" class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs text-muted-foreground">快速添加:</span>
                  <Button
                    v-for="tag in availableQuickTags"
                    :key="tag"
                    type="button"
                    variant="ghost"
                    size="xs"
                    class="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    @click="addTag(tag)"
                  >
                    + {{ tag }}
                  </Button>
                </div>
              </div>
            </FormField>

            <FormField label="礼物封面">
              <div class="space-y-2">
                <ImageUpload
                  v-model="currentGoodsModel.cover"
                  :max-files="1"
                  accept="image/*"
                  size="md"
                />
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="goods-watermark"
                    :checked="shouldWatermarkCover"
                    @update:checked="(v) => (shouldWatermarkCover = Boolean(v))"
                  />
                  <label for="goods-watermark" class="text-xs text-muted-foreground cursor-pointer">
                    上传封面时自动添加水印
                  </label>
                </div>
              </div>
            </FormField>

            <div class="text-xs font-semibold text-muted-foreground border-b pb-1 pt-2">
              交付与类型配置
            </div>

            <FormField label="礼物类型">
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="opt in goodsTypeOptions"
                  :key="opt.value"
                  type="button"
                  :variant="currentGoodsModel.goods.type === opt.value ? 'default' : 'outline'"
                  @click="onGoodsTypeChange(opt.value)"
                >
                  {{ opt.label }}
                </Button>
              </div>
            </FormField>

            <template v-if="currentGoodsModel.goods.type === GoodsTypes.Virtual">
              <FormField
                label="交付内容"
                required
                hint="支持使用 {key} 占位符，启用密钥自动发放时将自动替换为分配的密钥"
              >
                <Textarea
                  :model-value="currentGoodsModel.goods.content ?? ''"
                  placeholder="兑换后向用户展示的虚拟内容（如网盘链接、兑换码模板 {key} 等）"
                  :maxlength="500"
                  rows="3"
                  @update:model-value="currentGoodsModel.goods.content = String($event)"
                />
              </FormField>

              <FormField label="卡密 / 密钥自动发放">
                <div class="flex flex-wrap gap-2">
                  <Button
                    v-for="opt in keySelectionModeOptions"
                    :key="opt.value"
                    type="button"
                    :variant="currentGoodsModel.goods.keySelectionMode === opt.value ? 'default' : 'outline'"
                    @click="currentGoodsModel.goods.keySelectionMode = opt.value"
                  >
                    {{ opt.label }}
                  </Button>
                </div>
              </FormField>

              <FormField
                v-if="currentGoodsModel.goods.keySelectionMode !== VirtualKeySelectionMode.None"
                label="卡密库"
                :extra="`已添加 ${currentGoodsModel.goods.virtualKeys?.length ?? 0} 个密钥，兑换时将自动分配并消耗`"
              >
                <div class="space-y-2">
                  <div class="flex items-start gap-2">
                    <Textarea
                      v-model="virtualKeyInput"
                      placeholder="输入卡密或密钥（支持每行一个批量粘贴）"
                      rows="2"
                      class="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      :disabled="!virtualKeyInput.trim()"
                      @click="addVirtualKeys"
                    >
                      添加
                    </Button>
                  </div>
                  <div v-if="currentGoodsModel.goods.virtualKeys?.length" class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin p-1">
                    <Tag
                      v-for="key in currentGoodsModel.goods.virtualKeys"
                      :key="key"
                      type="info"
                      closable
                      @close="removeVirtualKey(key)"
                    >
                      {{ key }}
                    </Tag>
                  </div>
                </div>
              </FormField>

              <FormField
                label="私有附件文件"
                extra="仅对已兑换该虚拟商品的用户签发 15 分钟临期签名下载链接，未兑换用户无法获取"
              >
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      ref="privateFileInputRef"
                      type="file"
                      multiple
                      class="hidden"
                      @change="handlePrivateFileChange"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      :loading="uploadingPrivateFile"
                      @click="privateFileInputRef?.click()"
                    >
                      <component :is="DocumentLock24Regular" class="size-3.5 mr-1" />
                      上传私有附件 (≤10MB)
                    </Button>
                  </div>
                  <div v-if="privateAttachments.length" class="space-y-1">
                    <div
                      v-for="file in privateAttachments"
                      :key="file.id"
                      class="flex-between px-2.5 py-1.5 rounded border border-border bg-muted/30 text-xs"
                    >
                      <span class="truncate font-medium">{{ file.name }}</span>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-muted-foreground tabular-nums">{{ formatFileSize(file.size) }}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          @click="removePrivateAttachment(file.id)"
                        >
                          <component :is="Delete24Filled" class="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </FormField>
            </template>

            <template v-else-if="currentGoodsModel.goods.type === GoodsTypes.Physical">
              <FormField label="收货地址收集方式">
                <div class="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    :variant="isDirectCollect ? 'default' : 'outline'"
                    @click="toggleCollectMode('direct')"
                  >
                    通过本站直接收集
                  </Button>
                  <Button
                    type="button"
                    :variant="!isDirectCollect ? 'default' : 'outline'"
                    @click="toggleCollectMode('external')"
                  >
                    使用站外链接收集
                  </Button>
                </div>
              </FormField>

              <div v-if="isDirectCollect" class="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                <Checkbox
                  id="goods-privacy-policy"
                  :checked="isAllowedPrivacyPolicy"
                  @update:checked="(v) => (isAllowedPrivacyPolicy = Boolean(v))"
                />
                <label for="goods-privacy-policy" class="text-xs cursor-pointer">
                  我已阅读并同意本站收货信息收集与隐私保护协议，并承诺仅用于礼物寄送
                </label>
              </div>

              <div v-else class="space-y-3">
                <FormField
                  label="站外收集链接"
                  required
                  v-model="currentGoodsModel.goods.collectUrl"
                  placeholder="请输入收集表单链接（如腾讯文档、问卷星、表单链接等）"
                  :maxlength="300"
                />
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="goods-embed-collect"
                    :checked="Boolean(currentGoodsModel.goods.embedCollectUrl)"
                    @update:checked="(v) => (currentGoodsModel.goods.embedCollectUrl = Boolean(v))"
                  />
                  <label for="goods-embed-collect" class="text-xs cursor-pointer">
                    尝试将外部收集表单直接内嵌到网页中展示
                  </label>
                </div>
              </div>
            </template>

            <template v-else-if="currentGoodsModel.goods.type === GoodsTypes.Service">
              <ServiceGoodsConfig v-model="currentGoodsModel.goods.serviceConfig" />
            </template>
          </TabsContent>

          <TabsContent value="subItems" class="space-y-4">
            <Alert variant="info" size="sm">
              <Info24Regular class="size-4" />
              <AlertDescription>
                前台兑换时用户可选择具体款式；款式价格为最终兑换价，库存按款式独立计算。未单独配置的属性默认沿用主商品配置。
              </AlertDescription>
            </Alert>

            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground whitespace-nowrap">单次最多可选:</span>
                  <NumberField
                    :model-value="currentGoodsModel.goods.maxSubItemSelections ?? 0"
                    :min="0"
                    class="w-24"
                    @update:model-value="currentGoodsModel.goods.maxSubItemSelections = $event ?? 0"
                  />
                  <span class="text-xs text-muted-foreground">种 (0为不限)</span>
                </div>

                <Select v-model="subItemsSortMode">
                  <SelectTrigger class="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in subItemsSortOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" variant="outline" @click="addSubItem">
                <Add24Filled class="size-3.5 mr-1" />
                添加款式
              </Button>
            </div>

            <Empty
              v-if="!currentGoodsModel.goods.subItems?.length"
              description="暂无款式，点击右上角添加"
              class="py-8"
            />

            <div v-else class="space-y-3">
              <Card
                v-for="sub in subItemsForDisplay"
                :key="sub.id ?? sub.name"
                class="bg-muted/20"
              >
                <CardContent class="p-3 space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-primary">
                      款式 #{{ getSubItemIndex(sub) }}
                    </span>
                    <div class="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        :disabled="subItemsSortMode !== 'manual' || getSubItemIndex(sub) <= 1"
                        @click="moveSubItem(sub.id, -1)"
                      >
                        <ArrowUp24Filled class="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        :disabled="subItemsSortMode !== 'manual' || getSubItemIndex(sub) >= (currentGoodsModel.goods.subItems?.length ?? 0)"
                        @click="moveSubItem(sub.id, 1)"
                      >
                        <ArrowDown24Filled class="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        class="text-destructive"
                        @click="removeSubItem(sub.id)"
                      >
                        <Delete24Filled class="size-3.5 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField
                      label="款式名称"
                      required
                      v-model="sub.name"
                      placeholder="如: 粉色 / 大号"
                      :maxlength="100"
                    />
                    <FormField label="所需积分" required>
                      <NumberField
                        :model-value="sub.price ?? 0"
                        :min="0"
                        @update:model-value="sub.price = $event ?? 0"
                      />
                    </FormField>
                    <FormField label="款式库存">
                      <div class="flex items-center gap-2 min-h-8">
                        <div class="flex items-center gap-1.5 shrink-0">
                          <Checkbox
                            :id="`sub-unlimited-${sub.id}`"
                            :checked="sub.stock === undefined"
                            @update:checked="(v) => (sub.stock = v ? undefined : 10)"
                          />
                          <label :for="`sub-unlimited-${sub.id}`" class="text-xs cursor-pointer">不限</label>
                        </div>
                        <NumberField
                          v-if="sub.stock !== undefined"
                          :model-value="sub.stock ?? 0"
                          :min="0"
                          class="flex-1"
                          @update:model-value="sub.stock = $event ?? 0"
                        />
                      </div>
                    </FormField>
                  </div>

                  <Accordion type="single" collapsible class="border-t pt-1">
                    <AccordionItem value="override" class="border-b-0">
                      <AccordionTrigger class="py-2 text-xs text-muted-foreground hover:no-underline">
                        独立属性覆盖 (可选，默认沿用主商品配置)
                      </AccordionTrigger>
                      <AccordionContent class="pt-2 space-y-3">
                        <FormField label="款式封面" v-if="sub.id !== null && sub.id !== undefined">
                          <ImageUpload
                            v-model="subItemCoverFiles[sub.id]"
                            :max-files="1"
                            accept="image/*"
                            size="xs"
                          />
                        </FormField>

                        <FormField
                          label="款式描述"
                          type="textarea"
                          v-model="sub.description"
                          placeholder="留空则沿用主商品描述"
                          :maxlength="500"
                          :rows="2"
                        />

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <FormField label="允许重购">
                            <div class="flex flex-wrap items-center gap-3 min-h-8">
                              <div class="flex items-center gap-1.5">
                                <Checkbox
                                  :id="`sub-rebuy-inherit-${sub.id}`"
                                  :checked="sub.isAllowRebuy === undefined"
                                  @update:checked="(v) => updateSubItemInheritFlag(sub, 'isAllowRebuy', Boolean(v))"
                                />
                                <label :for="`sub-rebuy-inherit-${sub.id}`" class="text-xs cursor-pointer">
                                  沿用主商品
                                </label>
                              </div>
                              <div v-if="sub.isAllowRebuy !== undefined" class="flex items-center gap-1.5">
                                <Checkbox
                                  :id="`sub-rebuy-val-${sub.id}`"
                                  :checked="Boolean(sub.isAllowRebuy)"
                                  @update:checked="(v) => (sub.isAllowRebuy = Boolean(v))"
                                />
                                <label :for="`sub-rebuy-val-${sub.id}`" class="text-xs cursor-pointer">
                                  允许重复兑换
                                </label>
                              </div>
                            </div>
                          </FormField>

                          <FormField label="单人限购数">
                            <div class="flex items-center gap-2 min-h-8">
                              <div class="flex items-center gap-1.5 shrink-0">
                                <Checkbox
                                  :id="`sub-max-inherit-${sub.id}`"
                                  :checked="sub.maxBuyCount === undefined"
                                  @update:checked="(v) => updateSubItemInheritFlag(sub, 'maxBuyCount', Boolean(v))"
                                />
                                <label :for="`sub-max-inherit-${sub.id}`" class="text-xs cursor-pointer">
                                  沿用主商品
                                </label>
                              </div>
                              <NumberField
                                v-if="sub.maxBuyCount !== undefined"
                                :model-value="sub.maxBuyCount ?? 1"
                                :min="1"
                                class="flex-1"
                                @update:model-value="sub.maxBuyCount = $event ?? 1"
                              />
                            </div>
                          </FormField>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rules" class="space-y-5">
            <div class="space-y-3">
              <div class="text-xs font-semibold text-muted-foreground border-b pb-1">
                常规限制
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="重复兑换">
                  <div class="flex items-center gap-2 min-h-8">
                    <Checkbox
                      id="goods-rebuy"
                      :checked="Boolean(currentGoodsModel.goods.isAllowRebuy)"
                      @update:checked="(v) => (currentGoodsModel.goods.isAllowRebuy = Boolean(v))"
                    />
                    <label for="goods-rebuy" class="text-xs cursor-pointer">
                      允许同一用户多次重复兑换
                    </label>
                  </div>
                </FormField>

                <FormField
                  v-if="currentGoodsModel.goods.isAllowRebuy"
                  label="单人最大兑换数量"
                >
                  <NumberField
                    :model-value="currentGoodsModel.goods.maxBuyCount ?? 1"
                    :min="1"
                    @update:model-value="currentGoodsModel.goods.maxBuyCount = $event ?? 1"
                  />
                </FormField>
              </div>
            </div>

            <div class="space-y-4">
              <div class="text-xs font-semibold text-muted-foreground border-b pb-1">
                舰长 (大航海) 特权配置
              </div>

              <div class="space-y-3 rounded-md border p-3 bg-muted/20">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Checkbox
                      id="goods-guard-free"
                      :checked="currentSetting.guardFreeMonths !== undefined && currentSetting.guardFreeMonths !== null"
                      @update:checked="(v) => toggleMonthRule('guardFreeMonths', Boolean(v))"
                    />
                    <label for="goods-guard-free" class="text-xs font-medium cursor-pointer">
                      允许舰长免费兑换
                    </label>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Info24Regular class="size-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        符合条件的舰长在兑换此礼物时无需消耗积分（仍受限购数量与库存限制）
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div
                  v-if="currentSetting.guardFreeMonths !== undefined && currentSetting.guardFreeMonths !== null"
                  class="space-y-3 pl-5 border-l-2 border-primary/30"
                >
                  <FormField label="最低免费兑换等级">
                    <div class="flex flex-wrap gap-1.5">
                      <Button
                        v-for="opt in guardLevelOptions"
                        :key="opt.value"
                        type="button"
                        size="xs"
                        :variant="(currentSetting.allowGuardFreeMinLevel ?? GuardLevel.None) === opt.value ? 'default' : 'outline'"
                        @click="currentSetting.allowGuardFreeMinLevel = opt.value"
                      >
                        {{ opt.label }}
                      </Button>
                    </div>
                  </FormField>

                  <div class="flex items-center gap-2">
                    <Checkbox
                      id="goods-guard-free-current"
                      :checked="currentSetting.guardFreeMonths.length === 0"
                      @update:checked="(v) => toggleCurrentMonthOnly('guardFreeMonths', Boolean(v))"
                    />
                    <label for="goods-guard-free-current" class="text-xs cursor-pointer">
                      当前在舰即可生效（不限特定上舰月份）
                    </label>
                  </div>

                  <div v-if="currentSetting.guardFreeMonths.length > 0" class="space-y-2">
                    <div class="text-xs text-muted-foreground">
                      指定上舰月份（在以下任意月份有上舰记录即可免费兑换）：
                    </div>
                    <div
                      v-for="(ym, idx) in currentSetting.guardFreeMonths"
                      :key="`free-ym-${idx}`"
                      class="flex items-center gap-2"
                    >
                      <Select
                        :model-value="String(ym.year)"
                        @update:model-value="(v) => updateYearMonthField(ym, 'year', v)"
                      >
                        <SelectTrigger class="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="y in allowedYearOptions"
                            :key="y.value"
                            :value="y.value"
                          >
                            {{ y.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        :model-value="String(ym.month)"
                        @update:model-value="(v) => updateYearMonthField(ym, 'month', v)"
                      >
                        <SelectTrigger class="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="m in allowedMonthOptions"
                            :key="m.value"
                            :value="m.value"
                          >
                            {{ m.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        class="text-destructive"
                        :disabled="currentSetting.guardFreeMonths.length <= 1"
                        @click="removeYearMonth('guardFreeMonths', idx)"
                      >
                        <Delete24Filled class="size-3.5" />
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="xs" @click="addYearMonth('guardFreeMonths')">
                      <Add24Filled class="size-3 mr-1" />
                      添加月份
                    </Button>
                  </div>
                </div>
              </div>

              <div class="space-y-3 rounded-md border p-3 bg-muted/20">
                <FormField label="兑换门槛 (最低舰长等级限制)">
                  <div class="flex flex-wrap gap-1.5">
                    <Button
                      v-for="opt in guardThresholdOptions"
                      :key="opt.value"
                      type="button"
                      size="xs"
                      :variant="(currentSetting.allowGuardLevel ?? GuardLevel.None) === opt.value ? 'default' : 'outline'"
                      @click="currentSetting.allowGuardLevel = opt.value"
                    >
                      {{ opt.label }}
                    </Button>
                  </div>
                </FormField>

                <div
                  v-if="(currentSetting.allowGuardLevel ?? GuardLevel.None) !== GuardLevel.None"
                  class="space-y-3 pl-5 border-l-2 border-primary/30"
                >
                  <div class="flex items-center gap-2">
                    <Checkbox
                      id="goods-guard-level-limit"
                      :checked="currentSetting.guardLevelMonths !== undefined && currentSetting.guardLevelMonths !== null"
                      @update:checked="(v) => toggleMonthRule('guardLevelMonths', Boolean(v))"
                    />
                    <label for="goods-guard-level-limit" class="text-xs cursor-pointer">
                      限定特定上舰月份（不勾选则仅要求当前在舰）
                    </label>
                  </div>

                  <template v-if="currentSetting.guardLevelMonths !== undefined && currentSetting.guardLevelMonths !== null">
                    <div class="flex items-center gap-2">
                      <Checkbox
                        id="goods-guard-level-current"
                        :checked="currentSetting.guardLevelMonths.length === 0"
                        @update:checked="(v) => toggleCurrentMonthOnly('guardLevelMonths', Boolean(v))"
                      />
                      <label for="goods-guard-level-current" class="text-xs cursor-pointer">
                        当前在舰即可
                      </label>
                    </div>

                    <div v-if="currentSetting.guardLevelMonths.length > 0" class="space-y-2">
                      <div
                        v-for="(ym, idx) in currentSetting.guardLevelMonths"
                        :key="`lvl-ym-${idx}`"
                        class="flex items-center gap-2"
                      >
                        <Select
                          :model-value="String(ym.year)"
                          @update:model-value="(v) => updateYearMonthField(ym, 'year', v)"
                        >
                          <SelectTrigger class="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="y in allowedYearOptions"
                              :key="y.value"
                              :value="y.value"
                            >
                              {{ y.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          :model-value="String(ym.month)"
                          @update:model-value="(v) => updateYearMonthField(ym, 'month', v)"
                        >
                          <SelectTrigger class="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="m in allowedMonthOptions"
                              :key="m.value"
                              :value="m.value"
                            >
                              {{ m.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          class="text-destructive"
                          :disabled="currentSetting.guardLevelMonths.length <= 1"
                          @click="removeYearMonth('guardLevelMonths', idx)"
                        >
                          <Delete24Filled class="size-3.5" />
                        </Button>
                      </div>
                      <Button type="button" variant="outline" size="xs" @click="addYearMonth('guardLevelMonths')">
                        <Add24Filled class="size-3 mr-1" />
                        添加月份
                      </Button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter class="p-4 border-t bg-muted/20">
        <Button type="button" variant="ghost" @click="open = false">
          取消
        </Button>
        <Button type="button" :disabled="isLoading" @click="updateGoods">
          保存礼物
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
