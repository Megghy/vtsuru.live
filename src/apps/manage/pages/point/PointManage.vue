<script setup lang="ts">
import Add24Filled from '@vicons/fluent/es/Add24Filled'
import ArrowSync24Filled from '@vicons/fluent/es/ArrowSync24Filled'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import Edit24Filled from '@vicons/fluent/es/Edit24Filled'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import ShoppingBag24Filled from '@vicons/fluent/es/ShoppingBag24Filled'
import { useRouteHash } from '@vueuse/router'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel } from '@/api/client-types'
import { FunctionTypes, GoodsStatus } from '@/api/generated/model'
import { postApiPointDeleteGoods, postApiPointUpdateGoodsStatus } from '@/api/generated/point/point'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { CURRENT_HOST } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import PointGoodsEditDialog from './PointGoodsEditDialog.vue'
import PointGuardDuplicateManage from './PointGuardDuplicateManage.vue'
import PointTestPanel from './PointTestPanel.vue'
import PointUserManage from './PointUserManage.vue'

const message = useMessage()
const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const showAddGoodsModal = ref(false)
const editingGoods = ref<ResponsePointGoodModel | undefined>(undefined)

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

// 商品数据
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

const existTags = computed(() => {
  const tags = new Set<string>()
  for (const item of goods.value) {
    for (const tag of item.tags ?? []) {
      if (tag) tags.add(tag)
    }
  }
  return Array.from(tags)
})

const shelfSections = computed(() => [
  {
    key: 'onShelf',
    items: onShelfGoods.value,
    isOffShelf: false,
    emptyText: '暂无礼物',
    emptyClass: 'py-12',
    nextStatus: GoodsStatus.Discontinued,
    shelfActionLabel: '下架',
    shelfConfirmPositive: '确认下架',
    shelfConfirmText: '确定要下架这个礼物吗？',
    shelfBtnClass: 'text-amber-500 hover:text-amber-600',
    cardClass: 'h-full flex flex-col',
  },
  {
    key: 'offShelf',
    items: offShelfGoods.value,
    isOffShelf: true,
    emptyText: '暂无已下架的礼物',
    emptyClass: 'py-6',
    nextStatus: GoodsStatus.Normal,
    shelfActionLabel: '上架',
    shelfConfirmPositive: '重新上架',
    shelfConfirmText: '确定要重新上架这个礼物吗？',
    shelfBtnClass: 'text-emerald-500 hover:text-emerald-600',
    cardClass: 'h-full flex flex-col opacity-75 hover:opacity-100 transition-opacity',
  },
])

function onModalOpen() {
  editingGoods.value = undefined
  showAddGoodsModal.value = true
}

function onUpdateClick(item: ResponsePointGoodModel) {
  editingGoods.value = item
  showAddGoodsModal.value = true
}

function handleGoodsSaved(saved: ResponsePointGoodModel) {
  const index = goods.value.findIndex((g) => g.id === saved.id)
  if (index >= 0) {
    goods.value[index] = saved
  } else {
    goods.value.push(saved)
  }
}

async function onSetShelfClick(item: ResponsePointGoodModel, status: GoodsStatus) {
  const originStatus = item.status
  try {
    const res = await postApiPointUpdateGoodsStatus({
      ids: [item.id],
      status,
    })

    if (res.code === 200) {
      message.success('操作成功')
      const index = goods.value.findIndex((g) => g.id === item.id)
      if (index > -1) {
        goods.value[index].status = status
      }
    } else {
      message.error(`失败: ${res.message}`)
      item.status = originStatus
    }
  } catch (err) {
    message.error(`失败: ${err}`)
    item.status = originStatus
  }
}

async function onDeleteClick(item: ResponsePointGoodModel) {
  try {
    const res = await postApiPointDeleteGoods({ id: item.id })

    if (res.code === 200) {
      message.success('删除成功')
      goods.value = goods.value.filter((g) => g.id !== item.id)
    } else {
      message.error(`删除失败: ${res.message}`)
    }
  } catch (err) {
    message.error(`删除失败: ${err}`)
  }
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
              class="hidden md:flex h-control-sm w-60 lg:w-72 xl:w-80 font-mono bg-muted/40 text-muted-foreground select-all"
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
      size="sm"
      v-if="!accountInfo.eventFetcherState.online"
      variant="warning"
    >
      <AlertDescription class="flex items-center gap-1.5 flex-wrap">
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

        <div
          v-for="section in shelfSections"
          :key="section.key"
          :class="section.isOffShelf ? 'pt-4' : ''"
        >
          <div
            v-if="section.isOffShelf"
            class="flex items-center gap-2 mb-3"
          >
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已下架礼物</span>
            <Separator class="flex-1" />
          </div>

          <Empty
            v-if="section.items.length === 0"
            :description="section.emptyText"
            :class="section.emptyClass"
          />
          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <PointGoodsItem
              v-for="item in section.items"
              :key="item.id"
              :goods="item"
              :is-manage="true"
              :class="section.cardClass"
            >
              <template #footer>
                <div class="w-full min-w-0 space-y-2 pt-2 border-t mt-auto">
                  <div class="text-xs font-semibold text-primary flex items-center gap-1 min-w-0">
                    <ShoppingBag24Filled class="size-3.5 shrink-0" />
                    <span class="truncate">积分: {{ item.price }}</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                    <Button
                      variant="outline"
                      size="xs"
                      class="flex-1 min-w-[52px] gap-1 px-2"
                      @click="onUpdateClick(item)"
                    >
                      <Edit24Filled class="size-3 shrink-0" />
                      <span>修改</span>
                    </Button>
                    <Popconfirm
                      :positive-text="section.shelfConfirmPositive"
                      negative-text="取消"
                      @positive-click="onSetShelfClick(item, section.nextStatus)"
                    >
                      <template #trigger>
                        <Button
                          variant="outline"
                          size="xs"
                          class="flex-1 min-w-[52px] gap-1 px-2"
                          :class="section.shelfBtnClass"
                        >
                          <ArrowSync24Filled class="size-3 shrink-0" />
                          <span>{{ section.shelfActionLabel }}</span>
                        </Button>
                      </template>
                      {{ section.shelfConfirmText }}
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
                          class="flex-1 min-w-[52px] gap-1 px-2 text-destructive hover:bg-destructive/10"
                        >
                          <Delete24Filled class="size-3 shrink-0" />
                          <span>删除</span>
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
    <PointGoodsEditDialog
      v-model:open="showAddGoodsModal"
      :editing-goods="editingGoods"
      :exist-tags="existTags"
      @saved="handleGoodsSaved"
    />
  </div>
</template>
