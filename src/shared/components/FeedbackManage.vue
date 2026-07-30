<script setup lang="ts">
import type { CreateSupportTicketRequest, SupportTicketDetail, SupportTicketSummary } from '@/api/api-models'
import type { UploadFileInfo } from 'naive-ui'
import { SupportTicketStatus, SupportTicketType, UserFileLocation, UserFileTypes } from '@/api/api-models'
import { isLoggedIn } from '@/api/account'
import { Add24Regular, ArrowClockwise24Regular, Image24Regular } from '@vicons/fluent'
import {
  NButton,
  NCheckbox,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NUpload,
  useMessage,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { uploadFiles } from '@/shared/services/fileUpload'
import {
  createSupportTicket,
  getMySupportTickets,
  getPublicSupportTickets,
  getSupportTicket,
} from '@/shared/services/supportTickets'
import SupportTicketDetailView from './support-ticket/SupportTicketDetail.vue'
import SupportTicketListItem from './support-ticket/SupportTicketListItem.vue'
import PublicTicketCard from './support-ticket/PublicTicketCard.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const view = ref<'mine' | 'public'>(isLoggedIn.value ? 'mine' : 'public')
const tickets = ref<SupportTicketSummary[]>([])
const selectedTicket = ref<SupportTicketDetail>()
const loadingList = ref(false)
const loadingDetail = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const fileList = ref<UploadFileInfo[]>([])
const draft = ref<CreateSupportTicketRequest>({
  title: '',
  content: '',
  type: SupportTicketType.Bug,
  isPublic: false,
  emailOnStaffReply: false,
  imageFileIds: [],
})

const selectedId = computed(() => {
  const value = Number(route.params.id)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
})
const editable = computed(() => view.value === 'mine'
  && isLoggedIn.value
  && tickets.value.some(ticket => ticket.id === selectedId.value))
const isDetailRoute = computed(() => selectedId.value !== undefined)
const showPublicCards = computed(() => view.value === 'public' && !isDetailRoute.value)

const typeOptions = [
  { label: '产品问题', value: SupportTicketType.Bug },
  { label: '功能建议', value: SupportTicketType.Feature },
  { label: '账号问题', value: SupportTicketType.Account },
  { label: '其他', value: SupportTicketType.Other },
]

async function loadTickets() {
  loadingList.value = true
  try {
    tickets.value = (view.value === 'mine'
      ? await getMySupportTickets()
      : await getPublicSupportTickets())
      .toSorted((a, b) => {
        if (a.status === SupportTicketStatus.Resolved && b.status !== SupportTicketStatus.Resolved) return 1
        if (a.status !== SupportTicketStatus.Resolved && b.status === SupportTicketStatus.Resolved) return -1
        return b.lastMessageTime - a.lastMessageTime
      })
  } catch (error) {
    tickets.value = []
    message.error((error as Error).message)
  } finally {
    loadingList.value = false
  }
}

async function loadDetail() {
  if (!selectedId.value) {
    selectedTicket.value = undefined
    return
  }
  loadingDetail.value = true
  try {
    selectedTicket.value = await getSupportTicket(selectedId.value)
  } catch (error) {
    selectedTicket.value = undefined
    message.error((error as Error).message)
  } finally {
    loadingDetail.value = false
  }
}

async function openTicket(id: number) {
  await router.push({ name: 'feedback-detail', params: { id }, query: { view: view.value } })
}

async function closeDetail() {
  await router.push({ name: 'feedback', query: view.value === 'public' ? { view: 'public' } : undefined })
}

function resetDraft() {
  draft.value = {
    title: '',
    content: '',
    type: SupportTicketType.Bug,
    isPublic: false,
    emailOnStaffReply: false,
    imageFileIds: [],
  }
  fileList.value = []
}

function beforeUpload({ file }: { file: UploadFileInfo }) {
  if (!file.file?.type.startsWith('image/')) {
    message.error('只能上传图片文件')
    return false
  }
  return true
}

async function submitTicket() {
  const title = draft.value.title.trim()
  const content = draft.value.content.trim()
  if (!title || !content) {
    message.error('请填写标题和详细内容')
    return
  }
  creating.value = true
  try {
    const files = fileList.value.map(item => item.file).filter((file): file is File => Boolean(file))
    const uploaded = files.length
      ? await uploadFiles(files, UserFileTypes.Image, UserFileLocation.Local)
      : []
    const ticket = await createSupportTicket({
      ...draft.value,
      title,
      content,
      imageFileIds: uploaded.map(file => file.id),
    })
    resetDraft()
    showCreate.value = false
    view.value = 'mine'
    await loadTickets()
    await openTicket(ticket.id)
    message.success(`工单 #${ticket.id} 已创建`)
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    creating.value = false
  }
}

async function refreshDetail() {
  await Promise.all([loadTickets(), loadDetail()])
}

watch(view, async (nextView, previousView) => {
  if (previousView && nextView !== previousView && isDetailRoute.value) {
    await router.push({ name: 'feedback', query: nextView === 'public' ? { view: 'public' } : undefined })
  }
  if (route.name === 'feedback-detail' && route.query.view !== nextView) {
    await router.replace({ query: { ...route.query, view: nextView } })
  }
  await loadTickets()
}, { immediate: true })
watch(selectedId, loadDetail, { immediate: true })
watch(() => route.query.view, (routeView) => {
  if (routeView === 'public' || (routeView === 'mine' && isLoggedIn.value)) {
    view.value = routeView
  }
}, { immediate: true })
</script>

<template>
  <div class="ticket-page">
    <header class="ticket-page__toolbar">
      <NTabs v-if="isLoggedIn" v-model:value="view" type="segment" size="small" class="ticket-page__tabs">
        <NTabPane name="mine" tab="我的工单" />
        <NTabPane name="public" tab="公开工单" />
      </NTabs>
      <strong v-else class="ticket-page__title">公开工单</strong>
      <NButton v-if="isLoggedIn" type="primary" size="small" @click="showCreate = true">
        <template #icon>
          <NIcon :component="Add24Regular" />
        </template>
        新建工单
      </NButton>
      <NButton v-else quaternary circle size="small" title="刷新" :loading="loadingList" @click="loadTickets">
        <template #icon>
          <NIcon :component="ArrowClockwise24Regular" />
        </template>
      </NButton>
    </header>

    <div v-if="showPublicCards" class="public-ticket-list">
      <div v-if="loadingList && !tickets.length" class="public-ticket-list__state">
        <NSpin size="small" />
      </div>
      <NEmpty v-else-if="!tickets.length" class="public-ticket-list__state" description="暂无公开工单" />
      <div v-else class="public-ticket-list__grid">
        <PublicTicketCard
          v-for="ticket in tickets"
          :key="ticket.id"
          :ticket="ticket"
          @click="openTicket(ticket.id)"
        />
      </div>
    </div>

    <div v-else-if="view === 'mine'" class="ticket-workspace" :class="{ 'ticket-workspace--detail': isDetailRoute }">
      <aside class="ticket-list">
        <div class="ticket-list__header">
          <span>{{ view === 'mine' ? '我的工单' : '公开工单' }}</span>
          <NButton quaternary circle size="small" title="刷新" :loading="loadingList" @click="loadTickets">
            <template #icon>
              <NIcon :component="ArrowClockwise24Regular" />
            </template>
          </NButton>
        </div>
        <div v-if="loadingList && !tickets.length" class="ticket-list__state">
          <NSpin size="small" />
        </div>
        <NEmpty
          v-else-if="!tickets.length"
          class="ticket-list__state"
          :description="view === 'mine' ? '还没有工单' : '暂无公开工单'"
        />
        <SupportTicketListItem
          v-for="ticket in tickets"
          v-else
          :key="ticket.id"
          :ticket="ticket"
          :active="ticket.id === selectedId"
          @click="openTicket(ticket.id)"
        />
      </aside>

      <SupportTicketDetailView
        class="ticket-workspace__detail"
        :ticket="selectedTicket"
        :loading="loadingDetail"
        :editable="editable"
        @back="closeDetail"
        @refresh="refreshDetail"
      />
    </div>

    <SupportTicketDetailView
      v-else
      class="public-ticket-detail"
      :ticket="selectedTicket"
      :loading="loadingDetail"
      :editable="editable"
      @back="closeDetail"
      @refresh="refreshDetail"
    />

    <NModal
      v-model:show="showCreate"
      preset="card"
      title="新建工单"
      class="ticket-create-modal"
      :mask-closable="!creating"
      @after-leave="resetDraft"
    >
      <NForm label-placement="top" size="small">
        <NFormItem label="类型" required>
          <NSelect v-model:value="draft.type" :options="typeOptions" />
        </NFormItem>
        <NFormItem label="标题" required>
          <NInput v-model:value="draft.title" maxlength="160" show-count placeholder="用一句话概括问题" />
        </NFormItem>
        <NFormItem label="详细内容" required>
          <NInput
            v-model:value="draft.content"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 10 }"
            maxlength="5000"
            show-count
            placeholder="说明发生了什么、如何复现，以及你期望的结果"
          />
        </NFormItem>
        <NFormItem label="图片">
          <NUpload
            v-model:file-list="fileList"
            accept="image/*"
            list-type="image-card"
            :default-upload="false"
            :max="5"
            multiple
            :on-before-upload="beforeUpload"
          >
            <NIcon :component="Image24Regular" size="24" />
          </NUpload>
        </NFormItem>
        <div class="ticket-create__preferences">
          <NCheckbox v-model:checked="draft.isPublic">
            公开此工单
          </NCheckbox>
          <NCheckbox v-model:checked="draft.emailOnStaffReply">
            站长回复时发送邮件
          </NCheckbox>
        </div>
      </NForm>
      <template #footer>
        <div class="ticket-create__footer">
          <NButton :disabled="creating" @click="showCreate = false">
            取消
          </NButton>
          <NButton
            type="primary"
            :loading="creating"
            :disabled="!draft.title.trim() || !draft.content.trim()"
            @click="submitTicket"
          >
            创建工单
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.ticket-page { display: grid; gap: 12px; }
.ticket-page__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ticket-page__title { color: var(--vtsuru-fg); font-size: 15px; }
.ticket-page__tabs { width: 220px; }
.public-ticket-list { min-height: 320px; }
.public-ticket-list__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.public-ticket-list__state { display: grid; min-height: 320px; place-content: center; }
.public-ticket-detail { overflow: hidden; border: 1px solid var(--vtsuru-border); border-radius: 8px; background: var(--vtsuru-bg); }
.ticket-workspace { display: grid; grid-template-columns: minmax(250px, 320px) minmax(0, 1fr); overflow: hidden; border: 1px solid var(--vtsuru-border); border-radius: 8px; background: var(--vtsuru-bg); }
.ticket-list { min-width: 0; height: min(720px, calc(100vh - 150px)); overflow-y: auto; border-right: 1px solid var(--vtsuru-border); }
.ticket-list__header { position: sticky; z-index: 1; top: 0; display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 12px 0 14px; border-bottom: 1px solid var(--vtsuru-border); color: var(--vtsuru-fg); background: var(--vtsuru-bg); font-size: 13px; font-weight: 600; }
.ticket-list__state { display: grid; min-height: 240px; place-content: center; }
.ticket-create__preferences { display: grid; gap: 10px; }
.ticket-create__footer { display: flex; justify-content: flex-end; gap: 8px; }
:global(.ticket-create-modal) { width: min(620px, calc(100vw - 32px)); }

@media (max-width: 760px) {
  .ticket-page__tabs { width: 190px; }
  .public-ticket-list__grid { grid-template-columns: 1fr; }
  .public-ticket-detail { border-right: 0; border-left: 0; border-radius: 0; }
  .ticket-workspace { display: block; border-right: 0; border-left: 0; border-radius: 0; }
  .ticket-list { height: calc(100dvh - 150px); border-right: 0; }
  .ticket-workspace__detail { display: none; }
  .ticket-workspace--detail .ticket-list { display: none; }
  .ticket-workspace--detail .ticket-workspace__detail { display: flex; }
}
</style>
