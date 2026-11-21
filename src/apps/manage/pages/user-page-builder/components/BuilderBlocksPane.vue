<script setup lang="ts">
import { Bookmark, Check, Layers, Pencil, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
  presetTemplates,
  personalTemplates,
  addBlockOptions,
  blockActionOptions,
  insertTemplate,
  handleAddBlockMenuSelect,
  saveSelectionAsTemplate,
  renamePersonalTemplate,
  deletePersonalTemplate,
} = useBlockManagerLibrary()

const templatePopoverOpen = ref(false)
const editingTemplateId = ref<string | null>(null)
const editingTemplateLabel = ref('')

function startRenameTemplate(id: string, currentLabel: string) {
  editingTemplateId.value = id
  editingTemplateLabel.value = currentLabel
}

function submitRenameTemplate(id: string) {
  renamePersonalTemplate(id, editingTemplateLabel.value)
  editingTemplateId.value = null
}

function applyTemplateAndClose(key: string) {
  templatePopoverOpen.value = false
  insertTemplate(key)
}
</script>

<template>
  <Card class="pane-card min-w-0 h-full flex flex-col overflow-hidden">
    <CardHeader class="h-10 px-3 py-0 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
      <CardTitle class="text-xs font-semibold">区块</CardTitle>

      <div class="blocks-pane__actions flex items-center gap-1">
        <TooltipProvider v-if="selectionCount">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="保存所选区块为模板"
                @click="saveSelectionAsTemplate"
              >
                <Bookmark class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存所选区块为个人模板</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Popover v-model:open="templatePopoverOpen">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <PopoverTrigger as-child>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="模板库"
                  >
                    <Layers class="size-3.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>预设与个人模板</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent
            align="end"
            class="w-72 p-2.5 space-y-2.5"
          >
            <div class="space-y-1">
              <div class="px-1.5 text-[11px] font-semibold text-muted-foreground">推荐起始模板</div>
              <div class="flex flex-col gap-0.5">
                <button
                  v-for="tpl in presetTemplates"
                  :key="tpl.key"
                  type="button"
                  class="flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md text-left hover:bg-muted transition-colors cursor-pointer"
                  @click="applyTemplateAndClose(tpl.key)"
                >
                  <span class="text-xs font-medium text-foreground">{{ tpl.label }}</span>
                  <span class="text-[11px] text-muted-foreground">{{ tpl.description }}</span>
                </button>
              </div>
            </div>

            <div class="border-t border-border pt-2 space-y-1">
              <div class="px-1.5 text-[11px] font-semibold text-muted-foreground">
                个人模板（{{ personalTemplates.length }}）
              </div>
              <div
                v-if="personalTemplates.length === 0"
                class="px-2 py-2 text-[11px] text-muted-foreground"
              >
                选中区块后点击书签图标即可存为个人模板
              </div>
              <div
                v-else
                class="max-h-44 overflow-y-auto scrollbar-thin flex flex-col gap-1"
              >
                <div
                  v-for="tpl in personalTemplates"
                  :key="tpl.id"
                  class="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/70 transition-colors"
                >
                  <template v-if="editingTemplateId === tpl.id">
                    <Input
                      v-model="editingTemplateLabel"
                      class="flex-1 min-w-0"
                      @keyup.enter="submitRenameTemplate(tpl.id)"
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="确认重命名"
                      @click="submitRenameTemplate(tpl.id)"
                    >
                      <Check class="size-3.5 text-primary" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="取消重命名"
                      @click="editingTemplateId = null"
                    >
                      <X class="size-3.5" />
                    </Button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="flex-1 min-w-0 text-left cursor-pointer"
                      @click="applyTemplateAndClose(`personal:${tpl.id}`)"
                    >
                      <div class="text-xs font-medium truncate">{{ tpl.label }}</div>
                      <div class="text-[11px] text-muted-foreground">{{ tpl.blocks.length }} 个区块</div>
                    </button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="重命名模板"
                      @click.stop="startRenameTemplate(tpl.id, tpl.label)"
                    >
                      <Pencil class="size-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-destructive hover:text-destructive"
                      aria-label="删除模板"
                      @click.stop="deletePersonalTemplate(tpl.id)"
                    >
                      <Trash2 class="size-3" />
                    </Button>
                  </template>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover v-model:open="showAddMenu">
          <PopoverTrigger as-child>
            <Button
              size="icon-xs"
              aria-label="添加区块"
            >
              <Plus class="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="w-72 p-2 flex flex-col gap-2"
          >
            <Input
              v-model="blockSearch"
              placeholder="搜索区块名称或关键词..."
            />
            <div class="max-h-72 overflow-y-auto scrollbar-thin flex flex-col gap-0.5">
              <template v-if="addBlockOptions.length">
                <template
                  v-for="opt in addBlockOptions"
                  :key="opt.key"
                >
                  <div
                    v-if="opt.groupLabel"
                    class="flex items-center gap-2 pt-2 pb-1 px-1.5 text-[11px] font-semibold text-muted-foreground select-none"
                  >
                    <span>{{ opt.groupLabel }}</span>
                    <span class="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    v-else
                    variant="ghost"
                    size="xs"
                    class="flex items-center justify-start gap-2 w-full px-2 text-left font-normal"
                    @click="handleAddBlockMenuSelect(String(opt.key))"
                  >
                    <component
                      :is="opt.icon"
                      v-if="opt.icon"
                      class="size-3.5 text-muted-foreground shrink-0"
                    />
                    <span>{{ opt.label }}</span>
                  </Button>
                </template>
              </template>
              <div
                v-else
                class="py-6 flex justify-center"
              >
                <Empty description="没有匹配的区块" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </CardHeader>

    <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <BlockManager :block-action-options="blockActionOptions" />
    </div>
  </Card>
</template>
