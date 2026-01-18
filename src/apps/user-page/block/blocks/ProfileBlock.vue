<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAvatar } from 'naive-ui';
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  blockProps: unknown
}>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}

  const avatarFile = (o.avatarFile && typeof o.avatarFile === 'object' && !Array.isArray(o.avatarFile)) ? o.avatarFile : null
  const avatarUrl = (avatarFile && typeof avatarFile.path === 'string' && avatarFile.path)
    ? avatarFile.path
    : ((typeof o.avatarUrl === 'string' && o.avatarUrl) ? o.avatarUrl : props.userInfo?.streamerInfo?.faceUrl)
  const displayName = (typeof o.displayName === 'string' && o.displayName) ? o.displayName : props.userInfo?.name
  const bio = (typeof o.bio === 'string' && o.bio) ? o.bio : props.biliInfo?.sign

  const framed = typeof o.framed === 'boolean' ? o.framed : true
  const backgrounded = typeof o.backgrounded === 'boolean' ? o.backgrounded : true
  return { avatarUrl, displayName, bio, framed, backgrounded }
})
</script>

<template>
  <BlockCard :framed="model.framed" :backgrounded="model.backgrounded" :content-style="{ padding: 0 }">
    <div class="profile-hero">
      <div class="avatar-container">
        <NAvatar
          v-if="model.avatarUrl"
          :src="model.avatarUrl"
          :img-props="{ referrerpolicy: 'no-referrer' }"
          round
          :size="120"
          class="profile-avatar"
        />
        <div class="avatar-glow" />
      </div>

      <div class="profile-info">
        <h1 v-if="model.displayName" class="profile-name">
          {{ model.displayName }}
        </h1>
        <p v-if="model.bio" class="profile-bio">
          {{ model.bio }}
        </p>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.profile-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  position: relative;
  overflow: hidden;
  text-align: center;
}

.avatar-container {
  position: relative;
  margin-bottom: 24px;
}

.profile-avatar {
  border: 4px solid var(--user-page-ui-surface-bg, var(--n-color, rgba(255, 255, 255, 0.7)));
  position: relative;
  z-index: 2;
  box-shadow: 0 12px 24px rgba(0,0,0,0.15);
}

.avatar-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  background: var(--n-primary-color);
  border-radius: 50%;
  opacity: 0.2;
  filter: blur(20px);
  z-index: 1;
}

.profile-name {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin: 0 0 12px;
  background: linear-gradient(135deg, var(--n-text-color) 30%, var(--n-text-color-3, var(--n-text-color)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.profile-bio {
  font-size: 15px;
  line-height: 1.6;
  color: var(--n-text-color-2, var(--n-text-color));
  opacity: 0.8;
  max-width: 500px;
  margin: 0 auto;
  white-space: pre-wrap;
}
</style>
