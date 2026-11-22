<script setup lang="ts">
import { Crown, Glasses, Headphones, Keyboard, RotateCcw, Sparkles } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'

import {
  DEFAULT_TYPING_CAT_ACCESSORIES,
  getCoatDefaultColors,
  normalizeHexColor,
  resolveTypingCatColors,
  TYPING_CAT_ACCESSORY_SPECS,
  TYPING_CAT_COATS,
  TYPING_CAT_COLOR_SPECS,
  TYPING_CAT_DESK_THEMES,
} from './types'
import type {
  TypingCatAccessories,
  TypingCatCoatId,
  TypingCatCustomColors,
  TypingCatDeskThemeId,
  TypingCatState,
} from './types'

const props = defineProps<{
  state: TypingCatState
}>()

const emit = defineEmits<{
  update: [patch: Partial<TypingCatState>]
}>()

const accessoryIcons = {
  headphones: Headphones,
  collar: Sparkles,
  glasses: Glasses,
  crown: Crown,
} as const

const currentCoatPreset = computed(
  () => TYPING_CAT_COATS.find((c) => c.id === props.state.coat) ?? TYPING_CAT_COATS[0],
)

const visibleColorSpecs = computed(() =>
  TYPING_CAT_COLOR_SPECS.filter((spec) => !spec.patternOnly || spec.patternOnly === currentCoatPreset.value.pattern),
)

const defaultCoatColors = computed(() => getCoatDefaultColors(props.state.coat))

const resolvedColors = computed(() => resolveTypingCatColors(props.state.coat, props.state.colors))

const modifiedColorCount = computed(() => {
  const custom = props.state.colors ?? {}
  return visibleColorSpecs.value.filter((spec) => {
    const hex = normalizeHexColor(custom[spec.key])
    return Boolean(hex && hex !== defaultCoatColors.value[spec.key].toLowerCase())
  }).length
})

const currentAccessories = computed<TypingCatAccessories>(() => ({
  ...DEFAULT_TYPING_CAT_ACCESSORIES,
  ...props.state.accessories,
}))

function selectCoat(coatId: TypingCatCoatId) {
  if (coatId === props.state.coat) return
  emit('update', { coat: coatId, colors: {} })
}

function selectDeskTheme(themeId: TypingCatDeskThemeId) {
  emit('update', { deskTheme: themeId })
}

function toggleAccessory(key: keyof TypingCatAccessories) {
  emit('update', {
    accessories: {
      ...currentAccessories.value,
      [key]: !currentAccessories.value[key],
    },
  })
}

function isPartColorCustomized(key: keyof TypingCatCustomColors): boolean {
  const hex = normalizeHexColor(props.state.colors?.[key])
  return Boolean(hex && hex !== defaultCoatColors.value[key].toLowerCase())
}

function updatePartColor(key: keyof TypingCatCustomColors, val: string) {
  const hex = normalizeHexColor(val)
  if (!hex) return
  const nextColors = { ...props.state.colors }
  if (hex === defaultCoatColors.value[key].toLowerCase()) {
    delete nextColors[key]
  } else {
    nextColors[key] = hex
  }
  emit('update', { colors: nextColors })
}

function resetPartColor(key: keyof TypingCatCustomColors) {
  const nextColors = { ...props.state.colors }
  delete nextColors[key]
  emit('update', { colors: nextColors })
}

function resetAllColors() {
  emit('update', { colors: {} })
  toast.success('已恢复当前花色默认配色')
}
</script>

