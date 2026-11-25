<script setup lang="ts">
import { Info, Sparkles, X } from 'lucide-vue-next'
import { ref } from 'vue'

import type { ResponseSongModel, SongRequestOption } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { getApiSongListSearchNetease } from '@/api/generated/song-list/song-list'
import { getApiSongListSearchNeteaseList } from '@/api/songRequestExtras'
import SongTagChipInput from '@/components/song-list/SongTagChipInput.vue'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

interface OptionItem {
  label: string
  value: string
}

defineProps<{
  languageOptions: OptionItem[]
  tagOptions: OptionItem[]
  authorOptions: OptionItem[]
}>()

const emit = defineEmits<{
  (e: 'save', song: ResponseSongModel): void
}>()

const show = ref(false)
const model = ref<ResponseSongModel>({} as ResponseSongModel)
const loading = ref(false)
const isMatchingNetease = ref(false)
const neteaseCandidates = ref<ResponseSongModel[]>([])

const PROFICIENCY_OPTIONS = ['拿手', '熟练', '练唱中', '现学']

function open(song: ResponseSongModel) {
  const cloned = JSON.parse(JSON.stringify(song)) as ResponseSongModel
  cloned.author = cloned.author ?? []
  cloned.language = cloned.language ?? []
  cloned.tags = cloned.tags ?? []
  cloned.aliases = cloned.aliases ?? []
  cloned.isPinned = Boolean(cloned.isPinned)
  cloned.isDisabled = Boolean(cloned.isDisabled)
  model.value = cloned
  neteaseCandidates.value = []
  show.value = true
}

function applyNeteaseCandidate(matched: ResponseSongModel, forceOverwrite = false) {
  let filled = 0
  if ((forceOverwrite || !model.value.cover) && matched.cover) {
    model.value.cover = matched.cover
    filled++
  }
  if ((forceOverwrite || !model.value.translateName) && matched.translateName) {
    model.value.translateName = matched.translateName
    filled++
  }
  if (
    (forceOverwrite ||
      !model.value.author?.length ||
      (model.value.author.length === 1 && model.value.author[0] === '未知')) &&
    matched.author?.length
  ) {
    model.value.author = [...matched.author]
    filled++
  }
  if ((forceOverwrite || !model.value.externalUrl) && matched.id > 0) {
    model.value.externalUrl = `https://music.163.com/#/song?id=${matched.id}`
    filled++
  }
  if ((forceOverwrite || !model.value.url) && matched.url) {
    model.value.url = matched.url
    filled++
  }
  neteaseCandidates.value = []
  if (filled === 0) {
    toast.info(`已选择《${matched.name}》，当前字段均已填写无需补充`)
  } else {
    toast.success(`已从网易云《${matched.name}》补充 ${filled} 项信息`)
  }
}

