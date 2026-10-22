<script setup lang="ts">
import { Add24Regular, ArrowClockwise24Regular, Dismiss16Regular, Image24Regular } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import type { CreateSupportTicketRequest, SupportTicketDetail, SupportTicketSummary } from '@/api/api-models'
import { SupportTicketStatus, SupportTicketType } from '@/api/api-models'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import {
  createSupportTicket,
  getMySupportTickets,
  getPublicSupportTickets,
  getSupportTicket,
} from '@/shared/services/supportTickets'
import { filterSupportTickets, supportTicketStatusOptions, supportTicketTypeOptions } from '@/shared/supportTicket'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

import PublicTicketCard from './support-ticket/PublicTicketCard.vue'
import SupportTicketDetailView from './support-ticket/SupportTicketDetail.vue'
import SupportTicketListItem from './support-ticket/SupportTicketListItem.vue'

interface LocalFileItem {
  id: string
  file: File
  url: string
}

const route = useRoute()
const router = useRouter()

const view = ref<'mine' | 'public'>(isLoggedIn.value ? 'mine' : 'public')
const tickets = ref<SupportTicketSummary[]>([])
const selectedTicket = ref<SupportTicketDetail>()
const loadingList = ref(false)
const loadingDetail = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const keyword = ref('')
const statusFilter = ref<string>('all')
const typeFilter = ref<string>('all')
const fileList = ref<LocalFileItem[]>([])
const fileInputRef = ref<HTMLInputElement>()

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
const inManage = computed(() => route.path.startsWith('/manage'))
const filtering = computed(() =>
  Boolean(keyword.value.trim() || statusFilter.value !== 'all' || typeFilter.value !== 'all'),
)
const filteredTickets = computed(() =>
  filterSupportTickets(tickets.value, {
    keyword: keyword.value,
    status: statusFilter.value === 'all' ? null : (Number(statusFilter.value) as SupportTicketStatus),
    type: typeFilter.value === 'all' ? null : (Number(typeFilter.value) as SupportTicketType),
  }),
)
const listRouteName = computed(() => (inManage.value ? 'manage-feedback' : 'feedback'))
const detailRouteName = computed(() => (inManage.value ? 'manage-feedback-detail' : 'feedback-detail'))

async function loadTickets() {
  loadingList.value = true
  try {
    tickets.value = (view.value === 'mine' ? await getMySupportTickets() : await getPublicSupportTickets()).toSorted(
      (a, b) => {
        if (a.status === SupportTicketStatus.Resolved && b.status !== SupportTicketStatus.Resolved) return 1
        if (a.status !== SupportTicketStatus.Resolved && b.status === SupportTicketStatus.Resolved) return -1
        return b.lastMessageTime - a.lastMessageTime
      },
    )
  } catch (error) {
    tickets.value = []
    toast.error((error as Error).message)
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
    toast.error((error as Error).message)
  } finally {
    loadingDetail.value = false
  }
}

async function openTicket(id: number) {
  await router.push({ name: detailRouteName.value, params: { id }, query: { view: view.value } })
}

async function closeDetail() {
  await router.push({ name: listRouteName.value, query: view.value === 'public' ? { view: 'public' } : undefined })
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
  fileList.value.forEach((f) => URL.revokeObjectURL(f.url))
  fileList.value = []
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files?.length) return
  const remaining = 5 - fileList.value.length
  const files = Array.from(target.files).slice(0, remaining)
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      toast.error('只能上传图片文件')
      continue
    }
    fileList.value.push({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      url: URL.createObjectURL(f),
    })
  }
  target.value = ''
}

function removeFile(index: number) {
  const item = fileList.value[index]
  if (item) URL.revokeObjectURL(item.url)
  fileList.value.splice(index, 1)
}

