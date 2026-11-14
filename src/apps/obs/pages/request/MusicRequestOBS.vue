<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { useMusicRequestObsView } from '@/apps/obs/components/request/useMusicRequestObsView'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import ObsClassicPanel from '@/apps/obs/components/shared/ObsClassicPanel.vue'
import ObsFreshPanel from '@/apps/obs/components/shared/ObsFreshPanel.vue'
import ObsGlassPanel from '@/apps/obs/components/shared/ObsGlassPanel.vue'
import ObsMinimalPanel from '@/apps/obs/components/shared/ObsMinimalPanel.vue'
import ObsTransparentPanel from '@/apps/obs/components/shared/ObsTransparentPanel.vue'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { useOBSNotification } from '@/store/useOBSNotification'

const props = withDefaults(
  defineProps<{
    id?: number
    active?: boolean
    visible?: boolean
    speedMultiplier?: number
    style?: 'classic' | 'fresh' | 'minimal' | 'glass' | 'transparent'
  }>(),
  { active: true, visible: true },
)

const route = useRoute()
const account = useAccount()
const currentId = computed<string>(() => {
  const value = props.id ?? (Array.isArray(route.query.id) ? route.query.id[0] : route.query.id)
  return value === undefined || value === null ? '' : String(value)
})
const targetUserId = computed(() => parsePositiveId(currentId.value) || (account.value.id > 0 ? String(account.value.id) : ''))

const speedMultiplier = computed(() => {
  if (props.speedMultiplier !== undefined && props.speedMultiplier > 0) {
    return props.speedMultiplier
  }
  const speed = Number.parseFloat(route.query.speed?.toString() ?? '1')
  return Number.isNaN(speed) || speed <= 0 ? 1 : speed
})

const styleType = computed(() => {
  const queryStyle = route.query.style
  return props.style || (typeof queryStyle === 'string' ? queryStyle : 'classic')
})

const panelComponent = computed(() => {
  switch (styleType.value) {
    case 'glass':
      return ObsGlassPanel
    case 'transparent':
      return ObsTransparentPanel
    case 'fresh':
      return ObsFreshPanel
    case 'minimal':
      return ObsMinimalPanel
    default:
      return ObsClassicPanel
  }
})

const { title, countText, current, items, footerTags, update, applySnapshot } = useMusicRequestObsView(currentId)

const obsNotification = useOBSNotification()
const { on } = useObsRealtimeSync({
  topic: () => (targetUserId.value ? `obs:display:music-request:${targetUserId.value}` : ''),
  active: () => props.active,
  visible: () => props.visible,
  onSync: update,
})
on('Snapshot', (payload) => {
  if (payload) {
    applySnapshot(payload)
  }
})

onMounted(() => {
  void obsNotification.init(['music-request'])
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
    empty-text="暂无人点歌"
    v-bind="$attrs"
  />
</template>
