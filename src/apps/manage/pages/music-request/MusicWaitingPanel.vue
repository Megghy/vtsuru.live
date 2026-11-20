<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowNext20Filled from '@vicons/fluent/es/ArrowNext20Filled'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import MusicNote224Filled from '@vicons/fluent/es/MusicNote224Filled'
import Play24Regular from '@vicons/fluent/es/Play24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import Timer24Regular from '@vicons/fluent/es/Timer24Regular'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import MusicRequestItem from '@/apps/open-live/components/request/MusicRequestItem.vue'
import LiveActiveFocusCard from '@/apps/open-live/components/shared/LiveActiveFocusCard.vue'
import LiveConsoleCockpit from '@/apps/open-live/components/shared/LiveConsoleCockpit.vue'
import LiveSideCard from '@/apps/open-live/components/shared/LiveSideCard.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { useMessage } from '@/shared/utils'
import { useMusicRequestProvider, type WaitMusicInfo } from '@/store/useMusicRequest'

import { useActiveMusicCooldowns } from './useActiveMusicCooldowns'

const message = useMessage()
const accountInfo = useAccount()
const musicRequestStore = useMusicRequestProvider()

const waitingFilter = ref('')
const quickSearchKeyword = ref('')
const quickPlatform = ref<'netease' | 'kugou'>(musicRequestStore.settings.platform ?? 'netease')
const quickSearchResult = ref<ResponseSongModel | null>(null)

interface IndexedWaitingItem {
  info: WaitMusicInfo
  originalIndex: number
}

const indexedWaiting = computed<IndexedWaitingItem[]>(() =>
  musicRequestStore.waitingMusics.map((info, originalIndex) => ({
    info,
    originalIndex,
  })),
)

const filteredWaiting = computed(() => {
  const kw = waitingFilter.value.trim().toLowerCase()
  if (!kw) return indexedWaiting.value
  return indexedWaiting.value.filter(
    ({ info }) =>
      info.music.name.toLowerCase().includes(kw) ||
      (info.from?.name || '').toLowerCase().includes(kw) ||
      (info.music.author || []).some((a) => a.toLowerCase().includes(kw)),
  )
})

const isFiltered = computed(() => waitingFilter.value.trim().length > 0)

const activeCooldowns = useActiveMusicCooldowns()

function createHostRequester() {
  return {
    name: accountInfo.value?.name || '主播手动点歌',
    uid: accountInfo.value?.biliId ?? 0,
    oid: '',
    guard_level: 0,
    fans_medal_level: 0,
    fans_medal_name: '',
    fans_medal_wearing_status: false,
    face: '',
  }
}

async function handleQuickSearch() {
  const kw = quickSearchKeyword.value.trim()
  if (!kw) {
    message.warning('请输入要搜索的歌曲关键词')
    return
  }
  const song = await musicRequestStore.searchOnlineSong(kw, quickPlatform.value)
  if (!song) {
    quickSearchResult.value = null
    message.warning(`未搜索到匹配「${kw}」的歌曲`)
    return
  }
  quickSearchResult.value = song
}

function enqueueQuickResult(playNow: boolean) {
  const song = quickSearchResult.value
  if (!song) return
  const info: WaitMusicInfo = {
    from: createHostRequester(),
    music: song,
  }
  if (playNow) {
    musicRequestStore.playWaitingItemNow(info)
  } else {
    musicRequestStore.addWaitingMusic(info, { queueOnly: true })
  }
  quickSearchResult.value = null
  quickSearchKeyword.value = ''
}
</script>

