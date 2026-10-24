<script setup lang="ts">
import {
  Add24Filled,
  ArrowSync24Filled,
  Copy24Regular,
  Delete24Filled,
  Edit24Filled,
  Info24Filled,
  Open24Regular,
  ShoppingBag24Filled,
} from '@vicons/fluent'
import { useRouteHash } from '@vueuse/router'
import { Plus } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel, UploadPointGoodsModel } from '@/api/client-types'
import type { TempSubPointGoodsModel } from '@/api/generated/model'
import { FunctionTypes, GoodsStatus, GoodsTypes, VirtualKeySelectionMode } from '@/api/generated/model'
import {
  postApiPointDeleteGoods,
  postApiPointUpdateGoods,
  postApiPointUpdateGoodsStatus,
} from '@/api/generated/point/point'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { CURRENT_HOST } from '@/shared/config'
import { FileStore, uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { fromRemoteImageList, getPendingUploadFiles, ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard, toast, useMessage } from '@/shared/utils'
import { addVtsuruLiveWatermark } from '@/shared/utils/imageWatermark'
import { useBiliAuth } from '@/store/useBiliAuth'

import PointGuardDuplicateManage from './PointGuardDuplicateManage.vue'
import PointTestPanel from './PointTestPanel.vue'
import PointUserManage from './PointUserManage.vue'
import ServiceGoodsConfig from './ServiceGoodsConfig.vue'

const message = useMessage()
const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const isUpdating = ref(false)
const isAllowedPrivacyPolicy = ref(false)
const showAddGoodsModal = ref(false)
const isUploadingCover = ref(false)
const shouldWatermarkCover = ref(true)
const goodsModalTab = ref<'basic' | 'subItems' | 'rules'>('basic')
const subItemsSortMode = ref<'manual' | 'name' | 'price' | 'stock'>('manual')
let tempSubItemIdSeed = -1

// 路由哈希处理
const realHash = useRouteHash('goods', { mode: 'replace' })
const hash = computed({
  get() {
    return realHash.value?.startsWith('#') ? realHash.value.slice(1) : realHash.value || 'goods'
  },
  set(val) {
    realHash.value = `#${val}`
  },
})
const currentPointSetting = computed(() => accountInfo.value?.settings.point)
const goodsPageUrl = computed(() => (accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/goods` : ''))

function openPointSourceSettings() {
  hash.value = 'settings'
  window.setTimeout(() => {
    document.getElementById('point-source-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 0)
}

// 商品数据及模型
const goods = ref<ResponsePointGoodModel[]>(await biliAuth.GetGoods(accountInfo.value?.id, message))
function sortGoods(a: ResponsePointGoodModel, b: ResponsePointGoodModel) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
  return b.id - a.id
}
const onShelfGoods = computed(() =>
  goods.value.filter((g) => g.status !== GoodsStatus.Discontinued).toSorted(sortGoods),
)
const offShelfGoods = computed(() =>
  goods.value.filter((g) => g.status === GoodsStatus.Discontinued).toSorted(sortGoods),
)

function defaultGoodsModel(): { goods: UploadPointGoodsModel; fileList: UploadImageItem[] } {
  return {
    goods: {
      type: GoodsTypes.Virtual,
      status: GoodsStatus.Normal,
      maxBuyCount: 1,
      isAllowRebuy: false,
      isPinned: false,
      setting: {
        allowGuardLevel: 0,
        allowGuardFreeMinLevel: 0,
      },
      virtualKeys: [],
      keySelectionMode: VirtualKeySelectionMode.None,
      currentKeyIndex: 0,
      subItems: [],
      name: '',
      price: 0,
      tags: [],
      description: '',
      cover: undefined,
      serviceConfig: undefined,
    } as UploadPointGoodsModel,
    fileList: [],
  }
}
const currentGoodsModel = ref<{ goods: UploadPointGoodsModel; fileList: UploadImageItem[] }>(defaultGoodsModel())
const subItemFileLists = ref<Record<string, UploadImageItem[]>>({})

function getSubItemKey(sub: TempSubPointGoodsModel) {
  return String(sub.id)
}

function ensureSubItems() {
  currentGoodsModel.value.goods.subItems ??= []
}

function addSubItem() {
  ensureSubItems()
  const parent = currentGoodsModel.value.goods
  const tempId = tempSubItemIdSeed--
  const sub: TempSubPointGoodsModel = {
    id: tempId,
    name: '',
    price: parent.price,
    stock: undefined,
    description: undefined,
    type: undefined,
    tags: undefined,
    cover: undefined,
    collectUrl: undefined,
    embedCollectUrl: undefined,
    isAllowRebuy: undefined,
    maxBuyCount: undefined,
    content: undefined,
    virtualKeys: undefined,
    keySelectionMode: undefined,
    setting: undefined,
  }
  currentGoodsModel.value.goods.subItems!.push(sub)
  subItemFileLists.value[getSubItemKey(sub)] = []
}

function removeSubItemByKey(subKey: string) {
  ensureSubItems()
  const list = currentGoodsModel.value.goods.subItems!
  const index = list.findIndex((s) => getSubItemKey(s) === subKey)
  if (index < 0) return
  const sub = list[index]
  if (sub) {
    delete subItemFileLists.value[getSubItemKey(sub)]
  }
  list.splice(index, 1)
}

const currentYear = new Date().getFullYear()
const allowedYearOptions = [
  { label: `${currentYear}年`, value: currentYear },
  { label: `${currentYear - 1}年`, value: currentYear - 1 },
  { label: `${currentYear - 2}年`, value: currentYear - 2 },
]
const allowedMonthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: i + 1,
}))

async function uploadCover(file: File) {
  let fileToUpload = file
  if (shouldWatermarkCover.value) {
    try {
      fileToUpload = await addVtsuruLiveWatermark(file)
    } catch (e) {
      console.warn('水印添加失败，将使用原图上传:', e)
    }
  }
  return await uploadFiles(fileToUpload, FileStore.Goods, (stage: string) => {
    if (stage === UploadStage.Preparing) toast.info('正在处理图片...')
    else if (stage === UploadStage.Uploading) toast.info('正在上传到云存储...')
  })
}

async function updateGoods() {
  if (isUpdating.value || isUploadingCover.value) return
  isUpdating.value = true

  try {
    const parent = currentGoodsModel.value.goods
    if (!parent.name || !parent.name.trim()) {
      goodsModalTab.value = 'basic'
      throw new Error('请输入礼物名称')
    }
    if (parent.price < 0) {
      goodsModalTab.value = 'basic'
      throw new Error('礼物所需积分不能为负数')
    }

    const newFilesToUpload = getPendingUploadFiles(currentGoodsModel.value.fileList)
    if (newFilesToUpload.length > 0) {
      isUploadingCover.value = true
      message.info(shouldWatermarkCover.value ? '正在添加封面水印并上传...' : '正在上传封面...')
      const uploadResults = await uploadCover(newFilesToUpload[0])
      isUploadingCover.value = false
      if (uploadResults && uploadResults.length > 0) {
        currentGoodsModel.value.goods.cover = uploadResults[0]
        currentGoodsModel.value.fileList = fromRemoteImageList([uploadResults[0]], '封面')
        message.success('封面上传成功')
      } else {
        throw new Error('封面上传失败')
      }
    } else if (currentGoodsModel.value.fileList.length === 0) {
      currentGoodsModel.value.goods.cover = undefined
    }

    // 上传款式封面
    ensureSubItems()
    for (const sub of currentGoodsModel.value.goods.subItems ?? []) {
      const key = getSubItemKey(sub)
      const fileList = subItemFileLists.value[key] ?? []
      const subFilesToUpload = getPendingUploadFiles(fileList)
      if (subFilesToUpload.length > 0) {
        isUploadingCover.value = true
        const uploadResults = await uploadCover(subFilesToUpload[0])
        isUploadingCover.value = false
        if (uploadResults && uploadResults.length > 0) {
          sub.cover = uploadResults[0]
          subItemFileLists.value[key] = fromRemoteImageList([uploadResults[0]], '封面')
        } else {
          throw new Error(`款式封面上传失败: ${sub.name || '未命名'}`)
        }
      } else if (fileList.length === 0) {
        sub.cover = undefined
      }
    }

    const {
      code,
      data,
      message: errMsg,
    } = (await postApiPointUpdateGoods(currentGoodsModel.value.goods as any)) as unknown as {
      code: number
      data: ResponsePointGoodModel
      message: string
    }

    if (code === 200) {
      message.success('商品信息保存成功')
      showAddGoodsModal.value = false
      currentGoodsModel.value = defaultGoodsModel()

      const index = goods.value.findIndex((g) => g.id === data.id)
      if (index >= 0) {
        goods.value[index] = data
      } else {
        goods.value.push(data)
      }
    } else {
      message.error(`商品信息保存失败: ${errMsg}`)
    }
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : '保存失败'
    message.error(errorMsg)
  } finally {
    isUpdating.value = false
    isUploadingCover.value = false
  }
}

function onUpdateClick(item: ResponsePointGoodModel) {
  const copiedItem = JSON.parse(JSON.stringify(item)) as UploadPointGoodsModel
  currentGoodsModel.value = {
    goods: copiedItem,
    fileList: fromRemoteImageList([item.cover], '封面'),
  }
  subItemFileLists.value = {}
  for (const s of copiedItem.subItems ?? []) {
    const key = getSubItemKey(s)
    subItemFileLists.value[key] = fromRemoteImageList([s.cover], '封面')
  }
  isAllowedPrivacyPolicy.value = true
  shouldWatermarkCover.value = true
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showAddGoodsModal.value = true
}

async function onSetShelfClick(item: ResponsePointGoodModel, status: GoodsStatus) {
  const originStatus = item.status
  try {
    const { code, message: errMsg } = (await postApiPointUpdateGoodsStatus({
      ids: [item.id],
      status: status as any,
    })) as unknown as {
      code: number
      message: string
    }

    if (code === 200) {
      message.success('操作成功')
      const index = goods.value.findIndex((g) => g.id === item.id)
      if (index > -1) {
        goods.value[index].status = status
      }
    } else {
      message.error(`失败: ${errMsg}`)
      item.status = originStatus
    }
  } catch (err) {
    message.error(`失败: ${err}`)
    item.status = originStatus
  }
}

async function onDeleteClick(item: ResponsePointGoodModel) {
  try {
    const { code, message: errMsg } = (await postApiPointDeleteGoods({
      id: item.id,
    })) as unknown as {
      code: number
      message: string
    }

    if (code === 200) {
      message.success('删除成功')
      goods.value = goods.value.filter((g) => g.id !== item.id)
    } else {
      message.error(`删除失败: ${errMsg}`)
    }
  } catch (err) {
    message.error(`删除失败: ${err}`)
  }
}

function onModalOpen() {
  if (!currentGoodsModel.value.goods.id) {
    resetGoods()
  }
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showAddGoodsModal.value = true
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

function resetGoods() {
  currentGoodsModel.value = defaultGoodsModel()
  subItemFileLists.value = {}
  isAllowedPrivacyPolicy.value = false
  shouldWatermarkCover.value = true
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
}
</script>

<template>
  <div class="space-y-4">
    <!-- 头部 -->
    <ManagePageHeader
      title="积分管理"
      subtitle="礼物、订单、用户与配置"
      :function-type="FunctionTypes.Point"
    >
      <template #action>
        <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div
            v-if="goodsPageUrl"
            class="flex items-center gap-1.5 w-full sm:w-auto"
          >
            <Input
              :model-value="goodsPageUrl"
              readonly
              class="hidden md:flex h-control-sm w-60 lg:w-72 xl:w-80 font-mono text-xs bg-muted/40 text-muted-foreground select-all"
              title="礼物展示页链接（点击全选）"
              @click="($event.target as HTMLInputElement).select()"
            />
            <Button
              variant="outline"
              class="flex-1 sm:flex-initial"
              @click="copyToClipboard(goodsPageUrl)"
            >
              <component
                :is="Copy24Regular"
                class="size-3.5 mr-1"
              />
              复制链接
            </Button>
            <Button
              variant="outline"
              class="flex-1 sm:flex-initial"
              as="a"
              :href="goodsPageUrl"
              target="_blank"
            >
              <component
                :is="Open24Regular"
                class="size-3.5 mr-1"
              />
              前往展示页
            </Button>
          </div>
          <EventFetcherStatusCard class="w-full sm:w-auto" />
        </div>
      </template>
    </ManagePageHeader>

    <Alert
      v-if="!accountInfo.eventFetcherState.online"
      variant="default"
      class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2"
    >
      <AlertDescription class="text-xs flex items-center gap-1.5 flex-wrap">
        <span>
          此功能依赖
          <a
            href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
            target="_blank"
            rel="noreferrer"
            class="font-medium underline hover:text-foreground"
          >
            VtsuruEventFetcher
          </a>
          (事件监听器)，否则无法自动记录直播事件
        </span>
        <Separator
          orientation="vertical"
          class="h-3 mx-1"
        />
        <a
          href="https://www.wolai.com/ueENtfAm9gPEqHrAVSB2Co"
          target="_blank"
          rel="noreferrer"
          class="text-blue-500 hover:underline"
        >
          积分说明
        </a>
      </AlertDescription>
    </Alert>

    <!-- 标签页 -->
    <Tabs
      v-model="hash"
      class="w-full"
    >
      <TabsList>
        <TabsTrigger value="goods">礼物</TabsTrigger>
        <TabsTrigger value="orders">订单</TabsTrigger>
        <TabsTrigger value="users">用户</TabsTrigger>
        <TabsTrigger value="guard-duplicates">重复上舰</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
        <TabsTrigger value="test">测试</TabsTrigger>
      </TabsList>

      <!-- 礼物管理 -->
      <TabsContent
        value="goods"
        class="pt-4 space-y-4"
      >
        <div class="flex items-center gap-2.5">
          <Button
            class="gap-1.5"
            @click="onModalOpen"
          >
            <Add24Filled class="size-4" />
            添加礼物
          </Button>
        </div>

        <!-- 上架礼物 -->
        <Empty
          v-if="onShelfGoods.length === 0"
          description="暂无礼物"
          class="py-12"
        />
        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          <PointGoodsItem
            v-for="item in onShelfGoods"
            :key="item.id"
            :goods="item"
            :is-manage="true"
            class="h-full flex flex-col"
          >
            <template #footer>
              <div class="space-y-2 pt-2 border-t mt-auto">
                <div class="text-xs font-semibold text-primary flex items-center gap-1">
                  <ShoppingBag24Filled class="size-3.5" />
                  积分: {{ item.price }}
                </div>
                <div class="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    class="flex-1"
                    @click="onUpdateClick(item)"
                  >
                    <Edit24Filled class="size-3 mr-1" />
                    修改
                  </Button>
                  <Popconfirm
                    positive-text="确认下架"
                    negative-text="取消"
                    @positive-click="onSetShelfClick(item, GoodsStatus.Discontinued)"
                  >
                    <template #trigger>
                      <Button
                        variant="outline"
                        size="xs"
                        class="flex-1 text-amber-500 hover:text-amber-600"
                      >
                        <ArrowSync24Filled class="size-3 mr-1" />
                        下架
                      </Button>
                    </template>
                    确定要下架这个礼物吗？
                  </Popconfirm>
                  <Popconfirm
                    positive-text="确认删除"
                    negative-text="取消"
                    @positive-click="onDeleteClick(item)"
                  >
                    <template #trigger>
                      <Button
                        variant="outline"
                        size="xs"
                        class="flex-1 text-destructive hover:bg-destructive/10"
                      >
                        <Delete24Filled class="size-3 mr-1" />
                        删除
                      </Button>
                    </template>
                    确定要删除这个礼物吗？
                  </Popconfirm>
                </div>
              </div>
            </template>
          </PointGoodsItem>
        </div>

        <!-- 已下架 -->
        <div class="pt-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已下架礼物</span>
            <Separator class="flex-1" />
          </div>

          <Empty
            v-if="offShelfGoods.length === 0"
            description="暂无已下架的礼物"
            class="py-6"
          />
          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <PointGoodsItem
              v-for="item in offShelfGoods"
              :key="item.id"
              :goods="item"
              :is-manage="true"
              class="h-full flex flex-col opacity-75 hover:opacity-100 transition-opacity"
            >
              <template #footer>
                <div class="space-y-2 pt-2 border-t mt-auto">
                  <div class="text-xs font-semibold text-primary flex items-center gap-1">
                    <ShoppingBag24Filled class="size-3.5" />
                    积分: {{ item.price }}
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      class="flex-1"
                      @click="onUpdateClick(item)"
                    >
                      <Edit24Filled class="size-3 mr-1" />
                      修改
                    </Button>
                    <Popconfirm
                      positive-text="重新上架"
                      negative-text="取消"
                      @positive-click="onSetShelfClick(item, GoodsStatus.Normal)"
                    >
                      <template #trigger>
                        <Button
                          variant="outline"
                          size="xs"
                          class="flex-1 text-emerald-500 hover:text-emerald-600"
                        >
                          <ArrowSync24Filled class="size-3 mr-1" />
                          上架
                        </Button>
                      </template>
                      确定要重新上架这个礼物吗？
                    </Popconfirm>
                    <Popconfirm
                      positive-text="确认删除"
                      negative-text="取消"
                      @positive-click="onDeleteClick(item)"
                    >
                      <template #trigger>
                        <Button
                          variant="outline"
                          size="xs"
                          class="flex-1 text-destructive hover:bg-destructive/10"
                        >
                          <Delete24Filled class="size-3 mr-1" />
                          删除
                        </Button>
                      </template>
                      确定要删除这个礼物吗？
                    </Popconfirm>
                  </div>
                </div>
              </template>
            </PointGoodsItem>
          </div>
        </div>
      </TabsContent>

      <!-- 订单 -->
      <TabsContent
        value="orders"
        class="pt-4"
      >
        <PointOrderManage :goods="goods" />
      </TabsContent>

      <!-- 用户 -->
      <TabsContent
        value="users"
        class="pt-4"
      >
        <PointUserManage
          :goods="goods"
          :point-setting="currentPointSetting"
          @open-source-settings="openPointSourceSettings"
        />
      </TabsContent>

      <!-- 重复上舰 -->
      <TabsContent
        value="guard-duplicates"
        class="pt-4"
      >
        <PointGuardDuplicateManage />
      </TabsContent>

      <!-- 设置 -->
      <TabsContent
        value="settings"
        class="pt-4"
      >
        <PointSettings source-anchor-id="point-source-settings" />
      </TabsContent>

      <!-- 测试 -->
      <TabsContent
        value="test"
        class="pt-4"
      >
        <PointTestPanel />
      </TabsContent>
    </Tabs>

    <!-- 添加 / 修改礼物模态框 -->
    <Dialog v-model:open="showAddGoodsModal">
      <DialogContent class="max-w-3xl max-h-[88vh] flex flex-col p-0">
        <DialogHeader class="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle class="text-sm font-semibold">
            {{ currentGoodsModel.goods.id ? '编辑礼物' : '添加礼物' }}
          </DialogTitle>
          <Button
            v-if="!currentGoodsModel.goods.id"
            variant="ghost"
            size="xs"
            class="text-amber-500 hover:text-amber-600 mr-6"
            @click="resetGoods"
          >
            重置表单
          </Button>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <Tabs
            v-model="goodsModalTab"
            class="w-full"
          >
            <TabsList>
              <TabsTrigger value="basic">商品与交付</TabsTrigger>
              <TabsTrigger value="subItems">款式设置 ({{ currentGoodsModel.goods.subItems?.length || 0 }})</TabsTrigger>
              <TabsTrigger value="rules">规则与特权</TabsTrigger>
            </TabsList>

            <!-- 基本信息与交付 -->
            <TabsContent
              value="basic"
              class="pt-3 space-y-4"
            >
              <div class="space-y-3">
                <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">基本信息</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground"
                      >礼物名称 <span class="text-destructive">*</span></label
                    >
                    <Input
                      v-model="currentGoodsModel.goods.name"
                      placeholder="如：舰长专属定制抱枕"
                      maxlength="200"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground"
                      >所需积分 <span class="text-destructive">*</span></label
                    >
                    <NumberField
                      v-model="currentGoodsModel.goods.price"
                      placeholder="兑换所需的积分数"
                      :min="0"
                      class="w-full"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground">库存设置</label>
                    <div class="flex items-center gap-3 h-8">
                      <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                        <Checkbox
                          :checked="currentGoodsModel.goods.count === undefined"
                          @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 100)"
                        />
                        <span>不限库存</span>
                      </label>
                      <NumberField
                        v-if="currentGoodsModel.goods.count !== undefined"
                        v-model="currentGoodsModel.goods.count"
                        :min="0"
                        class="flex-1"
                      />
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground">展示设置</label>
                    <div class="flex items-center h-8">
                      <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                        <Checkbox
                          :checked="currentGoodsModel.goods.isPinned"
                          @update:checked="currentGoodsModel.goods.isPinned = $event"
                        />
                        <span>在礼物列表顶部置顶显示</span>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- 封面上传 -->
                <div class="space-y-1.5 pt-2">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-medium text-foreground">礼物封面</label>
                    <label class="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                      <Checkbox v-model:checked="shouldWatermarkCover" />
                      <span>自动添加水印</span>
                    </label>
                  </div>

                  <ImageUpload
                    v-model="currentGoodsModel.fileList"
                    :max-files="1"
                    :disabled="isUpdating || isUploadingCover"
                    size="md"
                    placeholder="上传封面"
                  />
                </div>
              </div>

              <Separator />

              <!-- 交付与内容配置 -->
              <div class="space-y-3">
                <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">交付与类型配置</h4>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-foreground"
                    >礼物类型 <span class="text-destructive">*</span></label
                  >
                  <div class="flex items-center gap-2">
                    <Button
                      size="xs"
                      :variant="currentGoodsModel.goods.type === GoodsTypes.Virtual ? 'default' : 'outline'"
                      @click="onGoodsTypeChange(GoodsTypes.Virtual)"
                    >
                      虚拟礼物 (卡密/网盘/文本)
                    </Button>
                    <Button
                      size="xs"
                      :variant="currentGoodsModel.goods.type === GoodsTypes.Physical ? 'default' : 'outline'"
                      @click="onGoodsTypeChange(GoodsTypes.Physical)"
                    >
                      实体礼物 (实物邮寄)
                    </Button>
                    <Button
                      size="xs"
                      :variant="currentGoodsModel.goods.type === GoodsTypes.Service ? 'default' : 'outline'"
                      @click="onGoodsTypeChange(GoodsTypes.Service)"
                    >
                      服务兑换 (约稿/预约/定制)
                    </Button>
                  </div>
                </div>

                <!-- 虚拟礼物 -->
                <div
                  v-if="currentGoodsModel.goods.type === GoodsTypes.Virtual"
                  class="space-y-3 pt-2"
                >
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <span>交付内容</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Info24Filled class="size-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p class="text-xs">
                              兑换成功后展示给用户的具体内容。若启用了卡密发放，可在文本中使用 {key} 占位符自动替换。
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                    <Textarea
                      v-model="currentGoodsModel.goods.content"
                      placeholder="请输入兑换成功后展示给用户的文本、下载链接或提取码（支持 {key} 占位符）"
                      :rows="3"
                      class="text-xs"
                    />
                  </div>
                </div>

                <!-- 服务兑换 -->
                <ServiceGoodsConfig
                  v-if="currentGoodsModel.goods.type === GoodsTypes.Service"
                  v-model="currentGoodsModel.goods.serviceConfig"
                />
              </div>
            </TabsContent>

            <!-- 款式设置 -->
            <TabsContent
              value="subItems"
              class="pt-3 space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">可为主商品添加多种款式（如不同尺码、颜色或套餐）</span>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="addSubItem"
                >
                  <Plus class="size-3.5" />
                  添加款式
                </Button>
              </div>

              <Empty
                v-if="!currentGoodsModel.goods.subItems || currentGoodsModel.goods.subItems.length === 0"
                description="暂无独立款式（默认仅有主商品）"
                class="py-8 border rounded-lg border-dashed"
              />

              <div class="space-y-3">
                <Card
                  v-for="(sub, subIdx) in currentGoodsModel.goods.subItems"
                  :key="getSubItemKey(sub)"
                  class="border border-border p-3 space-y-3"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-foreground">款式 #{{ subIdx + 1 }}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      class="text-destructive hover:bg-destructive/10"
                      @click="removeSubItemByKey(getSubItemKey(sub))"
                    >
                      删除款式
                    </Button>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="text-xs font-medium text-foreground"
                        >款式名称 <span class="text-destructive">*</span></label
                      >
                      <Input
                        v-model="sub.name"
                        placeholder="如：黑色 XL 码"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs font-medium text-foreground">所需积分</label>
                      <NumberField
                        v-model="sub.price"
                        :min="0"
                        class="w-full"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs font-medium text-foreground">款式库存</label>
                      <NumberField
                        v-model="sub.stock"
                        placeholder="留空沿用主商品"
                        :min="0"
                        class="w-full"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs font-medium text-foreground">款式封面</label>
                      <ImageUpload
                        v-model="subItemFileLists[getSubItemKey(sub)]"
                        :max-files="1"
                        :disabled="isUpdating || isUploadingCover"
                        size="xs"
                        placeholder="上传款式封面"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <!-- 规则与特权 -->
            <TabsContent
              value="rules"
              class="pt-3 space-y-4"
            >
              <div class="space-y-3">
                <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">常规限制</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground">重复兑换</label>
                    <div class="flex items-center h-8">
                      <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                        <Checkbox
                          :checked="currentGoodsModel.goods.isAllowRebuy"
                          @update:checked="currentGoodsModel.goods.isAllowRebuy = $event"
                        />
                        <span>允许同一用户多次重复兑换</span>
                      </label>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-foreground">单人最大兑换数量</label>
                    <NumberField
                      v-model="currentGoodsModel.goods.maxBuyCount"
                      :min="1"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter class="p-3 border-t bg-muted/10">
          <Button
            variant="outline"
            :disabled="isUpdating || isUploadingCover"
            @click="showAddGoodsModal = false"
          >
            取消
          </Button>
          <Button
            :disabled="isUpdating || isUploadingCover"
            @click="updateGoods"
          >
            {{ isUpdating ? '保存中...' : currentGoodsModel.goods.id ? '保存修改' : '立即创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
