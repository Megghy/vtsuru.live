<script setup lang="ts">
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
  <UCard
    class="pane-card blocks-pane"
    title="区块"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden"
  >
    <template #header-extra>
      <div class="builder-row blocks-pane__actions">
        <UTooltip v-if="selectionCount">
          <UButton
            variant="ghost"
            square
            size="sm"
            aria-label="保存所选区块为模板"
            @click="saveSelectionAsTemplate"
          >
            <template #icon>
              <UIcon name="i-lucide-bookmark" />
            </template>
          </UButton>
          <template #content> 保存所选区块为模板 </template></UTooltip
        >

        <UTooltip
          :delay="0"
          placement="bottom"
        >
          <UDropdownMenu :items="templateOptions">
            <UButton
              variant="ghost"
              square
              size="sm"
              aria-label="应用起始模板"
              title="起始模板"
            >
              <template #icon>
                <UIcon name="i-lucide-layers" />
              </template>
            </UButton>
          </UDropdownMenu>
          <template #content> 起始模板 </template></UTooltip
        >

        <UPopover v-model:open="showAddMenu">
          <UTooltip text="添加区块">
            <UButton
              icon="i-lucide-circle-plus"
              color="primary"
              variant="soft"
              square
              size="sm"
              aria-label="添加区块"
            />
          </UTooltip>
          <template #content>
            <div class="blocks-pane__menu">
              <UInput
                v-model="blockSearch"
                icon="i-lucide-search"
                placeholder="搜索区块名称或关键词"
              />
              <div
                v-if="addBlockOptions.length"
                class="builder-scroll blocks-pane__library"
              >
                <template
                  v-for="option in addBlockOptions"
                  :key="option.key"
                >
                  <p
                    v-if="option.type === 'label'"
                    class="blocks-pane__group-label"
                  >
                    {{ option.label }}
                  </p>
                  <UButton
                    v-else
                    :label="option.label"
                    color="neutral"
                    variant="ghost"
                    block
                    @click="option.onSelect?.($event)"
                  />
                </template>
              </div>
              <UEmpty
                v-else
                size="sm"
                description="没有匹配的区块"
              />
            </div>
          </template>
        </UPopover>
      </div>
    </template>

    <BlockManager :block-action-options="blockActionOptions" />
  </UCard>
</template>

<style scoped>
.blocks-pane__actions {
  gap: 2px !important;
}

.blocks-pane__search {
  width: min(310px, calc(100vw - 32px));
  padding: 10px 10px 4px;
  box-sizing: border-box;
}

.blocks-pane__menu {
  display: grid;
  gap: 8px;
  width: min(310px, calc(100vw - 32px));
  padding: 10px;
}

.blocks-pane__library {
  display: grid;
  max-height: min(360px, calc(100dvh - 160px));
}

.blocks-pane__group-label {
  margin: 8px 8px 2px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
