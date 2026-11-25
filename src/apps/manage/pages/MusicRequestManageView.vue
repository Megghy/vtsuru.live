<script setup lang="ts">
import { Copy, Disc3, History, ListMusic, Monitor, Power, Settings2 } from 'lucide-vue-next'
import { computed, onActivated, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { AppStartData } from '@/api/generated/model'
import MusicHistoryPanel from '@/apps/manage/pages/music-request/MusicHistoryPanel.vue'
import MusicLibraryPanel from '@/apps/manage/pages/music-request/MusicLibraryPanel.vue'
import MusicRulesPanel from '@/apps/manage/pages/music-request/MusicRulesPanel.vue'
import MusicWaitingPanel from '@/apps/manage/pages/music-request/MusicWaitingPanel.vue'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import LiveConsolePageShell, {
  type LiveConsoleHeaderLink,
  type LiveConsoleTabItem,
} from '@/apps/open-live/components/shared/LiveConsolePageShell.vue'
import ObsStagePreview, { type ObsStageStyleType } from '@/apps/open-live/components/shared/ObsStagePreview.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

defineProps<{
  roomInfo?: AppStartData
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
const danmakuClient = useDanmakuClient()
const musicRequestStore = useMusicRequestProvider()

const activeMainTab = ref<'queue' | 'songlist' | 'history' | 'preview' | 'settings'>('queue')
const selectedObsStyle = ref<ObsStageStyleType>('glass')
const isTogglingEnabled = ref(false)

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/music-request',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params: { style: selectedObsStyle.value },
  }),
)

const headerLinks = computed<LiveConsoleHeaderLink[]>(() => [
  {
    label: 'OBS 浏览器源地址',
    value: obsUrl.value,
    description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600；切换下方预览样式会自动更新此链接',
  },
])

const tabs = computed<LiveConsoleTabItem[]>(() => [
  {
    value: 'queue',
    label: '待播点歌',
    icon: ListMusic,
    badge: musicRequestStore.waitingMusics.length,
  },
  {
    value: 'songlist',
    label: '闲置曲库',
    icon: Disc3,
    badge: musicRequestStore.originMusics.length || undefined,
  },
  { value: 'history', label: '点歌历史', icon: History },
  { value: 'preview', label: 'OBS 预览', icon: Monitor },
  { value: 'settings', label: '规则与屏蔽', icon: Settings2, keepMounted: true },
])

async function toggleAcceptingRequests() {
  if (isTogglingEnabled.value) return
  isTogglingEnabled.value = true
  try {
    const nextEnabled = !musicRequestStore.settings.enabled
    const ok = await musicRequestStore.saveSettings({ enabled: nextEnabled }, { silent: true })
    if (ok) {
      message.success(nextEnabled ? '已开启观众弹幕点歌接单' : '已暂停观众弹幕点歌（不影响当前播放）')
    }
  } finally {
    isTogglingEnabled.value = false
  }
}

function copyWaitingList() {
  const text = formatListForCopy(musicRequestStore.waitingMusics, (item) => `${item.music.name} - ${item.from?.name}`)
  if (!text) {
    message.warning('当前待播点歌清单为空')
    return
  }
  void copyToClipboard(text, '待播点歌清单已复制到剪贴板')
}

function copySongList() {
  const text = formatListForCopy(musicRequestStore.originMusics, (m) => `${m.name} - ${m.author.join('/')}`)
  if (!text) {
    message.warning('当前曲库为空')
    return
  }
  void copyToClipboard(text, '曲库清单已复制到剪贴板')
}

onMounted(() => {
  void danmakuClient.initOpenlive()
  musicRequestStore.startDanmakuListener()
  void musicRequestStore.loadLibrary()
})

onActivated(() => {
  musicRequestStore.startDanmakuListener()
  void musicRequestStore.loadLibrary()
})
</script>

<template>
  <LiveConsolePageShell
    v-model="activeMainTab"
    title="点歌机系统"
    subtitle="自动播放背景音乐并接收弹幕点歌插播，支持多候选搜歌、粉丝牌与大航海规则、以及 OBS 实时排队展示"
    :links="headerLinks"
    :tabs="tabs"
  >
    <template #header-action>
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          :variant="musicRequestStore.settings.enabled ? 'default' : 'outline'"
          :loading="isTogglingEnabled"
          @click="toggleAcceptingRequests"
        >
          <Power class="size-3.5 mr-1" />
          {{ musicRequestStore.settings.enabled ? '接单中' : '已暂停接单' }}
        </Button>

        <Button
          variant="outline"
          @click="copyWaitingList"
        >
          <Copy class="size-3.5 mr-1" />
          复制待播单
        </Button>

        <Button
          variant="outline"
          @click="copySongList"
        >
          <Disc3 class="size-3.5 mr-1" />
          复制曲库
        </Button>
      </div>
    </template>

    <template #queue>
      <MusicWaitingPanel />
    </template>

    <template #songlist>
      <MusicLibraryPanel />
    </template>

    <template #history>
      <MusicHistoryPanel />
    </template>

    <template #preview>
      <ObsStagePreview
        v-model:style-type="selectedObsStyle"
        obs-path="obs/music-request"
        :user-id="accountInfo?.id"
        copy-success-message="点歌机 OBS 源链接已复制 (已携带当前样式参数)"
        recommended-size="推荐 OBS 来源尺寸：宽 380px ~ 420px，高 520px ~ 640px。"
      >
        <template #default="{ styleType, speedMultiplier }">
          <MusicRequestOBS
            :id="accountInfo?.id"
            :key="`${accountInfo?.id}-${styleType}`"
            :theme-style="styleType"
            :speed-multiplier="speedMultiplier"
          />
        </template>
      </ObsStagePreview>
    </template>

    <template #settings>
      <MusicRulesPanel />
    </template>
  </LiveConsolePageShell>
</template>
