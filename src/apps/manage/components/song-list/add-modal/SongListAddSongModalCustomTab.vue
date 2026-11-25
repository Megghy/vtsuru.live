<script setup lang="ts">
import { Info, Sparkles, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseSongModel, SongRequestOption } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { getApiSongListSearchNetease } from '@/api/generated/song-list/song-list'
import { getApiSongListSearchNeteaseList } from '@/api/songRequestExtras'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import SongTagChipInput from '@/components/song-list/SongTagChipInput.vue'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
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

function createEmptyModel(): ResponseSongModel {
  return {
    id: -1,
    key: '',
    name: '',
    translateName: '',
    author: [],
    language: [],
    tags: [],
    url: '',
    externalUrl: '',
    cover: '',
    description: '',
    from: SongPlatform.Custom,
    createTime: 0,
    updateTime: 0,
    isPinned: false,
    isDisabled: false,
  }
}

const addSongModel = ref<ResponseSongModel>(createEmptyModel())
const onlyResetNameOnAdded = ref(true)
const isMatchingNetease = ref(false)
const neteaseCandidates = ref<ResponseSongModel[]>([])

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
    addSongModel.value.translateName = ''
    addSongModel.value.description = ''
    addSongModel.value.url = ''
    addSongModel.value.externalUrl = ''
    addSongModel.value.cover = ''
  } else {
    addSongModel.value = createEmptyModel()
  }

  emit('resetRender')
}

function applyNeteaseCandidate(matched: ResponseSongModel) {
  if (matched.cover) addSongModel.value.cover = matched.cover
  if (matched.translateName) addSongModel.value.translateName = matched.translateName
  if (matched.author?.length) addSongModel.value.author = [...matched.author]
  if (matched.id > 0) addSongModel.value.externalUrl = `https://music.163.com/#/song?id=${matched.id}`
  if (matched.url) addSongModel.value.url = matched.url
  neteaseCandidates.value = []
  message.success(`已匹配网易云曲目《${matched.name}》`)
}

