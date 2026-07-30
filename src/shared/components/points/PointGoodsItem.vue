<script setup lang="ts">
import { Pin16Filled } from '@vicons/fluent'
import { NCard, NEllipsis, NEmpty, NIcon, NImage, NTag } from 'naive-ui'
import { computed } from 'vue'

import type { ResponsePointGoodModel } from '@/api/api-models'
import { GoodsTypes } from '@/api/api-models'
import { IMGUR_URL } from '@/shared/config'

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
  <NEmpty
    v-if="!goods"
    description="已失效"
    class="empty-state"
  />
  <NCard
    v-else
    hoverable
    :bordered="true"
    size="small"
    class="goods-card"
    :class="{ 'is-pinned': goods.isPinned }"
    :style="props.contentStyle"
    content-style="padding: 12px;"
    footer-style="padding: 0 12px 12px 12px;"
  >
    <!-- 商品封面 -->
    <template #cover>
      <div class="cover-wrapper">
        <div class="cover-image-container">
          <NImage
            :src="goods.cover ? goods.cover.path : emptyCover"
            :fallback-src="emptyCover"
            object-fit="cover"
            :preview-disabled="!goods.cover"
            class="cover-image"
            lazy
            :img-props="{ style: { width: '100%', height: '100%', objectFit: 'cover' } }"
          />
        </div>

        <!-- 售罄遮罩 -->
        <div
          v-if="isSoldOut"
          class="sold-out-mask"
        >
          <span class="sold-out-text">已售完</span>
        </div>

        <!-- 置顶标记 -->
        <div
          v-if="goods.isPinned"
          class="pin-badge"
        >
          <NIcon :component="Pin16Filled" />
        </div>

        <!-- 底部浮层信息 -->
        <div class="cover-overlay">
          <!-- 左侧标签组 -->
          <div class="overlay-tags">
            <NTag
              size="tiny"
              :bordered="false"
              class="glass-tag"
              :class="goods.type === GoodsTypes.Physical ? 'tag-success' : 'tag-info'"
            >
              {{ goods.type === GoodsTypes.Physical ? '实物' : '虚拟' }}
            </NTag>

            <NTag
              v-if="hasSubItems"
              size="tiny"
              :bordered="false"
              class="glass-tag"
            >
              多选
            </NTag>

            <NTag
              v-if="goods.allowGuardLevel > 0"
              size="tiny"
              :bordered="false"
              class="glass-tag tag-warning"
            >
              {{ goods.allowGuardLevel === 1 ? '总督' : goods.allowGuardLevel === 2 ? '提督' : '舰长' }}专属
            </NTag>
          </div>

          <!-- 右侧价格 -->
          <div class="price-pill">
            <span class="coin-icon">🪙</span>
            <template v-if="goods.canFreeBuy && priceMax > 0">
              <span class="price-original">{{ priceRangeText }}</span>
              <span class="price-highlight">免费</span>
            </template>
            <template v-else>
              <span class="price-current">{{ priceRangeText }}</span>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- 商品信息主体 -->
    <div class="card-content">
      <!-- 标题行 -->
      <div class="header-row-container">
        <div class="title-main">
          <NEllipsis
            class="goods-title"
            :line-clamp="1"
            :tooltip="{ arrowPointToCenter: true }"
          >
            <span
              class="goods-title-text"
              style="font-weight: 800; font-size: 1.05rem; line-height: 1.25; letter-spacing: -0.015em"
            >
              {{ goods.name }}
            </span>
          </NEllipsis>
        </div>

        <!-- 库存显示 -->
        <div
          class="stock-badge"
          :class="{
            'stock-none': isSoldOut,
            'stock-inf': hasSubItems ? availableSubItemCount > 0 : !goods.count && goods.count !== 0,
          }"
        >
          <template v-if="isSoldOut"> 缺货 </template>
          <template v-else-if="hasSubItems"> {{ availableSubItemCount }} 选 </template>
          <template v-else-if="goods.count && goods.count > 0"> 余 {{ goods.count }} </template>
          <template v-else> 无限 </template>
        </div>
      </div>

      <!-- 描述文本 -->
      <div class="description-container">
        <NEllipsis
          :line-clamp="2"
          class="description-text"
          :tooltip="{ arrowPointToCenter: true }"
        >
          {{ goods.description || '暂无描述' }}
        </NEllipsis>
      </div>

      <!-- 标签区域 (用户侧) -->
      <div
        v-if="!isManage"
        class="tags-row"
      >
        <template v-if="goods.setting?.allowGuardLevel && goods.setting.allowGuardLevel > 0">
          <!-- 已经在封面显示，此处可省略或重复强调，选择保留其他重要Tag -->
        </template>

        <NTag
          v-if="goods.canFreeBuy"
          :bordered="false"
          size="tiny"
          type="success"
          round
          class="mini-tag"
        >
          ⭐ 舰长免费
        </NTag>
        <NTag
          v-if="!goods.isAllowRebuy"
          :bordered="false"
          size="tiny"
          type="error"
          round
          class="mini-tag"
        >
          🔒 限购一次
        </NTag>
        <NTag
          v-for="tag in goods.tags"
          :key="tag"
          :bordered="false"
          size="tiny"
          round
          class="mini-tag custom-tag"
        >
          {{ tag }}
        </NTag>
      </div>

      <!-- 管理侧信息卡片 -->
      <div
        v-if="isManage"
        class="manage-info-grid"
      >
        <div
          v-if="goods.type === GoodsTypes.Physical && goods.maxBuyCount"
          class="info-cell"
        >
          <span class="label">📦 限购</span>
          <span class="value">{{ goods.maxBuyCount }}</span>
        </div>
        <div class="info-cell">
          <span class="label">🔄 重购</span>
          <span
            class="value"
            :class="goods.isAllowRebuy ? 'text-success' : 'text-error'"
          >
            {{ goods.isAllowRebuy ? '是' : '否' }}
          </span>
        </div>
        <div
          v-if="goods.type === GoodsTypes.Virtual && goods.virtualKeys?.length"
          class="info-cell"
        >
          <span class="label">🔑 密钥</span>
          <span class="value">{{ goods.virtualKeys.length }}</span>
        </div>
        <div
          v-if="goods.type === GoodsTypes.Physical"
          class="info-cell"
        >
          <span class="label">📮 地址</span>
          <span class="value">{{ goods.collectUrl ? '站外' : '本站' }}</span>
        </div>
        <!-- 子商品简略信息 -->
        <div
          v-if="hasSubItems"
          class="info-cell sub-items-summary"
        >
          <span class="label">🎨 款式</span>
          <NEllipsis class="value">
            {{ subItems.map((s) => s.name).join(' / ') }}
          </NEllipsis>
        </div>
      </div>
    </div>

    <!-- 页脚插槽 -->
    <template #footer>
      <slot name="footer" />
    </template>
  </NCard>
