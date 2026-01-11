<script setup lang="ts">
import type { BlockNode } from '@/features/user-page/block/schema'
import BlockPropsForm from './BlockPropsForm.vue'
import LayoutChildrenEditor from './LayoutChildrenEditor.vue'

const props = defineProps<{
  block: BlockNode
}>()
</script>

<template>
  <LayoutChildrenEditor v-if="props.block.type === 'layout'" :block="props.block" />
  <BlockPropsForm v-else :block="props.block" />
</template>

