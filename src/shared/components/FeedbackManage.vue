<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import type { CreateSupportTicketRequest, SupportTicketDetail, SupportTicketSummary } from '@/api/api-models'
import { SupportTicketStatus, SupportTicketType, UserFileLocation, UserFileTypes } from '@/api/api-models'
import { uploadFiles } from '@/shared/services/fileUpload'
import {
  createSupportTicket,
  getMySupportTickets,
  getPublicSupportTickets,
  getSupportTicket,
} from '@/shared/services/supportTickets'

import PublicTicketCard from './support-ticket/PublicTicketCard.vue'
import SupportTicketDetailView from './support-ticket/SupportTicketDetail.vue'
import SupportTicketListItem from './support-ticket/SupportTicketListItem.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const view = ref<'mine' | 'public'>(isLoggedIn.value ? 'mine' : 'public')
const tickets = ref<SupportTicketSummary[]>([])
const selectedTicket = ref<SupportTicketDetail>()
const loadingList = ref(false)
const loadingDetail = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const files = ref<File[]>([])
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
const editable = computed(
  () => view.value === 'mine' && isLoggedIn.value && tickets.value.some((ticket) => ticket.id === selectedId.value),
)
const isDetailRoute = computed(() => selectedId.value !== undefined)
const showPublicCards = computed(() => view.value === 'public' && !isDetailRoute.value)
const typeOptions = [
  { label: '产品问题', value: SupportTicketType.Bug },
  { label: '功能建议', value: SupportTicketType.Feature },
  { label: '账号问题', value: SupportTicketType.Account },
  { label: '其他', value: SupportTicketType.Other },
]
const viewTabs = [
  { label: '我的工单', value: 'mine' },
  { label: '公开工单', value: 'public' },
]

async function loadTickets() {
  loadingList.value = true
  try {
    tickets.value = (view.value === 'mine' ? await getMySupportTickets() : await getPublicSupportTickets()).toSorted(
      (left, right) => {
        if (left.status === SupportTicketStatus.Resolved && right.status !== SupportTicketStatus.Resolved) return 1
        if (left.status !== SupportTicketStatus.Resolved && right.status === SupportTicketStatus.Resolved) return -1
        return right.lastMessageTime - left.lastMessageTime
      },
    )
  } catch (error) {
    tickets.value = []
    toast.add({ title: (error as Error).message, color: 'error' })
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
    toast.add({ title: (error as Error).message, color: 'error' })
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
  files.value = []
}

function selectFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const selectedFiles = [...(input.files ?? [])]
  const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'))
  if (invalidFile) {
    toast.add({ title: '只能上传图片文件', color: 'error' })
    input.value = ''
    return
  }
  files.value = [...files.value, ...selectedFiles].slice(0, 5)
  input.value = ''
}

async function submitTicket() {
  const title = draft.value.title.trim()
  const content = draft.value.content.trim()
  if (!title || !content) {
    toast.add({ title: '请填写标题和详细内容', color: 'error' })
    return
  }
  creating.value = true
  try {
    const uploaded = files.value.length
      ? await uploadFiles(files.value, UserFileTypes.Image, UserFileLocation.Local)
      : []
    const ticket = await createSupportTicket({
      ...draft.value,
      title,
      content,
      imageFileIds: uploaded.map((file) => file.id),
    })
    resetDraft()
    showCreate.value = false
    view.value = 'mine'
    await loadTickets()
    await openTicket(ticket.id)
    toast.add({ title: `工单 #${ticket.id} 已创建`, color: 'success' })
  } catch (error) {
    toast.add({ title: (error as Error).message, color: 'error' })
  } finally {
    creating.value = false
  }
}

async function refreshDetail() {
  await Promise.all([loadTickets(), loadDetail()])
}

watch(
  view,
  async (nextView, previousView) => {
    if (previousView && nextView !== previousView && isDetailRoute.value) {
      await router.push({ name: 'feedback', query: nextView === 'public' ? { view: 'public' } : undefined })
    }
    if (route.name === 'feedback-detail' && route.query.view !== nextView) {
      await router.replace({ query: { ...route.query, view: nextView } })
    }
    await loadTickets()
  },
  { immediate: true },
)
watch(selectedId, loadDetail, { immediate: true })
watch(
  () => route.query.view,
  (routeView) => {
    if (routeView === 'public' || (routeView === 'mine' && isLoggedIn.value)) view.value = routeView
  },
  { immediate: true },
)
</script>

