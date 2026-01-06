<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { useElementSize } from '@vueuse/core'
import { Live24Filled } from '@vicons/fluent'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { roomInfo } from '@/apps/client/data/info'

const accountInfo = useAccount()

const coverRef = ref()
const isHover = ref(false)
const roomCover = computed(() => {
  return isHover.value ? roomInfo.value?.keyframe : roomInfo.value?.user_cover
})
const { height } = useElementSize(coverRef)

function logout() {
  cookie.value = undefined
  window.location.reload()
}
</script>

<template>
  <NFlex
    class="client-index-layout"
    justify="center"
    align="flex-start"
    gap="large"
    wrap
  >
    <CookieInvalidAlert
      class="client-index-alert"
      variant="home"
    />
    <NCard
      title="首页"
      embedded
      size="small"
      class="client-index-card"
    >
      <NFlex
        vertical
        gap="small"
      >
        <NText>
          你好, {{ accountInfo.name }}
        </NText>

        <NDivider style="margin: 8px 0" />

        <NText depth="3" style="font-size: 13px;">
          快速入口
        </NText>

        <NFlex
          vertical
          gap="8"
          style="margin-top: 4px;"
        >
          <NButton
            type="primary"
            block
            class="client-index-quick-entry-button"
            @click="$router.push({ name: 'client-live-manage' })"
          >
            <template #icon>
              <NIcon :component="Live24Filled" />
            </template>
            进入直播管理
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
    <NCard
      title="账号"
      embedded
      class="client-index-card"
    >
      <div>
        <NFlex
          align="center"
          gap="medium"
        >
          <NAvatar
            :src="`${accountInfo.streamerInfo?.faceUrl}@100w`"
            :fallback-src="accountInfo.name[.2]"
            bordered
            round
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />
          <NFlex
            vertical
            size="small"
          >
            <NFlex
              align="center"
              gap="small"
            >
              <NText
                strong
                style="font-size: 1.25rem;"
              >
                {{ accountInfo.name }}
              </NText>
              <NText depth="3">
                ({{ accountInfo.streamerInfo?.name }})
              </NText>
            </NFlex>
            <NText depth="3">
              {{ accountInfo.bindEmail }}
            </NText>
          </NFlex>
        </NFlex>
      </div>
      <template #footer>
        <div style="display: flex; align-items: flex-end; gap: 0.5rem;">
          <NPopconfirm @positive-click="logout">
            <template #trigger>
              <NButton type="error">
                退出登录
              </NButton>
            </template>
            确定要登出吗? B站 Cookie 将需要重新扫描
          </NPopconfirm>
        </div>
      </template>
    </NCard>
    <NCard class="client-index-card">
      <template #header>
        <NSpace align="center">
          直播状态
          <NTag :type="roomInfo?.live_status === 1 ? 'success' : 'error'">
            {{ roomInfo?.live_status === 1 ? '直播中' : '未直播' }}
          </NTag>
        </NSpace>
        <NText
          depth="3"
          style="font-size: 14px"
        >
          当前的直播间信息
        </NText>
      </template>
      <div
        v-if="roomCover"
        style="position: relative"
      >
        <div style="position: relative; width: 100%; max-width: 500px;">
          <NImage
            ref="coverRef"
            :src="roomCover"
            style="width: 100%; opacity: 0.5; border-radius: 8px;"
            referrerpolicy="no-referrer"
            :img-props="{ referrerpolicy: 'no-referrer', style: { width: '100%' } }"
          />
        </div>
        <div
          style="position: absolute; z-index: 1; top: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)"
          :style="{ height: `${height}px`, maxWidth: '500px', cursor: 'pointer' }"
          @click="openUrl(`https://live.bilibili.com/${accountInfo.biliRoomId}`)"
          @mouseenter="isHover = true"
          @mouseleave="isHover = false"
        />
        <NText style="position: absolute; bottom: 12px; left: 16px; z-index: 2; color: white; font-size: 18px">
          {{ roomInfo?.title }}
        </NText>
      </div>
      <template #footer>
        <NSpace align="end">
          <NButton
            type="primary"
            @click="openUrl(`https://live.bilibili.com/${accountInfo.biliRoomId}`)"
          >
            前往直播间
          </NButton>
        </NSpace>
      </template>
    </NCard>
  </NFlex>
</template>

<style scoped>
  .client-index-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
  }

  .client-index-card {
    min-width: 260px;
  }

  .client-index-quick-entry-button + .client-index-quick-entry-button {
    margin-top: 4px;
  }
</style>
