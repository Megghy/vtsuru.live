<script setup lang="ts">
import { Pin16Filled } from '@vicons/fluent'
import { computed } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsTypes } from '@/api/generated/model'
import { IMGUR_URL } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardFooter } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'

const props = defineProps<{
  goods: ResponsePointGoodModel | undefined
  contentStyle?: string | undefined
  size?: 'small' | 'default'
  isManage?: boolean
}>()

// 默认封面图片
const emptyCover = `${IMGUR_URL}None.png`

const hasSubItems = computed(() => (props.goods?.subItems?.length ?? 0) > 0)
const subItems = computed(() => props.goods?.subItems ?? [])
const availableSubItemCount = computed(() => subItems.value.filter((s) => s.count == null || s.count > 0).length)
const isSoldOut = computed(() => {
  if (!props.goods) return false
  if (!hasSubItems.value) return props.goods.count === 0
  return subItems.value.length > 0 && subItems.value.every((s) => s.count === 0)
})
const priceMin = computed(() => {
  if (!props.goods) return 0
  if (!hasSubItems.value) return props.goods.price
  const list = subItems.value.map((s) => s.price)
  return list.length ? Math.min(...list) : props.goods.price
})
const priceMax = computed(() => {
  if (!props.goods) return 0
  if (!hasSubItems.value) return props.goods.price
  const list = subItems.value.map((s) => s.price)
  return list.length ? Math.max(...list) : props.goods.price
})
const priceRangeText = computed(() => {
  if (!props.goods) return ''
  if (!hasSubItems.value) return props.goods.price > 0 ? String(props.goods.price) : '免费'
  if (priceMin.value <= 0 && priceMax.value <= 0) return '免费'
  return priceMin.value === priceMax.value ? `${priceMin.value}` : `${priceMin.value}~${priceMax.value}`
})
</script>

