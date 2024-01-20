<script setup lang="ts">
import { ResponsePointGoodModel } from '@/api/api-models'
import { NCard } from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  goods: ResponsePointGoodModel
}>()
</script>

<template>
  <NCard>
    <template #cover>
      <img :src="goods.cover" />
    </template>
    <template #header>
      {{ goods.name }}
    </template>
  </NCard>
</template>
