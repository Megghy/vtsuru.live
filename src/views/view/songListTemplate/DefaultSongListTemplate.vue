<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongsInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { SongListConfigType } from '@/data/TemplateTypes'
import LiveRequestOBS from '@/views/obs/LiveRequestOBS.vue'
import { CloudAdd20Filled } from '@vicons/fluent'
import { NButton, NCard, NCollapse, NCollapseItem, NDivider, NIcon, NTooltip, useMessage } from 'naive-ui'
import { h, ref } from 'vue'

const accountInfo = useAccount()

//所有模板都应该有这些
const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const isLoading = ref('')
const message = useMessage()

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
              disabled: !accountInfo,
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
        default: () =>
          !props.liveRequestSettings?.allowFromWeb || song.options
            ? '点歌 | 用户不允许从网页点歌, 点击后将复制点歌内容到剪切板'
            : !accountInfo
              ? '点歌 | 你需要登录后才能点歌'
              : '点歌',
      },
    )
    : undefined,
]
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <SongList
    v-if="data"
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
</template>
