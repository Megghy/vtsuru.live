<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ResponsePointGoodModel } from '@/api/api-models'
import { GoodsTypes } from '@/api/api-models'
import { IMGUR_URL } from '@/shared/config'

const props = defineProps<{
  goods: ResponsePointGoodModel | undefined
  contentStyle?: string
  size?: 'small' | 'default'
  isManage?: boolean
}>()

const emptyCover = `${IMGUR_URL}None.png`
const isCoverPreviewOpen = ref(false)
const hasSubItems = computed(() => (props.goods?.subItems?.length ?? 0) > 0)
const subItems = computed(() => props.goods?.subItems ?? [])
const availableSubItemCount = computed(
  () => subItems.value.filter((item) => item.count == null || item.count > 0).length,
)
const isSoldOut = computed(() => {
  if (!props.goods) return false
  if (!hasSubItems.value) return props.goods.count === 0
  return subItems.value.length > 0 && subItems.value.every((item) => item.count === 0)
})
const priceMin = computed(() => {
  if (!props.goods) return 0
  if (!hasSubItems.value) return props.goods.price
  const prices = subItems.value.map((item) => item.price)
  return prices.length ? Math.min(...prices) : props.goods.price
})
const priceMax = computed(() => {
  if (!props.goods) return 0
  if (!hasSubItems.value) return props.goods.price
  const prices = subItems.value.map((item) => item.price)
  return prices.length ? Math.max(...prices) : props.goods.price
})
const priceRangeText = computed(() => {
  if (!props.goods) return ''
  if (!hasSubItems.value) return props.goods.price > 0 ? String(props.goods.price) : '免费'
  if (priceMin.value <= 0 && priceMax.value <= 0) return '免费'
  return priceMin.value === priceMax.value ? `${priceMin.value}` : `${priceMin.value}~${priceMax.value}`
})
</script>

<template>
  <div
    v-if="!goods"
    class="empty-state"
  >
    <UIcon
      name="i-lucide-package-x"
      class="empty-state__icon"
    />
    <span>已失效</span>
  </div>
  <UCard
    v-else
    class="goods-card"
    :class="{ 'is-pinned': goods.isPinned }"
    :style="contentStyle"
    :ui="{ body: 'p-0 sm:p-0', footer: 'px-3 pb-3 pt-0 sm:px-3' }"
  >
    <div class="cover-wrapper">
      <div class="cover-image-container">
        <img
          class="cover-image"
          :src="goods.cover?.path || emptyCover"
          :alt="goods.name"
          loading="lazy"
          @error="($event.target as HTMLImageElement).src = emptyCover"
          @click="goods.cover && (isCoverPreviewOpen = true)"
        />
      </div>
      <div
        v-if="isSoldOut"
        class="sold-out-mask"
      >
        <span class="sold-out-text">已售完</span>
      </div>
      <div
        v-if="goods.isPinned"
        class="pin-badge"
      >
        <UIcon name="i-lucide-pin" />
      </div>
      <div class="cover-overlay">
        <div class="overlay-tags">
          <UBadge
            size="xs"
            variant="soft"
            :color="goods.type === GoodsTypes.Physical ? 'success' : 'info'"
            class="glass-tag"
          >
            {{ goods.type === GoodsTypes.Physical ? '实物' : '虚拟' }}
          </UBadge>
          <UBadge
            v-if="hasSubItems"
            size="xs"
            variant="soft"
            color="neutral"
            label="多选"
            class="glass-tag"
          />
          <UBadge
            v-if="goods.allowGuardLevel > 0"
            size="xs"
            variant="soft"
            color="warning"
            class="glass-tag tag-warning"
          >
            {{ goods.allowGuardLevel === 1 ? '总督' : goods.allowGuardLevel === 2 ? '提督' : '舰长' }}专属
          </UBadge>
        </div>
        <div class="price-pill">
          <span class="coin-icon">🪙</span>
          <template v-if="goods.canFreeBuy && priceMax > 0">
            <span class="price-original">{{ priceRangeText }}</span>
            <span class="price-highlight">免费</span>
          </template>
          <span
            v-else
            class="price-current"
            >{{ priceRangeText }}</span
          >
        </div>
      </div>
    </div>

    <div class="card-content">
      <div class="header-row-container">
        <div class="title-main">
          <span
            class="goods-title goods-title-text"
            :title="goods.name"
            >{{ goods.name }}</span
          >
        </div>
        <div
          class="stock-badge"
          :class="{
            'stock-none': isSoldOut,
            'stock-inf': hasSubItems ? availableSubItemCount > 0 : !goods.count && goods.count !== 0,
          }"
        >
          <template v-if="isSoldOut">缺货</template>
          <template v-else-if="hasSubItems">{{ availableSubItemCount }} 选</template>
          <template v-else-if="goods.count && goods.count > 0">余 {{ goods.count }}</template>
          <template v-else>无限</template>
        </div>
      </div>

      <p
        class="description-text"
        :title="goods.description || '暂无描述'"
      >
        {{ goods.description || '暂无描述' }}
      </p>

      <div
        v-if="!isManage"
        class="tags-row"
      >
        <UBadge
          v-if="goods.canFreeBuy"
          size="xs"
          color="success"
          variant="soft"
          class="mini-tag"
          label="⭐ 舰长免费"
        />
        <UBadge
          v-if="!goods.isAllowRebuy"
          size="xs"
          color="error"
          variant="soft"
          class="mini-tag"
          label="🔒 限购一次"
        />
        <UBadge
          v-for="tag in goods.tags"
          :key="tag"
          size="xs"
          color="neutral"
          variant="soft"
          class="mini-tag custom-tag"
          :label="tag"
        />
      </div>

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
            >{{ goods.isAllowRebuy ? '是' : '否' }}</span
          >
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
        <div
          v-if="hasSubItems"
          class="info-cell sub-items-summary"
        >
          <span class="label">🎨 款式</span>
          <span
            class="value sub-item-names"
            :title="subItems.map((item) => item.name).join(' / ')"
            >{{ subItems.map((item) => item.name).join(' / ') }}</span
          >
        </div>
      </div>
    </div>

    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UCard>

  <UModal
    v-if="goods?.cover"
    v-model:open="isCoverPreviewOpen"
    :title="goods.name"
  >
    <template #body>
      <img
        class="cover-preview"
        :src="goods.cover.path"
        :alt="goods.name"
      />
    </template>
  </UModal>
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
  border-color: var(--goods-accent);
  box-shadow: var(--goods-shadow);
}

.is-pinned {
  border-color: var(--goods-accent);
  background: color-mix(in srgb, var(--goods-bg), var(--goods-accent) 3%);
}

.cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
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
  object-fit: cover;
  cursor: zoom-in;
}

.cover-preview {
  display: block;
  width: 100%;
  max-height: 75vh;
  object-fit: contain;
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
  background: linear-gradient(to top, color-mix(in srgb, var(--goods-fg), transparent 15%), transparent);
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

.tag-warning {
  color: var(--goods-fg);
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
  padding: 12px;
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

.goods-title,
.sub-item-names {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-title-text {
  color: var(--goods-fg);
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.015em;
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
  display: -webkit-box;
  min-height: 36px;
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--goods-muted);
  font-size: 12px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tags-row {
  display: flex;
  min-height: 22px;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-tag {
  height: 20px;
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

.empty-state {
  display: grid;
  min-height: 180px;
  place-content: center;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}

.empty-state__icon {
  margin: auto;
  font-size: 28px;
}
</style>
