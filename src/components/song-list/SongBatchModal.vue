<script setup lang="ts">
import { ref } from 'vue'

import type { SongRequestOption } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { toast } from '@/shared/utils'

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
  (e: 'updateAuthor', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateTag', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateLanguage', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateOption', value: SongRequestOption | undefined): void
}>()

const show = ref(false)

const batchAuthorText = ref('')
const batchTagText = ref('')
const batchLanguageText = ref('')
const batchOption = ref<SongRequestOption | undefined>()

const authorMode = ref<'replace' | 'append'>('append')
const tagMode = ref<'replace' | 'append'>('append')
const languageMode = ref<'replace' | 'append'>('append')

function open() {
  show.value = true
}
function close() {
  show.value = false
}

function parseTags(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function handleUpdateAuthor() {
  const authors = parseTags(batchAuthorText.value)
  if (authors.length === 0) {
    toast.warning('请输入作者')
    return
  }
  emit('updateAuthor', authors, authorMode.value)
  batchAuthorText.value = ''
  close()
}

function handleUpdateTag() {
  const tags = parseTags(batchTagText.value)
  if (tags.length === 0) {
    toast.warning('请输入标签')
    return
  }
  emit('updateTag', tags, tagMode.value)
  batchTagText.value = ''
  close()
}

function handleUpdateLanguage() {
  const langs = parseTags(batchLanguageText.value)
  if (langs.length === 0) {
    toast.warning('请输入语言')
    return
  }
  emit('updateLanguage', langs, languageMode.value)
  batchLanguageText.value = ''
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
    <DialogContent class="sm:max-w-lg p-4 space-y-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold">批量操作 · 已选 {{ selectedCount }} 首</DialogTitle>
      </DialogHeader>

      <Tabs
        default-value="author"
        class="w-full"
      >
        <TabsList class="grid grid-cols-5">
          <TabsTrigger
            value="author"
            class="text-xs"
            >作者</TabsTrigger
          >
          <TabsTrigger
            value="tag"
            class="text-xs"
            >标签</TabsTrigger
          >
          <TabsTrigger
            value="language"
            class="text-xs"
            >语言</TabsTrigger
          >
          <TabsTrigger
            value="option"
            class="text-xs"
            >要求</TabsTrigger
          >
          <TabsTrigger
            value="delete"
            class="text-xs text-destructive"
            >删除</TabsTrigger
          >
        </TabsList>

        <TabsContent
          value="author"
          class="pt-3 space-y-3 text-xs"
        >
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="append"
                v-model="authorMode"
              />
              <span>追加</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="replace"
                v-model="authorMode"
              />
              <span>替换</span>
            </label>
          </div>
          <Input
            v-model="batchAuthorText"
            placeholder="输入作者，多个用空格或逗号分隔"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateAuthor"> 应用 </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="tag"
          class="pt-3 space-y-3 text-xs"
        >
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="append"
                v-model="tagMode"
              />
              <span>追加</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="replace"
                v-model="tagMode"
              />
              <span>替换</span>
            </label>
          </div>
          <Input
            v-model="batchTagText"
            placeholder="输入标签，多个用空格或逗号分隔"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateTag"> 应用 </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="language"
          class="pt-3 space-y-3 text-xs"
        >
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="append"
                v-model="languageMode"
              />
              <span>追加</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                value="replace"
                v-model="languageMode"
              />
              <span>替换</span>
            </label>
          </div>
          <Input
            v-model="batchLanguageText"
            placeholder="输入语言，多个用空格或逗号分隔"
          />
          <div class="flex justify-end">
            <Button @click="handleUpdateLanguage"> 应用 </Button>
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
            <span class="font-medium text-foreground">启用独立要求（将覆盖原有设置）</span>
          </label>

          <template v-if="batchOption">
            <div class="flex items-center gap-3 pl-5">
              <label class="flex items-center gap-1 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needJianzhang" />
                <span>舰长</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needTidu" />
                <span>提督</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <Checkbox v-model:checked="batchOption.needZongdu" />
                <span>总督</span>
              </label>
            </div>

            <div class="flex items-center gap-3 pl-5 flex-wrap">
              <div class="flex items-center gap-1.5">
                <label class="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    :checked="batchOption.scMinPrice != null"
                    @update:checked="(v: boolean) => (batchOption!.scMinPrice = v ? 30 : undefined)"
                  />
                  <span>SC ≥</span>
                </label>
                <NInputNumber
                  v-if="batchOption.scMinPrice != null"
                  v-model:value="batchOption.scMinPrice"
                  :min="1"
                  size="small"
                  class="w-20"
                />
                <span v-if="batchOption.scMinPrice != null">元</span>
              </div>

              <div class="flex items-center gap-1.5">
                <label class="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    :checked="batchOption.fanMedalMinLevel != null"
                    @update:checked="(v: boolean) => (batchOption!.fanMedalMinLevel = v ? 1 : undefined)"
                  />
                  <span>粉丝牌 ≥</span>
                </label>
                <NInputNumber
                  v-if="batchOption.fanMedalMinLevel != null"
                  v-model:value="batchOption.fanMedalMinLevel"
                  :min="1"
                  size="small"
                  class="w-20"
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
          value="delete"
          class="pt-3 space-y-3 text-xs"
        >
          <p class="text-destructive leading-relaxed m-0">
            确定要删除选中的 {{ selectedCount }} 首歌曲？此操作不可恢复。
          </p>
          <div class="flex justify-end">
            <Button
              variant="destructive"
              @click="
                emit('delete');
                close()
              "
            >
              确认删除
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
