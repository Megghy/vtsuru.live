<script setup lang="ts">
import { CheckCircle2, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { getApiSongListSearchNetease, postApiSongListUpdateBatch } from '@/api/generated/song-list/song-list'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Progress } from '@/shared/ui/progress'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { toast } from '@/shared/utils'

const props = defineProps<{
  open: boolean
  songs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  updated: [songs: ResponseSongModel[]]
}>()

const fillCover = ref(true)
const fillAuthor = ref(true)
const fillTranslate = ref(true)
const fillLinks = ref(true)

const isRunning = ref(false)
const isSaving = ref(false)
const abortFlag = ref(false)
const processedCount = ref(0)
const matchedDrafts = ref<Array<{ original: ResponseSongModel; updated: ResponseSongModel; fields: string[] }>>([])

function needsCompletion(song: ResponseSongModel): boolean {
  const missingCover = fillCover.value && !song.cover?.trim()
  const missingAuthor =
    fillAuthor.value && (!song.author?.length || (song.author.length === 1 && song.author[0] === '未知'))
  const missingTranslate = fillTranslate.value && !song.translateName?.trim()
  const missingLinks = fillLinks.value && (!song.url?.trim() || !song.externalUrl?.trim())
  return missingCover || missingAuthor || missingTranslate || missingLinks
}

const targetSongs = computed(() => props.songs.filter(needsCompletion))
const progressPercent = computed(() => {
  if (targetSongs.value.length === 0) return 0
  return Math.min(100, Math.round((processedCount.value / targetSongs.value.length) * 100))
})

async function startScan() {
  const queue = targetSongs.value.slice(0, 60)
  if (queue.length === 0) {
    toast.info('当前所有曲目的所选字段均已完整')
    return
  }

  isRunning.value = true
  abortFlag.value = false
  processedCount.value = 0
  matchedDrafts.value = []

  for (const song of queue) {
    if (abortFlag.value) break
    try {
      const kw = [song.name, song.author?.[0] && song.author[0] !== '未知' ? song.author[0] : '']
        .filter(Boolean)
        .join(' ')
      const res = await getApiSongListSearchNetease({ keyword: kw })
      if (res.code === 200 && res.data) {
        const matched = res.data
        const next: ResponseSongModel = { ...song }
        const fields: string[] = []

        if (fillCover.value && !next.cover?.trim() && matched.cover) {
          next.cover = matched.cover
          fields.push('封面')
        }
        if (
          fillAuthor.value &&
          (!next.author?.length || (next.author.length === 1 && next.author[0] === '未知')) &&
          matched.author?.length
        ) {
          next.author = [...matched.author]
          fields.push('原唱')
        }
        if (fillTranslate.value && !next.translateName?.trim() && matched.translateName) {
          next.translateName = matched.translateName
          fields.push('译名')
        }
        if (fillLinks.value && !next.url?.trim() && matched.url) {
          next.url = matched.url
          fields.push('试听')
        }
        if (fillLinks.value && !next.externalUrl?.trim() && matched.id > 0) {
          next.externalUrl = `https://music.163.com/#/song?id=${matched.id}`
          fields.push('外链')
        }
        if (fields.length > 0) {
          matchedDrafts.value.push({ original: song, updated: next, fields })
        }
      }
    } catch {
      // 单首失败跳过继续
    } finally {
      processedCount.value++
    }
  }

  isRunning.value = false
  if (matchedDrafts.value.length === 0) {
    toast.info('本次扫描未找到可补充的新信息')
  } else {
    toast.success(`扫描完成，可补全 ${matchedDrafts.value.length} 首曲目`)
  }
}

async function applyUpdates() {
  if (matchedDrafts.value.length === 0 || isSaving.value) return
  isSaving.value = true
  try {
    const payload = matchedDrafts.value.map((d) => ({
      key: d.updated.key,
      song: d.updated as never,
    }))
    const res = await postApiSongListUpdateBatch(payload)
    if (res.code === 200 && res.data) {
      toast.success(`已批量补全并保存 ${res.data.length} 首曲目`)
      emit('updated', res.data)
      matchedDrafts.value = []
      emit('update:open', false)
    } else {
      toast.error(res.message || '批量保存失败')
    }
  } catch (err) {
    toast.error(`批量保存失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSaving.value = false
  }
}

function handleClose(val: boolean) {
  if (!val) {
    abortFlag.value = true
  }
  emit('update:open', val)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-1.5">
          <Sparkles class="size-4 text-primary" />
          批量补全曲目信息
        </DialogTitle>
        <DialogDescription>
          自动检索网易云补齐缺失的封面、原唱、译名与试听链接（单次最多扫描 60 首，仅填补空缺字段不覆盖已有信息）。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 text-xs">
        <div class="flex flex-wrap items-center gap-4 rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              v-model:checked="fillCover"
              :disabled="isRunning"
            />
            <span>封面图</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              v-model:checked="fillAuthor"
              :disabled="isRunning"
            />
            <span>原唱</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              v-model:checked="fillTranslate"
              :disabled="isRunning"
            />
            <span>译名</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              v-model:checked="fillLinks"
              :disabled="isRunning"
            />
            <span>试听与外链</span>
          </label>
        </div>

        <div class="flex-between gap-2">
          <span class="text-muted-foreground tabular-nums">
            当前检测到 <strong class="text-foreground">{{ targetSongs.length }}</strong> 首曲目待完善
          </span>
          <div class="flex items-center gap-1.5">
            <Button
              v-if="isRunning"
              size="xs"
              variant="outline"
              @click="abortFlag = true"
            >
              停止扫描
            </Button>
            <Button
              v-else
              size="xs"
              variant="secondary"
              :disabled="targetSongs.length === 0"
              @click="startScan"
            >
              <Sparkles class="size-3.5 mr-1" />
              开始匹配 (最多 60 首)
            </Button>
          </div>
        </div>

        <div
          v-if="isRunning || processedCount > 0"
          class="space-y-1"
        >
          <Progress :model-value="progressPercent" />
          <div class="flex-between text-[11px] text-muted-foreground tabular-nums">
            <span>已扫描 {{ processedCount }} / {{ Math.min(targetSongs.length, 60) }}</span>
            <span>匹配成功 {{ matchedDrafts.length }} 首</span>
          </div>
        </div>

        <ScrollArea
          v-if="matchedDrafts.length > 0"
          class="h-52 rounded-md border border-border/70 p-2"
        >
          <div class="space-y-1.5">
            <div
              v-for="item in matchedDrafts"
              :key="item.updated.key"
              class="flex items-center justify-between gap-2 rounded border border-border/60 bg-card px-2.5 py-1.5"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img
                  v-if="item.updated.cover"
                  :src="item.updated.cover"
                  :alt="item.updated.name"
                  class="size-7 rounded object-cover shrink-0 border border-border/50"
                  referrerpolicy="no-referrer"
                />
                <div class="min-w-0">
                  <div class="font-medium text-foreground truncate">{{ item.updated.name }}</div>
                  <div class="text-[11px] text-muted-foreground truncate">
                    {{ item.updated.author?.join(' / ') || '未知歌手' }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Badge
                  v-for="f in item.fields"
                  :key="f"
                  variant="secondary"
                  size="xs"
                >
                  +{{ f }}
                </Badge>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose(false)"
        >
          关闭
        </Button>
        <Button
          :loading="isSaving"
          :disabled="isRunning || matchedDrafts.length === 0"
          @click="applyUpdates"
        >
          <CheckCircle2 class="size-3.5 mr-1" />
          保存这 {{ matchedDrafts.length }} 首补全结果
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
