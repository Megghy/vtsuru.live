<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'

import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'

defineProps<{
  hk: VtsHotkeyInfo
  custom?: VtsHotkeyCustomization
  disabled?: boolean
  armed?: boolean
  onDeck?: boolean
}>()

const emit = defineEmits<{
  (e: 'trigger'): void
  (e: 'edit'): void
  (e: 'toggle-pinned'): void
  (e: 'add-to-deck'): void
}>()
</script>

<template>
  <NPopover
    trigger="hover"
    :delay="400"
  >
    <template #trigger>
      <NButton
        block
        size="small"
        :disabled="disabled"
        :type="armed ? 'warning' : 'default'"
        @click="emit('trigger')"
      >
        <span
          v-if="custom?.color"
          class="hotkey-color-dot"
          :style="{ backgroundColor: custom.color }"
        />
        <img
          v-if="custom?.iconDataUrl"
          class="hotkey-icon"
          :src="custom.iconDataUrl"
          alt=""
        />
        <span class="hotkey-label">{{ armed ? '再次点击触发' : custom?.displayName || hk.name || hk.hotkeyID }}</span>
      </NButton>
    </template>
    <NFlex
      vertical
      :size="8"
      style="max-width: 320px"
    >
      <div>
        <div>{{ hk.name }}</div>
        <div v-if="hk.description">
          {{ hk.description }}
        </div>
        <div v-if="hk.type">类型: {{ hk.type }}</div>
      </div>
      <NFlex
        :wrap="true"
        :size="8"
      >
        <NButton
          size="tiny"
          :disabled="onDeck"
          @click="emit('add-to-deck')"
        >
          {{ onDeck ? '已在操作台' : '加入操作台' }}
        </NButton>
        <NButton
          size="tiny"
          @click="emit('toggle-pinned')"
        >
          {{ custom?.pinned ? '取消置顶' : '置顶' }}
        </NButton>
        <NButton
          size="tiny"
          @click="emit('edit')"
        >
          自定义外观
        </NButton>
      </NFlex>
    </NFlex>
  </NPopover>
</template>

<style scoped>
.hotkey-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 6px;
  flex: 0 0 auto;
}
.hotkey-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  margin-right: 6px;
  object-fit: cover;
  flex: 0 0 auto;
}
.hotkey-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
