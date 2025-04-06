<script setup lang="ts">
  import { useAccount } from '@/api/account';
import { useWebFetcher } from '@/store/useWebFetcher';
import { openUrl } from '@tauri-apps/plugin-opener';
  import { useElementSize } from '@vueuse/core';
import { roomInfo, streamingInfo } from './data/info';

  const accountInfo = useAccount();
  const cookie = useLocalStorage('JWT_Token', '')

  const webfetcher = useWebFetcher();

  const coverRef = ref();
  const { width, height } = useElementSize(coverRef);

  function logout() {
    cookie.value = undefined;
    window.location.reload();
  }
</script>

<template>
  <NFlex
    justify="center"
    align="center"
    gap="large"
  >
    <NCard
      title="首页"
      embedded
      size="small"
    >
      <div>
        你好, {{ accountInfo.name }}
      </div>
    </NCard>
    <NCard
      title="账号"
      embedded
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
    <NCard>
      <template #header>
        <NSpace align="center">
          直播状态
          <NTag
            :type="!accountInfo.streamerInfo?.isStreaming ? 'error' : 'success'"
          >
            {{ !accountInfo.streamerInfo?.isStreaming ? '未直播' : '直播中' }}
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
        v-if="roomInfo?.user_cover"
        style="position: relative"
      >
        <div
          style="position: relative; width: 100%; max-width: 500px;"
        >
          <NImage
            ref="coverRef"
            :src="roomInfo?.user_cover"
            style="width: 100%; opacity: 0.5; border-radius: 8px;"
            referrerpolicy="no-referrer"
            :img-props="{ referrerpolicy: 'no-referrer', style: { width: '100%'} }"
          />
        </div>
        <div
          style="position: absolute; z-index: 1; top: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)"
          :style="{ height: `${height}px`, maxWidth: '500px', cursor: 'pointer' }"
          @click="openUrl(`https://live.bilibili.com/${accountInfo.biliRoomId}`)"
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