<template>
  <div class="space-y-4">
    <!-- 猫咪花色预设 -->
    <div class="space-y-2">
      <div class="text-xs font-semibold text-foreground">猫咪花色预设</div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="coat in TYPING_CAT_COATS"
          :key="coat.id"
          type="button"
          class="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer"
          :class="
            state.coat === coat.id
              ? 'border-brand bg-brand-soft text-foreground font-semibold'
              : 'border-border bg-card hover:bg-muted/60 text-foreground'
          "
          @click="selectCoat(coat.id)"
        >
          <span
            class="relative size-4 rounded-full border border-border/80 shrink-0 overflow-hidden"
            :style="{ backgroundColor: coat.fur }"
          >
            <span
              v-if="coat.swatchAccent"
              class="absolute right-0 bottom-0 size-2 rounded-tl-full"
              :style="{ backgroundColor: coat.swatchAccent }"
            />
          </span>
          <span class="truncate">{{ coat.name }}</span>
        </button>
      </div>
    </div>

    <!-- 3D 配饰穿戴 -->
    <div class="space-y-2">
      <div class="text-xs font-semibold text-foreground">3D 穿戴配饰（可自由叠戴）</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          v-for="spec in TYPING_CAT_ACCESSORY_SPECS"
          :key="spec.key"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer"
          :class="
            currentAccessories[spec.key]
              ? 'border-brand bg-brand-soft text-foreground font-semibold'
              : 'border-border bg-card hover:bg-muted/60 text-foreground'
          "
          @click="toggleAccessory(spec.key)"
        >
          <component
            :is="accessoryIcons[spec.key]"
            class="size-3.5 shrink-0"
            :class="currentAccessories[spec.key] ? 'text-brand' : 'text-muted-foreground'"
          />
          <span class="truncate">{{ spec.label }}</span>
        </button>
      </div>
    </div>

    <!-- 键鼠外设主题 -->
    <div class="space-y-2">
      <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Keyboard class="size-3.5 text-muted-foreground" />
        <span>键鼠配色主题</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          v-for="theme in TYPING_CAT_DESK_THEMES"
          :key="theme.id"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs transition-colors cursor-pointer"
          :class="
            (state.deskTheme ?? 'classic') === theme.id
              ? 'border-brand bg-brand-soft text-foreground font-semibold'
              : 'border-border bg-card hover:bg-muted/60 text-foreground'
          "
          @click="selectDeskTheme(theme.id)"
        >
          <span
            class="relative size-4 rounded-xs border border-border/80 shrink-0 overflow-hidden"
            :style="{ backgroundColor: theme.base }"
          >
            <span
              class="absolute inset-x-0.5 top-0.5 h-1.5 rounded-[1px]"
              :style="{ backgroundColor: theme.plain }"
            />
            <span
              class="absolute right-0.5 bottom-0.5 size-1.5 rounded-[1px]"
              :style="{ backgroundColor: theme.accent }"
            />
          </span>
          <span class="truncate">{{ theme.name }}</span>
        </button>
      </div>
    </div>

    <!-- 身体部位自定义配色（含左右眼异瞳） -->
    <div class="rounded-lg border border-border bg-card p-3.5 space-y-3">
      <div class="flex-between gap-2">
        <div class="space-y-0.5 min-w-0">
          <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>身体部位自定义配色</span>
            <Badge
              v-if="modifiedColorCount > 0"
              variant="secondary"
              size="xs"
            >
              已改 {{ modifiedColorCount }} 项
            </Badge>
          </div>
          <p class="text-[11px] text-muted-foreground">
            单独修改右眼虹膜即可呈现异瞳；切换花色预设会重置自定义配色
          </p>
        </div>
        <Button
          variant="outline"
          size="xs"
          class="gap-1 shrink-0"
          :disabled="modifiedColorCount === 0"
          @click="resetAllColors"
        >
          <RotateCcw class="size-3.5" />
          恢复默认
        </Button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <FormField
          v-for="spec in visibleColorSpecs"
          :key="spec.key"
          :label="spec.label"
          class="min-w-0"
        >
          <template
            v-if="isPartColorCustomized(spec.key)"
            #extra
          >
            <button
              type="button"
              class="ml-auto inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              :title="`恢复${spec.label}默认色`"
              @click="resetPartColor(spec.key)"
            >
              <RotateCcw class="size-3" />
              重置
            </button>
          </template>
          <ColorPicker
            :model-value="resolvedColors[spec.key]"
            :show-alpha="false"
            @update:model-value="(val) => updatePartColor(spec.key, val)"
          />
        </FormField>
      </div>
    </div>
  </div>
</template>
