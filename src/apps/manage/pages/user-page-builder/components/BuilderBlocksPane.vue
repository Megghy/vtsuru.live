<script setup lang="ts">
import { AddCircleOutline, BookmarkOutline, LayersOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NDropdown,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NMenu,
  NPopover,
  NScrollbar,
  NTooltip,
} from 'naive-ui'
import { computed, inject } from 'vue'

import { UserPageEditorKey } from '../context'
import BlockManager from './BlockManager.vue'
import { useBlockManagerLibrary } from './useBlockManagerLibrary'

defineOptions({ name: 'BuilderBlocksPane' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const selectionCount = computed(() => editor.selectedBlockIds.value.length)
const {
  showAddMenu,
  blockSearch,
  templateOptions,
  addBlockOptions,
  blockActionOptions,
  insertTemplate,
  handleAddBlockMenuSelect,
  saveSelectionAsTemplate,
} = useBlockManagerLibrary()
</script>

<template>
  <NCard
    class="pane-card blocks-pane"
    title="区块"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden"
  >
    <template #header-extra>
      <NFlex
        class="blocks-pane__actions"
        :wrap="false"
        size="small"
      >
        <NTooltip v-if="selectionCount">
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              aria-label="保存所选区块为模板"
              @click="saveSelectionAsTemplate"
            >
              <template #icon>
                <NIcon><BookmarkOutline /></NIcon>
              </template>
            </NButton>
          </template>
          保存所选区块为模板
        </NTooltip>

        <NTooltip
          :delay="0"
          placement="bottom"
        >
          <template #trigger>
            <NDropdown
              :options="templateOptions"
              trigger="click"
              @select="(key) => insertTemplate(String(key))"
            >
              <NButton
                quaternary
                circle
                size="small"
                aria-label="应用起始模板"
                title="起始模板"
              >
                <template #icon>
                  <NIcon><LayersOutline /></NIcon>
                </template>
              </NButton>
            </NDropdown>
          </template>
          起始模板
        </NTooltip>

        <NPopover
          v-model:show="showAddMenu"
          trigger="click"
          placement="bottom-end"
        >
          <template #trigger>
            <NTooltip>
              <template #trigger>
                <NButton
                  type="primary"
                  secondary
                  circle
                  size="small"
                  aria-label="添加区块"
                >
                  <template #icon>
                    <NIcon><AddCircleOutline /></NIcon>
                  </template>
                </NButton>
              </template>
              添加区块
            </NTooltip>
          </template>
          <div class="blocks-pane__search">
            <NInput
              v-model:value="blockSearch"
              clearable
              placeholder="搜索区块名称或关键词"
            />
          </div>
          <NScrollbar style="width: min(310px, calc(100vw - 32px)); max-height: min(360px, calc(100dvh - 160px))">
            <NMenu
              v-if="addBlockOptions.length"
              :options="addBlockOptions"
              :indent="18"
              :root-indent="18"
              :node-props="
                (option: any) =>
                  String(option?.key || '').startsWith('divider:')
                    ? { style: 'margin-top: 8px; padding: 8px 12px 4px; cursor: default;' }
                    : {}
              "
              @update:value="(key) => handleAddBlockMenuSelect(String(key))"
            />
            <NEmpty
              v-else
              size="small"
              description="没有匹配的区块"
              style="padding: 24px"
            />
          </NScrollbar>
        </NPopover>
      </NFlex>
    </template>

    <BlockManager :block-action-options="blockActionOptions" />
  </NCard>
</template>

<style scoped>
.blocks-pane :deep(.n-card-header) {
  padding: 10px 12px;
}

.blocks-pane :deep(.n-card-header__main) {
  min-width: max-content;
}

.blocks-pane__actions {
  gap: 2px !important;
}

.blocks-pane__search {
  width: min(310px, calc(100vw - 32px));
  padding: 10px 10px 4px;
  box-sizing: border-box;
}
</style>