async function handleMatchNetease() {
  const keyword = model.value.name?.trim()
  if (!keyword) {
    toast.warning('请先填写歌曲名称')
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
      // 兼容旧后端：降级到单条搜索接口
    }
    const res = await getApiSongListSearchNetease({ keyword })
    if (res.code !== 200) {
      toast.error(res.message || '匹配失败')
      return
    }
    if (!res.data) {
      toast.info('未在网易云匹配到同名曲目')
      return
    }
    applyNeteaseCandidate(res.data)
  } catch (err) {
    toast.error(`匹配失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isMatchingNetease.value = false
  }
}

function handleSave() {
  if (!model.value.name?.trim()) {
    toast.error('请输入歌曲名称')
    return
  }
  model.value.name = model.value.name.trim()
  loading.value = true
  emit('save', model.value)
}

function close() {
  show.value = false
  loading.value = false
}

defineExpose({ open, close, loading })
</script>

<template>
  <TooltipProvider>
    <Dialog v-model:open="show">
      <DialogContent class="sm:max-w-2xl max-h-[88vh] overflow-y-auto p-4 gap-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <div class="flex-between gap-2 pr-6">
            <DialogTitle class="text-sm truncate">修改歌曲 - {{ model.name || '' }}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="gap-1 shrink-0"
              :loading="isMatchingNetease"
              @click="handleMatchNetease"
            >
              <Sparkles class="size-3.5" />
              补全网易云信息
            </Button>
          </div>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <!-- 网易云多候选选择器 -->
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
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              <button
                v-for="cand in neteaseCandidates"
                :key="cand.id"
                type="button"
                class="flex items-center gap-2 p-1.5 rounded-md border border-border/70 bg-card hover:border-primary/60 text-left transition-colors min-w-0"
                @click="applyNeteaseCandidate(cand, true)"
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
              v-model="model.name"
              type="text"
              label="歌曲名称"
              required
              maxlength="200"
              placeholder="请输入歌曲名称"
              class="min-w-0"
            />

            <FormField
              v-model="model.translateName"
              type="text"
              label="翻译 / 别名"
              maxlength="200"
              placeholder="可选翻译或别名"
              class="min-w-0"
            />

            <FormField
              label="作者 / 歌手"
              class="min-w-0"
            >
              <SongTagChipInput
                :model-value="model.author ?? []"
                :options="authorOptions"
                placeholder="输入作者按回车添加"
                @update:model-value="model.author = $event"
              />
            </FormField>

            <FormField
              label="语言"
              class="min-w-0"
            >
              <SongTagChipInput
                :model-value="model.language ?? []"
                :options="languageOptions"
                placeholder="输入语言或点击下方已有"
                @update:model-value="model.language = $event"
              />
            </FormField>

            <FormField
              label="标签"
              class="sm:col-span-2 min-w-0"
            >
              <SongTagChipInput
                :model-value="model.tags ?? []"
                :options="tagOptions"
                placeholder="输入标签按回车添加，支持包含空格"
                @update:model-value="model.tags = $event"
              />
            </FormField>

            <FormField
              label="点歌别名（用于弹幕简称/容错匹配）"
              class="sm:col-span-2 min-w-0"
            >
              <SongTagChipInput
                :model-value="model.aliases ?? []"
                :options="[]"
                placeholder="如：花火、千本樱；按回车添加"
                @update:model-value="model.aliases = $event"
              />
            </FormField>

            <FormField
              label="熟练度"
              class="min-w-0"
            >
              <Select
                :model-value="model.proficiency || '__none'"
                @update:model-value="model.proficiency = $event === '__none' ? null : String($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="未设置" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">未设置</SelectItem>
                  <SelectItem
                    v-for="p in PROFICIENCY_OPTIONS"
                    :key="p"
                    :value="p"
                  >
                    {{ p }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              v-model="model.keyShift"
              type="text"
              label="常用升降调"
              maxlength="50"
              placeholder="如：原调 / 升2 / 降半音"
              class="min-w-0"
            />

            <FormField
              v-model="model.instrumentalUrl"
              type="text"
              label="伴奏 / 乐谱链接"
              maxlength="500"
              placeholder="可选，伴奏或歌词谱面外链"
              class="sm:col-span-2 min-w-0"
            />

            <FormField
              v-model="model.url"
              type="text"
              label="音频试听 / 伴奏直链"
              maxlength="500"
              :placeholder="
                model.from === SongPlatform.Netease ? '网易云曲目可留空自动生成外链播放' : '音频直链 (.mp3/.flac 等)'
              "
              class="min-w-0"
            />

            <FormField
              v-model="model.externalUrl"
              type="text"
              label="作品外链 / 翻唱链接"
              maxlength="500"
              placeholder="B站投稿、网易云或5sing页面链接"
              class="min-w-0"
            />

            <FormField
              label="封面图链接"
              class="sm:col-span-2 min-w-0"
            >
              <div class="flex items-center gap-2">
                <Input
                  :model-value="model.cover ?? ''"
                  maxlength="500"
                  placeholder="可选，封面图片 URL"
                  class="flex-1 min-w-0"
                  @update:model-value="model.cover = String($event)"
                />
                <img
                  v-if="model.cover"
                  :src="model.cover"
                  alt="封面预览"
                  class="size-8 rounded object-cover border border-border shrink-0"
                  referrerpolicy="no-referrer"
                />
              </div>
            </FormField>
          </div>

          <FormField
            v-model="model.description"
            type="textarea"
            label="备注说明"
            rows="2"
            maxlength="250"
            placeholder="可选备注说明（如调音/合唱/仅片段等）"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <SettingRow
              :model-value="Boolean(model.isPinned)"
              type="switch"
              variant="compact"
              title="置顶招牌曲目"
              description="优先展示在歌单顶部"
              @update:model-value="model.isPinned = Boolean($event)"
            />
            <SettingRow
              :model-value="Boolean(model.isDisabled)"
              type="switch"
              variant="compact"
              title="暂不接歌"
              description="保留展示但暂停观众点歌"
              @update:model-value="model.isDisabled = Boolean($event)"
            />
          </div>

          <!-- 独立点歌门槛 -->
          <div class="space-y-2 pt-2 border-t border-border/60">
            <div class="flex items-center gap-1.5">
              <label class="flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
                <Checkbox
                  :checked="model.options != null"
                  @update:checked="
                    (v: boolean) =>
                      (model.options = v
                        ? ({ needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption)
                        : undefined)
                  "
                />
                <span>为本首歌曲单独设置点歌门槛</span>
              </label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Info class="size-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>启用后将覆盖全局点歌设置，用于单独设置歌曲要求</TooltipContent>
              </Tooltip>
            </div>

            <div
              v-if="model.options"
              class="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-3"
            >
              <div class="flex items-center gap-4 flex-wrap">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needJianzhang" />
                  <span>舰长</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needTidu" />
                  <span>提督</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox v-model:checked="model.options.needZongdu" />
                  <span>总督</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Checkbox
                      :checked="model.options.scMinPrice != null"
                      @update:checked="(v: boolean) => (model.options!.scMinPrice = v ? 30 : undefined)"
                    />
                    <span>SC ≥</span>
                  </label>
                  <NumberField
                    v-if="model.options.scMinPrice != null"
                    v-model="model.options.scMinPrice"
                    :min="1"
                    class="w-28"
                  />
                  <span v-if="model.options.scMinPrice != null">元</span>
                </div>

                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Checkbox
                      :checked="model.options.fanMedalMinLevel != null"
                      @update:checked="(v: boolean) => (model.options!.fanMedalMinLevel = v ? 1 : undefined)"
                    />
                    <span>粉丝牌 ≥</span>
                  </label>
                  <NumberField
                    v-if="model.options.fanMedalMinLevel != null"
                    v-model="model.options.fanMedalMinLevel"
                    :min="1"
                    class="w-28"
                  />
                  <span v-if="model.options.fanMedalMinLevel != null">级</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            @click="show = false"
          >
            取消
          </Button>
          <Button
            :loading="loading"
            @click="handleSave"
          >
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
