<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ClassicRequestOBS from './live-request/ClassicRequestOBS.vue'
import FreshRequestOBS from './live-request/FreshRequestOBS.vue'
import MinimalRequestOBS from './live-request/MinimalRequestOBS.vue'
import { useOBSNotification } from '@/store/useOBSNotification'

const props = defineProps<{
  id?: number
  active?: boolean
  visible?: boolean
  style?: 'classic' | 'fresh' | 'minimal'
}>()

const route = useRoute()
const currentId = computed(() => {
  const queryId = route.query.id
  return props.id ?? (typeof queryId === 'string' ? Number.parseInt(queryId) : undefined)
})

// 渲染哪种样式
const styleType = computed(() => {
  const queryStyle = route.query.style
  return props.style || (typeof queryStyle === 'string' ? queryStyle : 'classic')
})

const obsNotification = useOBSNotification()
onMounted(() => {
  // 只接收 live-request 类型的通知
  void obsNotification.init(['live-request'])
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
    v-else-if="styleType === 'fresh'"
    :id="currentId"
    :active="active"
    :visible="visible"
    v-bind="$attrs"
  />
  <MinimalRequestOBS
    v-else
    :id="currentId"
    :active="active"
    :visible="visible"
    v-bind="$attrs"
  />
</template>
