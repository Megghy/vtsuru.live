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
    : props.userInfo?.streamerInfo?.faceUrl
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
          :img-props="{ referrerpolicy: 'no-referrer', loading: 'lazy', decoding: 'async', alt: model.displayName || '用户头像' }"
          round
          :size="120"
          class="profile-avatar"
        />
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
  border: 4px solid var(--vtsuru-block-bg-muted);
  position: relative;
  z-index: 2;
  box-shadow: var(--vtsuru-page-shadow);
}

.profile-name {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0;
  margin: 0 0 12px;
  color: var(--vtsuru-block-fg);
}

.profile-bio {
  font-size: 15px;
  line-height: 1.6;
  color: var(--vtsuru-block-fg-muted);
  max-width: 500px;
  margin: 0 auto;
  white-space: pre-wrap;
}
</style>
