<script setup lang="ts">
import type { ResponsePointGoodModel } from '@/api/api-models'
import { Pin16Filled } from '@vicons/fluent'
import { NCard, NEllipsis, NEmpty, NFlex, NIcon, NImage, NTag, NText } from 'naive-ui'
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
</script>

<template>
  <NEmpty
    v-if="!goods"
    description="已失效"
  />
  <NCard
    v-else
    embedded
    :style="props.contentStyle"
    size="small"
    class="goods-card"
    :class="{ 'pinned-card': goods.isPinned }"
  >
    <!-- 商品封面 -->
    <template #cover>
      <div class="cover-container">
        <NImage
          :src="goods.cover ? goods.cover.path : emptyCover"
          :fallback-src="emptyCover"
          height="150"
          object-fit="cover"
          :preview-disabled="!goods.cover"
          style="width: 100%"
        />
        <!-- 置顶标记 -->
        <div
          v-if="goods.isPinned"
          class="pin-badge"
        >
          <NIcon :component="Pin16Filled" />
        </div>

        <!-- 价格徽章 -->
        <div class="price-badge">
          <NText class="price-text">
            <template v-if="goods.canFreeBuy && goods.price > 0">
              🪙 <span class="price-original">{{ goods.price }}</span>
              <span class="price-free">免费</span>
            </template>
            <template v-else>
              🪙 {{ goods.price > 0 ? goods.price : '免费' }}
            </template>
          </NText>
        </div>

        <!-- 标签容器 -->
        <div class="tags-badge">
          <!-- 商品类型标签 -->
          <NTag
            size="small"
            :bordered="true"
            style="background-color: transparent;"
            :style="{
              color: goods.type === GoodsTypes.Physical ? '#006633' : '#0066cc',
              borderColor: goods.type === GoodsTypes.Physical ? '#009966' : '#3399ff',
              backgroundColor: goods.type === GoodsTypes.Physical ? '#c2e6d290' : '#c2d6eb90',
            }"
          >
            {{ goods.type === GoodsTypes.Physical ? '实物' : '虚拟' }}
          </NTag>
          <!-- 状态标签 -->
          <NTag
            v-if="goods.count === 0"
            size="small"
            type="error"
            :bordered="false"
            style="color: #ffffff; background-color: rgba(255, 85, 85, 0.7);"
          >
            已售完
          </NTag>

          <!-- 舰长限制标签 -->
          <NTag
            v-if="goods.allowGuardLevel > 0"
            size="small"
            type="warning"
            :bordered="false"
            style="color: #333333; background-color: rgba(255, 204, 0, 0.7);"
          >
            {{ goods.allowGuardLevel === 1 ? '总督' : goods.allowGuardLevel === 2 ? '提督' : '舰长' }}专属
          </NTag>
        </div>
      </div>
    </template>
    <!-- 商品信息头部 - 改为水平布局 -->
    <template #header>
      <NFlex vertical>
        <!-- 标题行：左侧标题，右侧库存 -->
        <NFlex
          justify="space-between"
          align="center"
          class="title-row"
        >
          <NFlex
            align="center"
            class="title-container"
          >
            <NEllipsis
              strong
              class="goods-title"
              :line-clamp="1"
            >
              {{ goods.name }}
            </NEllipsis>
          </NFlex>

          <NFlex
            align="center"
            class="stock-info"
          >
            <NText
              depth="3"
              size="small"
            >
              库存:
            </NText>
            <NText
              v-if="goods.count && goods.count > 0"
              size="small"
            >
              {{ goods.count }}
            </NText>
            <NText
              v-else-if="goods.count === 0"
              size="small"
              type="error"
            >
              无
            </NText>
            <NText
              v-else
              size="small"
            >
              ∞
            </NText>
          </NFlex>
        </NFlex>
      </NFlex>
    </template>

    <!-- 商品描述和标签 -->
    <NFlex
      vertical
      :gap="8"
      class="content-section"
    >
      <!-- 描述文本 -->
      <NEllipsis
        :line-clamp="2"
        class="description-text"
      >
        <template #tooltip>
          <div style="white-space: pre-wrap;">
            {{ goods.description ? goods.description : '暂无描述' }}
          </div>
        </template>
        <NText
          :depth="goods.description ? 1 : 3"
          :italic="!goods.description"
        >
          {{ goods.description ? goods.description : '暂无描述' }}
        </NText>
      </NEllipsis>

      <!-- 礼物信息卡片 - 仅在后台管理页面显示 -->
      <div
        v-if="isManage"
        class="info-cards"
      >
        <!-- 兑换数量限制 -->
        <div
          v-if="goods.type === GoodsTypes.Physical && goods.maxBuyCount"
          class="info-item"
        >
          <NText
            depth="3"
            class="info-label"
          >
            📦 限购
          </NText>
          <NText class="info-value">
            {{ goods.maxBuyCount }}件
          </NText>
        </div>

        <!-- 是否允许重复兑换 -->
        <div class="info-item">
          <NText
            depth="3"
            class="info-label"
          >
            🔄 重购
          </NText>
          <NText
            class="info-value"
            :type="goods.isAllowRebuy ? 'success' : 'error'"
          >
            {{ goods.isAllowRebuy ? '允许' : '禁止' }}
          </NText>
        </div>

        <!-- 舰长等级限制 -->
        <div
          v-if="goods.setting?.allowGuardLevel && goods.setting.allowGuardLevel > 0"
          class="info-item"
        >
          <NText
            depth="3"
            class="info-label"
          >
            ⚓ 等级
          </NText>
          <NText
            class="info-value"
            type="warning"
          >
            {{ goods.setting.allowGuardLevel === 1 ? '总督' : goods.setting.allowGuardLevel === 2 ? '提督' : '舰长' }}+
          </NText>
        </div>

        <!-- 舰长免费 -->
        <div
          v-if="goods.setting?.guardFreeMonths !== undefined || goods.setting?.guardFree !== undefined"
          class="info-item"
        >
          <NText
            depth="3"
            class="info-label"
          >
            ⭐ 舰长
          </NText>
          <NText
            class="info-value"
            type="success"
          >
            免费
          </NText>
        </div>

        <!-- 虚拟礼物密钥数量 -->
        <div
          v-if="goods.type === GoodsTypes.Virtual && goods.virtualKeys && goods.virtualKeys.length > 0"
          class="info-item"
        >
          <NText
            depth="3"
            class="info-label"
          >
            🔑 密钥
          </NText>
          <NText class="info-value">
            {{ goods.virtualKeys.length }}个
          </NText>
        </div>

        <!-- 收集地址方式 -->
        <div
          v-if="goods.type === GoodsTypes.Physical"
          class="info-item"
        >
          <NText
            depth="3"
            class="info-label"
          >
            📮 地址
          </NText>
          <NText class="info-value">
            {{ goods.collectUrl ? '站外' : '本站' }}
          </NText>
        </div>
      </div>

      <!-- 用户自定义标签展示 -->
      <div
        v-if="(goods.tags && goods.tags.length > 0) || (!isManage && ((goods.setting?.allowGuardLevel ?? 0) > 0 || goods.canFreeBuy || !goods.isAllowRebuy))"
        class="tags-container"
      >
        <div class="tags-wrapper">
          <!-- 用户页面：显示重要信息标签 -->
          <template v-if="!isManage">
            <NTag
              v-if="goods.setting?.allowGuardLevel && goods.setting.allowGuardLevel > 0"
              :bordered="false"
              size="tiny"
              class="user-tag important-tag"
              style="color: #fff; background-color: rgba(255, 170, 0, 0.85);"
            >
              ⚓ {{ goods.setting.allowGuardLevel === 1 ? '总督' : goods.setting.allowGuardLevel === 2 ? '提督' : '舰长' }}+
            </NTag>
            <NTag
              v-if="goods.canFreeBuy"
              :bordered="false"
              size="tiny"
              class="user-tag important-tag"
              style="color: #fff; background-color: rgba(24, 160, 88, 0.85);"
            >
              ⭐ 舰长免费
            </NTag>
            <NTag
              v-if="!goods.isAllowRebuy"
              :bordered="false"
              size="tiny"
              class="user-tag important-tag"
              style="color: #fff; background-color: rgba(208, 48, 80, 0.85);"
            >
              🔒 限购一次
            </NTag>
          </template>

          <!-- 用户自定义标签 -->
          <NTag
            v-for="tag in goods.tags"
            :key="tag"
            :bordered="false"
            size="tiny"
            class="user-tag"
            style="color: #f0f0f0; background-color: rgba(100, 100, 110, 0.7);"
          >
            {{ tag }}
          </NTag>
        </div>
      </div>
    </NFlex>

    <!-- 自定义页脚 -->
    <template #footer>
      <slot name="footer" />
    </template>
  </NCard>
