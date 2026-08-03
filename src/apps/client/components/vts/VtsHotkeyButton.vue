<script setup lang="ts">
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
  <UPopover>
    <UButton
      block
      :size="deck ? 'md' : 'sm'"
      :disabled="disabled"
      :color="safeClick && armed ? 'warning' : 'neutral'"
      :class="{ 'hotkey-deck-btn': deck }"
      @click="emit('trigger')"
    >
      <div
        v-if="deck"
        class="flex flex-col items-center gap-1 py-1.5"
      >
        <img
          v-if="custom?.iconDataUrl"
          class="hotkey-deck-icon"
          :src="custom.iconDataUrl"
          alt=""
        />
        <span
          v-else-if="custom?.color"
          class="hotkey-deck-dot"
          :style="{ backgroundColor: custom.color }"
        />
        <span class="hotkey-deck-label">{{ custom?.displayName || hk.name || hk.hotkeyID }}</span>
      </div>
      <template v-else>
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
        <span>{{ custom?.displayName || hk.name || hk.hotkeyID }}</span>
      </template>
    </UButton>
    <template #content>
      <div class="flex max-w-80 flex-col gap-2 p-3">
        <div>
          <div>{{ hk.name }}</div>
          <div v-if="hk.description">
            {{ hk.description }}
          </div>
          <div v-if="hk.type">类型: {{ hk.type }}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            size="xs"
            @click="emit('edit')"
            >编辑</UButton
          >
          <UButton
            size="xs"
            @click="emit('toggle-pinned')"
            >{{ custom?.pinned ? '取消置顶' : '置顶' }}</UButton
          >
          <UButton
            size="xs"
            @click="emit('toggle-favorite')"
            >{{ custom?.favorite ? '取消收藏' : '收藏' }}</UButton
          >
        </div>
      </div>
    </template>
  </UPopover>
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
