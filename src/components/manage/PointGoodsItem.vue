<script setup lang="ts">
import { GoodsTypes, ResponsePointGoodModel } from '@/api/api-models'
import { NButton, NCard, NDropdown, NEllipsis, NEmpty, NFlex, NIcon, NImage, NPopselect, NTag, NText } from 'naive-ui'
import { FILE_BASE_URL, IMGUR_URL } from '@/data/constants'
import { computed, ref } from 'vue'
import { MoreHorizontal16Filled, MoreVertical16Filled } from '@vicons/fluent'

const props = defineProps<{
  goods: ResponsePointGoodModel | undefined
}>()
const emptyCover = IMGUR_URL + 'None.png'
</script>

<template>
  <NEmpty v-if="!goods" description="已失效" />
  <NCard v-else embedded>
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
    <template #header-extra>
      <NFlex justify="space-between">
        <NFlex>
          <NText depth="3"> 库存: </NText>
          <NText v-if="goods.count && goods.count > -1">
            {{ goods.count }}
          </NText>
          <NText v-else> ∞ </NText>
        </NFlex>
      </NFlex>
    </template>
    <template #header>
      <NFlex align="center">
        <NTag size="small" :bordered="goods.type != GoodsTypes.Physical">
          {{ goods.type == GoodsTypes.Physical ? '实物' : '虚拟' }}
        </NTag>
        <NEllipsis>
          {{ goods.name }}
        </NEllipsis>
      </NFlex>
    </template>
    <NFlex vertical>
      <NText :depth="goods.description ? 1 : 3" :italic="!goods.description">
        {{ goods.description ? goods.description : '暂无描述' }}
      </NText>
      <NFlex>
        <NTag v-for="tag in goods.tags" :key="tag" :bordered="false" size="tiny">{{ tag }}</NTag>
      </NFlex>
    </NFlex>
    <template #footer>
      <slot name="footer"></slot>
    </template>
  </NCard>
</template>
