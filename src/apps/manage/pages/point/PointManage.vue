<script setup lang="ts">
import { useRouteHash } from '@vueuse/router'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type {
  PointGoodsSetting,
  ResponsePointGoodModel,
  UploadSubPointGoodsModel,
  UploadPointGoodsModel,
} from '@/api/api-models'
import { FunctionTypes, GoodsStatus, GoodsTypes, KeySelectionMode, UserFileLocation } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { CURRENT_HOST, POINT_API_URL } from '@/shared/config'
import { uploadFiles } from '@/shared/services/fileUpload'
import { addVtsuruLiveWatermark } from '@/shared/utils/imageWatermark'
import { useBiliAuth } from '@/store/useBiliAuth'

import PointGuardDuplicateManage from './PointGuardDuplicateManage.vue'
import PointTestPanel from './PointTestPanel.vue'
import PointUserManage from './PointUserManage.vue'

type GoodsEditor = { goods: UploadPointGoodsModel; coverFile?: File; subCoverFiles: Record<string, File | undefined> }
type ConfirmAction =
  | { kind: 'shelf'; item: ResponsePointGoodModel; status: GoodsStatus }
  | { kind: 'delete'; item: ResponsePointGoodModel }
  | null

const accountInfo = useAccount()
const biliAuth = useBiliAuth()
const toast = useToast()
const isUpdating = ref(false)
const isAllowedPrivacyPolicy = ref(false)
const showGoodsModal = ref(false)
const shouldWatermarkCover = ref(true)
const goodsModalTab = ref('basic')
const subItemsSortMode = ref<'manual' | 'name' | 'price' | 'stock'>('manual')
const confirmAction = ref<ConfirmAction>(null)
let tempSubItemIdSeed = -1

