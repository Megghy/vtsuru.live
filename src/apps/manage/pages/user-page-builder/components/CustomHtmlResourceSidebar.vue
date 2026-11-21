<script setup lang="ts">
import { CloudUpload, Copy } from 'lucide-vue-next'

import type { APIFileModel } from '@/api/generated/model'
import { FileStore } from '@/shared/services/fileUpload'
import { Button } from '@/shared/ui/button'
import { SmartImage } from '@/shared/ui/image'
import { Input } from '@/shared/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineOptions({ name: 'CustomHtmlResourceSidebar' })

defineProps<{
  resources: APIFileModel[]
  attachedIds: Set<number>
  isLoading: boolean
  uploading: boolean
}>()

const resourceSearch = defineModel<string>('resourceSearch', { required: true })
const resourceSources = defineModel<string[]>('resourceSources', { required: true })

const emit = defineEmits<{
  upload: []
  attach: [file: APIFileModel]
  copyPath: [path?: string | null]
}>()
</script>

<template>
  <aside class="resources-pane flex min-h-0 flex-col overflow-hidden border-r bg-muted/20">
    <div class="p-3 border-b flex flex-col gap-2 shrink-0">
      <div class="flex justify-between items-center">
        <span class="text-xs font-semibold text-foreground">图片资源</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="uploading"
                aria-label="上传图片"
                @click="emit('upload')"
              >
                <CloudUpload class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent> 上传图片 </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ToggleGroup
        v-model="resourceSources"
        type="multiple"
        size="xs"
        class="h-auto w-full flex-wrap justify-start"
      >
        <ToggleGroupItem :value="FileStore.Configs">编辑器</ToggleGroupItem>
        <ToggleGroupItem :value="FileStore.Library">自己上传</ToggleGroupItem>
        <ToggleGroupItem :value="FileStore.Questions">提问箱</ToggleGroupItem>
      </ToggleGroup>
      <Input
        v-model="resourceSearch"
        placeholder="搜索文件"
      />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
      <div
        v-if="resources.length"
        class="resource-list space-y-1"
      >
        <div
          v-for="file in resources"
          :key="file.id"
          class="resource-row flex items-center gap-0.5 rounded-md hover:bg-muted/50"
        >
          <Button
            variant="ghost"
            class="resource-row-main min-w-0 flex-1 h-auto justify-start gap-2 p-1.5"
            @click="emit('attach', file)"
          >
            <SmartImage
              :src="file.path"
              alt=""
              class="size-8 rounded object-cover shrink-0"
            />
            <span class="min-w-0 flex-1 text-left">
              <strong class="block truncate text-foreground">{{ file.name || `资源 #${file.id}` }}</strong>
              <small class="text-muted-foreground"
                >#{{ file.id }}<template v-if="attachedIds.has(file.id)"> · 已绑定</template></small
              >
            </span>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="shrink-0"
                  :disabled="!file.path"
                  aria-label="复制资源链接"
                  @click.stop="emit('copyPath', file.path)"
                >
                  <Copy class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制链接</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div
        v-else-if="!isLoading"
        class="py-8 text-center text-xs text-muted-foreground"
      >
        没有可用图片
      </div>
    </div>
  </aside>
</template>
