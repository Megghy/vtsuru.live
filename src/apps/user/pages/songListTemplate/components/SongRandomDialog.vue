<script setup lang="ts">
import { Copy, Music, Send, Shuffle } from 'lucide-vue-next'
import { computed } from 'vue'

import type { ResponseSongModel, SettingSongRequest } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { SmartImage } from '@/shared/ui/image'
import { copyToClipboard } from '@/shared/utils'

import { isNewSong } from '../utils/useSongListQueryState'
import SongOptionBadges from './SongOptionBadges.vue'

const props = defineProps<{
  open: boolean
  song: ResponseSongModel | null
  isSelf?: boolean
  liveRequestSettings?: SettingSongRequest
  canReroll?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  reroll: []
  request: [song: ResponseSongModel]
}>()

const danmakuCommand = computed(() => {
  if (!props.song) return ''
  const prefix = props.liveRequestSettings?.orderPrefix ?? ''
  return `${prefix} ${props.song.name}`.trim()
})

async function handleCopyCommand() {
  if (!danmakuCommand.value) return
  await copyToClipboard(danmakuCommand.value, `已复制点歌指令：${danmakuCommand.value}`)
}

function handleRequest() {
  if (!props.song) return
  emit('update:open', false)
  emit('request', props.song)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-sm">
          <Shuffle class="size-4 text-primary" />
          随机抽选结果
        </DialogTitle>
        <DialogDescription class="sr-only">随机抽取到的歌单曲目信息</DialogDescription>
      </DialogHeader>

      <div
        v-if="song"
        class="space-y-3 py-1"
      >
        <div class="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <SmartImage
            v-if="song.cover"
            :src="song.cover"
            :alt="song.name"
            class="size-14 rounded-md object-cover border border-border shrink-0"
          />
          <div
            v-else
            class="size-14 rounded-md bg-muted flex-center shrink-0 text-muted-foreground"
          >
            <Music class="size-5" />
          </div>

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-sm text-foreground break-words">{{ song.name }}</span>
              <Badge
                v-if="isNewSong(song)"
                variant="brand"
                size="xs"
              >
                NEW
              </Badge>
            </div>
            <div
              v-if="song.translateName"
              class="text-xs text-muted-foreground truncate"
            >
              {{ song.translateName }}
            </div>
            <div class="text-xs text-muted-foreground truncate">
              {{ song.author?.length ? song.author.join(' / ') : '未知歌手' }}
            </div>
          </div>
        </div>

        <div
          v-if="song.language?.length || song.tags?.length"
          class="flex flex-wrap gap-1"
        >
          <Badge
            v-for="lang in song.language ?? []"
            :key="`l-${lang}`"
            variant="outline"
            size="xs"
          >
            {{ lang }}
          </Badge>
          <Badge
            v-for="tag in song.tags ?? []"
            :key="`t-${tag}`"
            variant="secondary"
            size="xs"
          >
            {{ tag }}
          </Badge>
        </div>

        <SongOptionBadges
          :options="song.options"
          variant="semantic"
        />

        <p
          v-if="song.description"
          class="text-xs text-muted-foreground m-0 leading-relaxed"
        >
          {{ song.description }}
        </p>
      </div>

      <DialogFooter class="flex-wrap gap-2">
        <Button
          v-if="canReroll"
          type="button"
          variant="outline"
          class="gap-1.5 mr-auto"
          @click="emit('reroll')"
        >
          <Shuffle class="size-3.5" />
          换一首
        </Button>

        <Button
          type="button"
          variant="outline"
          class="gap-1.5"
          @click="handleCopyCommand"
        >
          <Copy class="size-3.5" />
          复制弹幕
        </Button>

        <Button
          v-if="song && !isSelf && !song.isDisabled"
          type="button"
          class="gap-1.5"
          @click="handleRequest"
        >
          <Send class="size-3.5" />
          点这首
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
