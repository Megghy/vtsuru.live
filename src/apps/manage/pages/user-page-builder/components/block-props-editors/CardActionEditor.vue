<script setup lang="ts">
import PropsGrid from '../PropsGrid.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'

defineProps<{
  action: Record<string, any>
  pageOptions: Array<{ label: string; value: string }>
  label: string
}>()
</script>

<template>
  <PropsGrid>
    <UFormField :label="`${label}文字`">
      <UInput
        v-model="action.label"
        placeholder="留空则不显示"
      />
    </UFormField>
    <UFormField :label="`${label}目标类型`">
      <USelect
        :value="getNavigationTargetType(action)"
        :items="[
          { label: '页面', value: 'page' },
          { label: '外链', value: 'external' },
        ]"
        @update:model-value="(value) => setNavigationTargetType(action, value as 'page' | 'external' | 'back')"
      />
    </UFormField>
    <UFormField
      class="span-full"
      :label="`${label}目标`"
    >
      <USelect
        v-if="action.page"
        v-model="action.page"
        :items="pageOptions"
      />
      <UInput
        v-else
        v-model="action.url"
        placeholder="https://..."
      />
    </UFormField>
  </PropsGrid>
</template>
