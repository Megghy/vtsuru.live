<script setup lang="ts">
import { FormField } from '@/shared/ui/form-field'

defineProps<{
  label: string
  hint?: string
  value?: string | number
}>()
</script>

<template>
  <FormField
    :label="label"
    :hint="hint"
    :extra="value"
  >
    <template
      v-if="$slots.hint"
      #hint
    >
      <slot name="hint" />
    </template>
    <slot />
  </FormField>
</template>
