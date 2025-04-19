<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ClassicRequestOBS from './live-request/ClassicRequestOBS.vue'
import FreshRequestOBS from './live-request/FreshRequestOBS.vue'

const props = defineProps<{
  id?: number,
  active?: boolean,
  visible?: boolean,
  style?: 'classic' | 'fresh',
}>()

const route = useRoute()
const currentId = computed(() => {
  const queryId = route.query.id
  return props.id ?? (typeof queryId === 'string' ? parseInt(queryId) : undefined)
})

// 渲染哪种样式
const styleType = computed(() => {
  const queryStyle = route.query.style
  return props.style || (typeof queryStyle === 'string' ? queryStyle : 'classic')
})
</script>

<template>
  <ClassicRequestOBS
    v-if="styleType === 'classic'"
    :id="currentId"
    :active="active"
    :visible="visible"
    v-bind="$attrs"
  />
  <FreshRequestOBS
    v-else
    :id="currentId"
    :active="active"
    :visible="visible"
    v-bind="$attrs"
  />
</template>