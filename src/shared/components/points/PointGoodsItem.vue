<script setup lang="ts">
import Pin16Filled from '@vicons/fluent/es/Pin16Filled'
import {
  Clock,
  Crown,
  ExternalLink,
  KeyRound,
  Layers,
  Lock,
  Package,
  Repeat,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  Wrench,
  ZoomIn,
} from 'lucide-vue-next'
import { computed } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsSalePhase, GoodsStatus, GoodsTypes, VirtualKeySelectionMode } from '@/api/generated/model'
import { IMGUR_URL } from '@/shared/config'
import { transformImageUrl } from '@/shared/services/imageTransform'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardFooter } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ImagePreview } from '@/shared/ui/image-preview'

const props = defineProps<{
  goods: ResponsePointGoodModel | undefined
  contentStyle?: string | undefined
  size?: 'small' | 'default'
  isManage?: boolean
}>()

const emptyCover = transformImageUrl(`${IMGUR_URL}None.png`, 'card')

const hasSubItems = computed(() => (props.goods?.subItems?.length ?? 0) > 0)
const subItems = computed(() => props.goods?.subItems ?? [])
const availableSubItemCount = computed(() => subItems.value.filter((s) => s.count == null || s.count > 0).length)

const isSoldOut = computed(() => {
  if (!props.goods) return false
  if (!hasSubItems.value) return props.goods.count === 0
  return subItems.value.length > 0 && subItems.value.every((s) => s.count === 0)
})

const salePhase = computed(() => props.goods?.salePhase ?? GoodsSalePhase.Active)

