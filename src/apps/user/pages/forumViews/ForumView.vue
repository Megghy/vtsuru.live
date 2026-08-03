<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { UserInfo } from '@/api/api-models'
import type { ForumPostTopicModel, ForumTopicBaseModel } from '@/api/models/forum'
import { ForumTopicSortTypes, ForumUserLevels } from '@/api/models/forum'
import PublicTime from '@/apps/user-page/PublicTime.vue'
import TurnstileVerify from '@/apps/user/components/TurnstileVerify.vue'
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
const pn = ref(0)
const sort = ref(ForumTopicSortTypes.Time)

const forumInfo = ref(await useForum.GetForumInfo(userInfo?.id ?? -1))
const topics = ref<{ data: ForumTopicBaseModel[]; total: number; more: boolean } | undefined>({
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
  <UCard
    v-if="!forumInfo"
    class="user-page-card"
    size="small"
    bordered
  >
    <UAlert color="error"><template #description> 用户未创建粉丝讨论区 </template></UAlert>
  </UCard>
  <UCard
    v-else-if="
      (forumInfo.level < ForumUserLevels.Member && forumInfo.settings.requireApply) ||
      forumInfo.settings.allowedViewerLevel > forumInfo.level
    "
    class="user-page-card"
    size="small"
    bordered
  >
    <UAlert color="warning"
      ><template #description> 你需要成为成员才能访问 {{ forumInfo.name }}</template>
    </UAlert>
    <div style="height: 12px" />
    <UAlert
      v-if="forumInfo.isApplied"
      color="success"
      ><template #description> 已申请, 正在等待管理员审核 </template></UAlert
    >
    <UCard
      v-else
      title="加入该讨论区"
      class="user-page-card"
      size="small"
      bordered
    >
      <UAlert
        v-if="!accountInfo.id"
        color="error"
        ><template #description> 需要登录后才能够加入 </template></UAlert
      >
      <UAlert
        v-else-if="forumInfo.settings.requireApply"
        color="warning"
        ><template #description> 申请需要审核 </template></UAlert
      >
      <UAlert
        v-else
        color="success"
        ><template #description> 该讨论区可直接加入 </template></UAlert
      >
      <USeparator />
      <UButton
        color="primary"
        :loading="useForum.isLoading"
        :disabled="!accountInfo.id"
        @click="ApplyToForum"
      >
        {{ forumInfo.settings.requireApply ? '申请' : '' }}加入
      </UButton>
    </UCard>
  </UCard>
  <template v-else>
    <div
      vertical
      :size="12"
    >
      <UCard
        size="small"
        bordered
        :title="forumInfo.name"
        class="user-page-card"
      />
      <div class="forum-grid">
        <UCard
          class="user-page-card forum-sidebar"
          size="small"
          bordered
        >
          <div
            vertical
            :size="8"
          >
            <UButton
              color="primary"
              variant="soft"
              @click="showPostTopicModal = true"
            >
              发布话题
            </UButton>
            <UAlert
              v-if="forumInfo.isAdmin"
              color="info"
              ><template #description> 你是管理员 </template></UAlert
            >
          </div>
        </UCard>
        <UCard
          class="user-page-card forum-topics"
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <ul
            style="width: 100%"
            size="small"
            hoverable
            clickable
          >
            <li
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
            </li>
          </ul>
        </UCard>
      </div>
    </div>
    <UModal
      v-model:open="showPostTopicModal"
      :ui="{ content: 'max-w-[800px]' }"
    >
      <template #header>
        发布话题
        <USeparator vertical />
        <span
          depth="3"
          style="font-size: small"
        >
          保存于
          <PublicTime
            :time="lastBackupTopic"
            format="HH:mm:ss"
          />
        </span>
      </template>
      <template #body>
        <div vertical>
          <UInput
            v-model="currentPostTopicModel.title"
            placeholder="标题"
          />
          <VEditor
            ref="editor"
            v-model:value="currentPostTopicModel.content"
            :max-length="2333"
          />
          <UButton
            color="primary"
            :loading="!token || useForum.isLoading"
            @click="postTopic"
          >
            发布
          </UButton>
        </div>
      </template>
    </UModal>
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
