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
    <FormField label="最多展示">
      <NumberField
        v-model="blockProps.count"
        :min="1"
        :max="6"
        class="w-full"
      />
    </FormField>
    <SettingRow
      title="显示活动说明"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showDescription" />
    </SettingRow>
    <SettingRow
      title="显示投稿进度"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showProgress" />
    </SettingRow>
  </PropsGrid>
</template>