<template>
  <LiveConsoleCockpit>
    <template #main>
      <LiveActiveFocusCard
        v-if="musicRequestStore.currentOriginMusic && musicRequestStore.isPlayingOrderMusic"
        badge-label="正在点播"
        :badge-icon="MusicNote224Filled"
        :title="musicRequestStore.currentOriginMusic.music.name"
        :subtitle="musicRequestStore.currentOriginMusic.music.author?.join('/')"
      >
        <template #meta>
          <Badge
            variant="outline"
            size="xs"
            class="border-sky-500/40 text-sky-600 bg-sky-500/10"
          >
            点歌人: {{ musicRequestStore.currentOriginMusic.from?.name || '观众' }}
          </Badge>
        </template>

        <template #actions>
          <Button
            size="xs"
            variant="outline"
            @click="musicRequestStore.nextMusic()"
          >
            <ArrowNext20Filled class="size-3.5 mr-1" />
            切下一首
          </Button>
        </template>
      </LiveActiveFocusCard>

      <Card>
        <CardContent class="p-3.5 space-y-3">
          <div class="flex-between gap-2.5 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <Badge variant="brand"> 待播歌曲: {{ musicRequestStore.waitingMusics.length }} 首 </Badge>
              <Badge
                v-if="activeCooldowns.length > 0"
                variant="warning"
              >
                冷却中观众: {{ activeCooldowns.length }} 人
              </Badge>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <div class="relative w-52 max-w-full">
                <Search24Regular
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                />
                <Input
                  v-model="waitingFilter"
                  placeholder="搜索待播歌名或点歌人"
                  class="pl-8 pr-7"
                />
                <button
                  v-if="waitingFilter"
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="清空搜索"
                  @click="waitingFilter = ''"
                >
                  <Dismiss16Filled class="size-3" />
                </button>
              </div>

              <Button
                variant="ghost"
                class="text-destructive hover:bg-destructive/10"
                :disabled="musicRequestStore.waitingMusics.length === 0"
                @click="musicRequestStore.clearWaitingWithUndo()"
              >
                清空待播
              </Button>
            </div>
          </div>

          <Separator />

          <div
            v-if="filteredWaiting.length > 0"
            class="space-y-2"
          >
            <MusicRequestItem
              v-for="{ info, originalIndex } in filteredWaiting"
              :key="info.requestId || `${info.music.id}-${info.from?.name || ''}-${originalIndex}`"
              :music="info.music"
              :from-name="info.from?.name || ''"
              :index="originalIndex + 1"
              :can-block-user="Boolean(info.from?.uid || info.from?.oid)"
              :can-move-up="!isFiltered && originalIndex > 0"
              :can-move-down="!isFiltered && originalIndex < musicRequestStore.waitingMusics.length - 1"
              @play="musicRequestStore.playWaitingItemNow(info)"
              @cancel="musicRequestStore.cancelWaiting(info)"
              @block-song="musicRequestStore.blockSongKeyword(info)"
              @block-user="musicRequestStore.blockUser(info)"
              @pin="musicRequestStore.pinWaiting(originalIndex)"
              @move-up="musicRequestStore.moveWaiting(originalIndex, 'up')"
              @move-down="musicRequestStore.moveWaiting(originalIndex, 'down')"
            />
          </div>
          <div
            v-else
            class="text-center py-12 text-xs text-muted-foreground"
          >
            {{ waitingFilter ? '没有匹配的待播歌曲' : '当前暂无观众点歌，等待弹幕发送中...' }}
          </div>
        </CardContent>
      </Card>
    </template>

    <template #aside>
      <LiveSideCard title="在线搜歌快捷切播">
        <template #header-action>
          <Button
            size="xs"
            variant="outline"
            @click="quickPlatform = quickPlatform === 'netease' ? 'kugou' : 'netease'"
          >
            {{ quickPlatform === 'netease' ? '网易云' : '酷狗' }}
          </Button>
        </template>

        <div class="space-y-2.5">
          <div class="flex items-center gap-2">
            <Input
              v-model="quickSearchKeyword"
              placeholder="输入歌名或歌手..."
              class="flex-1 min-w-0"
              @keyup.enter="handleQuickSearch"
            />
            <Button
              :loading="musicRequestStore.isSearchingSong"
              @click="handleQuickSearch"
            >
              <Search24Regular class="size-4 mr-1" />
              搜歌
            </Button>
          </div>

          <div
            v-if="quickSearchResult"
            class="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5 text-xs"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Badge
                :variant="quickSearchResult.from === SongPlatform.Netease ? 'destructive' : 'outline'"
                size="xs"
                class="shrink-0"
              >
                {{ quickSearchResult.from === SongPlatform.Netease ? '网易云' : '酷狗' }}
              </Badge>
              <span class="font-medium text-foreground truncate">{{ quickSearchResult.name }}</span>
              <span class="text-muted-foreground truncate">{{ quickSearchResult.author?.join('/') }}</span>
            </div>

            <div class="flex items-center justify-end gap-2">
              <Button
                size="xs"
                variant="outline"
                @click="enqueueQuickResult(false)"
              >
                <Add24Regular class="size-3.5 mr-1" />
                加入待播
              </Button>
              <Button
                size="xs"
                @click="enqueueQuickResult(true)"
              >
                <Play24Regular class="size-3.5 mr-1" />
                立即切播
              </Button>
            </div>
          </div>
        </div>
      </LiveSideCard>

      <LiveSideCard
        title="点歌冷却监控"
        :icon="Timer24Regular"
        icon-class="text-amber-500"
        :badge="activeCooldowns.length > 0 ? activeCooldowns.length : null"
        badge-variant="warning"
      >
        <template
          v-if="activeCooldowns.length > 0"
          #header-action
        >
          <Button
            size="xs"
            variant="ghost"
            class="text-amber-600 hover:bg-amber-500/10"
            @click="musicRequestStore.clearAllCooldowns()"
          >
            解除全部
          </Button>
        </template>

        <div
          v-if="activeCooldowns.length > 0"
          class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto scrollbar-thin"
        >
          <Badge
            v-for="cd in activeCooldowns"
            :key="cd.userKey"
            variant="warning"
            class="gap-1.5 pr-1"
          >
            <span>{{ cd.name }} (剩 {{ cd.remain }}s)</span>
            <button
              type="button"
              class="rounded-full p-0.5 hover:bg-black/10 transition-colors"
              aria-label="解除该观众冷却"
              @click="musicRequestStore.clearCooldown(cd.userKey)"
            >
              <Dismiss16Filled class="size-3" />
            </button>
          </Badge>
        </div>
        <div
          v-else
          class="py-4 text-center text-xs text-muted-foreground"
        >
          当前暂无观众处于点歌冷却期
        </div>
      </LiveSideCard>
    </template>
  </LiveConsoleCockpit>
</template>
