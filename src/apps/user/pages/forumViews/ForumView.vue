<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { ForumPostTopicModel, ForumTopicBaseModel } from '@/api/models/forum'
import { useStorage } from '@vueuse/core'
import {
  NAlert, NButton, NCard, NDivider, NFlex, NInput, NList, NListItem, NModal, NText, NTime } from 'naive-ui';
import { onMounted, onUnmounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { ForumTopicSortTypes, ForumUserLevels } from '@/api/models/forum'
import TurnstileVerify from '@/apps/user/components/TurnstileVerify.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { useForumStore } from '@/store/useForumStore'
import ForumPreviewItem from './ForumPreviewItem.vue'

const { userInfo } = defineProps<{
  userInfo: UserInfo | undefined
}>()
const accountInfo = useAccount()
const token = ref('')
const turnstile = ref()
const editor = ref()

const postTopicBackup = useStorage<{ [key: number]: ForumPostTopicModel }>('Forum.PostTopic', {})
const showPostTopicModal = ref(false)
const currentPostTopicModel = ref<ForumPostTopicModel>({} as ForumPostTopicModel)
const lastBackupTopic = ref(Date.now())

const useForum = useForumStore()
const ps = ref(20)
const pn = ref(0)
const sort = ref(ForumTopicSortTypes.Time)

const forumInfo = ref(await useForum.GetForumInfo(userInfo?.id ?? -1))
const topics = ref<{ data: ForumTopicBaseModel[], total: number, more: boolean } | undefined>({
  data: [],
  total: 0,
  more: false,
})

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
      turnstile.value?.reset()
    })
}

let timer: any
onMounted(async () => {
  if (forumInfo.value) {
    topics.value = await useForum.GetTopics(forumInfo.value.owner.id ?? -1, ps.value, pn.value, sort.value)
    if (postTopicBackup.value[forumInfo.value.owner.id ?? -1]) {
      currentPostTopicModel.value = postTopicBackup.value[forumInfo.value.owner.id ?? -1]
    }
    timer = setInterval(async () => {
      backupTopic()
    }, 10000)
  }
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <NCard v-if="!forumInfo" size="small" bordered>
    <NAlert type="error" size="small" :bordered="false">
      用户未创建粉丝讨论区
    </NAlert>
  </NCard>
  <NCard
    v-else-if="
      (forumInfo.level < ForumUserLevels.Member && forumInfo.settings.requireApply)
        || forumInfo.settings.allowedViewerLevel > forumInfo.level
    "
    size="small"
    bordered
  >
    <NAlert type="warning" size="small" :bordered="false">
      你需要成为成员才能访问 {{ forumInfo.name }}
    </NAlert>
    <div style="height: 12px;" />
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
    <NFlex vertical :size="12">
      <NCard size="small" bordered :title="forumInfo.name" />
      <div class="forum-grid">
        <NCard class="forum-sidebar" size="small" bordered>
          <NFlex vertical :size="8">
            <NButton type="primary" secondary @click="showPostTopicModal = true">
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
        <NCard class="forum-topics" size="small" bordered content-style="padding: 0;">
          <NList
            style="width: 100%;"
            size="small"
            hoverable
            clickable
          >
            <NListItem
              v-for="item in topics?.data ?? []"
              :key="item.id"
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
          保存于 <NTime
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
        <NButton
          type="primary"
          :loading="!token || useForum.isLoading"
          @click="postTopic"
        >
          发布
        </NButton>
      </NFlex>
    </NModal>
    <TurnstileVerify
      ref="turnstile"
      v-model="token"
    />
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
}

@media (max-width: 900px) {
  .forum-grid {
    grid-template-columns: 1fr;
  }
}
</style>