</template>

<style scoped>
.goods-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* 深色模式适配 */
:global(.dark) .goods-card {
  border-color: rgba(255, 255, 255, 0.12);
}

.goods-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 24px -6px rgba(0, 0, 0, 0.12),
    0 4px 8px -4px rgba(0, 0, 0, 0.08);
  border-color: var(--vtsuru-primary);
}

.is-pinned {
  border-color: var(--vtsuru-primary);
  background-color: rgba(var(--vtsuru-primary-rgb), 0.02);
}

/* 封面区域 */
.cover-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 比例 */
  height: 0;
  overflow: hidden;
  background-color: var(--vtsuru-bg-elevated);
}

.cover-image-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.cover-image {
  width: 100%;
  height: 100%;
  display: block;
}

.cover-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 遮罩 */
.sold-out-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  pointer-events: none; /* 允许点击穿透到图片，从而触发预览 */
  user-select: none;
}

.sold-out-text {
  color: #fff;
  font-weight: 800;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  /* 虽然父级禁用了 pointer-events，但文字本身建议也显式禁用，确保万无一失 */
  pointer-events: none;
}

/* 置顶徽章 */
.pin-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vtsuru-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  z-index: 6;
}

/* 底部浮层 */
.cover-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px 12px 12px; /* 增加内边距避免溢出 */
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 5;
  pointer-events: none; /* 允许点击穿透到图片预览 */
}

.overlay-tags,
.price-pill {
  pointer-events: auto; /* 标签和价格恢复点击 */
}

.overlay-tags {
  display: flex;
  gap: 6px;
}

.glass-tag {
  backdrop-filter: blur(8px);
  color: #fff;
  font-weight: 500;
  height: 20px;
  line-height: 20px;
}

.tag-success {
  background: rgba(var(--vtsuru-success-rgb), 0.85);
}
.tag-info {
  background: rgba(var(--vtsuru-info-rgb), 0.85);
}
.tag-warning {
  background: rgba(var(--vtsuru-warning-rgb), 0.85);
  color: #000;
}

/* 价格胶囊 */
.price-pill {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  padding: 2px 10px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

:global(.dark) .price-pill {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
}

.coin-icon {
  font-size: 14px;
}

.price-original {
  font-size: 11px;
  text-decoration: line-through;
  color: #666;
  opacity: 0.7;
}

.price-current,
.price-highlight {
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  color: #1a1a1a;
}

:global(.dark) .price-current {
  color: #efefef;
}

.price-highlight {
  color: var(--vtsuru-primary);
}

/* 内容区域 */
.header-row-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.title-main {
  flex: 1;
  min-width: 0;
}

.goods-title-text {
  color: var(--vtsuru-fg);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.goods-card:hover .goods-title-text {
  color: var(--vtsuru-primary) !important;
  transform: translateY(-1px);
  transform-origin: left center;
}

.is-pinned .goods-title-text {
  color: var(--vtsuru-primary);
}

.stock-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: var(--vtsuru-bg-inset);
  color: var(--vtsuru-fg-muted);
  white-space: nowrap;
  font-weight: 700;
  border: 1px solid var(--vtsuru-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.stock-none {
  color: var(--vtsuru-error);
  background-color: rgba(var(--vtsuru-error-rgb), 0.1);
}
.stock-inf {
  color: var(--vtsuru-success);
  background-color: rgba(var(--vtsuru-success-rgb), 0.1);
}

.description-text {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.5;
  margin-bottom: 8px;
  min-height: 36px; /* 保证两行高度一致 */
}

/* 标签行 */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 22px; /* 占位防止跳动 */
}

.mini-tag {
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
}

.custom-tag {
  background-color: var(--vtsuru-bg-inset);
  color: var(--vtsuru-fg);
}

/* 管理侧信息网格 */
.manage-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  background-color: var(--vtsuru-bg-inset);
  padding: 8px;
  border-radius: 8px;
  margin-top: 4px;
}

.sub-items-summary {
  grid-column: span 2;
  border-top: 1px dashed var(--vtsuru-border);
  padding-top: 4px;
  margin-top: 2px;
}

.info-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.info-cell .label {
  color: var(--vtsuru-fg-muted);
}
.info-cell .value {
  font-weight: 600;
  color: var(--vtsuru-fg);
}
.text-success {
  color: var(--vtsuru-success) !important;
}
.text-error {
  color: var(--vtsuru-error) !important;
}
</style>
