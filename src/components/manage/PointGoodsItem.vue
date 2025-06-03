<script setup lang="ts">
  import { GoodsTypes, ResponsePointGoodModel } from '@/api/api-models';
import { IMGUR_URL } from '@/data/constants';
import { Pin16Filled } from '@vicons/fluent';
import { NCard, NEllipsis, NEmpty, NFlex, NIcon, NImage, NTag, NText } from 'naive-ui';

  const props = defineProps<{
    goods: ResponsePointGoodModel | undefined;
    contentStyle?: string | undefined;
    size?: 'small' | 'default';
  }>();

  // 默认封面图片
  const emptyCover = IMGUR_URL + 'None.png';
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
            🪙 {{ goods.price > 0 ? goods.price : '免费' }}
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
              color: goods.type == GoodsTypes.Physical ? '#006633' : '#0066cc',
              borderColor: goods.type == GoodsTypes.Physical ? '#009966' : '#3399ff',
              backgroundColor: goods.type == GoodsTypes.Physical ? '#c2e6d290' : '#c2d6eb90'
            }"
          >
            {{ goods.type == GoodsTypes.Physical ? '实物' : '虚拟' }}
          </NTag>
          <!-- 状态标签 -->
          <NTag
            v-if="goods.count == 0"
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
              v-else-if="goods.count == 0"
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

      <!-- 用户自定义标签展示 -->
      <div
        v-if="goods.tags && goods.tags.length > 0"
        class="tags-container"
      >
        <div class="tags-wrapper">
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
  transition: all 0.3s ease;
  position: relative;
}

.goods-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.pinned-card {
  border: 2px solid var(--primary-color);
  box-shadow: 0 2px 10px rgba(var(--primary-color-rgb), 0.15);
}

.cover-container {
  position: relative;
  max-height: 100%;
}

.pin-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--error-color);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  color: white;
  transform: rotate(45deg);
  z-index: 2;
}

.price-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 8px;
  border-top-left-radius: 6px;
  z-index: 2;
}

.tags-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 4px 8px;
  border-top-right-radius: 6px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 70%;
}

.price-text {
  font-weight: bold;
  font-size: 0.9em;
  color: #ffffff;
}

.title-row {
  margin-bottom: 4px;
}

.title-container {
  max-width: 70%;
}

.goods-title {
  font-size: 1em;
  line-height: 1.3;
  word-break: break-word;
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
  max-height: 40px;
  overflow: hidden;
  margin-top: 4px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.user-tag {
  transition: all 0.2s ease;
}

.user-tag:hover {
  transform: translateY(-2px);
  z-index: 1;
}

.stock-info {
  font-size: 0.85em;
  color: var(--text-color-3);
}
</style>
