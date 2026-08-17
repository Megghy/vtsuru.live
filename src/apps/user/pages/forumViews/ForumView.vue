<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NFlex,
  NInput,
  NList,
  NListItem,
  NModal,
  NSpin,
  NText,
  NTime,
} from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { UserInfo } from '@/api/api-models'
import type { ForumPostTopicModel, ForumTopicBaseModel } from '@/api/models/forum'
import { ForumTopicSortTypes, ForumUserLevels } from '@/api/models/forum'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useForumStore } from '@/store/useForumStore'

import ForumPreviewItem from './ForumPreviewItem.vue'

const { userInfo } = defineProps<{
  userInfo: UserInfo | undefined
}>()
const accountInfo = useAccount()
const token = ref('')
const turnstile = ref()
const editor = ref()

const postTopicBackup = usePersistedStorage<{ [key: number]: ForumPostTopicModel }>('Forum.PostTopic', {})
const showPostTopicModal = ref(false)
const currentPostTopicModel = ref<ForumPostTopicModel>({} as ForumPostTopicModel)
const lastBackupTopic = ref(Date.now())

const useForum = useForumStore()
const ps = ref(20)
const pn = ref(1)
const sort = ref(ForumTopicSortTypes.Time)

const forumInfo = ref<Awaited<ReturnType<typeof useForum.GetForumInfo>>>()
const forumLoading = ref(true)
const topics = ref<{ data: ForumTopicBaseModel[]; total: number; more: boolean }>()

async function ApplyToForum() {
  if (!forumInfo.value) return
  if (await useForum.ApplyToForum(forumInfo.value.owner.id ?? -1)) {
    forumInfo.value.isApplied = true
  }
}
function backupTopic() {
  if (!showPostTopicModal.value) {
    return
  }
  postTopicBackup.value[forumInfo.value?.owner.id ?? -1] = currentPostTopicModel.value
  lastBackupTopic.value = Date.now()
}
function postTopic() {
  currentPostTopicModel.value.owner = forumInfo.value?.owner.id ?? -1
  useForum
    .PostTopic(currentPostTopicModel.value, token.value)
    .then(async (topic) => {
      if (topic) {
        currentPostTopicModel.value = {} as ForumPostTopicModel
        delete postTopicBackup.value[forumInfo.value?.owner.id ?? -1]
        showPostTopicModal.value = false
        topics.value = await useForum.GetTopics(forumInfo.value?.owner.id ?? -1, ps.value, pn.value, sort.value)
      }
    })
    .finally(() => {
      token.value = ''
      turnstile.value?.reset()
    })
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  forumInfo.value = await useForum.GetForumInfo(userInfo?.id ?? -1)
  if (forumInfo.value) {
    topics.value = await useForum.GetTopics(forumInfo.value.owner.id ?? -1, ps.value, pn.value, sort.value)
    if (postTopicBackup.value[forumInfo.value.owner.id ?? -1]) {
      currentPostTopicModel.value = postTopicBackup.value[forumInfo.value.owner.id ?? -1]
    }
  }
  forumLoading.value = false
})