</template>

<style scoped>
.goods-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.goods-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
  z-index: 1;
  pointer-events: none;
}

.goods-card:hover::before {
  left: 100%;
}

.goods-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
}

.goods-card:active {
  transform: translateY(-4px);
  transition: all 0.1s ease;
}

.pinned-card {
  border: 2px solid var(--primary-color);
  box-shadow: 0 4px 16px rgba(24, 160, 88, 0.25), 0 0 0 1px rgba(24, 160, 88, 0.1);
  background: linear-gradient(135deg, var(--card-color) 0%, rgba(24, 160, 88, 0.02) 100%);
}

.pinned-card:hover {
  box-shadow: 0 8px 28px rgba(24, 160, 88, 0.35), 0 2px 12px rgba(24, 160, 88, 0.15);
}

.cover-container {
  position: relative;
  max-height: 100%;
  overflow: hidden;
}

.cover-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.1) 100%);
  pointer-events: none;
  z-index: 1;
}

/* 售罄遮罩效果 */
.goods-card:has(.tags-badge .n-tag[type="error"]) .cover-container::before {
  content: '已售完';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  font-weight: bold;
  color: #ff5555;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  z-index: 3;
  backdrop-filter: blur(2px);
}

.pin-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(255, 255, 255, 0.3);
  color: white;
  transform: rotate(45deg);
  z-index: 2;
  animation: pin-pulse 2s ease-in-out infinite;
}

