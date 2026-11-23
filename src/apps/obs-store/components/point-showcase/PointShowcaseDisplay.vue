<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Coins, Flame, Gift, Package, Sparkles, Tag, Trophy } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getApiCheckinRanking } from '@/api/generated/check-in/check-in'
import { GoodsStatus } from '@/api/generated/model'
import type { ResponseBasePointGoodsModel, ResponseUserCheckInModel } from '@/api/generated/model'
import { getApiPointGetGoods } from '@/api/generated/point/point'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { resolveFileUrl } from '@/shared/config'

import { DEFAULT_POINT_SHOWCASE_STATE, SAMPLE_CHECKIN_RANKING, SAMPLE_POINT_GOODS } from './types'
import type { PointShowcaseAction, PointShowcaseState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const {
  state,
  onAction,
  userId: resolvedUserId,
} = useObsBridge<PointShowcaseState, PointShowcaseAction>({
  componentId: 'point-showcase',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_POINT_SHOWCASE_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const rawGoods = ref<ResponseBasePointGoodsModel[]>([])
const rawRanking = ref<ResponseUserCheckInModel[]>([])
const isLoading = ref(false)
const hasFetched = ref(false)
let requestSeq = 0

async function fetchData() {
  const uid = resolvedUserId.value
  if (!uid) {
    rawGoods.value = []
    rawRanking.value = []
    hasFetched.value = true
    return
  }
  const seq = ++requestSeq
  isLoading.value = true
  try {
    const [goodsRes, rankRes] = await Promise.allSettled([
      getApiPointGetGoods({ id: String(uid) }),
      getApiCheckinRanking({ vId: uid, count: 10 }),
    ])
    if (seq !== requestSeq) return
    if (goodsRes.status === 'fulfilled' && goodsRes.value.code === 200 && Array.isArray(goodsRes.value.data)) {
      rawGoods.value = goodsRes.value.data
    } else {
      rawGoods.value = []
    }
    if (rankRes.status === 'fulfilled' && rankRes.value.code === 200 && Array.isArray(rankRes.value.data)) {
      rawRanking.value = rankRes.value.data
    } else {
      rawRanking.value = []
    }
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
      hasFetched.value = true
    }
  }
}

watch(
  resolvedUserId,
  () => {
    void fetchData()
  },
  { immediate: true },
)

// 每 5 分钟自动刷新公开数据
useIntervalFn(() => {
  if (!state.value.useSampleData) {
    void fetchData()
  }
}, 5 * 60_000)

const maxItems = computed(() => Math.max(3, Math.min(10, Number(state.value.maxItems) || 5)))

function isGoodSoldOut(item: ResponseBasePointGoodsModel) {
  if (item.subItems?.length) {
    return item.subItems.every((sub) => sub.count === 0)
  }
  return item.count === 0
}

const displayGoods = computed(() => {
  const list = state.value.useSampleData ? SAMPLE_POINT_GOODS : rawGoods.value
  return list
    .filter((item) => item.status === GoodsStatus.Normal)
    .toSorted((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(isGoodSoldOut(a)) - Number(isGoodSoldOut(b)))
    .slice(0, maxItems.value)
})

const displayRanking = computed(() => {
  const list = state.value.useSampleData ? SAMPLE_CHECKIN_RANKING : rawRanking.value
  return list.slice(0, maxItems.value)
})

const activeGoodsIndex = ref(0)
const cycleStage = ref<'goods' | 'checkin'>('goods')

const activePanel = computed<'goods' | 'checkin'>(() => {
  if (state.value.mode === 'goods') return 'goods'
  if (state.value.mode === 'checkin') return 'checkin'
  if (displayGoods.value.length === 0 && displayRanking.value.length > 0) return 'checkin'
  if (displayRanking.value.length === 0 && displayGoods.value.length > 0) return 'goods'
  return cycleStage.value
})

const currentGood = computed<ResponseBasePointGoodsModel | null>(() => {
  if (!displayGoods.value.length) return null
  return displayGoods.value[activeGoodsIndex.value % displayGoods.value.length] ?? null
})

function advanceSlide() {
  if (state.value.mode === 'goods') {
    if (displayGoods.value.length > 1) {
      activeGoodsIndex.value = (activeGoodsIndex.value + 1) % displayGoods.value.length
    }
    return
  }
  if (state.value.mode === 'cycle') {
    if (displayGoods.value.length > 0 && displayRanking.value.length > 0) {
      if (cycleStage.value === 'goods') {
        cycleStage.value = 'checkin'
      } else {
        cycleStage.value = 'goods'
        activeGoodsIndex.value = (activeGoodsIndex.value + 1) % displayGoods.value.length
      }
    } else if (displayGoods.value.length > 1) {
      activeGoodsIndex.value = (activeGoodsIndex.value + 1) % displayGoods.value.length
    }
  }
}

watch(
  () => [state.value.mode, displayGoods.value.length],
  () => {
    activeGoodsIndex.value = 0
    cycleStage.value = 'goods'
  },
)

const rotateMs = computed(() => Math.max(3, Math.min(60, Number(state.value.rotateIntervalSeconds) || 8)) * 1000)

useIntervalFn(() => {
  advanceSlide()
}, rotateMs)

onMounted(() => {
  onAction((action) => {
    if (action.type === 'REFRESH') {
      void fetchData()
    } else if (action.type === 'NEXT_SLIDE') {
      advanceSlide()
    }
  })
})

function getGoodCoverUrl(item: ResponseBasePointGoodsModel) {
  return item.cover?.path ? resolveFileUrl(item.cover.path) : null
}

function getEffectivePrice(item: ResponseBasePointGoodsModel) {
  if (item.isOnDiscount && item.discountPrice != null) {
    return item.discountPrice
  }
  return item.price
}

function hasDiscount(item: ResponseBasePointGoodsModel) {
  const effective = getEffectivePrice(item)
  return item.isOnDiscount && item.originalPrice > effective
}

function formatPriceLabel(price: number) {
  return price <= 0 ? '免费' : `${price} 积分`
}

function getStockLabel(item: ResponseBasePointGoodsModel) {
  if (isGoodSoldOut(item)) return '已兑完'
  if (item.count != null && !item.subItems?.length) return `剩余 ${item.count}`
  return '可兑换'
}
</script>

<template>
  <div
    class="point-obs-root"
    :class="[
      `theme-${state.theme}`,
      {
        'is-inline': props.inlineMode,
        'no-shadow': props.noShadow,
      },
    ]"
    :style="{ '--widget-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <div class="point-shell">
      <!-- 顶部栏 -->
      <header class="point-header">
        <div class="header-left">
          <span class="header-icon">
            <Gift
              v-if="activePanel === 'goods'"
              class="icon-svg"
            />
            <Trophy
              v-else
              class="icon-svg"
            />
          </span>
          <span class="header-title">{{ state.title || '积分商城 · 签到榜' }}</span>
          <span
            v-if="state.useSampleData"
            class="sample-pill"
          >
            示例
          </span>
        </div>
        <span class="mode-pill">
          {{ activePanel === 'goods' ? '好礼兑换' : '签到排行' }}
        </span>
      </header>

      <!-- 主内容区 -->
      <div class="point-body">
        <Transition
          name="panel-fade"
          mode="out-in"
        >
          <!-- 视图 1：积分商品轮播卡片 -->
          <div
            v-if="activePanel === 'goods'"
            :key="`goods-${currentGood?.id ?? 'empty'}`"
            class="goods-stage"
          >
            <template v-if="currentGood">
              <div class="goods-card">
                <div class="goods-cover">
                  <img
                    v-if="getGoodCoverUrl(currentGood)"
                    :src="getGoodCoverUrl(currentGood)!"
                    :alt="currentGood.name"
                    class="cover-img"
                  />
                  <div
                    v-else
                    class="cover-fallback"
                  >
                    <Package class="fallback-icon" />
                  </div>
                  <span
                    v-if="hasDiscount(currentGood)"
                    class="discount-badge"
                  >
                    <Tag class="mini-icon" />
                    折扣
                  </span>
                </div>

                <div class="goods-info">
                  <div class="goods-name">{{ currentGood.name }}</div>
                  <p
                    v-if="currentGood.description"
                    class="goods-desc"
                  >
                    {{ currentGood.description }}
                  </p>

                  <div class="goods-price-row">
                    <span class="price-current">
                      <Coins class="price-icon" />
                      {{ formatPriceLabel(getEffectivePrice(currentGood)) }}
                    </span>
                    <span
                      v-if="hasDiscount(currentGood)"
                      class="price-original"
                    >
                      {{ currentGood.originalPrice }}
                    </span>
                  </div>

                  <div class="goods-tags">
                    <span
                      class="meta-chip"
                      :class="{ 'is-soldout': isGoodSoldOut(currentGood) }"
                    >
                      {{ getStockLabel(currentGood) }}
                    </span>
                    <span
                      v-if="currentGood.maxBuyCount > 0"
                      class="meta-chip"
                    >
                      限兑 {{ currentGood.maxBuyCount }}
                    </span>
                    <span
                      v-for="tag in currentGood.tags.slice(0, 2)"
                      :key="tag"
                      class="meta-chip is-accent"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-if="displayGoods.length > 1"
                class="carousel-dots"
              >
                <span
                  v-for="(item, idx) in displayGoods"
                  :key="item.id"
                  class="dot"
                  :class="{ 'is-active': idx === activeGoodsIndex % displayGoods.length }"
                />
              </div>
            </template>

            <div
              v-else-if="hasFetched && !isLoading"
              class="empty-box"
            >
              <Gift class="empty-icon" />
              <span class="empty-title">暂未上架积分商品</span>
              <span class="empty-hint">可在积分商城上架礼物，或开启示例预览</span>
            </div>
          </div>

          <!-- 视图 2：弹幕签到排行榜 -->
          <div
            v-else
            key="checkin"
            class="checkin-stage"
          >
            <div
              v-if="displayRanking.length > 0"
              class="rank-list"
            >
              <div
                v-for="(user, idx) in displayRanking"
                :key="user.ouId || `${user.name}-${idx}`"
                class="rank-row"
                :class="`rank-${idx + 1}`"
              >
                <span class="rank-index">{{ idx + 1 }}</span>
                <span class="rank-name">{{ user.name }}</span>
                <span class="rank-streak">
                  <Flame class="streak-icon" />
                  {{ user.consecutiveDays }}天
                </span>
                <span class="rank-points">{{ user.points }}</span>
              </div>
            </div>

            <div
              v-else-if="hasFetched && !isLoading"
              class="empty-box"
            >
              <Trophy class="empty-icon" />
              <span class="empty-title">暂无签到排行数据</span>
              <span class="empty-hint">观众在直播间签到后将自动上榜</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- 底部引流标语 -->
      <footer
        v-if="state.ctaText"
        class="point-footer"
      >
        <Sparkles class="footer-icon" />
        <span class="footer-text">{{ state.ctaText }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.point-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
  color: #f8fafc;
}

.point-shell {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

/* 4 套视觉主题 */
.theme-card .point-shell {
  background: rgba(15, 18, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 13px 15px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

.theme-minimal .point-shell {
  background: transparent;
  padding: 6px 8px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

.theme-neon .point-shell {
  background: rgba(9, 10, 18, 0.95);
  border: 1px solid var(--widget-accent);
  border-radius: 10px;
  padding: 13px 15px;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--widget-accent) 45%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--widget-accent) 16%, transparent);
}

.theme-glass .point-shell {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 16px;
  padding: 13px 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
}

.no-shadow .point-shell {
  box-shadow: none !important;
}

/* 头部 */
.point-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.header-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--widget-accent) 22%, transparent);
  color: var(--widget-accent);
  flex-shrink: 0;
}

