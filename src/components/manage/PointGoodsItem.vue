<script setup lang="ts">
  import { GoodsTypes, ResponsePointGoodModel } from '@/api/api-models';
  import { FILE_BASE_URL, IMGUR_URL } from '@/data/constants';
  import { NAlert, NCard, NEllipsis, NEmpty, NFlex, NIcon, NImage, NTag, NText } from 'naive-ui';
  import { VehicleShip20Filled } from '@vicons/fluent';

  const props = defineProps<{
    goods: ResponsePointGoodModel | undefined;
    contentStyle?: string | undefined;
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
    class="goods-card"
  >
    <!-- 商品封面 -->
    <template #cover>
      <NImage
        :src="goods.cover ? FILE_BASE_URL + goods.cover : emptyCover"
        :fallback-src="emptyCover"
        height="150"
        object-fit="cover"
        :preview-disabled="!goods.cover"
        style="width: 100%"
      />
    </template>

    <!-- 商品信息头部 -->
    <template #header-extra>
      <NFlex justify="space-between">
        <NFlex>
          <NText depth="3">
            库存:
          </NText>
          <NText v-if="goods.count && goods.count > 0">
            {{ goods.count }}
          </NText>
          <NText
            v-else-if="goods.count == 0"
            style="color: #5f5f5f;"
          >
            无
          </NText>
          <NText v-else>
            ∞
          </NText>
        </NFlex>
      </NFlex>
    </template>

    <!-- 商品标题 -->
    <template #header>
      <NFlex
        align="center"
        :size="5"
      >
        <!-- 售罄标签 -->
        <NTag
          v-if="goods.count == 0"
          size="small"
          type="error"
          :bordered="false"
        >
          已售完
        </NTag>

        <!-- 商品类型标签 -->
        <NTag
          size="small"
          :bordered="goods.type != GoodsTypes.Physical"
        >
          {{ goods.type == GoodsTypes.Physical ? '实物' : '虚拟' }}
        </NTag>

        <!-- 商品名称 -->
        <NEllipsis>
          {{ goods.name }}
        </NEllipsis>
      </NFlex>
    </template>

    <!-- 商品描述和标签 -->
    <NFlex vertical>
      <NEllipsis :line-clamp="2">
        <NText
          :depth="goods.description ? 1 : 3"
          :italic="!goods.description"
        >
          {{ goods.description ? goods.description : '暂无描述' }}
        </NText>
      </NEllipsis>

      <!-- 标签展示 -->
      <NFlex wrap>
        <!-- 舰长限制标签 -->
        <NTag
          v-if="goods.allowGuardLevel > 0"
          size="tiny"
          :color="{ color: '#5f5f5f', textColor: 'gold' }"
        >
          <template #icon>
            <NIcon :component="VehicleShip20Filled" />
          </template>
          仅限舰长
        </NTag>

        <!-- 商品标签 -->
        <NTag
          v-for="tag in goods.tags"
          :key="tag"
          :bordered="false"
          size="tiny"
        >
          {{ tag }}
        </NTag>
      </NFlex>
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
}

.goods-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