@keyframes pin-pulse {
  0%, 100% {
    transform: rotate(45deg) scale(1);
  }
  50% {
    transform: rotate(45deg) scale(1.05);
  }
}

.price-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.95) 0%, rgba(18, 130, 70, 0.95) 100%);
  color: white;
  padding: 6px 12px;
  border-top-left-radius: 8px;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
}

.tags-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.6) 100%);
  padding: 6px 8px;
  border-top-right-radius: 8px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 65%;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.price-text {
  font-weight: 600;
  font-size: 1em;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.title-row {
  margin-bottom: 8px;
  gap: 8px;
}

.title-container {
  flex: 1;
  min-width: 0;
}

.goods-title {
  font-size: 1.05em;
  line-height: 1.4;
  word-break: break-word;
  font-weight: 600;
  color: var(--text-color-1);
}

.content-section {
  margin-top: 6px;
}

.description-text {
  margin-bottom: 4px;
  white-space: pre-wrap;
}

.tags-container {
  position: relative;
  max-height: 44px;
  overflow: hidden;
  margin-top: 8px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.user-tag {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.85em;
}

.user-tag:hover {
  transform: translateY(-2px) scale(1.05);
  z-index: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* 重要信息标签样式 */
.important-tag {
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.important-tag:hover {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px) scale(1.08);
}

.stock-info {
  font-size: 0.85em;
  color: var(--text-color-3);
  white-space: nowrap;
  padding: 2px 8px;
  background-color: var(--action-color);
  border-radius: 4px;
  font-weight: 500;
}

/* 信息卡片样式 */
.info-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
  padding: 8px;
  background-color: var(--action-color);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: var(--card-color);
  border-radius: 4px;
  border: 1px solid var(--divider-color);
  transition: all 0.2s ease;
  font-size: 0.85em;
}

.info-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color-hover);
}

.info-label {
  font-size: 0.9em;
  white-space: nowrap;
}

.info-value {
  font-weight: 600;
  font-size: 0.95em;
  white-space: nowrap;
}

.price-original {
  text-decoration: line-through;
  opacity: 0.7;
  margin-right: 6px;
}

.price-free {
  font-weight: 700;
}
</style>
