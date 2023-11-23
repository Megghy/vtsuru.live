<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongsInfo, UserInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { CloudAdd20Filled } from '@vicons/fluent'
import { NButton, NCard, NCollapse, NCollapseItem, NDivider, NIcon, NTooltip, useMessage } from 'naive-ui'
import { h, ref } from 'vue'
import { Setting_SongRequest, SongRequestInfo } from '@/api/api-models'
import SongRequestOBS from '@/views/obs/SongRequestOBS.vue'

const accountInfo = useAccount()

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  songRequestSettings: Setting_SongRequest
  songRequestActive: SongRequestInfo[]
  currentData: SongsInfo[] | undefined
}>()
const emits = defineEmits(['requestSong'])

const isLoading = ref('')
const message = useMessage()

const buttoms = (song: SongsInfo) => [
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
                  if (song.options || !props.songRequestSettings.allowFromWeb) {
                    navigator.clipboard.writeText(`${props.songRequestSettings.orderPrefix} ${song.name}`)
                    message.success('复制成功')
                  } else {
                    isLoading.value = song.key
                    emits('requestSong', song)
                    isLoading.value = ''
                  }
                },
              },
              {
                icon: () => h(NIcon, { component: CloudAdd20Filled }),
              }
            ),
          default: () =>
            !props.songRequestSettings.allowFromWeb || song.options ? '点歌 | 用户不允许从网页点歌, 点击后将复制点歌内容到剪切板' : !accountInfo ? '点歌 | 你需要登录后才能点歌' : '点歌',
        }
      )
    : undefined,
]
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <SongList v-if="currentData" :songs="currentData ?? []" :is-self="accountInfo?.id == userInfo?.id" :extra-buttom="buttoms" v-bind="$attrs" />
  <NCollapse v-if="userInfo?.canRequestSong">
    <NCollapseItem title="点歌列表">
      <NCard size="small" embedded>
        <div style="height: 400px; width: 700px; max-width: 100%; position: relative; margin: 0 auto">
          <SongRequestOBS :id="userInfo?.id" />
        </div>
      </NCard>
    </NCollapseItem>
  </NCollapse>
  <NDivider />
</template>
