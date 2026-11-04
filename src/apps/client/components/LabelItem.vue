<script lang="ts" setup>
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'

withDefaults(
  defineProps<{
    label: string
    labelPlacement?: 'left' | 'top'
  }>(),
  {
    labelPlacement: 'left',
  },
)
</script>

<template>
  <FormField
    v-if="labelPlacement === 'top'"
    :label="label"
  >
    <slot />
  </FormField>
  <SettingRow
    v-else
    variant="none"
    :title="label"
    class="py-1"
  >
    <slot />
  </SettingRow>
</template>