watch(showPostTopicModal, (open) => {
  if (open) {
    token.value = ''
    timer = setInterval(() => {
      backupTopic()
    }, 10000)
  } else {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <NSpin
    v-if="forumLoading"
    show
  />
  <NCard
    v-else-if="!forumInfo"
    size="small"
    bordered
  >
    <NAlert
      type="error"
      size="small"
      :bordered="false"
    >
      用户未创建粉丝讨论区
    </NAlert>
  </NCard>
  <NCard
    v-else-if="
      (forumInfo.level < ForumUserLevels.Member && forumInfo.settings.requireApply) ||
      forumInfo.settings.allowedViewerLevel > forumInfo.level
    "
    size="small"
    bordered
  >
    <NAlert
      type="warning"
      size="small"
      :bordered="false"
    >
      你需要成为成员才能访问 {{ forumInfo.name }}
    </NAlert>
    <div style="height: 12px" />
    <NAlert
      v-if="forumInfo.isApplied"
      type="success"
      size="small"
      :bordered="false"
    >
      已申请, 正在等待管理员审核
    </NAlert>
    <NCard
      v-else
      title="加入该讨论区"
      size="small"
      bordered
    >
      <NAlert
        v-if="!accountInfo.id"
        type="error"
        size="small"
        :bordered="false"
      >
        需要登录后才能够加入
      </NAlert>
      <NAlert
        v-else-if="forumInfo.settings.requireApply"
        type="warning"
        size="small"
        :bordered="false"
      >
        申请需要审核
      </NAlert>
      <NAlert
        v-else
        type="success"
        size="small"
        :bordered="false"
      >
        该讨论区可直接加入
      </NAlert>
      <NDivider />
      <NButton
        type="primary"
        :loading="useForum.isLoading"
        :disabled="!accountInfo.id"
        @click="ApplyToForum"
      >
        {{ forumInfo.settings.requireApply ? '申请' : '' }}加入
      </NButton>
    </NCard>
  </NCard>
  <template v-else>
    <NFlex
      vertical
      :size="12"
    >
      <NCard
        size="small"
        bordered
        :title="forumInfo.name"
      />
      <div class="forum-grid">
        <NCard
          class="forum-sidebar"
          size="small"
          bordered
        >
          <NFlex
            vertical
            :size="8"
          >
            <NButton
              type="primary"
              secondary
              @click="showPostTopicModal = true"
            >
              发布话题
            </NButton>
            <NAlert
              v-if="forumInfo.isAdmin"
              type="info"
              size="small"
              :bordered="false"
            >
              你是管理员
            </NAlert>
          </NFlex>
        </NCard>
        <NCard
          class="forum-topics"
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <NList
            style="width: 100%"
            size="small"
            hoverable
            clickable
          >
            <NListItem
              v-for="(item, index) in topics?.data ?? []"
              :key="item.id"
              :style="{ '--topic-index': index }"
            >
              <a
                class="topic-link"
                :href="`${$route.path}/topic/${item.id}`"
                target="_blank"
              >
                <ForumPreviewItem
                  :item="item"
                  :forum="forumInfo"
                />
              </a>
            </NListItem>
          </NList>
        </NCard>
      </div>
    </NFlex>
    <NModal
      v-model:show="showPostTopicModal"
      preset="card"
      style="width: 800px; max-width: 95%"
    >
      <template #header>
        发布话题
        <NDivider vertical />
        <NText
          depth="3"
          style="font-size: small"
        >
          保存于
          <NTime
            :time="lastBackupTopic"
            format="HH:mm:ss"
          />
        </NText>
      </template>
      <NFlex vertical>
        <NInput
          v-model:value="currentPostTopicModel.title"
          placeholder="标题"
        />
        <VEditor
          ref="editor"
          v-model:value="currentPostTopicModel.content"
          :max-length="2333"
        />
        <div class="forum-submit-row">
          <CaptchaWidget
            v-if="showPostTopicModal"
            ref="turnstile"
            v-model="token"
            class="forum-captcha"
          />
          <NButton
            type="primary"
            :disabled="!token"
            :loading="useForum.isLoading"
            @click="postTopic"
          >
            发布
          </NButton>
        </div>
      </NFlex>
    </NModal>
  </template>
</template>

<style scoped>
.forum-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  align-items: start;
}

.topic-link {
  display: block;
  color: inherit;
  text-decoration: none;
  transition: transform 0.18s ease;
}

.topic-link:hover {
  transform: translateX(3px);
}

.forum-topics :deep(.n-list-item) {
  animation: forum-topic-enter 0.4s calc(var(--topic-index, 0) * 40ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.forum-submit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  width: 100%;
}

.forum-captcha {
  min-width: 0;
}

@keyframes forum-topic-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

@media (max-width: 900px) {
  .forum-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .forum-submit-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .forum-submit-row :deep(.n-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .topic-link {
    transition: none;
  }

  .forum-topics :deep(.n-list-item) {
    animation: none;
  }

  .topic-link:hover {
    transform: none;
  }
}
</style>
