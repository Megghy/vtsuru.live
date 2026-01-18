<script setup lang="ts">
import { NAlert, NButton, NCard, NScrollbar, NSplit } from 'naive-ui';
import { useStorage } from '@vueuse/core'
import { inject } from 'vue'
import BlockManager from './BlockManager.vue'
import BuilderPropsPane from './BuilderPropsPane.vue'
import { UserPageEditorKey } from '../context'
import { USER_PAGE_BUILDER_SPLIT_BLOCKS_MERGED_TOP_SIZE_KEY } from '../storageKeys'

defineOptions({ name: 'BuilderBlocksPane' })

const props = defineProps<{
  mergedProps: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-merged-props'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const mergedTopSize = useStorage<string | number>(USER_PAGE_BUILDER_SPLIT_BLOCKS_MERGED_TOP_SIZE_KEY, '420px')
</script>

<template>
  <NCard
    class="pane-card"
    title="区块"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden"
  >
    <template #header-extra>
      <NButton size="small" quaternary @click="emit('toggle-merged-props')">
        {{ props.mergedProps ? '拆分编辑列' : '合并编辑列' }}
      </NButton>
    </template>

    <NSplit
      v-if="props.mergedProps"
      v-model:size="mergedTopSize"
      direction="vertical"
      min="220px"
      style="flex: 1; min-height: 0"
      :pane1-style="{ display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
      :pane2-style="{ display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
    >
      <template #1>
        <NScrollbar class="pane-scroll">
          <div style="padding: 10px">
            <BlockManager />
          </div>
        </NScrollbar>
      </template>
      <template #2>
        <BuilderPropsPane />
      </template>
    </NSplit>

    <NScrollbar v-else class="pane-scroll">
      <div style="padding: 10px">
        <BlockManager />
      </div>
    </NScrollbar>



    <NAlert type="info" :show-icon="true">
      请选择一个区块进行编辑。支持 Ctrl/Shift 多选批量操作。
    </NAlert>
  </NCard>
</template>
