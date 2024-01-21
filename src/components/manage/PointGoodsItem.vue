<script setup lang="ts">
import { ResponsePointGoodModel } from '@/api/api-models'
import { NButton, NCard, NDropdown, NEllipsis, NFlex, NIcon, NImage, NPopselect, NText } from 'naive-ui'
import { FILE_BASE_URL, IMGUR_URL } from '@/data/constants'
import { computed, ref } from 'vue'
import { MoreHorizontal16Filled, MoreVertical16Filled } from '@vicons/fluent'

const props = defineProps<{
  goods: ResponsePointGoodModel
}>()
const emptyCover = IMGUR_URL + 'None.png'
</script>

<template>
  <NCard>
    <template #cover>
      <NImage :src="goods.cover ? FILE_BASE_URL + goods.cover : emptyCover" :fallback-src="emptyCover" height="150" object-fit="cover" :preview-disabled="!goods.cover" style="width: 100%" />
    </template>
    <template #header-extra>
      <slot name="header-extra"></slot>
    </template>
    <template #header>
      <NEllipsis>
        {{ goods.name }}
      </NEllipsis>
    </template>
    <NFlex vertical>
      <NText depth="3">
        {{ goods.description }}
      </NText>
      <NFlex justify="space-between">
        <NFlex>
          <NText> 库存: </NText>
          <NText v-if="goods.count && goods.count > -1">
            {{ goods.count }}
          </NText>
          <NText v-else> 不限 </NText>
        </NFlex>
      </NFlex>
    </NFlex>
    <template #footer>
      <slot name="footer"></slot>
    </template>
  </NCard>
</template>
