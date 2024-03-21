<script setup lang="ts">
import { UserInfo } from '@/api/api-models'
import { ForumPostTopicModel, ForumTopicBaseModel, ForumTopicSortTypes, ForumUserLevels } from '@/api/models/forum'
import TurnstileVerify from '@/components/TurnstileVerify.vue'
import VEditor from '@/components/VEditor.vue'
import { TURNSTILE_KEY } from '@/data/constants'
import { useForumStore } from '@/store/useForumStore'
import { useStorage } from '@vueuse/core'
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
  NText,
  NTime,
  useMessage,
} from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'
import ForumPreviewItem from './ForumPreviewItem.vue'
import ForumCommentItem from './ForumCommentItem.vue'

const { biliInfo, userInfo } = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()
const token = ref('')
const turnstile = ref()
const editor = ref()

const postTopicBackup = useStorage<{ [key: number]: ForumPostTopicModel }>('Forum.PostTopic', {})
const showPostTopicModal = ref(false)
const currentPostTopicModel = ref<ForumPostTopicModel>({} as ForumPostTopicModel)
const lastBackupTopic = ref(Date.now())

const useForum = useForumStore()
const message = useMessage()
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
  <NAlert v-if="!forumInfo" type="error"> 用户未创建粉丝讨论区 </NAlert>
  <NCard
    v-else-if="
      (forumInfo.level < ForumUserLevels.Member && forumInfo.settings.requireApply) ||
      forumInfo.settings.allowedViewerLevel > forumInfo.level
    "
  >
    <NAlert type="warning"> 你需要成为成员才能访问 </NAlert>
    <NAlert v-if="forumInfo.isApplied" type="success"> 已申请, 正在等待管理员审核 </NAlert>
    <NCard v-else title="加入">
      加入 {{ forumInfo.name }}
      <NButton type="primary" @click="ApplyToForum" :loading="useForum.isLoading">
        {{ forumInfo.settings.requireApply ? '申请' : '' }}加入
      </NButton>
    </NCard>
  </NCard>
  <template v-else>
    <NFlex vertical>
      <NCard size="small">
        <template #header>
          <NFlex justify="center">
            <NText style="font-size: large">{{ forumInfo.name }}</NText>
          </NFlex>
        </template>
      </NCard>
      <NFlex>
        <NCard style="max-width: 300px">
          <NFlex vertical>
            <NButton @click="showPostTopicModal = true"> 发布话题 </NButton>
          </NFlex>
        </NCard>
        <NList bordered style="flex: 1" size="small" hoverable clickable>
          <NListItem v-for="item in topics?.data ?? []" :key="item.id">
            <a :href="`${$route.path}/topic/${item.id}`" target="_blank">
              <ForumPreviewItem :item="item" :forum="forumInfo" />
            </a>
          </NListItem>
        </NList>
      </NFlex>
    </NFlex>
    <NModal preset="card" v-model:show="showPostTopicModal" style="width: 800px; max-width: 95%">
      <template #header>
        发布话题
        <NDivider vertical />
        <NText depth="3" style="font-size: small"> 保存于 <NTime :time="lastBackupTopic" format="HH:mm:ss" /> </NText>
      </template>
      <NFlex vertical>
        <NInput v-model:value="currentPostTopicModel.title" placeholder="标题" />
        <VEditor v-model:value="currentPostTopicModel.content" :max-length="2333" ref="editor" />
        <NButton type="primary" @click="postTopic" :loading="!token || useForum.isLoading"> 发布 </NButton>
      </NFlex>
    </NModal>
    <TurnstileVerify ref="turnstile" v-model="token" />
  </template>
</template>

<style scoped>
a {
  text-decoration: none;
}
</style>
