<script setup lang="ts">
import { NButton, NFlex, NPopover } from 'naive-ui'
import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'

defineProps<{
  hk: VtsHotkeyInfo
  custom?: VtsHotkeyCustomization
  disabled?: boolean
  armed?: boolean
  safeClick?: boolean
  deck?: boolean
}>()

const emit = defineEmits<{
  (e: 'trigger'): void
  (e: 'edit'): void
  (e: 'toggle-pinned'): void
  (e: 'toggle-favorite'): void
}>()
</script>

<template>
  <NPopover trigger="hover">
    <template #trigger>
      <NButton
        block
        :size="deck ? 'medium' : 'small'"
        :disabled="disabled"
        :type="safeClick && armed ? 'warning' : 'default'"
        :class="{ 'hotkey-deck-btn': deck }"
        @click="emit('trigger')"
      >
        <NFlex v-if="deck" vertical align="center" :size="4" style="padding: 6px 0">
          <img v-if="custom?.iconDataUrl" class="hotkey-deck-icon" :src="custom.iconDataUrl" alt="">
          <span v-else-if="custom?.color" class="hotkey-deck-dot" :style="{ backgroundColor: custom.color }" />
          <span class="hotkey-deck-label">{{ custom?.displayName || hk.name || hk.hotkeyID }}</span>
        </NFlex>
        <template v-else>
          <span v-if="custom?.color" class="hotkey-color-dot" :style="{ backgroundColor: custom.color }" />
          <img v-if="custom?.iconDataUrl" class="hotkey-icon" :src="custom.iconDataUrl" alt="">
          <span>{{ custom?.displayName || hk.name || hk.hotkeyID }}</span>
        </template>
      </NButton>
    </template>
    <NFlex vertical :size="8" style="max-width: 320px">
      <div>
        <div>{{ hk.name }}</div>
        <div v-if="hk.description">
          {{ hk.description }}
        </div>
        <div v-if="hk.type">
          类型: {{ hk.type }}
        </div>
      </div>
      <NFlex :wrap="true" :size="8">
        <NButton size="tiny" @click="emit('edit')">
          编辑
        </NButton>
        <NButton size="tiny" @click="emit('toggle-pinned')">
          {{ custom?.pinned ? '取消置顶' : '置顶' }}
        </NButton>
        <NButton size="tiny" @click="emit('toggle-favorite')">
          {{ custom?.favorite ? '取消收藏' : '收藏' }}
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
.hotkey-deck-btn {
  height: auto !important;
  min-height: 64px;
}
.hotkey-deck-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
}
.hotkey-deck-dot {
  width: 20px;
  height: 20px;
  border-radius: 999px;
}
.hotkey-deck-label {
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  word-break: break-all;
  max-width: 80px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
