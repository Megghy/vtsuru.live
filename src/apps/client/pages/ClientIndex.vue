<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { useElementSize } from '@vueuse/core'

import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import { roomInfo } from '@/apps/client/data/info'
const accountInfo = useAccount()

const coverRef = ref()
const isHover = ref(false)
const roomCover = computed(() => {
  return isHover.value ? roomInfo.value?.keyframe : roomInfo.value?.user_cover
})
const { height } = useElementSize(coverRef)
const liveRoomUrl = computed(() => `https://live.bilibili.com/${accountInfo.value.biliRoomId}`)

function logout() {
  cookie.value = undefined
  window.location.reload()
}
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <UCard
      size="small"
      bordered
    >
      <ClientPageHeader
        title="首页"
        description="客户端状态与常用入口"
      />
    </UCard>

    <CookieInvalidAlert variant="home" />

    <div
      :x-gap="12"
      :y-gap="12"
      cols="1 900:2 1300:3"
      item-responsive
    >
      <div>
        <UCard
          size="small"
          bordered
          title="快速入口"
        >
          <div
            vertical
            :size="8"
          >
            <span> 你好, {{ accountInfo.name }} </span>
            <UButton
              color="primary"
              block
              class="client-index-quick-entry-button"
              @click="$router.push({ name: 'client-live-manage' })"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              进入直播管理
            </UButton>
          </div>
        </UCard>
      </div>

      <div>
        <UCard
          size="small"
          bordered
          title="账号"
        >
          <div
            align="center"
            :size="12"
          >
            <UAvatar
              :src="`${accountInfo.streamerInfo?.faceUrl}@100w`"
              :fallback-src="accountInfo.name?.slice(0, 2)"
              bordered
              round
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <div
              vertical
              :size="4"
              style="min-width: 0"
            >
              <div
                align="center"
                :size="8"
                :wrap="false"
                style="min-width: 0"
              >
                <span style="max-width: 100%">
                  <span
                    strong
                    style="font-size: 16px"
                  >
                    {{ accountInfo.name }}
                  </span>
                </span>
                <span depth="3"> ({{ accountInfo.streamerInfo?.name }}) </span>
              </div>
              <span depth="3">
                {{ accountInfo.bindEmail }}
              </span>
            </div>
          </div>
          <template #footer>
            <UPopover>
              <UButton
                color="error"
                size="sm"
              >
                退出登录
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>确定要登出吗? B站 Cookie 将需要重新扫描</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="error"
                      @click="(close(), logout)"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
          </template>
        </UCard>
      </div>

      <div>
        <UCard
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <template #header>
            <div align="center">
              直播状态
              <UBadge
                :type="roomInfo?.live_status === 1 ? 'success' : 'error'"
                size="small"
                :bordered="false"
              >
                {{ roomInfo?.live_status === 1 ? '直播中' : '未直播' }}
              </UBadge>
            </div>
          </template>

          <div
            v-if="roomCover"
            class="client-index-cover"
          >
            <div
              :style="{ position: 'relative', width: '100%', borderRadius: 'var(--vtsuru-radius)', overflow: 'hidden' }"
            >
              <img
                ref="coverRef"
                :src="roomCover"
                style="width: 100%; opacity: 0.65"
                referrerpolicy="no-referrer"
                :img-props="{ referrerpolicy: 'no-referrer', style: { width: '100%' } }"
              />
            </div>
            <div
              class="client-index-cover__mask"
              :style="{ height: `${height}px` }"
              @click="openUrl(liveRoomUrl)"
              @mouseenter="isHover = true"
              @mouseleave="isHover = false"
            />
            <div class="client-index-cover__title">
              {{ roomInfo?.title }}
            </div>
          </div>
          <div
            v-else
            class="client-index-cover__empty"
          >
            <UEmpty
              size="small"
              description="暂无直播间封面信息"
            />
          </div>

          <div class="client-index-cover__footer">
            <UButton
              color="primary"
              size="small"
              @click="openUrl(liveRoomUrl)"
            >
              前往直播间
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
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
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.15), transparent);
}

.client-index-cover__title {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 12px;
  z-index: 2;
  color: white;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.client-index-cover__empty {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.client-index-cover__footer {
  padding: 12px 16px 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
