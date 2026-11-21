<script setup lang="ts">
import { ref } from 'vue'

import type { SongRequestOption } from '@/api/generated/model'
import SongTagChipInput from '@/components/song-list/SongTagChipInput.vue'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { NumberField } from '@/shared/ui/number-field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { toast } from '@/shared/utils'

export type BatchUpdateMode = 'append' | 'remove' | 'replace'

interface OptionItem {
  label: string
  value: string
}

defineProps<{
  selectedCount: number
  languageOptions: OptionItem[]
  tagOptions: OptionItem[]
  authorOptions: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'updateAuthor', value: string[], mode: BatchUpdateMode): void
  (e: 'updateTag', value: string[], mode: BatchUpdateMode): void
  (e: 'updateLanguage', value: string[], mode: BatchUpdateMode): void
  (e: 'updateOption', value: SongRequestOption | undefined): void
  (e: 'updatePin', value: boolean): void
  (e: 'updateDisabled', value: boolean): void
}>()

const show = ref(false)

const batchAuthors = ref<string[]>([])
const batchTags = ref<string[]>([])
const batchLanguages = ref<string[]>([])
const batchOption = ref<SongRequestOption | undefined>()

const authorMode = ref<BatchUpdateMode>('append')
const tagMode = ref<BatchUpdateMode>('append')
const languageMode = ref<BatchUpdateMode>('append')

function open() {
  show.value = true
}
function close() {
  show.value = false
}

function handleUpdateAuthor() {
  if (authorMode.value !== 'replace' && batchAuthors.value.length === 0) {
    toast.warning('请先添加或选择作者')
    return
  }
  emit('updateAuthor', [...batchAuthors.value], authorMode.value)
  batchAuthors.value = []
  close()
}

function handleUpdateTag() {
  if (tagMode.value !== 'replace' && batchTags.value.length === 0) {
    toast.warning('请先添加或选择标签')
    return
  }
  emit('updateTag', [...batchTags.value], tagMode.value)
  batchTags.value = []
  close()
}

function handleUpdateLanguage() {
  if (languageMode.value !== 'replace' && batchLanguages.value.length === 0) {
    toast.warning('请先添加或选择语言')
    return
  }
  emit('updateLanguage', [...batchLanguages.value], languageMode.value)
  batchLanguages.value = []
  close()
}

function handleUpdateOption() {
  emit('updateOption', batchOption.value)
  batchOption.value = undefined
  close()
}