const isOnDiscount = computed(() => {
  const g = props.goods
  if (!g?.isOnDiscount) return false
  return (g.originalPrice ?? g.price) > g.price
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

const originalPriceRangeText = computed(() => {
  const g = props.goods
  if (!g) return ''
  if (!hasSubItems.value) return String(g.originalPrice ?? g.price)
  const originals = subItems.value.map((s) => s.originalPrice ?? s.price)
  if (!originals.length) return String(g.originalPrice ?? g.price)
  const min = Math.min(...originals)
  const max = Math.max(...originals)
  return min === max ? `${min}` : `${min}~${max}`
})

const discountRatioLabel = computed(() => {
  const g = props.goods
  if (!g || !isOnDiscount.value) return ''
  const orig = g.originalPrice ?? 0
  if (orig <= 0) return '特惠'
  if (g.price <= 0) return '限免'
  const fold = Number(((g.price / orig) * 10).toFixed(1))
  return fold > 0 && fold < 10 ? `${fold}折` : '特惠'
})

const typeMeta = computed(() => {
  switch (props.goods?.type) {
    case GoodsTypes.Physical:
      return { label: '实物', icon: Package }
    case GoodsTypes.Service:
      return { label: '服务', icon: Wrench }
    default:
      return { label: '虚拟', icon: Sparkles }
  }
})

const guardLevelLabel = computed(() => {
  switch (props.goods?.allowGuardLevel) {
    case 1:
      return '总督专属'
    case 2:
      return '提督专属'
    case 3:
      return '舰长专属'
    default:
      return ''
  }
})

const virtualKeyCount = computed(() => props.goods?.virtualKeys?.length ?? 0)
const isVirtualKeyPoolEnabled = computed(
  () =>
    props.goods?.type === GoodsTypes.Virtual &&
    props.goods.keySelectionMode !== undefined &&
    props.goods.keySelectionMode !== VirtualKeySelectionMode.None,
)
const isVirtualKeyLowStock = computed(
  () =>
    Boolean(props.isManage) &&
    isVirtualKeyPoolEnabled.value &&
    props.goods?.status !== GoodsStatus.Discontinued &&
    virtualKeyCount.value < 5,
)

function formatShortTime(ts?: number | null) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${min}`
  } catch {
    return ''
  }
}

const scheduleBadgeText = computed(() => {
  const g = props.goods
  if (!g) return ''
  if (salePhase.value === GoodsSalePhase.NotStarted && g.saleStartTime) {
    return `${formatShortTime(g.saleStartTime)} 开售`
  }
  if (salePhase.value === GoodsSalePhase.Ended) {
    return '售卖已结束'
  }
  if (isOnDiscount.value && g.discountEndTime) {
    return `特惠至 ${formatShortTime(g.discountEndTime)}`
  }
  if (g.saleEndTime) {
    return `限售至 ${formatShortTime(g.saleEndTime)}`
  }
  return ''
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
    class="goods-card group min-w-0 overflow-hidden bg-card/95 border-border/80 shadow-xs transition-all duration-200 hover:border-primary/45 hover:shadow-md flex flex-col justify-between"
    :class="{ 'is-pinned ring-1 ring-primary/35': goods.isPinned }"
    :style="props.contentStyle"
  >
    <!-- 封面区域（干净角标，不再底部大图压黑遮罩） -->
    <div class="cover-wrapper relative w-full aspect-[16/10] overflow-hidden bg-muted/40 border-b border-border/50">
      <ImagePreview
        v-if="goods.cover?.path"
        :src="goods.cover.path"
        :file-id="goods.cover.id"
        :is-public="true"
        fallback-transform="card"
        :alt="goods.name"
        wrapper-class="block size-full"
      >
        <template #default="{ open, thumbSrc, onError }">
          <button
            type="button"
            class="relative block size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="`放大查看 ${goods.name}`"
            @click="open()"
          >
            <img
              :src="thumbSrc || undefined"
              :alt="goods.name"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              @error="onError"
            />
            <span
              class="pointer-events-none absolute bottom-2 right-2 size-6 rounded-full bg-black/60 text-white flex-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
            >
              <ZoomIn class="size-3.5" />
            </span>
          </button>
        </template>
      </ImagePreview>
      <img
        v-else
        :src="emptyCover"
        :alt="goods.name"
        loading="lazy"
        referrerpolicy="no-referrer"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />

      <!-- 售罄或停售遮罩 -->
      <div
        v-if="isSoldOut"
        class="sold-out-mask pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-[1px] flex-center"
      >
        <span
          class="sold-out-text text-white font-semibold text-xs px-2.5 py-1 rounded-md bg-black/75 border border-white/20"
        >
          已售完
        </span>
      </div>
      <div
        v-else-if="salePhase === GoodsSalePhase.Ended"
        class="pointer-events-none absolute inset-0 bg-black/45 flex-center"
      >
        <span class="text-white font-semibold text-xs px-2.5 py-1 rounded-md bg-black/75 border border-white/20">
          售卖已结束
        </span>
      </div>

      <!-- 左上角：类型 + 限时/置顶状态 -->
      <div class="pointer-events-none absolute top-2 left-2 flex items-center gap-1 flex-wrap max-w-[82%]">
        <span
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/85 backdrop-blur-xs text-[10px] font-medium text-foreground border border-border/60 shadow-2xs"
        >
          <component
            :is="typeMeta.icon"
            class="size-2.5 text-muted-foreground"
          />
          {{ typeMeta.label }}
        </span>

        <span
          v-if="isOnDiscount"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-600/95 text-white text-[10px] font-semibold shadow-2xs"
        >
          {{ discountRatioLabel }}
        </span>
        <span
          v-else-if="salePhase === GoodsSalePhase.NotStarted"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-600/95 text-white text-[10px] font-medium shadow-2xs"
        >
          <Clock class="size-2.5" />
          即将开售
        </span>
      </div>

      <!-- 右上角：置顶与预警 -->
      <div class="pointer-events-none absolute top-2 right-2 flex items-center gap-1">
        <div
          v-if="isVirtualKeyLowStock"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] font-medium shadow-2xs"
          title="启用卡密自动发放的商品剩余卡密不足 5 个"
        >
          <KeyRound class="size-2.5" />
          <span>卡密余 {{ virtualKeyCount }}</span>
        </div>
        <div
          v-if="goods.isPinned"
          class="pin-badge size-6 rounded-full bg-primary text-primary-foreground flex-center shadow-xs"
          title="置顶商品"
        >
          <component
            :is="Pin16Filled"
            class="size-3.5"
          />
        </div>
      </div>
    </div>

    <!-- 卡片主体 -->
    <CardContent class="card-content p-3.5 space-y-2 flex-1 min-w-0 text-xs">
      <!-- 标题 + 库存 -->
      <div class="header-row-container flex items-start justify-between gap-2">
        <strong
          class="goods-title font-semibold text-foreground text-sm leading-snug line-clamp-1 flex-1 min-w-0"
          :title="goods.name"
        >
          {{ goods.name }}
        </strong>
        <span
          class="stock-badge text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-medium"
          :class="isSoldOut ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'"
        >
          <template v-if="isSoldOut">缺货</template>
          <template v-else-if="hasSubItems">{{ availableSubItemCount }} 选</template>
          <template v-else-if="goods.count && goods.count > 0">余 {{ goods.count }}</template>
          <template v-else>无限</template>
        </span>
      </div>

      <!-- 价格区（高对比排版，支持舰长免兑/限时折扣原价对比） -->
      <div class="flex items-baseline justify-between gap-2">
        <div class="price-pill flex items-baseline gap-1.5 min-w-0">
          <template v-if="goods.canFreeBuy && priceMax > 0">
            <span
              class="price-highlight text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
            >
              免费
            </span>
            <span class="price-original text-[11px] font-mono tabular-nums text-muted-foreground line-through">
              {{ originalPriceRangeText }} 积分
            </span>
          </template>
          <template v-else-if="isOnDiscount">
            <span class="price-current text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {{ priceRangeText }}
            </span>
            <span
              v-if="priceRangeText !== '免费'"
              class="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium"
            >
              积分
            </span>
            <span class="price-original text-[11px] font-mono tabular-nums text-muted-foreground line-through">
              {{ originalPriceRangeText }}
            </span>
          </template>
          <template v-else>
            <span class="price-current text-base font-bold font-mono tabular-nums text-primary">
              {{ priceRangeText }}
            </span>
            <span
              v-if="priceRangeText !== '免费'"
              class="text-[11px] text-muted-foreground font-medium"
            >
              积分
            </span>
          </template>
        </div>

        <span
          v-if="scheduleBadgeText"
          class="inline-flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 shrink-0"
        >
          <Clock class="size-2.5" />
          {{ scheduleBadgeText }}
        </span>
      </div>

      <!-- 描述 -->
      <p
        class="description-text text-xs text-muted-foreground line-clamp-2 leading-relaxed m-0 min-h-[2.25rem]"
        :title="goods.description || ''"
      >
        {{ goods.description || '暂无描述' }}
      </p>

      <!-- 精简元信息徽章行（前后台共用清晰图标语法，彻底告别 2x2 灰块与 emoji） -->
      <div class="tags-row flex items-center gap-1 flex-wrap pt-0.5">
        <Badge
          v-if="goods.hasGuardFreePrivilege || goods.canFreeBuy"
          variant="secondary"
          size="xs"
          class="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0"
        >
          <Crown class="size-2.5" />
          {{ goods.canFreeBuy ? '舰长免费' : '舰长福利' }}
        </Badge>

        <Badge
          v-if="guardLevelLabel"
          variant="secondary"
          size="xs"
          class="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0"
        >
          <ShieldCheck class="size-2.5" />
          {{ guardLevelLabel }}
        </Badge>

        <Badge
          v-if="!goods.isAllowRebuy"
          variant="secondary"
          size="xs"
          class="gap-1 bg-muted text-muted-foreground border-0"
        >
          <Lock class="size-2.5" />
          限换1次
        </Badge>
        <Badge
          v-else-if="isManage && goods.maxBuyCount > 1"
          variant="secondary"
          size="xs"
          class="gap-1 bg-muted text-muted-foreground border-0"
        >
          <Repeat class="size-2.5" />
          单次上限 {{ goods.maxBuyCount }}
        </Badge>

        <Badge
          v-if="isManage && isVirtualKeyPoolEnabled"
          :variant="isVirtualKeyLowStock ? 'destructive' : 'outline'"
          size="xs"
          class="gap-1 font-mono"
        >
          <KeyRound class="size-2.5" />
          密钥 {{ virtualKeyCount }}
        </Badge>

        <Badge
          v-if="isManage && goods.type === GoodsTypes.Physical && goods.collectUrl"
          variant="outline"
          size="xs"
          class="gap-1 text-muted-foreground"
        >
          <ExternalLink class="size-2.5" />
          站外收集
        </Badge>

        <Badge
          v-if="hasSubItems"
          variant="outline"
          size="xs"
          class="gap-1 text-muted-foreground"
          :title="subItems.map((s) => s.name).join(' / ')"
        >
          <Layers class="size-2.5" />
          {{ subItems.length }} 款式
        </Badge>

        <Badge
          v-for="tag in goods.tags?.slice(0, isManage ? 2 : 4)"
          :key="tag"
          variant="outline"
          size="xs"
          class="gap-1 text-muted-foreground"
        >
          <TagIcon class="size-2.5" />
          {{ tag }}
        </Badge>
      </div>
    </CardContent>

    <!-- 页脚插槽 -->
    <CardFooter
      v-if="$slots.footer"
      class="px-3.5 pb-3.5 pt-0 flex-col items-stretch"
    >
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>
