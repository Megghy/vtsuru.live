<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { useElementSize } from '@vueuse/core'
import { Live24Filled } from '@vicons/fluent'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { roomInfo } from '@/apps/client/data/info'
import { useThemeVars } from 'naive-ui';
const accountInfo = useAccount()
const themeVars = useThemeVars()

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
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <ClientPageHeader
        title="首页"
        description="客户端状态与常用入口"
      />
    </NCard>

    <CookieInvalidAlert variant="home" />

    <NGrid
      :x-gap="12"
      :y-gap="12"
      cols="1 900:2 1300:3"
      item-responsive
    >
      <NGridItem>
        <NCard size="small" bordered title="快速入口">
          <NFlex vertical :size="8">
            <NText>
              你好, {{ accountInfo.name }}
            </NText>
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
        </NCard>
      </NGridItem>

      <NGridItem>
        <NCard size="small" bordered title="账号">
          <NFlex align="center" :size="12">
            <NAvatar
              :src="`${accountInfo.streamerInfo?.faceUrl}@100w`"
              :fallback-src="accountInfo.name[.2]"
              bordered
              round
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <NFlex vertical :size="4" style="min-width: 0;">
              <NFlex align="center" :size="8" :wrap="false" style="min-width: 0;">
                <NEllipsis style="max-width: 100%;">
                  <NText strong style="font-size: 16px;">
                    {{ accountInfo.name }}
                  </NText>
                </NEllipsis>
                <NText depth="3">
                  ({{ accountInfo.streamerInfo?.name }})
                </NText>
              </NFlex>
              <NText depth="3">
                {{ accountInfo.bindEmail }}
              </NText>
            </NFlex>
          </NFlex>
          <template #footer>
            <NPopconfirm @positive-click="logout">
              <template #trigger>
                <NButton type="error" size="small">
                  退出登录
                </NButton>
              </template>
              确定要登出吗? B站 Cookie 将需要重新扫描
            </NPopconfirm>
          </template>
        </NCard>
      </NGridItem>

      <NGridItem>
        <NCard
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <template #header>
            <NFlex align="center">
              直播状态
              <NTag :type="roomInfo?.live_status === 1 ? 'success' : 'error'" size="small" :bordered="false">
                {{ roomInfo?.live_status === 1 ? '直播中' : '未直播' }}
              </NTag>
            </NFlex>
          </template>

          <div v-if="roomCover" class="client-index-cover">
            <div :style="{ position: 'relative', width: '100%', borderRadius: themeVars.borderRadius, overflow: 'hidden' }">
              <NImage
                ref="coverRef"
                :src="roomCover"
                style="width: 100%; opacity: 0.65;"
                referrerpolicy="no-referrer"
                :img-props="{ referrerpolicy: 'no-referrer', style: { width: '100%' } }"
              />
            </div>
            <div
              class="client-index-cover__mask"
              :style="{ height: `${height}px` }"
              @click="openUrl(`https://live.bilibili.com/${accountInfo.biliRoomId}`)"
              @mouseenter="isHover = true"
              @mouseleave="isHover = false"
            />
            <div class="client-index-cover__title">
              {{ roomInfo?.title }}
            </div>
          </div>
          <div v-else class="client-index-cover__empty">
            <NText depth="3">
              暂无直播间封面信息
            </NText>
          </div>

          <div class="client-index-cover__footer">
            <NButton
              type="primary"
              size="small"
              @click="openUrl(`https://live.bilibili.com/${accountInfo.biliRoomId}`)"
            >
              前往直播间
            </NButton>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>
  </NFlex>
</template>

<style scoped>
  .client-index-quick-entry-button + .client-index-quick-entry-button {
    margin-top: 4px;
  }

  .client-index-cover {
    position: relative;
  }

  .client-index-cover__mask {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    cursor: pointer;
    background: linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.15), transparent);
  }

  .client-index-cover__title {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 12px;
    z-index: 2;
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .client-index-cover__empty {
    padding: 14px;
  }

  .client-index-cover__footer {
    padding: 12px 14px 14px;
    display: flex;
    justify-content: flex-end;
  }
</style>
