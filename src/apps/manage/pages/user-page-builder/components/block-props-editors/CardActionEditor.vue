<script setup lang="ts">
import { NFormItem, NInput, NSelect } from 'naive-ui'

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
    <NFormItem :label="`${label}文字`">
      <NInput
        v-model:value="action.label"
        placeholder="留空则不显示"
      />
    </NFormItem>
    <NFormItem :label="`${label}目标类型`">
      <NSelect
        :value="getNavigationTargetType(action)"
        :options="[
          { label: '页面', value: 'page' },
          { label: '外链', value: 'external' },
        ]"
        @update:value="(value) => setNavigationTargetType(action, value)"
      />
    </NFormItem>
    <NFormItem
      class="span-full"
      :label="`${label}目标`"
    >
      <NSelect
        v-if="action.page"
        v-model:value="action.page"
        :options="pageOptions"
      />
      <NInput
        v-else
        v-model:value="action.url"
        placeholder="https://..."
      />
    </NFormItem>
  </PropsGrid>
</template>