async function handleMatchNetease() {
  const keyword = addSongModel.value.name?.trim()
  if (!keyword) {
    message.warning('请先输入歌曲名称')
    return
  }
  isMatchingNetease.value = true
  neteaseCandidates.value = []
  try {
    try {
      const listRes = await getApiSongListSearchNeteaseList({ keyword, limit: 8 })
      if (listRes.code === 200 && listRes.data?.length) {
        if (listRes.data.length === 1) {
          applyNeteaseCandidate(listRes.data[0])
        } else {
          neteaseCandidates.value = listRes.data
        }
        return
      }
    } catch {
      // 兼容旧后端
    }
    const res = await getApiSongListSearchNetease({ keyword })
    if (res.code !== 200) {
      message.error(res.message || '匹配失败')
      return
    }
    const matched = res.data
    if (!matched) {
      message.info('未在网易云匹配到同名曲目')
      return
    }
    applyNeteaseCandidate(matched)
  } catch (err) {
    message.error(`匹配失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isMatchingNetease.value = false
  }
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
    const result = await addSongsToSongList([{ ...addSongModel.value, name }], SongPlatform.Custom)
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
  <TooltipProvider>
    <div class="space-y-4 text-xs">
      <div
        v-if="neteaseCandidates.length > 0"
        class="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2"
      >
        <div class="flex-between gap-2">
          <span class="font-medium text-foreground">选择要补全的网易云版本（{{ neteaseCandidates.length }} 个候选）</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="关闭候选列表"
            @click="neteaseCandidates = []"
          >
            <X class="size-3.5" />
          </Button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
          <button
            v-for="cand in neteaseCandidates"
            :key="cand.id"
            type="button"
            class="flex items-center gap-2 p-1.5 rounded-md border border-border/70 bg-card hover:border-primary/60 text-left transition-colors min-w-0"
            @click="applyNeteaseCandidate(cand)"
          >
            <img
              v-if="cand.cover"
              :src="cand.cover"
              :alt="cand.name"
              class="size-8 rounded object-cover shrink-0 border border-border/60"
              referrerpolicy="no-referrer"
            />
            <div class="min-w-0 flex-1">
              <div class="font-medium text-foreground truncate">{{ cand.name }}</div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ cand.author?.join(' / ') || '未知歌手' }}{{ cand.translateName ? ` · ${cand.translateName}` : '' }}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="歌曲名称"
          required
          class="min-w-0"
        >
          <div class="flex items-center gap-1.5">
            <Input
              v-model="addSongModel.name"
              placeholder="请输入歌曲名称"
              maxlength="200"
              class="flex-1 min-w-0"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  class="gap-1 shrink-0"
                  :loading="isMatchingNetease"
                  :disabled="!addSongModel.name?.trim()"
                  @click="handleMatchNetease"
                >
                  <Sparkles class="size-3.5" />
                  补全
                </Button>
              </TooltipTrigger>
              <TooltipContent>从网易云自动补全译名、歌手、封面与链接</TooltipContent>
            </Tooltip>
          </div>
        </FormField>

        <FormField
          v-model="addSongModel.translateName"
          type="text"
          label="翻译 / 别名"
          placeholder="可选翻译或别名"
          maxlength="200"
          class="min-w-0"
        />

        <FormField
          label="作者 / 歌手"
          class="min-w-0"
        >
          <SongTagChipInput
            :model-value="addSongModel.author ?? []"
            :options="authors"
            placeholder="输入作者按回车添加"
            @update:model-value="addSongModel.author = $event"
          />
        </FormField>

        <FormField
          label="语言"
          class="min-w-0"
        >
          <SongTagChipInput
            :model-value="addSongModel.language ?? []"
            :options="songSelectOption"
            placeholder="输入语言或点选下方快捷项"
            @update:model-value="addSongModel.language = $event"
          />
        </FormField>

        <FormField
          label="标签"
          class="sm:col-span-2 min-w-0"
        >
          <SongTagChipInput
            :model-value="addSongModel.tags ?? []"
            :options="tags"
            placeholder="输入标签按回车添加，支持包含空格"
            @update:model-value="addSongModel.tags = $event"
          />
        </FormField>

        <FormField
          v-model="addSongModel.url"
          type="text"
          label="音频试听 / 伴奏直链"
          maxlength="500"
          placeholder="可选，音频直链 (.mp3/.flac 等) 可在线试听"
          class="min-w-0"
        />

        <FormField
          v-model="addSongModel.externalUrl"
          type="text"
          label="作品外链 / 翻唱链接"
          maxlength="500"
          placeholder="可选，B站投稿、网易云或5sing页面链接"
          class="min-w-0"
        />

        <FormField
          label="封面图链接"
          class="sm:col-span-2 min-w-0"
        >
          <div class="flex items-center gap-2">
            <Input
              :model-value="addSongModel.cover ?? ''"
              maxlength="500"
              placeholder="可选，封面图片 URL"
              class="flex-1 min-w-0"
              @update:model-value="addSongModel.cover = String($event)"
            />
            <img
              v-if="addSongModel.cover"
              :src="addSongModel.cover"
              alt="封面预览"
              class="size-8 rounded object-cover border border-border shrink-0"
              referrerpolicy="no-referrer"
            />
          </div>
        </FormField>

        <FormField
          v-model="addSongModel.description"
          type="text"
          label="备注说明"
          placeholder="可选备注说明"
          maxlength="250"
          class="sm:col-span-2 min-w-0"
        />

        <div class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <SettingRow
            :model-value="Boolean(addSongModel.isPinned)"
            type="switch"
            variant="compact"
            title="置顶招牌曲目"
            description="优先展示在歌单顶部"
            @update:model-value="addSongModel.isPinned = Boolean($event)"
          />
          <SettingRow
            :model-value="Boolean(addSongModel.isDisabled)"
            type="switch"
            variant="compact"
            title="暂不接歌"
            description="保留展示但暂停观众点歌"
            @update:model-value="addSongModel.isDisabled = Boolean($event)"
          />
        </div>

        <!-- 独立点歌门槛 -->
        <div class="col-span-full space-y-2 pt-2 border-t border-border/60">
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
            <Tooltip>
              <TooltipTrigger as-child>
                <Info class="size-3.5 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">启用后将覆盖全局点歌要求，单独控制本首歌曲的点歌门槛。</p>
              </TooltipContent>
            </Tooltip>
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

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Checkbox
                    :checked="addSongModel.options.scMinPrice != null"
                    @update:checked="
                      (checked: boolean) => {
                        if (addSongModel.options) addSongModel.options.scMinPrice = checked ? 30 : undefined
                      }
                    "
                  />
                  <span>SC ≥</span>
                </label>
                <NumberField
                  v-if="addSongModel.options?.scMinPrice != null"
                  v-model="addSongModel.options.scMinPrice"
                  :min="1"
                  class="w-28"
                />
                <span v-if="addSongModel.options?.scMinPrice != null">元</span>
              </div>

              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Checkbox
                    :checked="addSongModel.options.fanMedalMinLevel != null"
                    @update:checked="
                      (checked: boolean) => {
                        if (addSongModel.options) addSongModel.options.fanMedalMinLevel = checked ? 1 : undefined
                      }
                    "
                  />
                  <span>粉丝牌 ≥</span>
                </label>
                <NumberField
                  v-if="addSongModel.options?.fanMedalMinLevel != null"
                  v-model="addSongModel.options.fanMedalMinLevel"
                  :min="1"
                  class="w-28"
                />
                <span v-if="addSongModel.options?.fanMedalMinLevel != null">级</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
