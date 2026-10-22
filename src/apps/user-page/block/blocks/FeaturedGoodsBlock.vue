<script setup lang="ts">
import { OpenOutline, RefreshOutline, StorefrontOutline } from '@vicons/ionicons5'
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { ResponsePointGoodModel, UserInfo } from '@/api/api-models'
import { FunctionTypes, GoodsStatus } from '@/api/api-models'
import { fetchPublicPointGoods } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: UserInfo }>()
const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const count = computed(() => ([3, 4, 5, 6].includes(Number(values.value.count)) ? Number(values.value.count) : 3))
const selection = computed(() => (values.value.selection === 'available' ? 'available' : 'pinned'))
const selectedGoodsIds = computed(() =>
  Array.isArray(values.value.goodsIds)
    ? values.value.goodsIds.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 6)
    : [],
)
const showDescription = computed(() => values.value.showDescription !== false)
const showStock = computed(() => values.value.showStock !== false)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.Point))
const query = useUserPageRuntimeQuery({
  key: () => `featured-goods:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: (signal) => fetchPublicPointGoods(props.userInfo!.id, { signal }),
})

function isSoldOut(item: ResponsePointGoodModel) {
  return item.subItems?.length ? item.subItems.every((subItem) => subItem.count === 0) : item.count === 0
}

function price(item: ResponsePointGoodModel) {
  const prices = item.subItems?.length ? item.subItems.map((subItem) => subItem.price) : [item.price]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (max <= 0) return '免费'
  return min === max ? `${min} 积分` : `${min} - ${max} 积分`
}

const goods = computed(() => {
  const available = (query.data.value ?? []).filter((item) => item.status === GoodsStatus.Normal)
  if (selectedGoodsIds.value.length) {
    const byId = new Map(available.map((item) => [item.id, item]))
    return selectedGoodsIds.value.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }
  return available
    .toSorted((a, b) =>
      selection.value === 'pinned'
        ? Number(b.isPinned) - Number(a.isPinned)
        : Number(isSoldOut(a)) - Number(isSoldOut(b)),
    )
    .slice(0, count.value)
})

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页积分商品区块加载失败', error)
  }
}

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, enabled.value] as const,
  () => {
    void load()
  },
)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="goods-header flex items-center justify-between w-full">
        <span class="goods-heading flex items-center gap-1.5 font-semibold text-sm">
          <component
            :is="StorefrontOutline"
            class="size-4"
          />
          精选积分礼物
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-goods', params: { id: props.userInfo.name } }"
          custom
        >
          <Button
            variant="ghost"
            class="text-primary font-medium p-0"
            @click="navigate"
          >
            全部商品
            <component
              :is="OpenOutline"
              class="size-3.5 ml-1"
            />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert
      v-if="!enabled"
      class="text-xs py-2"
    >
      <AlertDescription> 积分兑换未开放 </AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
      class="text-xs py-2"
    >
      <AlertDescription class="flex items-center justify-between w-full">
        <span>积分商品加载失败</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="load(true)"
        >
          <component
            :is="RefreshOutline"
            class="size-3"
          />
          重试
        </Button>
      </AlertDescription>
    </Alert>
    <div
      v-else-if="query.status.value === 'loading' || query.status.value === 'idle'"
      class="py-6 flex justify-center"
    >
      <Spin />
    </div>
    <div v-else>
      <Empty
        v-if="!goods.length"
        description="暂无可展示商品"
        class="py-4 text-xs"
      />
      <div
        v-else
        class="goods-grid grid grid-cols-3 gap-2.5"
      >
        <RouterLink
          v-for="item in goods"
          :key="item.id"
          :to="{ name: 'user-goods', params: { id: props.userInfo?.name } }"
          class="goods-item border border-border rounded-lg bg-muted/40 overflow-hidden text-foreground no-underline transition hover:border-primary hover:bg-card"
        >
          <div class="cover-wrap relative aspect-video overflow-hidden bg-muted">
            <img
              v-if="item.cover?.path"
              :src="item.cover.path"
              alt=""
              loading="lazy"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="cover-empty h-full flex items-center justify-center text-muted-foreground text-2xl"
            >
              <component
                :is="StorefrontOutline"
                class="size-8"
              />
            </div>
            <Badge
              v-if="isSoldOut(item)"
              variant="secondary"
              class="stock-tag absolute right-1.5 bottom-1.5 text-[10px] h-4 px-1"
            >
              已售罄
            </Badge>
          </div>
          <div class="goods-copy p-2.5 grid gap-1">
            <strong class="text-xs font-semibold truncate">{{ item.name }}</strong>
            <p
              v-if="showDescription && item.description"
              class="text-[11px] text-muted-foreground line-clamp-2 m-0 leading-normal"
            >
              {{ item.description }}
            </p>
            <div class="goods-meta flex items-center justify-between text-xs mt-1">
              <span class="price font-bold text-primary">{{ price(item) }}</span>
              <span
                v-if="showStock && !isSoldOut(item)"
                class="stock text-[10px] text-muted-foreground"
              >
                {{ item.count == null || item.subItems?.length ? '有库存' : `剩余 ${item.count}` }}
              </span>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.goods-grid {
  container-type: inline-size;
}
@container (max-width: 640px) {
  .goods-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 380px) {
  .goods-grid {
    grid-template-columns: 1fr;
  }
  .goods-item {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
  }
  .cover-wrap {
    aspect-ratio: auto;
    min-height: 100px;
  }
}
</style>
