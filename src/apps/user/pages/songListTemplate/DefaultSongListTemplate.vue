<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'
import { ChevronLeft24Filled, ChevronRight24Filled, CloudAdd20Filled } from '@vicons/fluent'
import { h, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongList from '@/components/SongList.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { useBiliAuth } from '@/store/useBiliAuth'

import { getSongRequestTooltip } from './utils/songRequestUtils'

// 所有模板都应该有这些
const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])
const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const isLoading = ref('')
const songListRef = ref<InstanceType<typeof SongList> | null>(null)

// 处理翻页逻辑
function handlePrevPage() {
  if (songListRef.value) {
    songListRef.value.prevPage()
  }
}

function handleNextPage() {
  if (songListRef.value) {
    songListRef.value.nextPage()
  }
}

// 键盘快捷键处理函数
function handleKeyDown(event: KeyboardEvent) {
  // 忽略在输入框内的按键
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  ) {
    return
  }

  // 左方向键 - 上一页
  if (event.key === 'ArrowLeft') {
    handlePrevPage()
    event.preventDefault()
  }
  // 右方向键 - 下一页
  else if (event.key === 'ArrowRight') {
    handleNextPage()
    event.preventDefault()
  }
}

// 添加和移除事件监听器
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

function buttons(song: SongsInfo) {
  return [
    accountInfo.value?.id !== props.userInfo?.id
      ? h(
          UTooltip,
          {
            text: getSongRequestTooltip(song, props.liveRequestSettings, {
              isLoggedIn: !!accountInfo.value.id,
              isBiliAuthed: biliAuth.isAuthed,
            }),
          },
          {
            default: () =>
              h(
                UButton,
                {
                  color: 'warning',
                  size: 'sm',
                  square: true,
                  loading: isLoading.value === song.key,
                  disabled: !accountInfo.value,
                  onClick: () => {
                    isLoading.value = song.key
                    emits('requestSong', song)
                    window.setTimeout(() => {
                      isLoading.value = ''
                    }, 2000)
                  },
                },
                {
                  leading: () => h(CloudAdd20Filled),
                },
              ),
          },
        )
      : undefined,
  ]
}
</script>

<template>
  <div class="song-list-container">
    <USeparator style="margin-top: 10px" />
    <!-- 左侧翻页按钮 -->
    <div class="page-button page-button-left">
      <UButton
        square
        variant="soft"
        size="lg"
        title="上一页 (←)"
        @click="handlePrevPage"
      >
        <template #leading>
          <component :is="ChevronLeft24Filled" />
        </template>
      </UButton>
    </div>

    <!-- 右侧翻页按钮 -->
    <div class="page-button page-button-right">
      <UButton
        square
        variant="soft"
        size="lg"
        title="下一页 (→)"
        @click="handleNextPage"
      >
        <template #leading>
          <component :is="ChevronRight24Filled" />
        </template>
      </UButton>
    </div>

    <SongList
      v-if="data"
      ref="songListRef"
      :songs="data ?? []"
      :is-self="accountInfo?.id === userInfo?.id"
      :extra-button="buttons"
      :live-request-active="liveRequestActive"
      v-bind="$attrs"
    />
    <div v-if="userInfo?.canRequestSong">
      <UCollapsible>
        <UButton
          color="neutral"
          variant="soft"
          label="点歌列表"
          trailing-icon="i-lucide-chevron-down"
        />
        <template #content>
          <UCard
            size="small"
            variant="soft"
            class="user-page-card"
          >
            <div style="height: 400px; width: 700px; max-width: 100%; position: relative; margin: 0 auto">
              <LiveRequestOBS :id="userInfo?.id" />
            </div>
          </UCard>
        </template>
      </UCollapsible>
    </div>
    <USeparator />
  </div>
</template>

<style scoped>
.song-list-container {
  position: relative;
}

.page-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}

.page-button-left {
  left: -20px;
}

.page-button-right {
  right: -20px;
}

@media (max-width: 768px) {
  .page-button-left {
    left: 0;
  }

  .page-button-right {
    right: 0;
  }
}
</style>