defineExpose({ open, close })
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="sm:max-w-lg p-4 gap-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm">批量操作 · 已选 {{ selectedCount }} 首</DialogTitle>
      </DialogHeader>

      <Tabs
        default-value="tag"
        class="w-full"
      >
        <TabsList class="grid grid-cols-6 w-full">
          <TabsTrigger value="tag">标签</TabsTrigger>
          <TabsTrigger value="author">作者</TabsTrigger>
          <TabsTrigger value="language">语言</TabsTrigger>
          <TabsTrigger value="option">要求</TabsTrigger>
          <TabsTrigger value="status">状态</TabsTrigger>
          <TabsTrigger
            value="delete"
            class="text-destructive"
          >
            删除
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="tag"
          class="pt-3 space-y-3 text-xs"
        >
          <ToggleGroup
            type="single"
            :model-value="tagMode"
            class="w-full grid grid-cols-3"
            @update:model-value="(v) => v && (tagMode = v as BatchUpdateMode)"
          >
            <ToggleGroupItem value="append">追加</ToggleGroupItem>
            <ToggleGroupItem value="remove">移除指定</ToggleGroupItem>
            <ToggleGroupItem value="replace">替换 / 清空</ToggleGroupItem>
          </ToggleGroup>
          <SongTagChipInput
            v-model="batchTags"
            :options="tagOptions"
            :placeholder="tagMode === 'replace' ? '留空应用即可批量清空标签' : '输入或点选标签'"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateTag">
              {{ tagMode === 'replace' && batchTags.length === 0 ? '清空标签' : '应用' }}
            </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="author"
          class="pt-3 space-y-3 text-xs"
        >
          <ToggleGroup
            type="single"
            :model-value="authorMode"
            class="w-full grid grid-cols-3"
            @update:model-value="(v) => v && (authorMode = v as BatchUpdateMode)"
          >
            <ToggleGroupItem value="append">追加</ToggleGroupItem>
            <ToggleGroupItem value="remove">移除指定</ToggleGroupItem>
            <ToggleGroupItem value="replace">替换 / 清空</ToggleGroupItem>
          </ToggleGroup>
          <SongTagChipInput
            v-model="batchAuthors"
            :options="authorOptions"
            :placeholder="authorMode === 'replace' ? '留空应用即可批量清空作者' : '输入或点选作者'"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateAuthor">
              {{ authorMode === 'replace' && batchAuthors.length === 0 ? '清空作者' : '应用' }}
            </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="language"
          class="pt-3 space-y-3 text-xs"
        >
          <ToggleGroup
            type="single"
            :model-value="languageMode"
            class="w-full grid grid-cols-3"
            @update:model-value="(v) => v && (languageMode = v as BatchUpdateMode)"
          >
            <ToggleGroupItem value="append">追加</ToggleGroupItem>
            <ToggleGroupItem value="remove">移除指定</ToggleGroupItem>
            <ToggleGroupItem value="replace">替换 / 清空</ToggleGroupItem>
          </ToggleGroup>
          <SongTagChipInput
            v-model="batchLanguages"
            :options="languageOptions"
            :placeholder="languageMode === 'replace' ? '留空应用即可批量清空语言' : '输入或点选语言'"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateLanguage">
              {{ languageMode === 'replace' && batchLanguages.length === 0 ? '清空语言' : '应用' }}
            </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="option"
          class="pt-3 space-y-3 text-xs"
        >
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="batchOption != null"
              @update:checked="
                (v: boolean) =>
                  (batchOption = v ? { needJianzhang: false, needTidu: false, needZongdu: false } : undefined)
              "
            />
            <span class="font-medium text-foreground">启用独立要求（取消勾选点击应用将清空门槛）</span>
          </label>

          <template v-if="batchOption">
            <div class="flex items-center gap-4 pl-5 flex-wrap">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needJianzhang" />
                <span>舰长</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needTidu" />
                <span>提督</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needZongdu" />
                <span>总督</span>
              </label>
            </div>

            <div class="flex items-center gap-4 pl-5 flex-wrap">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    :checked="batchOption.scMinPrice != null"
                    @update:checked="(v: boolean) => (batchOption!.scMinPrice = v ? 30 : undefined)"
                  />
                  <span>SC ≥</span>
                </label>
                <NumberField
                  v-if="batchOption.scMinPrice != null"
                  v-model="batchOption.scMinPrice"
                  :min="1"
                  class="w-28"
                />
                <span v-if="batchOption.scMinPrice != null">元</span>
              </div>

              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    :checked="batchOption.fanMedalMinLevel != null"
                    @update:checked="(v: boolean) => (batchOption!.fanMedalMinLevel = v ? 1 : undefined)"
                  />
                  <span>粉丝牌 ≥</span>
                </label>
                <NumberField
                  v-if="batchOption.fanMedalMinLevel != null"
                  v-model="batchOption.fanMedalMinLevel"
                  :min="1"
                  class="w-28"
                />
                <span v-if="batchOption.fanMedalMinLevel != null">级</span>
              </div>
            </div>
          </template>

          <div class="flex justify-end pt-2">
            <Button @click="handleUpdateOption"> 应用 </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="status"
          class="pt-3 space-y-3 text-xs"
        >
          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              @click="(emit('updatePin', true), close())"
            >
              设为置顶招牌
            </Button>
            <Button
              variant="outline"
              @click="(emit('updatePin', false), close())"
            >
              取消置顶
            </Button>
            <Button
              variant="outline"
              @click="(emit('updateDisabled', true), close())"
            >
              设为暂不接歌
            </Button>
            <Button
              variant="outline"
              @click="(emit('updateDisabled', false), close())"
            >
              恢复可点歌
            </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="delete"
          class="pt-3 space-y-3 text-xs"
        >
          <p class="text-destructive leading-relaxed m-0">
            确定要删除选中的 {{ selectedCount }} 首歌曲？此操作不可恢复。
          </p>
          <div class="flex justify-end">
            <Button
              variant="destructive"
              @click="(emit('delete'), close())"
            >
              确认删除
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
