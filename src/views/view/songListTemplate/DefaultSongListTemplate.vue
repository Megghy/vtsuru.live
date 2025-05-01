<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongsInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { SongListConfigType } from '@/data/TemplateTypes'
import LiveRequestOBS from '@/views/obs/LiveRequestOBS.vue'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { CloudAdd20Filled, ChevronLeft24Filled, ChevronRight24Filled } from '@vicons/fluent'
import { NButton, NCard, NCollapse, NCollapseItem, NDivider, NIcon, NTooltip, useMessage } from 'naive-ui'
import { h, ref, onMounted, onUnmounted } from 'vue'
import { useBiliAuth } from '@/store/useBiliAuth'

const accountInfo = useAccount()
const biliAuth = useBiliAuth()

//所有模板都应该有这些
const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const isLoading = ref('')
const message = useMessage()
const songListRef = ref<InstanceType<typeof SongList> | null>(null)

// 处理翻页逻辑
const handlePrevPage = () => {
  if (songListRef.value) {
    songListRef.value.prevPage()
  }
}

const handleNextPage = () => {
  if (songListRef.value) {
    songListRef.value.nextPage()
  }
}

// 键盘快捷键处理函数
const handleKeyDown = (event: KeyboardEvent) => {
  // 忽略在输入框内的按键
  if (event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement) {
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

const buttons = (song: SongsInfo) => [
  accountInfo.value?.id != props.userInfo?.id
    ? h(
      NTooltip,
      { trigger: 'hover' },
      {
        trigger: () =>
          h(
            NButton,
            {
              type: 'warning',
              size: 'small',
              circle: true,
              loading: isLoading.value == song.key,
              disabled: !accountInfo.value,
              onClick: () => {
                isLoading.value = song.key
                emits('requestSong', song)
                isLoading.value = ''
              },
            },
            {
              icon: () => h(NIcon, { component: CloudAdd20Filled }),
            },
          ),
        default: () => getSongRequestTooltip(song, props.liveRequestSettings)
      },
    )
    : undefined,
]
</script>

<template>
  <div class="song-list-container">
    <NDivider style="margin-top: 10px" />
    <!-- 左侧翻页按钮 -->
    <div class="page-button page-button-left">
      <NButton
        circle
        secondary
        size="large"
        title="上一页 (←)"
        @click="handlePrevPage"
      >
        <template #icon>
          <NIcon :component="ChevronLeft24Filled" />
        </template>
      </NButton>
    </div>

    <!-- 右侧翻页按钮 -->
    <div class="page-button page-button-right">
      <NButton
        circle
        secondary
        size="large"
        title="下一页 (→)"
        @click="handleNextPage"
      >
        <template #icon>
          <NIcon :component="ChevronRight24Filled" />
        </template>
      </NButton>
    </div>

    <SongList
      v-if="data"
      ref="songListRef"
      :songs="data ?? []"
      :is-self="accountInfo?.id == userInfo?.id"
      :extra-button="buttons"
      v-bind="$attrs"
    />
    <NCollapse v-if="userInfo?.canRequestSong">
      <NCollapseItem title="点歌列表">
        <NCard
          size="small"
          embedded
        >
          <div style="height: 400px; width: 700px; max-width: 100%; position: relative; margin: 0 auto">
            <LiveRequestOBS :id="userInfo?.id" />
          </div>
        </NCard>
      </NCollapseItem>
    </NCollapse>
    <NDivider />
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
