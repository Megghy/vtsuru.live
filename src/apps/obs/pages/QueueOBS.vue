<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import ObsClassicPanel from '@/apps/obs/components/shared/ObsClassicPanel.vue'
import ObsFreshPanel from '@/apps/obs/components/shared/ObsFreshPanel.vue'
import ObsMinimalPanel from '@/apps/obs/components/shared/ObsMinimalPanel.vue'
import { useQueueObsView } from '@/apps/obs/components/queue/useQueueObsView'
import { useOBSNotification } from '@/store/useOBSNotification'

const props = defineProps<{
  id?: number
  active?: boolean
  visible?: boolean
  speedMultiplier?: number
  style?: 'classic' | 'fresh' | 'minimal'
}>()

const route = useRoute()
const currentId = computed<string>(() => {
  const value = props.id ?? (Array.isArray(route.query.id) ? route.query.id[0] : route.query.id)
  return value === undefined || value === null ? '' : String(value)
})

const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speedParam = route.query.speed
  const speed = Number.parseFloat(speedParam?.toString() ?? '1')
  return Number.isNaN(speed) || speed <= 0 ? 1 : speed
})

const styleType = computed(() => {
  const queryStyle = route.query.style
  return props.style || (typeof queryStyle === 'string' ? queryStyle : 'classic')
})

const panelComponent = computed(() => {
  switch (styleType.value) {
    case 'fresh':
      return ObsFreshPanel
    case 'minimal':
      return ObsMinimalPanel
    default:
      return ObsClassicPanel
  }
})

const {
  title,
  countText,
  current,
  items,
  footerTags,
  update,
} = useQueueObsView(currentId.value)

const obsNotification = useOBSNotification()

onMounted(() => {
  void obsNotification.init(['queue'])
  update()
  window.$mitt.on('onOBSComponentUpdate', () => {
    update()
  })
})

onUnmounted(() => {
  window.$mitt.off('onOBSComponentUpdate')
})
</script>

<template>
  <component
    :is="panelComponent"
    :title="title"
    :count-text="countText"
    :current="current"
    :items="items"
    :footer-tags="footerTags"
    :speed-multiplier="speedMultiplier"
    empty-text="暂无人排队"
    v-bind="$attrs"
  />
</template>
