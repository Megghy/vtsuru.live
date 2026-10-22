<script setup lang="ts">
import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

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
  <Popover>
    <PopoverTrigger as-child>
      <Button class="w-full justify-start px-2.5 truncate" :disabled="disabled" :variant="armed ? 'destructive' : 'outline'" @click="emit('trigger')">
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
        <span class="hotkey-label truncate">{{ armed ? '再次点击触发' : custom?.displayName || hk.name || hk.hotkeyID }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72 p-3 text-xs flex flex-col gap-2">
      <div>
        <div class="font-semibold text-sm">{{ hk.name }}</div>
        <div
          v-if="hk.description"
          class="text-[var(--muted-foreground)] mt-0.5"
        >
          {{ hk.description }}
        </div>
        <div
          v-if="hk.type"
          class="text-[var(--muted-foreground)] mt-0.5"
        >
          类型: {{ hk.type }}
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--border)]">
        <Button variant="secondary" class="h-6 text-[11px] px-2" :disabled="onDeck" @click="emit('add-to-deck')">
          {{ onDeck ? '已在操作台' : '加入操作台' }}
        </Button>
        <Button variant="outline" class="h-6 text-[11px] px-2" @click="emit('toggle-pinned')">
          {{ custom?.pinned ? '取消置顶' : '置顶' }}
        </Button>
        <Button variant="outline" class="h-6 text-[11px] px-2" @click="emit('edit')">
          自定义外观
        </Button>
      </div>
    </PopoverContent>
  </Popover>
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
