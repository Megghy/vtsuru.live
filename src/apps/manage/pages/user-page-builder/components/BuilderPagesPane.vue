<script setup lang="ts">
import { NButton, NCard, NFlex, NIcon, NScrollbar, NText } from 'naive-ui'
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import PageManager from './PageManager.vue'

defineOptions({ name: 'BuilderPagesPane' })

const props = defineProps<{
  collapsed: boolean
  resizable: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
}>()
</script>

<template>
  <NCard
    class="pane-card"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden"
  >
    <template #header>
      <NFlex justify="space-between" align="center" :wrap="false" style="gap: 6px">
        <Transition name="fade">
          <NText v-if="!props.collapsed" strong>
            页面
          </NText>
        </Transition>
        <NButton
          v-if="props.resizable"
          quaternary
          circle
          size="small"
          @click="emit('toggle-collapse')"
        >
          <template #icon>
            <NIcon>
              <ChevronBackOutline v-if="!props.collapsed" />
              <ChevronForwardOutline v-else />
            </NIcon>
          </template>
        </NButton>
      </NFlex>
    </template>
    <Transition name="fade-slide">
      <div v-if="!props.collapsed" class="pane-scroll">
        <NScrollbar style="height: 100%">
          <div style="padding: 12px">
            <PageManager />
          </div>
        </NScrollbar>
      </div>
    </Transition>
  </NCard>
</template>

