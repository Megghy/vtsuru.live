<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import BlockPropsForm from './BlockPropsForm.vue'

const props = defineProps<{
  block: BlockNode
}>()
</script>

<template>
  <BlockPropsForm :block="props.block" />
</template>
