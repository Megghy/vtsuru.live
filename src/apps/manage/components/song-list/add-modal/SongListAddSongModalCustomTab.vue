<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { ResponseSongModel, SongRequestOption } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

interface OptionItem {
  label: string
  value: string
}

const props = defineProps<{
  existingSongs: ResponseSongModel[]
  authors: OptionItem[]
  tags: OptionItem[]
  songSelectOption: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
  (e: 'resetRender'): void
}>()

const message = useMessage()

const addSongModel = ref<ResponseSongModel>({} as ResponseSongModel)
const onlyResetNameOnAdded = ref(true)

// 多选 Tag 输入辅助
const authorInput = ref('')
const languageInput = ref('')
const tagInput = ref('')

function addTagItem(field: 'author' | 'language' | 'tags', text: string) {
  const val = text.trim()
  if (!val) return
  if (!addSongModel.value[field]) addSongModel.value[field] = []
  if (!addSongModel.value[field]?.includes(val)) {
    addSongModel.value[field]?.push(val)
  }
}

function removeTagItem(field: 'author' | 'language' | 'tags', idx: number) {
  addSongModel.value[field]?.splice(idx, 1)
}

defineExpose({
  add: addCustomSong,
  canAdd: computed(() => Boolean(addSongModel.value.name?.trim())),
  resetAll: () => resetAddingSong(),
  resetName: () => resetAddingSong(true),
  onlyResetNameOnAdded,
})

function resetAddingSong(onlyName = false) {
  if (onlyName) {
    addSongModel.value.name = ''
    addSongModel.value.description = ''
  } else {
    addSongModel.value = {} as ResponseSongModel
  }
  authorInput.value = ''
  languageInput.value = ''
  tagInput.value = ''

  emit('resetRender')
  message.success('已重置')
}

async function addCustomSong() {
  const name = addSongModel.value.name?.trim()
  if (!name) {
    message.error('请输入歌曲名称')
    return
  }

  if (props.existingSongs.some((s) => s.name === name)) {
    message.error('已存在相同名称的歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    const result = await addSongsToSongList([addSongModel.value], SongPlatform.Custom)
    if (result.code !== 200) {
      message.error(`添加失败: ${result.message}`)
      return
    }

    if (result.data.length !== 1) {
      message.error('未能添加歌曲，已存在相同名称的曲目')
      return
    }

    message.success(`成功添加歌曲: ${name}`)
    emit('added', result.data as unknown as ResponseSongModel[])
    resetAddingSong(onlyResetNameOnAdded.value)
  } catch (err) {
    console.error(err)
    message.error('添加失败')
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="space-y-4 text-xs">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <!-- 歌曲名称 -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">歌曲名称 <span class="text-destructive">*</span></label>
        <Input
          v-model="addSongModel.name"
          placeholder="请输入歌曲名称"
          maxlength="200"
        />
      </div>

      <!-- 作者 (多选) -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">作者 (回车添加)</label>
        <Input
          v-model="authorInput"
          placeholder="输入作者后按回车新增"
          @keyup.enter="
            addTagItem('author', authorInput)
            authorInput = ''
          "
        />
        <div
          v-if="addSongModel.author && addSongModel.author.length > 0"
          class="flex flex-wrap gap-1 pt-1"
        >
          <span
            v-for="(a, idx) in addSongModel.author"
            :key="idx"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px] text-foreground border"
          >
            {{ a }}
            <button
              type="button"
              class="hover:text-destructive"
              @click="removeTagItem('author', idx)"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <!-- 语言 (多选) -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">语言 (可快捷添加或输入)</label>
        <div class="flex items-center gap-2">
          <Input
            v-model="languageInput"
            placeholder="输入语言后回车"
            class="flex-1"
            @keyup.enter="
              addTagItem('language', languageInput)
              languageInput = ''
            "
          />
          <div class="w-32">
            <Select @update:model-value="addTagItem('language', String($event))">
              <SelectTrigger>
                <SelectValue placeholder="快捷选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in songSelectOption"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div
          v-if="addSongModel.language && addSongModel.language.length > 0"
          class="flex flex-wrap gap-1 pt-1"
        >
          <span
            v-for="(l, idx) in addSongModel.language"
            :key="idx"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px] text-foreground border"
          >
            {{ l }}
            <button
              type="button"
              class="hover:text-destructive"
              @click="removeTagItem('language', idx)"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <!-- 标签 (多选) -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">标签 (回车添加)</label>
        <Input
          v-model="tagInput"
          placeholder="输入标签后按回车新增"
          @keyup.enter="
            addTagItem('tags', tagInput)
            tagInput = ''
          "
        />
        <div
          v-if="addSongModel.tags && addSongModel.tags.length > 0"
          class="flex flex-wrap gap-1 pt-1"
        >
          <span
            v-for="(t, idx) in addSongModel.tags"
            :key="idx"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px] text-foreground border"
          >
            {{ t }}
            <button
              type="button"
              class="hover:text-destructive"
              @click="removeTagItem('tags', idx)"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <!-- 试听 / 伴奏链接 -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">试听 / 伴奏链接</label>
        <Input
          v-model="addSongModel.url"
          placeholder="可选，音频直链可直接播放"
        />
      </div>

      <!-- 备注说明 -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-foreground">备注说明</label>
        <Input
          v-model="addSongModel.description"
          placeholder="可选备注说明"
          maxlength="250"
        />
      </div>

      <!-- 独立点歌门槛 -->
      <div class="col-span-full space-y-2 pt-2 border-t">
        <div class="flex items-center gap-1.5">
          <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
            <Checkbox
              :checked="addSongModel.options != null"
              @update:checked="
                (checked: boolean) => {
                  addSongModel.options = checked
                    ? ({
                        needJianzhang: false,
                        needTidu: false,
                        needZongdu: false,
                      } as SongRequestOption)
                    : undefined
                }
              "
            />
            <span>为本首歌曲单独设置点歌门槛</span>
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">启用后将覆盖全局点歌要求，单独控制本首歌曲的点歌门槛。</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          v-if="addSongModel.options != null"
          class="p-3 rounded-lg border border-border bg-muted/20 space-y-3"
        >
          <div class="flex items-center gap-4 flex-wrap text-xs">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox v-model:checked="addSongModel.options.needJianzhang" />
              <span>要求舰长</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox v-model:checked="addSongModel.options.needTidu" />
              <span>要求提督</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox v-model:checked="addSongModel.options.needZongdu" />
              <span>要求总督</span>
            </label>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox
                :checked="addSongModel.options.scMinPrice != null"
                @update:checked="
                  (checked: boolean) => {
                    if (addSongModel.options) addSongModel.options.scMinPrice = checked ? 30 : undefined
                  }
                "
              />
              <span>需要 SC (最低金额)</span>
            </label>
            <NumberField
              v-if="addSongModel.options?.scMinPrice != null"
              v-model="addSongModel.options.scMinPrice"
              :min="30"
              class="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