async function submitTicket() {
  const title = draft.value.title.trim()
  const content = draft.value.content.trim()
  if (!title || !content) {
    toast.error('请填写标题和详细内容')
    return
  }
  creating.value = true
  try {
    const files = fileList.value.map((item) => item.file)
    const uploaded = files.length ? await uploadFiles(files, FileStore.Tickets) : []
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
    toast.success(`工单 #${ticket.id} 已创建`)
  } catch (error) {
    toast.error((error as Error).message)
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
      await router.push({
        name: listRouteName.value,
        query: nextView === 'public' ? { view: 'public' } : undefined,
      })
    }
    if (route.name === detailRouteName.value && route.query.view !== nextView) {
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
    if (routeView === 'public' || (routeView === 'mine' && isLoggedIn.value)) {
      view.value = routeView
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="ticket-page"
    :class="{ 'ticket-page--manage': inManage, 'ticket-page--detail': isDetailRoute }"
  >
    <header class="ticket-page__toolbar flex items-center justify-between gap-3 pb-3 border-b border-border/60">
      <div v-if="isLoggedIn" class="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
        <button
          type="button"
          class="px-3 py-1 rounded-md transition font-medium"
          :class="view === 'mine' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="view = 'mine'"
        >
          我的工单
        </button>
        <button
          type="button"
          class="px-3 py-1 rounded-md transition font-medium"
          :class="view === 'public' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="view = 'public'"
        >
          公开工单
        </button>
      </div>
      <strong
        v-else
        class="ticket-page__title text-sm font-semibold text-foreground"
      >
        公开工单
      </strong>

      <div class="ticket-page__actions flex items-center gap-2">
        <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-foreground" title="刷新" :disabled="loadingList" @click="loadTickets">
          <component :is="ArrowClockwise24Regular" class="size-4" :class="{ 'animate-spin': loadingList }" />
        </Button>
        <Button v-if="isLoggedIn" class="flex items-center gap-1" @click="showCreate = true">
          <component :is="Add24Regular" class="size-3.5" />
          新建工单
        </Button>
      </div>
    </header>

    <div
      v-if="tickets.length || filtering"
      class="ticket-page__filters flex flex-wrap items-center gap-2 pt-3"
    >
      <Input v-model="keyword" placeholder="搜索标题或编号" class="w-48" />
      <Select v-model="statusFilter">
        <SelectTrigger class="w-28">
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" class="text-xs">全部状态</SelectItem>
          <SelectItem
            v-for="opt in supportTicketStatusOptions"
            :key="opt.value"
            :value="String(opt.value)"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="typeFilter">
        <SelectTrigger class="w-28">
          <SelectValue placeholder="类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" class="text-xs">全部类型</SelectItem>
          <SelectItem
            v-for="opt in supportTicketTypeOptions"
            :key="opt.value"
            :value="String(opt.value)"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      v-if="showPublicCards"
      class="public-ticket-list pt-3"
    >
      <div
        v-if="loadingList && !tickets.length"
        class="public-ticket-list__state py-12 flex justify-center"
      >
        <Spin />
      </div>
      <Empty
        v-else-if="!filteredTickets.length"
        class="public-ticket-list__state py-12"
        :description="filtering ? '没有符合条件的工单' : '暂无公开工单'"
      />
      <div
        v-else
        class="public-ticket-list__grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <PublicTicketCard
          v-for="ticket in filteredTickets"
          :key="ticket.id"
          :ticket="ticket"
          @click="openTicket(ticket.id)"
        />
      </div>
    </div>

    <div
      v-else-if="view === 'mine'"
      class="ticket-workspace pt-3"
      :class="{ 'ticket-workspace--detail': isDetailRoute }"
    >
      <aside class="ticket-list space-y-2">
        <div
          v-if="loadingList && !tickets.length"
          class="ticket-list__state py-8 flex justify-center"
        >
          <Spin />
        </div>
        <Empty
          v-else-if="!filteredTickets.length"
          class="ticket-list__state py-8"
          :description="filtering ? '没有符合条件的工单' : '还没有工单'"
        />
        <SupportTicketListItem
          v-for="ticket in filteredTickets"
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
      class="public-ticket-detail pt-3"
      :ticket="selectedTicket"
      :loading="loadingDetail"
      :editable="editable"
      @back="closeDetail"
      @refresh="refreshDetail"
    />

    <!-- 新建工单弹窗 -->
    <Dialog v-model:open="showCreate">
      <DialogContent class="sm:max-w-md p-4 space-y-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <DialogTitle class="text-sm font-semibold">新建工单</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <div class="space-y-1">
            <label class="font-medium text-foreground">类型 *</label>
            <Select
              :model-value="String(draft.type)"
              @update:model-value="draft.type = Number($event) as SupportTicketType"
            >
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in supportTicketTypeOptions"
                  :key="opt.value"
                  :value="String(opt.value)"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">标题 *</label>
            <Input v-model="draft.title" maxlength="160" placeholder="用一句话概括问题" />
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground">详细内容 *</label>
            <Textarea
              v-model="draft.content"
              rows="5"
              maxlength="5000"
              placeholder="说明发生了什么、如何复现，以及你期望的结果"
              class="text-xs resize-none"
            />
          </div>

          <!-- 图片上传 -->
          <div class="space-y-1.5">
            <label class="font-medium text-foreground">图片 (最多 5 张)</label>
            <div class="flex items-center gap-2 flex-wrap">
              <div
                v-for="(item, i) in fileList"
                :key="item.id"
                class="relative size-16 rounded-md border border-border overflow-hidden group"
              >
                <img :src="item.url" class="size-full object-cover" alt="" />
                <button
                  type="button"
                  class="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-80 hover:opacity-100"
                  @click="removeFile(i)"
                >
                  <component :is="Dismiss16Regular" class="size-2.5" />
                </button>
              </div>

              <button
                v-if="fileList.length < 5"
                type="button"
                class="size-16 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition"
                @click="fileInputRef?.click()"
              >
                <component :is="Image24Regular" class="size-5" />
                <span class="text-[10px]">添加</span>
              </button>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="onFileSelect"
              />
            </div>
          </div>

          <div class="flex items-center gap-4 pt-1">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox v-model:checked="draft.isPublic" />
              <span>公开此工单</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox v-model:checked="draft.emailOnStaffReply" />
              <span>站长回复时发送邮件</span>
            </label>
          </div>
        </div>

        <DialogFooter class="pt-2 border-t border-border/60">
          <Button variant="outline" :disabled="creating" @click="showCreate = false">
            取消
          </Button>
          <Button :disabled="creating || !draft.title.trim() || !draft.content.trim()" @click="submitTicket">
            创建工单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.ticket-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}
.ticket-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 16px;
  min-height: 520px;
}
@media (max-width: 768px) {
  .ticket-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
