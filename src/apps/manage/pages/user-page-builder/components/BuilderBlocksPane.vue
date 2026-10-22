<script setup lang="ts">
import { AddCircleOutline, BookmarkOutline, LayersOutline } from '@vicons/ionicons5'
import { computed, inject } from 'vue'

import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
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
  templateOptions,
  addBlockOptions,
  blockActionOptions,
  insertTemplate,
  handleAddBlockMenuSelect,
  saveSelectionAsTemplate,
} = useBlockManagerLibrary()
</script>

<template>
  <Card class="pane-card min-w-0 h-full flex flex-col overflow-hidden">
    <CardHeader class="p-2 border-b border-border flex flex-row items-center justify-between space-y-0">
      <CardTitle class="text-xs font-semibold">区块</CardTitle>

      <div class="blocks-pane__actions flex items-center gap-1">
        <TooltipProvider v-if="selectionCount">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                class="size-7 p-0"
                aria-label="保存所选区块为模板"
                @click="saveSelectionAsTemplate"
              >
                <component
                  :is="BookmarkOutline"
                  class="size-3.5"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存所选区块为模板</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="ghost"
                    class="size-7 p-0"
                    aria-label="应用起始模板"
                    title="起始模板"
                  >
                    <component
                      :is="LayersOutline"
                      class="size-3.5"
                    />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>起始模板</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent
            align="end"
            class="w-40 text-xs"
          >
            <DropdownMenuItem
              v-for="opt in templateOptions"
              :key="opt.key"
              @click="insertTemplate(String(opt.key))"
            >
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover v-model:open="showAddMenu">
          <PopoverTrigger as-child>
            <Button
              class="size-7 p-0"
              aria-label="添加区块"
            >
              <component
                :is="AddCircleOutline"
                class="size-4"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="w-72 p-2 text-xs flex flex-col gap-2"
          >
            <Input
              v-model="blockSearch"
              placeholder="搜索区块名称或关键词..."
              size="xs"
            />
            <div class="max-h-72 overflow-y-auto flex flex-col gap-0.5">
              <template v-if="addBlockOptions.length">
                <template
                  v-for="opt in addBlockOptions"
                  :key="opt.key"
                >
                  <div
                    v-if="String(opt.key).startsWith('divider:')"
                    class="pt-2 pb-1 px-1.5 text-[11px] font-bold text-muted-foreground border-b border-border mb-1"
                  >
                    <component
                      :is="opt.label"
                      v-if="typeof opt.label === 'function'"
                    />
                    <span v-else>{{ opt.label }}</span>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="flex items-center gap-2 w-full p-1.5 rounded hover:bg-muted text-left text-xs transition-colors cursor-pointer select-none"
                    @click="handleAddBlockMenuSelect(String(opt.key))"
                  >
                    <component
                      :is="opt.icon"
                      v-if="opt.icon"
                      class="size-4 text-muted-foreground shrink-0"
                    />
                    <span>{{ typeof opt.label === 'function' ? opt.key : opt.label }}</span>
                  </button>
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
