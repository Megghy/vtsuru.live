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
  --goods-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --goods-muted: var(--vtsuru-block-fg-muted, var(--vtsuru-surface-fg-muted, var(--vtsuru-fg-muted)));
  --goods-bg: var(
    --vtsuru-block-bg-muted,
    var(--vtsuru-page-card-bg, var(--user-page-theme-surface-bg, var(--vtsuru-bg-muted)))
  );
  --goods-bg-soft: var(
    --vtsuru-page-card-bg-embedded,
    var(--user-page-theme-surface-bg-hover, var(--vtsuru-bg-elevated))
  );
  --goods-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --goods-accent: var(--vtsuru-page-primary, var(--vtsuru-primary, var(--vtsuru-brand)));
  --goods-shadow: var(--vtsuru-page-shadow, var(--vtsuru-shadow));
  --goods-overlay-fg: var(--vtsuru-page-primary-readable, #fff);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--goods-border);
  border-radius: var(--vtsuru-page-radius, var(--vtsuru-radius, 8px));
  background: var(--goods-bg);
  transition:
    transform 0.25s var(--vtsuru-bezier, ease),
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.goods-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--goods-shadow);
  border-color: var(--goods-accent);
}

.is-pinned {
  border-color: var(--goods-accent);
  background: color-mix(in srgb, var(--goods-bg), var(--goods-accent) 3%);
}

.cover-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  overflow: hidden;
  background: var(--goods-bg-soft);
}

.cover-image-container,
.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.cover-image {
  display: block;
}

.cover-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sold-out-mask {
  position: absolute;
  inset: 0;
  z-index: 11;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  background: color-mix(in srgb, var(--goods-fg), transparent 55%);
  backdrop-filter: blur(4px);
}

.sold-out-text {
  padding: 6px 16px;
  border: 1px solid color-mix(in srgb, var(--goods-overlay-fg), transparent 70%);
  border-radius: 999px;
  color: var(--goods-overlay-fg);
  background: color-mix(in srgb, var(--goods-fg), transparent 35%);
  box-shadow: var(--goods-shadow);
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.pin-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--goods-border);
  border-radius: 50%;
  color: var(--goods-accent);
  background: color-mix(in srgb, var(--goods-bg), transparent 8%);
  box-shadow: var(--goods-shadow);
  backdrop-filter: blur(4px);
}

.cover-overlay {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: 40px 12px 12px;
  pointer-events: none;
  background: linear-gradient(to top, color-mix(in srgb, var(--goods-fg), transparent 15%), transparent);
}

.overlay-tags,
.price-pill {
  pointer-events: auto;
}

.overlay-tags {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px;
}

.glass-tag {
  height: 20px;
  color: var(--goods-overlay-fg);
  font-weight: 500;
  backdrop-filter: blur(8px);
}

.tag-success {
  background: color-mix(in srgb, var(--vtsuru-success), transparent 15%);
}

.tag-info {
  background: color-mix(in srgb, var(--vtsuru-info), transparent 15%);
}

.tag-warning {
  color: var(--goods-fg);
  background: color-mix(in srgb, var(--vtsuru-warning), transparent 15%);
}

.price-pill {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 2px 10px;
  border: 1px solid var(--goods-border);
  border-radius: 999px;
  color: var(--goods-fg);
  background: color-mix(in srgb, var(--goods-bg), transparent 8%);
  box-shadow: var(--goods-shadow);
  backdrop-filter: blur(12px);
}

.coin-icon {
  font-size: 14px;
}

.price-original {
  color: var(--goods-muted);
  font-size: 11px;
  text-decoration: line-through;
}

.price-current,
.price-highlight {
  color: var(--goods-fg);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.price-highlight {
  color: var(--goods-accent);
}

.card-content {
  min-width: 0;
}

.header-row-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  margin-bottom: 10px;
}

.title-main {
  min-width: 0;
  flex: 1;
}

.goods-title-text {
  color: var(--goods-fg);
  transition: color 0.2s ease;
}

.goods-card:hover .goods-title-text,
.is-pinned .goods-title-text {
  color: var(--goods-accent) !important;
}

.stock-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid var(--goods-border);
  border-radius: 6px;
  color: var(--goods-muted);
  background: var(--goods-bg-soft);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.stock-none {
  color: var(--vtsuru-error);
  background: color-mix(in srgb, var(--vtsuru-error), transparent 88%);
}

.stock-inf {
  color: var(--vtsuru-success);
  background: color-mix(in srgb, var(--vtsuru-success), transparent 88%);
}

.description-text {
  min-height: 36px;
  margin-bottom: 8px;
  color: var(--goods-muted);
  font-size: 12px;
  line-height: 1.5;
}

.tags-row {
  display: flex;
  min-height: 22px;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-tag {
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
}

.custom-tag {
  color: var(--goods-fg);
  background: var(--goods-bg-soft);
}

.manage-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
  margin-top: 4px;
  padding: 8px;
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--goods-bg-soft);
}

.sub-items-summary {
  grid-column: span 2;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px dashed var(--goods-border);
}

.info-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
  font-size: 11px;
}

.info-cell .label {
  flex-shrink: 0;
  color: var(--goods-muted);
}

.info-cell .value {
  min-width: 0;
  color: var(--goods-fg);
  font-weight: 600;
}

.text-success {
  color: var(--vtsuru-success) !important;
}

.text-error {
  color: var(--vtsuru-error) !important;
}
</style>
