<script setup lang="ts">
import Add24Filled from '@vicons/fluent/es/Add24Filled'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'

import type { TempGuardFreeDate } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

defineProps<{
  enableCheckboxId: string
  enableLabel: string
  currentOnlyCheckboxId: string
  currentOnlyLabel: string
  specificTitle: string
}>()

const months = defineModel<TempGuardFreeDate[] | null | undefined>('months')

const currentYear = new Date().getFullYear()
const allowedYearOptions = Array.from({ length: 10 }, (_, idx) => {
  const year = currentYear - 2 + idx
  return { label: `${year}年`, value: String(year) }
})
const allowedMonthOptions = Array.from({ length: 12 }, (_, idx) => {
  const month = idx + 1
  return { label: `${month}月`, value: String(month) }
})

function currentYearMonth(): TempGuardFreeDate {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function toggleEnable(enabled: boolean) {
  months.value = enabled ? [currentYearMonth()] : undefined
}

function toggleCurrentOnly(currentOnly: boolean) {
  months.value = currentOnly ? [] : [currentYearMonth()]
}

function addYearMonth() {
  months.value = [...(months.value ?? []), currentYearMonth()]
}

function removeYearMonth(index: number) {
  if (!months.value || months.value.length <= 1) return
  months.value = months.value.filter((_, idx) => idx !== index)
}

function updateField(index: number, field: 'year' | 'month', raw: unknown) {
  const num = Number(raw)
  if (!Number.isFinite(num) || !months.value) return
  months.value = months.value.map((item, idx) => (idx === index ? { ...item, [field]: num } : item))
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Checkbox
          :id="enableCheckboxId"
          :checked="months !== undefined && months !== null"
          @update:checked="(v) => toggleEnable(Boolean(v))"
        />
        <label
          :for="enableCheckboxId"
          class="text-xs font-medium cursor-pointer"
        >
          {{ enableLabel }}
        </label>
      </div>
      <slot name="header-extra" />
    </div>

    <div
      v-if="months !== undefined && months !== null"
      class="space-y-3 pl-5 border-l-2 border-primary/30"
    >
      <slot name="before-months" />

      <div class="flex items-center gap-2">
        <Checkbox
          :id="currentOnlyCheckboxId"
          :checked="months.length === 0"
          @update:checked="(v) => toggleCurrentOnly(Boolean(v))"
        />
        <label
          :for="currentOnlyCheckboxId"
          class="text-xs cursor-pointer"
        >
          {{ currentOnlyLabel }}
        </label>
      </div>

      <div
        v-if="months.length > 0"
        class="space-y-2"
      >
        <div class="text-xs text-muted-foreground">{{ specificTitle }}</div>
        <div
          v-for="(ym, idx) in months"
          :key="`ym-${idx}`"
          class="flex items-center gap-2"
        >
          <Select
            :model-value="String(ym.year)"
            @update:model-value="(v) => updateField(idx, 'year', v)"
          >
            <SelectTrigger class="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="y in allowedYearOptions"
                :key="y.value"
                :value="y.value"
              >
                {{ y.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            :model-value="String(ym.month)"
            @update:model-value="(v) => updateField(idx, 'month', v)"
          >
            <SelectTrigger class="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="m in allowedMonthOptions"
                :key="m.value"
                :value="m.value"
              >
                {{ m.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            class="text-destructive"
            :disabled="months.length <= 1"
            @click="removeYearMonth(idx)"
          >
            <Delete24Filled class="size-3.5" />
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          @click="addYearMonth"
        >
          <Add24Filled class="size-3 mr-1" />
          添加月份
        </Button>
      </div>
    </div>
  </div>
</template>
