<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
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
  </PropsGrid>
</template>
