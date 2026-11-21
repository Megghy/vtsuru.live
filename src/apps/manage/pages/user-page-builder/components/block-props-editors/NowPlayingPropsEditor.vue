<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid>
    <SettingRow
      title="显示点歌用户"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showRequester" />
    </SettingRow>
    <SettingRow
      title="展开待唱队列"
      variant="none"
      class="py-1"
    >
      <Switch
        :checked="blockProps.showQueue !== false"
        @update:checked="blockProps.showQueue = $event"
      />
    </SettingRow>
    <FormField
      v-if="blockProps.showQueue !== false"
      label="待唱显示数量"
    >
      <NumberField
        :model-value="typeof blockProps.queueLimit === 'number' ? blockProps.queueLimit : 5"
        :min="1"
        :max="10"
        class="w-full"
        @update:model-value="blockProps.queueLimit = $event"
      />
    </FormField>
  </PropsGrid>
</template>