<template>
  <div class="ticket-page">
    <header class="ticket-page__toolbar">
      <UTabs
        v-if="isLoggedIn"
        v-model="view"
        :items="viewTabs"
        :content="false"
        class="ticket-page__tabs"
      />
      <strong
        v-else
        class="ticket-page__title"
        >公开工单</strong
      >
      <UButton
        v-if="isLoggedIn"
        color="primary"
        size="sm"
        icon="i-lucide-plus"
        @click="showCreate = true"
        >新建工单</UButton
      >
      <UButton
        v-else
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-refresh-cw"
        aria-label="刷新"
        :loading="loadingList"
        @click="loadTickets"
      />
    </header>

    <div
      v-if="showPublicCards"
      class="public-ticket-list"
    >
      <div
        v-if="loadingList && !tickets.length"
        class="public-ticket-list__state"
      >
        <UIcon
          class="ticket-page__spinner"
          name="i-lucide-loader-circle"
        />
      </div>
      <div
        v-else-if="!tickets.length"
        class="public-ticket-list__state"
      >
        <UIcon name="i-lucide-message-square-text" /><span>暂无公开工单</span>
      </div>
      <div
        v-else
        class="public-ticket-list__grid"
      >
        <PublicTicketCard
          v-for="ticket in tickets"
          :key="ticket.id"
          :ticket="ticket"
          @click="openTicket(ticket.id)"
        />
      </div>
    </div>

    <div
      v-else-if="view === 'mine'"
      class="ticket-workspace"
      :class="{ 'ticket-workspace--detail': isDetailRoute }"
    >
      <aside class="ticket-list">
        <div class="ticket-list__header">
          <span>我的工单</span>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-refresh-cw"
            aria-label="刷新"
            :loading="loadingList"
            @click="loadTickets"
          />
        </div>
        <div
          v-if="loadingList && !tickets.length"
          class="ticket-list__state"
        >
          <UIcon
            class="ticket-page__spinner"
            name="i-lucide-loader-circle"
          />
        </div>
        <div
          v-else-if="!tickets.length"
          class="ticket-list__state"
        >
          <UIcon name="i-lucide-message-square-text" /><span>还没有工单</span>
        </div>
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

    <UModal
      v-model:open="showCreate"
      title="新建工单"
      :dismissible="!creating"
      @after:leave="resetDraft"
    >
      <template #body>
        <form
          class="ticket-create"
          @submit.prevent="submitTicket"
        >
          <UFormField
            label="类型"
            required
          >
            <USelect
              v-model="draft.type"
              :items="typeOptions"
            />
          </UFormField>
          <UFormField
            label="标题"
            required
          >
            <UInput
              v-model="draft.title"
              maxlength="160"
              placeholder="用一句话概括问题"
            />
          </UFormField>
          <UFormField
            label="详细内容"
            required
          >
            <UTextarea
              v-model="draft.content"
              :rows="6"
              :maxrows="10"
              maxlength="5000"
              placeholder="说明发生了什么、如何复现，以及你期望的结果"
            />
          </UFormField>
          <UFormField label="图片">
            <div class="ticket-file-picker">
              <UButton
                as="label"
                color="neutral"
                variant="soft"
                icon="i-lucide-image-plus"
              >
                选择图片
                <input
                  accept="image/*"
                  multiple
                  type="file"
                  @change="selectFiles"
                />
              </UButton>
              <span>{{ files.length ? `已选 ${files.length} 张图片` : '最多 5 张图片' }}</span>
            </div>
          </UFormField>
          <div class="ticket-create__preferences">
            <UCheckbox v-model="draft.isPublic">公开此工单</UCheckbox>
            <UCheckbox v-model="draft.emailOnStaffReply">站长回复时发送邮件</UCheckbox>
          </div>
        </form>
      </template>
      <template #footer>
        <div class="ticket-create__footer">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="creating"
            @click="showCreate = false"
            >取消</UButton
          >
          <UButton
            color="primary"
            :loading="creating"
            :disabled="!draft.title.trim() || !draft.content.trim()"
            @click="submitTicket"
            >创建工单</UButton
          >
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.ticket-page {
  display: grid;
  gap: 12px;
}
.ticket-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ticket-page__title {
  color: var(--vtsuru-fg);
  font-size: 15px;
}
.ticket-page__tabs {
  width: 220px;
}
.ticket-page__spinner {
  animation: spin 0.8s linear infinite;
}
.public-ticket-list {
  min-height: 320px;
}
.public-ticket-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px;
}
.public-ticket-list__state,
.ticket-list__state {
  display: grid;
  place-content: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.public-ticket-list__state {
  min-height: 320px;
}
.public-ticket-detail,
.ticket-workspace {
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg);
}
.ticket-workspace {
  display: grid;
  grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
}
.ticket-list {
  min-width: 0;
  height: min(720px, calc(100vh - 150px));
  overflow-y: auto;
  border-right: 1px solid var(--vtsuru-border);
}
.ticket-list__header {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px 0 14px;
  border-bottom: 1px solid var(--vtsuru-border);
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
  font-size: 13px;
  font-weight: 600;
}
.ticket-list__state {
  min-height: 240px;
}
.ticket-create,
.ticket-create__preferences {
  display: grid;
  gap: 12px;
}
.ticket-file-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.ticket-file-picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.ticket-create__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .ticket-page__tabs {
    width: 190px;
  }
  .public-ticket-list__grid {
    grid-template-columns: 1fr;
  }
  .public-ticket-detail,
  .ticket-workspace {
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }
  .ticket-workspace {
    display: block;
  }
  .ticket-list {
    height: calc(100dvh - 150px);
    border-right: 0;
  }
  .ticket-workspace__detail {
    display: none;
  }
  .ticket-workspace--detail .ticket-list {
    display: none;
  }
  .ticket-workspace--detail .ticket-workspace__detail {
    display: flex;
  }
}
</style>