const realHash = useRouteHash('goods', { mode: 'replace' })
const hash = computed({
  get: () => realHash.value?.replace(/^#/, '') || 'goods',
  set: (value) => {
    realHash.value = `#${value}`
  },
})
const tabItems = [
  { label: '礼物', value: 'goods' },
  { label: '订单', value: 'orders' },
  { label: '用户', value: 'users' },
  { label: '重复上舰', value: 'guard-duplicates' },
  { label: '设置', value: 'settings' },
  { label: '测试', value: 'test' },
]
const currentPointSetting = computed(() => accountInfo.value?.settings.point)
const goodsPageUrl = computed(() => (accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/goods` : ''))
const goods = ref<ResponsePointGoodModel[]>(await biliAuth.GetGoods(accountInfo.value?.id))
const onShelfGoods = computed(() =>
  goods.value.filter((item) => item.status !== GoodsStatus.Discontinued).toSorted(sortGoods),
)
const offShelfGoods = computed(() =>
  goods.value.filter((item) => item.status === GoodsStatus.Discontinued).toSorted(sortGoods),
)
const existingTags = computed(() =>
  [...new Set(goods.value.flatMap((item) => item.tags ?? []))].map((tag) => ({ label: tag, value: tag })),
)
const subItemsForDisplay = computed(() => {
  const items = currentGoods.value.goods.subItems ?? []
  if (subItemsSortMode.value === 'manual') return items
  return [...items].sort((left, right) =>
    subItemsSortMode.value === 'name'
      ? left.name.localeCompare(right.name)
      : subItemsSortMode.value === 'price'
        ? left.price - right.price
        : (left.stock ?? Infinity) - (right.stock ?? Infinity),
  )
})
const currentGoods = ref<GoodsEditor>(defaultGoodsEditor())

function defaultSetting(): PointGoodsSetting {
  return { allowGuardLevel: 0, allowGuardFreeMinLevel: 0 }
}
function defaultGoodsEditor(): GoodsEditor {
  return {
    goods: {
      type: GoodsTypes.Virtual,
      status: GoodsStatus.Normal,
      maxBuyCount: 1,
      isAllowRebuy: false,
      isPinned: false,
      setting: defaultSetting(),
      virtualKeys: [],
      keySelectionMode: KeySelectionMode.None,
      currentKeyIndex: 0,
      subItems: [],
      name: '',
      price: 0,
      tags: [],
      description: '',
    },
    subCoverFiles: {},
  }
}
function sortGoods(left: ResponsePointGoodModel, right: ResponsePointGoodModel) {
  return left.isPinned !== right.isPinned ? (left.isPinned ? -1 : 1) : right.id - left.id
}
function notify(title: string, color: 'success' | 'error' | 'info' = 'info') {
  toast.add({ title, color })
}
function openPointSourceSettings() {
  hash.value = 'settings'
  setTimeout(() =>
    document.getElementById('point-source-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  )
}
function getSubItemKey(subItem: UploadSubPointGoodsModel) {
  return String(subItem.id)
}
function ensureSubItems() {
  currentGoods.value.goods.subItems ??= []
}
function addSubItem() {
  ensureSubItems()
  currentGoods.value.goods.subItems!.push({ id: tempSubItemIdSeed--, name: '', price: currentGoods.value.goods.price })
}
function removeSubItem(key: string) {
  currentGoods.value.goods.subItems = (currentGoods.value.goods.subItems ?? []).filter(
    (item) => getSubItemKey(item) !== key,
  )
  delete currentGoods.value.subCoverFiles[key]
}
function moveSubItem(key: string, direction: -1 | 1) {
  if (subItemsSortMode.value !== 'manual') return
  const items = currentGoods.value.goods.subItems ?? []
  const index = items.findIndex((item) => getSubItemKey(item) === key)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return
  const [item] = items.splice(index, 1)
  items.splice(nextIndex, 0, item)
}
function resolveSubType(subItem: UploadSubPointGoodsModel) {
  return subItem.type ?? currentGoods.value.goods.type
}
function subCollectionMode(subItem: UploadSubPointGoodsModel) {
  return subItem.collectUrl === undefined ? 0 : subItem.collectUrl === '' ? 1 : 2
}
function setSubCollectionMode(subItem: UploadSubPointGoodsModel, mode: number) {
  subItem.collectUrl = mode === 0 ? undefined : mode === 1 ? '' : 'https://'
}
function setCover(event: Event, key?: string) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) return notify('文件大小不能超过 10MB', 'error')
  if (key) currentGoods.value.subCoverFiles[key] = file
  else currentGoods.value.coverFile = file
}
function openNewGoods() {
  currentGoods.value = defaultGoodsEditor()
  isAllowedPrivacyPolicy.value = false
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showGoodsModal.value = true
}
function openEditGoods(item: ResponsePointGoodModel) {
  const source = structuredClone(item)
  const setting = source.setting ?? defaultSetting()
  if (setting.allowGuardFreeMinLevel === undefined) setting.allowGuardFreeMinLevel = 0
  if (!setting.guardFreeMonths && setting.guardFree) setting.guardFreeMonths = [setting.guardFree]
  const parentCoverId = source.cover?.id
  const subItems = (source.subItems ?? []).map((subItem) => ({
    id: subItem.id,
    name: subItem.name,
    price: subItem.price,
    stock: subItem.count,
    description: subItem.description === source.description ? undefined : subItem.description,
    type: subItem.type === source.type ? undefined : subItem.type,
    tags: JSON.stringify(subItem.tags) === JSON.stringify(source.tags) ? undefined : subItem.tags,
    cover: subItem.cover?.id === parentCoverId ? undefined : subItem.cover,
    collectUrl: subItem.collectUrl === source.collectUrl ? undefined : subItem.collectUrl,
    embedCollectUrl: subItem.embedCollectUrl === source.embedCollectUrl ? undefined : subItem.embedCollectUrl,
    isAllowRebuy: subItem.isAllowRebuy === source.isAllowRebuy ? undefined : subItem.isAllowRebuy,
    maxBuyCount: subItem.maxBuyCount === source.maxBuyCount ? undefined : subItem.maxBuyCount,
    content: subItem.content === source.content ? undefined : subItem.content,
    virtualKeys:
      JSON.stringify(subItem.virtualKeys) === JSON.stringify(source.virtualKeys) ? undefined : subItem.virtualKeys,
    keySelectionMode: subItem.keySelectionMode === source.keySelectionMode ? undefined : subItem.keySelectionMode,
    setting: JSON.stringify(subItem.setting) === JSON.stringify(setting) ? undefined : subItem.setting,
  }))
  currentGoods.value = {
    goods: {
      ...source,
      count: source.count ?? undefined,
      collectUrl: source.collectUrl ?? undefined,
      embedCollectUrl: source.embedCollectUrl ?? undefined,
      setting,
      subItems,
    },
    subCoverFiles: {},
  }
  isAllowedPrivacyPolicy.value = true
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showGoodsModal.value = true
}
function normalizeSubItems() {
  const parent = currentGoods.value.goods
  for (const subItem of parent.subItems ?? []) {
    subItem.name = subItem.name.trim()
    if (!subItem.name) throw new Error('款式名称不能为空')
    if (subItem.price < 0) throw new Error(`款式 ${subItem.name} 的积分价格不能小于 0`)
    if (subItem.stock !== undefined && subItem.stock < 0) throw new Error(`款式 ${subItem.name} 的库存不能小于 0`)
    if (subItem.maxBuyCount !== undefined && subItem.maxBuyCount < 1)
      throw new Error(`款式 ${subItem.name} 的最大兑换数量必须大于 0`)
    if (subItem.collectUrl && subItem.collectUrl !== 'https://') new URL(subItem.collectUrl)
    if (subItem.description?.trim() === '') subItem.description = undefined
    if (subItem.description === parent.description) subItem.description = undefined
    if (subItem.type === parent.type) subItem.type = undefined
    if (subItem.isAllowRebuy === parent.isAllowRebuy) subItem.isAllowRebuy = undefined
    if (subItem.maxBuyCount === parent.maxBuyCount) subItem.maxBuyCount = undefined
    if (subItem.collectUrl === parent.collectUrl) subItem.collectUrl = undefined
    if (subItem.collectUrl === undefined) subItem.embedCollectUrl = undefined
    if (subItem.embedCollectUrl === parent.embedCollectUrl) subItem.embedCollectUrl = undefined
  }
}
async function uploadCover(file: File) {
  return uploadFiles(
    [shouldWatermarkCover.value ? await addVtsuruLiveWatermark(file) : file],
    undefined,
    UserFileLocation.Local,
  )
}
async function saveGoods() {
  if (isUpdating.value) return
  isUpdating.value = true
  try {
    const payload = currentGoods.value.goods
    if (!payload.name.trim()) throw new Error('请输入礼物名称')
    if (payload.price < 0) throw new Error('礼物积分不能小于 0')
    if (payload.type === GoodsTypes.Physical) {
      if (payload.collectUrl && payload.collectUrl !== 'https://') new URL(payload.collectUrl)
      else if (payload.collectUrl === undefined && !isAllowedPrivacyPolicy.value)
        throw new Error('需要阅读并同意本站隐私协议')
      if ((payload.maxBuyCount ?? 0) < 1) throw new Error('最大兑换数量必须大于 0')
    } else if (!payload.content?.trim()) throw new Error('请输入虚拟礼物的具体内容')
    for (const month of payload.setting.guardFreeMonths ?? [])
      if (!month.year || !month.month) throw new Error('请选择舰长免费兑换的年份和月份')
    for (const month of payload.setting.guardLevelMonths ?? [])
      if (!month.year || !month.month) throw new Error('请选择最低兑换等级限制的年份和月份')
    payload.setting.guardFree = undefined
    normalizeSubItems()
    if (currentGoods.value.coverFile) {
      const [cover] = await uploadCover(currentGoods.value.coverFile)
      if (!cover) throw new Error('封面上传失败')
      payload.cover = cover
    } else if (payload.id && !payload.cover) payload.cover = undefined
    for (const subItem of payload.subItems ?? []) {
      const file = currentGoods.value.subCoverFiles[getSubItemKey(subItem)]
      if (file) {
        const [cover] = await uploadCover(file)
        if (!cover) throw new Error(`款式封面上传失败: ${subItem.name}`)
        subItem.cover = cover
      }
    }
    const result = await QueryPostAPI<ResponsePointGoodModel>(`${POINT_API_URL}update-goods`, payload)
    if (result.code !== 200) throw new Error(result.message || '商品信息保存失败')
    const index = goods.value.findIndex((item) => item.id === result.data.id)
    if (index >= 0) goods.value[index] = result.data
    else goods.value.push(result.data)
    showGoodsModal.value = false
    notify('商品信息保存成功', 'success')
  } catch (error) {
    console.error(error)
    notify(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    isUpdating.value = false
  }
}
async function executeConfirmAction() {
  const action = confirmAction.value
  if (!action) return
  try {
    if (action.kind === 'delete') {
      const result = await QueryGetAPI(`${POINT_API_URL}delete-goods`, { id: action.item.id })
      if (result.code !== 200) throw new Error(result.message || '删除失败')
      goods.value = goods.value.filter((item) => item.id !== action.item.id)
    } else {
      const result = await QueryPostAPI(`${POINT_API_URL}update-goods-status`, {
        ids: [action.item.id],
        status: action.status,
      })
      if (result.code !== 200) throw new Error(result.message || '更新失败')
      action.item.status = action.status
    }
    confirmAction.value = null
    notify('操作成功', 'success')
  } catch (error) {
    console.error(error)
    notify(error instanceof Error ? error.message : String(error), 'error')
  }
}
function setUnlimitedStock(value: boolean) {
  currentGoods.value.goods.count = value ? undefined : 100
}
function setGuardFreeMonths(value: boolean) {
  currentGoods.value.goods.setting.guardFreeMonths = value
    ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
    : undefined
}
function setGuardLevelMonths(value: boolean) {
  currentGoods.value.goods.setting.guardLevelMonths = value
    ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
    : undefined
}
function addMonth(target: 'guardFreeMonths' | 'guardLevelMonths') {
  currentGoods.value.goods.setting[target] ??= []
  currentGoods.value.goods.setting[target]!.push({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
}
function removeMonth(target: 'guardFreeMonths' | 'guardLevelMonths', index: number) {
  currentGoods.value.goods.setting[target]?.splice(index, 1)
}
</script>

<template>
  <ManagePageHeader
    title="积分管理"
    subtitle="礼物、订单、用户与配置"
    :function-type="FunctionTypes.Point"
    :links="[{ label: '礼物展示页链接', value: goodsPageUrl }]"
  />
  <section class="status-strip">
    <UAlert
      v-if="!accountInfo.eventFetcherState.online"
      color="warning"
      icon="i-lucide-triangle-alert"
      title="积分系统依赖 VtsuruEventFetcher"
      description="事件监听器离线时，礼物、舰长等事件无法自动记录。"
      ><template #actions
        ><UButton
          to="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          color="neutral"
          variant="soft"
          size="sm"
          label="查看说明" /></template></UAlert
    ><EventFetcherStatusCard />
  </section>
  <UTabs
    v-model="hash"
    :items="tabItems"
    class="main-tabs"
  />
  <section
    v-if="hash === 'goods'"
    class="goods-page"
  >
    <div class="page-actions">
      <UButton
        icon="i-lucide-plus"
        label="添加礼物"
        @click="openNewGoods"
      /><UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-external-link"
        label="前往展示页"
        @click="$router.push({ name: 'user-goods', params: { id: accountInfo?.name } })"
      />
    </div>
    <UEmpty
      v-if="!onShelfGoods.length"
      icon="i-lucide-gift"
      title="暂无礼物"
    />
    <div
      v-else
      class="goods-grid"
    >
      <PointGoodsItem
        v-for="item in onShelfGoods"
        :key="item.id"
        :goods="item"
        :is-manage="true"
        ><template #footer
          ><div class="goods-actions">
            <span><UIcon name="i-lucide-shopping-bag" /> 积分: {{ item.price }}</span>
            <div>
              <UButton
                size="xs"
                color="info"
                variant="soft"
                icon="i-lucide-pencil"
                label="修改"
                @click="openEditGoods(item)"
              /><UButton
                size="xs"
                color="warning"
                variant="soft"
                icon="i-lucide-package-x"
                label="下架"
                @click="confirmAction = { kind: 'shelf', item, status: GoodsStatus.Discontinued }"
              /><UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                label="删除"
                @click="confirmAction = { kind: 'delete', item }"
              />
            </div></div></template
      ></PointGoodsItem>
    </div>
    <USeparator label="已下架" /><UEmpty
      v-if="!offShelfGoods.length"
      icon="i-lucide-package-open"
      title="暂无已下架礼物"
    />
    <div
      v-else
      class="goods-grid"
    >
      <PointGoodsItem
        v-for="item in offShelfGoods"
        :key="item.id"
        :goods="item"
        :is-manage="true"
        ><template #footer
          ><div class="goods-actions">
            <span><UIcon name="i-lucide-shopping-bag" /> 积分: {{ item.price }}</span>
            <div>
              <UButton
                size="xs"
                color="info"
                variant="soft"
                icon="i-lucide-pencil"
                label="修改"
                @click="openEditGoods(item)"
              /><UButton
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-package-check"
                label="上架"
                @click="confirmAction = { kind: 'shelf', item, status: GoodsStatus.Normal }"
              /><UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                label="删除"
                @click="confirmAction = { kind: 'delete', item }"
              />
            </div></div></template
      ></PointGoodsItem>
    </div>
  </section>
  <PointOrderManage
    v-else-if="hash === 'orders'"
    :goods="goods"
  /><PointUserManage
    v-else-if="hash === 'users'"
    :goods="goods"
    :point-setting="currentPointSetting"
    @open-source-settings="openPointSourceSettings"
  /><PointGuardDuplicateManage v-else-if="hash === 'guard-duplicates'" /><PointSettings
    v-else-if="hash === 'settings'"
    source-anchor-id="point-source-settings"
  /><PointTestPanel v-else-if="hash === 'test'" />
  <UModal
    v-model:open="showGoodsModal"
    :title="currentGoods.goods.id ? '编辑礼物' : '添加礼物'"
    :dismissible="!isUpdating"
    ><template #body
      ><div class="goods-editor">
        <UTabs
          v-model="goodsModalTab"
          :items="[
            { label: '基础', value: 'basic' },
            { label: '款式', value: 'sub-items' },
            { label: '兑换', value: 'exchange' },
            { label: '高级', value: 'advanced' },
          ]"
        />
        <section
          v-if="goodsModalTab === 'basic'"
          class="editor-section"
        >
          <div class="form-grid">
            <UFormField
              label="名称"
              required
              ><UInput
                v-model="currentGoods.goods.name"
                placeholder="礼物名称" /></UFormField
            ><UFormField
              label="所需积分"
              required
              ><UInputNumber
                v-model="currentGoods.goods.price"
                :min="0" /></UFormField
            ><UFormField label="库存"
              ><div class="inline-field">
                <UCheckbox
                  :model-value="currentGoods.goods.count === undefined"
                  label="不限"
                  @update:model-value="setUnlimitedStock"
                /><UInputNumber
                  v-if="currentGoods.goods.count !== undefined"
                  v-model="currentGoods.goods.count"
                  :min="0"
                /></div></UFormField
            ><UCheckbox
              v-model="currentGoods.goods.isPinned"
              label="在礼物列表中置顶显示"
            />
          </div>
          <USeparator label="详细描述" />
          <div class="form-grid">
            <UFormField label="描述"
              ><UTextarea
                v-model="currentGoods.goods.description"
                :maxlength="500"
                :rows="3" /></UFormField
            ><UFormField label="标签"
              ><USelectMenu
                v-model="currentGoods.goods.tags"
                :items="existingTags"
                value-key="value"
                multiple
                create-item
                searchable
                placeholder="输入后按回车添加" /></UFormField
            ><UFormField
              label="封面"
              description="小于 10MB"
              ><input
                type="file"
                accept="image/*"
                :disabled="isUpdating"
                @change="setCover" /><img
                v-if="currentGoods.coverFile"
                :src="URL.createObjectURL(currentGoods.coverFile)"
                class="cover-preview" /><img
                v-else-if="currentGoods.goods.cover"
                :src="currentGoods.goods.cover.path"
                class="cover-preview" /><UCheckbox
                v-model="shouldWatermarkCover"
                label="添加 vtsuru.live 水印（同时应用于款式封面）"
            /></UFormField>
          </div>
        </section>
        <section
          v-else-if="goodsModalTab === 'sub-items'"
          class="editor-section"
        >
          <UAlert
            color="info"
            title="款式 / 规格"
            description="前台兑换时可多选款式；款式价格为最终价；库存按款式独立计算。未上传款式封面时默认沿用父商品封面。"
          />
          <div class="inline-field">
            <UFormField label="最多可选款式数"
              ><UInputNumber
                v-model="currentGoods.goods.maxSubItemSelections"
                :min="0" /></UFormField
            ><span class="muted">0 或留空表示不限制</span>
          </div>
          <div class="sub-toolbar">
            <span>已配置 {{ currentGoods.goods.subItems?.length ?? 0 }} 个款式</span>
            <div>
              <USelect
                v-model="subItemsSortMode"
                :items="[
                  { label: '手动排序', value: 'manual' },
                  { label: '按名称', value: 'name' },
                  { label: '按价格', value: 'price' },
                  { label: '按库存', value: 'stock' },
                ]"
              /><UButton
                size="sm"
                icon="i-lucide-plus"
                label="添加款式"
                @click="addSubItem"
              />
            </div>
          </div>
          <UEmpty
            v-if="!currentGoods.goods.subItems?.length"
            icon="i-lucide-list-plus"
            title="暂无款式"
            description="不影响父商品直接兑换"
          />
          <article
            v-for="(subItem, index) in subItemsForDisplay"
            v-else
            :key="getSubItemKey(subItem)"
            class="sub-item"
          >
            <div class="sub-head">
              <strong>款式 #{{ index + 1 }}</strong>
              <div>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :disabled="subItemsSortMode !== 'manual'"
                  @click="moveSubItem(getSubItemKey(subItem), -1)"
                /><UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :disabled="subItemsSortMode !== 'manual'"
                  @click="moveSubItem(getSubItemKey(subItem), 1)"
                /><UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="removeSubItem(getSubItemKey(subItem))"
                />
              </div>
            </div>
            <div class="form-grid two">
              <UFormField
                label="名称"
                required
                ><UInput v-model="subItem.name" /></UFormField
              ><UFormField
                label="积分价格"
                required
                ><UInputNumber
                  v-model="subItem.price"
                  :min="0" /></UFormField
              ><UFormField label="库存"
                ><div class="inline-field">
                  <UCheckbox
                    :model-value="subItem.stock === undefined"
                    label="不限"
                    @update:model-value="(value) => (subItem.stock = value ? undefined : 100)"
                  /><UInputNumber
                    v-if="subItem.stock !== undefined"
                    v-model="subItem.stock"
                    :min="0"
                  /></div></UFormField
              ><UFormField label="封面"
                ><input
                  type="file"
                  accept="image/*"
                  @change="setCover($event, getSubItemKey(subItem))" /><img
                  v-if="currentGoods.subCoverFiles[getSubItemKey(subItem)]"
                  :src="URL.createObjectURL(currentGoods.subCoverFiles[getSubItemKey(subItem)]!)"
                  class="cover-preview" /><img
                  v-else-if="subItem.cover"
                  :src="subItem.cover.path"
                  class="cover-preview"
              /></UFormField>
            </div>
            <details>
              <summary>独立配置</summary>
              <div class="form-grid two nested">
                <UFormField label="兑换类型"
                  ><USelect
                    v-model="subItem.type"
                    :items="[
                      { label: '继承父商品', value: undefined },
                      { label: '虚拟', value: GoodsTypes.Virtual },
                      { label: '实物', value: GoodsTypes.Physical },
                    ]" /></UFormField
                ><UFormField label="描述"
                  ><UTextarea
                    v-model="subItem.description"
                    :rows="2" /></UFormField
                ><UCheckbox
                  v-model="subItem.isAllowRebuy"
                  label="允许重复兑换"
                /><UFormField label="最大兑换数量"
                  ><UInputNumber
                    v-model="subItem.maxBuyCount"
                    :min="1"
                    placeholder="继承父商品" /></UFormField
                ><UFormField label="地址收集"
                  ><URadioGroup
                    :model-value="subCollectionMode(subItem)"
                    :items="[
                      { label: '继承父商品', value: 0 },
                      { label: '本站收集', value: 1 },
                      { label: '站外收集', value: 2 },
                    ]"
                    @update:model-value="setSubCollectionMode(subItem, $event as number)" /></UFormField
                ><UFormField
                  v-if="subCollectionMode(subItem) === 2"
                  label="收集链接"
                  ><UInput v-model="subItem.collectUrl" /><UCheckbox
                    v-model="subItem.embedCollectUrl"
                    label="尝试嵌入到网页中"
                /></UFormField>
              </div>
              <template v-if="resolveSubType(subItem) === GoodsTypes.Virtual"
                ><UFormField label="虚拟礼物内容"
                  ><UTextarea
                    v-model="subItem.content"
                    :rows="3"
                    placeholder="留空则继承父商品" /></UFormField
                ><UFormField label="密钥选择模式"
                  ><USelect
                    v-model="subItem.keySelectionMode"
                    :items="[
                      { label: '继承父商品', value: undefined },
                      { label: '不使用', value: KeySelectionMode.None },
                      { label: '随机选择', value: KeySelectionMode.Random },
                      { label: '顺序选择', value: KeySelectionMode.Sequential },
                    ]" /></UFormField
                ><UFormField
                  v-if="subItem.keySelectionMode && subItem.keySelectionMode !== KeySelectionMode.None"
                  label="礼物密钥"
                  ><UInputTags v-model="subItem.virtualKeys" /></UFormField
              ></template>
            </details>
          </article>
        </section>
        <section
          v-else-if="goodsModalTab === 'exchange'"
          class="editor-section"
        >
          <div class="form-grid">
            <UFormField
              label="礼物类型"
              required
              ><URadioGroup
                v-model="currentGoods.goods.type"
                :items="[
                  { label: '虚拟礼物', value: GoodsTypes.Virtual },
                  { label: '实体礼物', value: GoodsTypes.Physical },
                ]" /></UFormField
            ><UCheckbox
              v-model="currentGoods.goods.isAllowRebuy"
              label="允许重复兑换"
            />
          </div>
          <USeparator label="舰长限制" />
          <details>
            <summary>展开舰长免费兑换与等级限制</summary>
            <div class="settings-stack nested">
              <UCheckbox
                :model-value="Array.isArray(currentGoods.goods.setting.guardFreeMonths)"
                label="限制舰长免费兑换月份"
                @update:model-value="setGuardFreeMonths"
              />
              <div
                v-if="currentGoods.goods.setting.guardFreeMonths"
                class="month-stack"
              >
                <UCheckbox
                  :model-value="!currentGoods.goods.setting.guardFreeMonths.length"
                  label="当前在舰即可"
                  @update:model-value="
                    (value) => {
                      currentGoods.goods.setting.guardFreeMonths = value
                        ? []
                        : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                    }
                  "
                />
                <div
                  v-for="(month, index) in currentGoods.goods.setting.guardFreeMonths"
                  :key="`free-${index}`"
                  class="inline-field"
                >
                  <USelect
                    v-model="month.year"
                    :items="
                      Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => ({
                        label: `${2024 + i}年`,
                        value: 2024 + i,
                      }))
                    "
                  /><USelect
                    v-model="month.month"
                    :items="Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: i + 1 }))"
                  /><UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="removeMonth('guardFreeMonths', index)"
                  />
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  label="添加月份"
                  @click="addMonth('guardFreeMonths')"
                />
              </div>
              <UFormField label="免费兑换最低舰长等级"
                ><URadioGroup
                  v-model="currentGoods.goods.setting.allowGuardFreeMinLevel"
                  :items="[
                    { label: '不限', value: 0 },
                    { label: '总督', value: 1 },
                    { label: '提督', value: 2 },
                    { label: '舰长', value: 3 },
                  ]" /></UFormField
              ><UCheckbox
                :model-value="Array.isArray(currentGoods.goods.setting.guardLevelMonths)"
                label="限制最低兑换等级的上舰月份"
                @update:model-value="setGuardLevelMonths"
              />
              <div
                v-if="currentGoods.goods.setting.guardLevelMonths"
                class="month-stack"
              >
                <UCheckbox
                  :model-value="!currentGoods.goods.setting.guardLevelMonths.length"
                  label="当前在舰即可"
                  @update:model-value="
                    (value) => {
                      currentGoods.goods.setting.guardLevelMonths = value
                        ? []
                        : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                    }
                  "
                />
                <div
                  v-for="(month, index) in currentGoods.goods.setting.guardLevelMonths"
                  :key="`level-${index}`"
                  class="inline-field"
                >
                  <USelect
                    v-model="month.year"
                    :items="
                      Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => ({
                        label: `${2024 + i}年`,
                        value: 2024 + i,
                      }))
                    "
                  /><USelect
                    v-model="month.month"
                    :items="Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: i + 1 }))"
                  /><UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="removeMonth('guardLevelMonths', index)"
                  />
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  label="添加月份"
                  @click="addMonth('guardLevelMonths')"
                />
              </div>
              <UFormField label="最低兑换等级"
                ><URadioGroup
                  v-model="currentGoods.goods.setting.allowGuardLevel"
                  :items="[
                    { label: '不限', value: 0 },
                    { label: '总督', value: 1 },
                    { label: '提督', value: 2 },
                    { label: '舰长', value: 3 },
                  ]"
              /></UFormField>
            </div>
          </details>
          <template v-if="currentGoods.goods.type === GoodsTypes.Physical"
            ><USeparator label="实物礼物配置" />
            <div class="form-grid">
              <UFormField label="最大兑换数量"
                ><UInputNumber
                  v-model="currentGoods.goods.maxBuyCount"
                  :min="1" /></UFormField
              ><UFormField label="收货地址"
                ><URadioGroup
                  :model-value="currentGoods.goods.collectUrl === undefined ? 0 : 1"
                  :items="[
                    { label: '通过本站收集', value: 0 },
                    { label: '使用站外链接', value: 1 },
                  ]"
                  @update:model-value="
                    (value) =>
                      (currentGoods.goods.collectUrl =
                        value === 0 ? undefined : currentGoods.goods.collectUrl || 'https://')
                  " /></UFormField
              ><UFormField
                v-if="currentGoods.goods.collectUrl !== undefined"
                label="收集链接"
                ><UInput v-model="currentGoods.goods.collectUrl" /><UCheckbox
                  v-model="currentGoods.goods.embedCollectUrl"
                  label="尝试将链接嵌入网页" /></UFormField
              ><UCheckbox
                v-else
                v-model="isAllowedPrivacyPolicy"
                label="同意本站隐私协议"
              /></div></template
          ><template v-else
            ><USeparator label="虚拟礼物配置" />
            <div class="form-grid">
              <UFormField label="密钥选择模式"
                ><URadioGroup
                  v-model="currentGoods.goods.keySelectionMode"
                  :items="[
                    { label: '不使用', value: KeySelectionMode.None },
                    { label: '随机选择', value: KeySelectionMode.Random },
                    { label: '顺序选择', value: KeySelectionMode.Sequential },
                  ]" /></UFormField
              ><UFormField
                v-if="currentGoods.goods.keySelectionMode !== KeySelectionMode.None"
                label="礼物密钥列表"
                ><UInputTags v-model="currentGoods.goods.virtualKeys" /></UFormField
              ><UFormField
                label="礼物内容"
                required
                ><UTextarea
                  v-model="currentGoods.goods.content"
                  :rows="6"
                  :maxlength="10000"
                  placeholder="可使用 {key} 作为占位符"
              /></UFormField></div
          ></template>
        </section>
        <section
          v-else
          class="editor-section"
        >
          <UAlert
            color="info"
            title="高级设置"
            description="商品状态会在保存后生效。下架和删除使用礼物卡片上的操作。"
          /><UCheckbox
            v-model="currentGoods.goods.isPinned"
            label="置顶显示"
          />
        </section></div></template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          :disabled="isUpdating"
          @click="showGoodsModal = false"
        /><UButton
          icon="i-lucide-save"
          :label="currentGoods.goods.id ? '保存修改' : '创建礼物'"
          :loading="isUpdating"
          @click="saveGoods"
        /></div></template
  ></UModal>
  <UModal
    :open="confirmAction !== null"
    :title="confirmAction?.kind === 'delete' ? '删除礼物' : '更新礼物状态'"
    @update:open="(open) => !open && (confirmAction = null)"
    ><template #body>{{
      confirmAction?.kind === 'delete'
        ? '确认删除这个礼物？此操作不可恢复。'
        : `确认${confirmAction?.status === GoodsStatus.Normal ? '重新上架' : '下架'}这个礼物？`
    }}</template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="confirmAction = null"
        /><UButton
          :color="confirmAction?.kind === 'delete' ? 'error' : 'primary'"
          label="确认"
          @click="executeConfirmAction"
        /></div></template
  ></UModal>
</template>

<style scoped>
.status-strip,
.goods-page,
.goods-editor,
.editor-section,
.settings-stack,
.month-stack {
  display: grid;
  gap: 16px;
}
.status-strip {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}
.main-tabs {
  margin: 16px 0;
}
.page-actions,
.goods-actions,
.goods-actions > div,
.sub-toolbar,
.sub-toolbar > div,
.sub-head,
.sub-head > div,
.inline-field,
.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
}
.goods-actions {
  display: grid;
  gap: 8px;
}
.goods-actions span {
  color: var(--vtsuru-primary);
  font-size: 13px;
  font-weight: 600;
}
.goods-actions > div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.goods-actions :deep(.u-button) {
  justify-content: center;
}
.goods-editor {
  max-height: 70vh;
  overflow: auto;
  padding-right: 4px;
}
.editor-section {
  padding-top: 16px;
}
.form-grid {
  display: grid;
  gap: 14px;
}
.form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.cover-preview {
  display: block;
  width: 112px;
  height: 112px;
  border: 1px solid var(--vtsuru-border);
  object-fit: cover;
}
.sub-toolbar,
.sub-head {
  justify-content: space-between;
}
.sub-item {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
}
.nested {
  margin-top: 14px;
}
.muted {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.modal-actions {
  justify-content: flex-end;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
@media (max-width: 720px) {
  .status-strip {
    grid-template-columns: 1fr;
  }
  .form-grid.two {
    grid-template-columns: 1fr;
  }
}
</style>