.icon-svg {
  width: 14px;
  height: 14px;
}

.header-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sample-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--widget-accent) 24%, transparent);
  color: var(--widget-accent);
}

.mode-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(241, 245, 249, 0.92);
  flex-shrink: 0;
  text-shadow: none;
}

/* 内容容器 */
.point-body {
  min-height: 174px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 商品卡片 */
.goods-stage {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goods-card {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 11px;
  padding: 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.theme-minimal .goods-card {
  background: rgba(12, 14, 20, 0.48);
  border-color: rgba(255, 255, 255, 0.16);
}

.goods-cover {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, color-mix(in srgb, var(--widget-accent) 28%, #1e293b), rgba(15, 23, 42, 0.9));
  color: var(--widget-accent);
}

.fallback-icon {
  width: 30px;
  height: 30px;
  opacity: 0.9;
}

.discount-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 4px;
  background: #f43f5e;
  color: #ffffff;
  text-shadow: none;
}

.mini-icon {
  width: 9px;
  height: 9px;
}

.goods-info {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  gap: 5px;
}

.goods-name {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.goods-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(203, 213, 225, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.goods-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.price-current {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 800;
  color: var(--widget-accent);
  font-variant-numeric: tabular-nums;
}

.price-icon {
  width: 13px;
  height: 13px;
}

.price-original {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.75);
  text-decoration: line-through;
  font-variant-numeric: tabular-nums;
}

.goods-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(226, 232, 240, 0.9);
  text-shadow: none;
}

.meta-chip.is-accent {
  background: color-mix(in srgb, var(--widget-accent) 22%, transparent);
  color: color-mix(in srgb, var(--widget-accent) 85%, #ffffff);
}

.meta-chip.is-soldout {
  background: rgba(244, 63, 94, 0.22);
  color: #fda4af;
}

.carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  transition:
    transform 180ms ease,
    background-color 180ms ease;
}

.dot.is-active {
  background: var(--widget-accent);
  transform: scale(1.35);
}

/* 签到排行榜 */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.theme-minimal .rank-row {
  background: rgba(12, 14, 20, 0.48);
  border-color: rgba(255, 255, 255, 0.14);
}

.rank-index {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(226, 232, 240, 0.9);
  flex-shrink: 0;
  text-shadow: none;
}

.rank-1 .rank-index {
  background: #f59e0b;
  color: #090d16;
}

.rank-2 .rank-index {
  background: #cbd5e1;
  color: #090d16;
}

.rank-3 .rank-index {
  background: #d97706;
  color: #ffffff;
}

.rank-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-streak {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #fb923c;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.streak-icon {
  width: 11px;
  height: 11px;
}

.rank-points {
  font-size: 12px;
  font-weight: 800;
  color: var(--widget-accent);
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: right;
  flex-shrink: 0;
}

/* 底部引流条 */
.point-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--widget-accent) 16%, rgba(15, 23, 42, 0.4));
  border: 1px solid color-mix(in srgb, var(--widget-accent) 32%, transparent);
}

.footer-icon {
  width: 13px;
  height: 13px;
  color: var(--widget-accent);
  flex-shrink: 0;
}

.footer-text {
  font-size: 11px;
  font-weight: 600;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 空态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  padding: 20px 12px;
}

.empty-icon {
  width: 22px;
  height: 22px;
  color: var(--widget-accent);
  margin-bottom: 2px;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.empty-hint {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
}
</style>