<template>
  <Empty
    v-if="!goods"
    description="已失效"
    class="empty-state py-8"
  />
  <Card
    v-else
    class="goods-card group overflow-hidden border border-border/80 bg-card shadow-xs transition hover:border-primary/50 flex flex-col justify-between"
    :class="{ 'is-pinned ring-1 ring-primary/40': goods.isPinned }"
    :style="props.contentStyle"
  >
    <!-- 商品封面 -->
    <div class="cover-wrapper relative w-full aspect-video overflow-hidden bg-muted/40">
      <img
        :src="goods.cover ? goods.cover.path : emptyCover"
        :alt="goods.name"
        loading="lazy"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover transition duration-300 group-hover:scale-105"
      />

      <!-- 售罄遮罩 -->
      <div
        v-if="isSoldOut"
        class="sold-out-mask absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center"
      >
        <span class="sold-out-text text-white font-bold text-xs px-2.5 py-1 rounded bg-black/70 border border-white/20">
          已售完
        </span>
      </div>

      <!-- 置顶标记 -->
      <div
        v-if="goods.isPinned"
        class="pin-badge absolute top-2 right-2 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs"
        title="置顶商品"
      >
        <component
          :is="Pin16Filled"
          class="size-3.5"
        />
      </div>

      <!-- 底部浮层信息 -->
      <div
        class="cover-overlay absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between gap-1.5 text-white"
      >
        <!-- 左侧标签组 -->
        <div class="overlay-tags flex items-center gap-1 flex-wrap">
          <Badge
            variant="secondary"
            class="text-[10px] h-4.5 px-1 font-normal bg-black/60 text-white border-0"
          >
            {{ goods.type === GoodsTypes.Physical ? '实物' : goods.type === GoodsTypes.Service ? '服务' : '虚拟' }}
          </Badge>

          <Badge
            v-if="hasSubItems"
            variant="secondary"
            class="text-[10px] h-4.5 px-1 font-normal bg-black/60 text-white border-0"
          >
            多选
          </Badge>

          <Badge
            v-if="goods.allowGuardLevel > 0"
            variant="secondary"
            class="text-[10px] h-4.5 px-1 font-normal bg-amber-500/80 text-white border-0"
          >
            {{ goods.allowGuardLevel === 1 ? '总督' : goods.allowGuardLevel === 2 ? '提督' : '舰长' }}专属
          </Badge>
        </div>

        <!-- 右侧价格 -->
        <div class="price-pill flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-xs font-mono font-bold">
          <span class="coin-icon text-[11px]">🪙</span>
          <template v-if="goods.canFreeBuy && priceMax > 0">
            <span class="price-original line-through opacity-70 text-[10px]">{{ priceRangeText }}</span>
            <span class="price-highlight text-emerald-400">免费</span>
          </template>
          <template v-else>
            <span class="price-current text-amber-300">{{ priceRangeText }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 商品信息主体 -->
    <CardContent class="card-content p-3 space-y-2 flex-1 min-w-0 text-xs">
      <!-- 标题行 -->
      <div class="header-row-container flex items-start justify-between gap-2">
        <strong
          class="goods-title font-bold text-foreground text-sm truncate flex-1 block"
          :title="goods.name"
        >
          {{ goods.name }}
        </strong>

        <!-- 库存显示 -->
        <span
          class="stock-badge text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 font-medium"
          :class="isSoldOut ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'"
        >
          <template v-if="isSoldOut">缺货</template>
          <template v-else-if="hasSubItems">{{ availableSubItemCount }} 选</template>
          <template v-else-if="goods.count && goods.count > 0">余 {{ goods.count }}</template>
          <template v-else>无限</template>
        </span>
      </div>

      <!-- 描述文本 -->
      <p
        class="description-text text-xs text-muted-foreground line-clamp-2 m-0"
        :title="goods.description"
      >
        {{ goods.description || '暂无描述' }}
      </p>

      <!-- 标签区域 (用户侧) -->
      <div
        v-if="!isManage"
        class="tags-row flex items-center gap-1 flex-wrap pt-1"
      >
        <Badge
          v-if="goods.canFreeBuy"
          variant="secondary"
          class="text-[10px] h-4.5 px-1 bg-emerald-500/10 text-emerald-600 font-normal"
        >
          ⭐ 舰长免费
        </Badge>
        <Badge
          v-if="!goods.isAllowRebuy"
          variant="secondary"
          class="text-[10px] h-4.5 px-1 bg-destructive/10 text-destructive font-normal"
        >
          🔒 限购一次
        </Badge>
        <Badge
          v-for="tag in goods.tags"
          :key="tag"
          variant="outline"
          class="text-[10px] h-4.5 px-1 font-normal text-muted-foreground"
        >
          {{ tag }}
        </Badge>
      </div>

      <!-- 管理侧信息卡片 -->
      <div
        v-if="isManage"
        class="manage-info-grid grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-muted-foreground"
      >
        <div
          v-if="goods.type === GoodsTypes.Physical && goods.maxBuyCount"
          class="info-cell flex items-center justify-between p-1 rounded bg-muted/40"
        >
          <span class="label">📦 限购</span>
          <span class="value font-mono">{{ goods.maxBuyCount }}</span>
        </div>
        <div class="info-cell flex items-center justify-between p-1 rounded bg-muted/40">
          <span class="label">🔄 重购</span>
          <span
            class="value font-medium"
            :class="goods.isAllowRebuy ? 'text-emerald-600' : 'text-destructive'"
          >
            {{ goods.isAllowRebuy ? '是' : '否' }}
          </span>
        </div>
        <div
          v-if="goods.type === GoodsTypes.Virtual && goods.virtualKeys?.length"
          class="info-cell flex items-center justify-between p-1 rounded bg-muted/40"
        >
          <span class="label">🔑 密钥</span>
          <span class="value font-mono">{{ goods.virtualKeys.length }}</span>
        </div>
        <div
          v-if="goods.type === GoodsTypes.Physical"
          class="info-cell flex items-center justify-between p-1 rounded bg-muted/40"
        >
          <span class="label">📮 地址</span>
          <span class="value">{{ goods.collectUrl ? '站外' : '本站' }}</span>
        </div>
        <div
          v-if="hasSubItems"
          class="info-cell col-span-2 flex items-center justify-between p-1 rounded bg-muted/40"
        >
          <span class="label shrink-0 mr-1">🎨 款式</span>
          <span
            class="value truncate"
            :title="subItems.map((s) => s.name).join(' / ')"
          >
            {{ subItems.map((s) => s.name).join(' / ') }}
          </span>
        </div>
      </div>
    </CardContent>

    <!-- 页脚插槽 -->
    <CardFooter
      v-if="$slots.footer"
      class="p-3 pt-0"
    >
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
