<script setup lang="ts">
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  ExternalLink,
  MessageSquare,
  Play,
  RotateCcw,
  Trash2,
  User,
  Video,
  X,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { VideoCollectInfo, VideoData } from '@/api/generated/model'
import { VideoStatus } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import {
  buildBiliVideoUrl,
  formatVideoDuration,
  normalizeBiliCoverUrl,
  normalizeTimestamp,
} from '@/shared/utils/videoCollect'

const props = withDefaults(
  defineProps<{
    videoInfo: VideoCollectInfo
    videoData: VideoData
    loading?: boolean
    selectable?: boolean
    selected?: boolean
    viewMode?: 'list' | 'grid'
  }>(),
  {
    loading: false,
    selectable: true,
    selected: false,
    viewMode: 'list',
  },
)

const emit = defineEmits<{
  updateStatus: [status: VideoStatus, video: VideoCollectInfo]
  reject: [video: VideoCollectInfo, title: string]
  removeVideo: [video: VideoCollectInfo]
  removeSender: [video: VideoCollectInfo, senderIndex: number]
  toggleSelect: [bvid: string]
  preview: [bvid: string, title: string, page: number]
}>()

const coverError = ref(false)
const isExpandedSenders = ref(false)

const bvid = computed(() => props.videoInfo.bvid ?? props.videoData.id ?? '')
const videoPage = computed(() => Math.max(1, props.videoInfo.page || 1))
const coverUrl = computed(() => normalizeBiliCoverUrl(props.videoData.cover))
const primarySender = computed(() => props.videoInfo.senders[0])
const otherSenders = computed(() => props.videoInfo.senders.slice(1))

const publishDateText = computed(() => {
  if (!props.videoData.publistTime) return ''
  try {
    return format(normalizeTimestamp(props.videoData.publistTime), 'yyyy-MM-dd')
  } catch {
    return ''
  }
})

const actions = computed(() => {
  if (props.videoInfo.status === VideoStatus.Pending) {
    return [
      { label: '通过', status: VideoStatus.Accepted, variant: 'brand' as const, icon: Check },
      { label: '拒绝', status: VideoStatus.Rejected, variant: 'destructive' as const, icon: X },
    ]
  }
  if (props.videoInfo.status === VideoStatus.Accepted) {
    return [
      { label: '退回待审', status: VideoStatus.Pending, variant: 'outline' as const, icon: RotateCcw },
      { label: '拒绝', status: VideoStatus.Rejected, variant: 'destructive' as const, icon: X },
    ]
  }
  return [
    { label: '退回待审', status: VideoStatus.Pending, variant: 'outline' as const, icon: RotateCcw },
    { label: '通过', status: VideoStatus.Accepted, variant: 'brand' as const, icon: Check },
  ]
})

function formatRelative(time: unknown) {
  try {
    return formatDistanceToNow(normalizeTimestamp(time), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

function openVideo() {
  if (!bvid.value) return
  window.open(buildBiliVideoUrl(bvid.value, videoPage.value), '_blank', 'noopener,noreferrer')
}

function triggerPreview() {
  if (!bvid.value) return
  emit('preview', bvid.value, props.videoData.title, videoPage.value)
}

function handleAction(status: VideoStatus) {
  if (status === VideoStatus.Rejected) {
    emit('reject', props.videoInfo, props.videoData.title)
  } else {
    emit('updateStatus', status, props.videoInfo)
  }
}
</script>

<template>
  <!-- 紧凑列表行视图 -->
  <article
    v-if="viewMode === 'list'"
    class="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/30 transition-colors text-foreground"
    :class="{
      'border-brand ring-1 ring-brand bg-brand-soft/10': selected,
      'border-l-4 border-l-emerald-500': videoInfo.status === VideoStatus.Accepted,
      'border-l-4 border-l-destructive opacity-80': videoInfo.status === VideoStatus.Rejected,
    }"
  >
    <!-- 选择框 -->
    <div
      v-if="selectable"
      class="shrink-0 cursor-pointer pt-0.5 sm:pt-0"
      @click.stop="emit('toggleSelect', bvid)"
    >
      <Checkbox
        :checked="selected"
        @update:checked="emit('toggleSelect', bvid)"
      />
    </div>

    <!-- 缩略图与悬浮预览 -->
    <div
      class="relative w-28 sm:w-32 aspect-[16/9] rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer group"
      role="button"
      tabindex="0"
      :aria-label="`播放预览：${videoData.title}`"
      @click="triggerPreview"
      @keydown.enter="triggerPreview"
    >
      <img
        v-if="!coverError && coverUrl"
        :src="coverUrl"
        :alt="videoData.title"
        class="w-full h-full object-cover transition-transform group-hover:scale-105"
        referrerpolicy="no-referrer"
        @error="coverError = true"
      />
      <div
        v-else
        class="w-full h-full flex-center text-muted-foreground"
      >
        <Video class="size-5" />
      </div>

      <div class="absolute inset-0 bg-black/40 flex-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play class="size-6 text-white fill-white drop-shadow" />
      </div>

      <span
        v-if="videoPage > 1"
        class="absolute left-1 top-1 px-1 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white leading-none"
      >
        P{{ videoPage }}
      </span>

      <span
        class="absolute right-1 bottom-1 px-1 py-0.5 rounded bg-black/75 text-[10px] font-mono tabular-nums text-white leading-none"
      >
        {{ formatVideoDuration(videoData.length) }}
      </span>
    </div>

    <!-- 主体元数据与推荐理由 -->
    <div class="min-w-0 flex-1 space-y-1.5 basis-full sm:basis-auto">
      <!-- 标题行 -->
      <div class="flex items-start sm:items-center gap-1.5 flex-wrap min-w-0">
        <SimpleTooltip :content="videoData.title">
          <Button
            variant="link"
            size="none"
            class="font-semibold text-xs text-foreground hover:text-brand text-left whitespace-normal break-words line-clamp-2 sm:line-clamp-1 max-w-full sm:max-w-sm justify-start"
            @click="triggerPreview"
          >
            {{ videoData.title }}
          </Button>
        </SimpleTooltip>

        <SimpleTooltip content="在哔哩哔哩新窗口打开">
          <Button
            variant="ghost"
            size="icon-xs"
            class="shrink-0"
            aria-label="在哔哩哔哩新窗口打开"
            @click.stop="openVideo"
          >
            <ExternalLink class="size-3.5" />
          </Button>
        </SimpleTooltip>

        <code class="px-1 py-0.5 rounded bg-muted/60 text-[10px] font-mono text-muted-foreground border border-border">
          {{ bvid }}
        </code>

        <Badge
          v-if="videoData.partitionName"
          variant="outline"
          size="xs"
        >
          {{ videoData.partitionName }}
        </Badge>

        <Badge
          v-if="videoInfo.watched"
          variant="secondary"
          size="xs"
          class="gap-1 text-emerald-600 dark:text-emerald-400"
        >
          <Eye class="size-3" />
          已看
        </Badge>
      </div>

      <!-- UP主与发布日期 -->
      <div class="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
        <SimpleTooltip :content="`UP 主: ${videoData.ownerName}`">
          <span class="inline-flex items-center gap-1 max-w-[160px]">
            <User class="size-3 shrink-0" />
            <span class="truncate">{{ videoData.ownerName }}</span>
          </span>
        </SimpleTooltip>
        <span
          v-if="publishDateText"
          class="inline-flex items-center gap-1 font-mono tabular-nums"
        >
          <Clock class="size-3 shrink-0" />
          发布于 {{ publishDateText }}
        </span>
      </div>

      <!-- 拒绝理由 -->
      <div
        v-if="videoInfo.status === VideoStatus.Rejected && videoInfo.rejectReason"
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-destructive/10 text-destructive text-[11px]"
      >
        <span>拒绝理由：{{ videoInfo.rejectReason }}</span>
      </div>

      <!-- 推荐信息行 -->
      <div class="flex items-center gap-2 text-xs flex-wrap">
        <template v-if="primarySender">
          <SimpleTooltip
            v-if="primarySender.description"
            :content="primarySender.description"
          >
            <div
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 border border-border text-[11px] text-muted-foreground max-w-full sm:max-w-lg truncate"
            >
              <MessageSquare class="size-3 text-brand shrink-0" />
              <span class="italic text-foreground truncate">“{{ primarySender.description }}”</span>
              <span class="text-muted-foreground shrink-0">
                — {{ primarySender.sender || '匿名用户' }}
                <span v-if="primarySender.senderId">({{ primarySender.senderId }})</span>
                · {{ formatRelative(primarySender.sendAt) }}
              </span>
            </div>
          </SimpleTooltip>

          <div
            v-else
            class="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            <User class="size-3" />
            <span>{{ primarySender.sender || '匿名用户' }}</span>
            <span v-if="primarySender.senderId">(UID {{ primarySender.senderId }})</span>
            <span>· {{ formatRelative(primarySender.sendAt) }}</span>
          </div>

          <Button
            v-if="otherSenders.length > 0"
            variant="outline"
            size="none"
            class="px-1.5 py-0.5 text-[10px] gap-1"
            @click="isExpandedSenders = !isExpandedSenders"
          >
            <span>共 {{ videoInfo.senders.length }} 人推荐</span>
            <ChevronUp
              v-if="isExpandedSenders"
              class="size-3"
            />
            <ChevronDown
              v-else
              class="size-3"
            />
          </Button>
        </template>
        <span
          v-else
          class="text-xs text-muted-foreground"
        >
          无推荐人信息
        </span>
      </div>

      <!-- 折叠的全部推荐人列表（支持移除不当留言） -->
      <div
        v-if="isExpandedSenders && videoInfo.senders.length > 1"
        class="mt-1 p-2 rounded-md bg-muted/20 border border-border space-y-1.5 text-[11px] text-muted-foreground"
      >
        <div
          v-for="(sender, idx) in videoInfo.senders"
          :key="idx"
          class="flex-between gap-2"
        >
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            <span class="font-medium text-foreground">{{ sender.sender || '匿名用户' }}</span>
            <span v-if="sender.senderId">UID {{ sender.senderId }}</span>
            <span>{{ formatRelative(sender.sendAt) }}</span>
            <span
              v-if="sender.description"
              class="italic text-foreground"
            >
              “{{ sender.description }}”
            </span>
          </div>
          <Popconfirm
            title="移除该推荐记录？"
            positive-text="移除"
            negative-text="取消"
            @positive-click="emit('removeSender', videoInfo, idx)"
          >
            <template #trigger>
              <span class="inline-flex shrink-0">
                <SimpleTooltip content="移除此条推荐记录">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive"
                    aria-label="移除此条推荐记录"
                  >
                    <X class="size-3" />
                  </Button>
                </SimpleTooltip>
              </span>
            </template>
            仅移除这条观众推荐记录；若这是唯一推荐记录，该视频也将一并移除。
          </Popconfirm>
        </div>
      </div>
    </div>

    <!-- 操作按钮组 -->
    <div class="video-actions flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end">
      <Button
        v-for="action in actions"
        :key="action.status"
        size="xs"
        :variant="action.variant"
        :loading="loading"
        @click="handleAction(action.status)"
      >
        <component
          :is="action.icon"
          class="size-3 mr-1"
        />
        {{ action.label }}
      </Button>

      <Popconfirm
        title="彻底删除此投稿？"
        positive-text="删除"
        negative-text="取消"
        @positive-click="emit('removeVideo', videoInfo)"
      >
        <template #trigger>
          <span class="inline-flex">
            <SimpleTooltip content="彻底删除此投稿">
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-muted-foreground hover:text-destructive"
                :disabled="loading"
                aria-label="彻底删除此投稿"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </SimpleTooltip>
          </span>
        </template>
        删除后该视频及所有关联推荐记录将从本征集表移除，无法恢复。
      </Popconfirm>
    </div>
  </article>

  <!-- 网格大图卡片视图 -->
  <article
    v-else
    class="rounded-lg border border-border bg-card overflow-hidden hover:border-brand/40 transition-colors flex flex-col text-foreground"
    :class="{
      'border-brand ring-1 ring-brand bg-brand-soft/10': selected,
      'border-t-4 border-t-emerald-500': videoInfo.status === VideoStatus.Accepted,
      'border-t-4 border-t-destructive opacity-80': videoInfo.status === VideoStatus.Rejected,
    }"
  >
    <div class="relative w-full aspect-[16/9] bg-muted group cursor-pointer">
      <div
        class="w-full h-full"
        role="button"
        tabindex="0"
        :aria-label="`播放预览：${videoData.title}`"
        @click="triggerPreview"
        @keydown.enter="triggerPreview"
      >
        <img
          v-if="!coverError && coverUrl"
          :src="coverUrl"
          :alt="videoData.title"
          class="w-full h-full object-cover transition-transform group-hover:scale-105"
          referrerpolicy="no-referrer"
          @error="coverError = true"
        />
        <div
          v-else
          class="w-full h-full flex-col-center text-muted-foreground text-xs gap-1"
        >
          <Video class="size-6" />
          <span>封面无法加载</span>
        </div>

        <div class="absolute inset-0 bg-black/40 flex-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play class="size-9 text-white fill-white drop-shadow" />
        </div>

        <span
          v-if="videoData.partitionName"
          class="absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded bg-black/65 text-[10px] text-white"
        >
          {{ videoData.partitionName }}
        </span>

        <span
          class="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono tabular-nums text-white flex items-center gap-1"
        >
          <Clock class="size-2.5" />
          <template v-if="videoPage > 1">P{{ videoPage }} · </template>
          {{ formatVideoDuration(videoData.length) }}
        </span>
      </div>

      <div
        v-if="selectable"
        class="absolute left-2 top-2 p-1 rounded bg-black/50 backdrop-blur-sm cursor-pointer"
        @click.stop="emit('toggleSelect', bvid)"
      >
        <Checkbox
          :checked="selected"
          @update:checked="emit('toggleSelect', bvid)"
        />
      </div>
    </div>

    <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-1">
          <SimpleTooltip :content="videoData.title">
            <Button
              variant="link"
              size="none"
              class="font-semibold text-xs text-foreground hover:text-brand text-left line-clamp-2 justify-start whitespace-normal"
              @click="triggerPreview"
            >
              {{ videoData.title }}
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content="在哔哩哔哩新窗口打开">
            <Button
              variant="ghost"
              size="icon-xs"
              class="shrink-0"
              aria-label="在哔哩哔哩新窗口打开"
              @click.stop="openVideo"
            >
              <ExternalLink class="size-3.5" />
            </Button>
          </SimpleTooltip>
        </div>

        <div class="flex-between text-[11px] text-muted-foreground gap-2">
          <SimpleTooltip :content="`UP 主: ${videoData.ownerName}`">
            <span class="flex items-center gap-1 truncate min-w-0">
              <User class="size-3 shrink-0" />
              <span class="truncate">{{ videoData.ownerName }}</span>
            </span>
          </SimpleTooltip>
          <code class="font-mono text-[10px] bg-muted/60 px-1 py-0.5 rounded shrink-0">{{ bvid }}</code>
        </div>

        <div
          v-if="publishDateText || videoInfo.watched"
          class="flex-between text-[11px] text-muted-foreground"
        >
          <span
            v-if="publishDateText"
            class="font-mono tabular-nums"
          >
            发布于 {{ publishDateText }}
          </span>
          <Badge
            v-if="videoInfo.watched"
            variant="secondary"
            size="xs"
            class="gap-1 text-emerald-600 dark:text-emerald-400"
          >
            <Eye class="size-3" />
            已看
          </Badge>
        </div>

        <div
          v-if="videoInfo.status === VideoStatus.Rejected && videoInfo.rejectReason"
          class="px-2 py-1 rounded bg-destructive/10 text-destructive text-[11px]"
        >
          拒绝理由：{{ videoInfo.rejectReason }}
        </div>

        <!-- 推荐信息（支持展开全部推荐人） -->
        <div
          v-if="primarySender"
          class="text-xs pt-1 space-y-1.5"
        >
          <div
            v-if="primarySender.description"
            class="p-2 rounded bg-muted/30 border border-border text-[11px] text-muted-foreground space-y-1"
          >
            <SimpleTooltip :content="primarySender.description">
              <p class="italic text-foreground line-clamp-2">“{{ primarySender.description }}”</p>
            </SimpleTooltip>
            <div class="flex-between text-[10px]">
              <span class="truncate">{{ primarySender.sender || '匿名用户' }}</span>
              <span class="shrink-0">{{ formatRelative(primarySender.sendAt) }}</span>
            </div>
          </div>
          <div
            v-else
            class="flex-between text-[11px] text-muted-foreground"
          >
            <span class="truncate">{{ primarySender.sender || '匿名用户' }}</span>
            <span class="shrink-0">{{ formatRelative(primarySender.sendAt) }}</span>
          </div>

          <Button
            v-if="otherSenders.length > 0"
            variant="outline"
            size="none"
            class="w-full justify-center py-0.5 px-2 text-[10px] gap-1"
            @click="isExpandedSenders = !isExpandedSenders"
          >
            <span>共 {{ videoInfo.senders.length }} 人推荐</span>
            <ChevronUp
              v-if="isExpandedSenders"
              class="size-3"
            />
            <ChevronDown
              v-else
              class="size-3"
            />
          </Button>

          <div
            v-if="isExpandedSenders && videoInfo.senders.length > 1"
            class="p-2 rounded bg-muted/20 border border-border space-y-1 text-[11px] text-muted-foreground max-h-36 overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="(sender, idx) in videoInfo.senders"
              :key="idx"
              class="flex-between gap-1.5"
            >
              <div class="min-w-0">
                <span class="font-medium text-foreground">{{ sender.sender || '匿名用户' }}</span>
                <span v-if="sender.description">：“{{ sender.description }}”</span>
              </div>
              <Popconfirm
                title="移除此推荐？"
                positive-text="移除"
                negative-text="取消"
                @positive-click="emit('removeSender', videoInfo, idx)"
              >
                <template #trigger>
                  <span class="inline-flex shrink-0">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-muted-foreground hover:text-destructive"
                      aria-label="移除此条推荐记录"
                    >
                      <X class="size-3" />
                    </Button>
                  </span>
                </template>
                确定移除该观众的推荐记录吗？
              </Popconfirm>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="video-actions flex items-center gap-1 pt-2 border-t border-border">
        <Button
          v-for="action in actions"
          :key="action.status"
          size="xs"
          :variant="action.variant"
          :loading="loading"
          class="flex-1"
          @click="handleAction(action.status)"
        >
          <component
            :is="action.icon"
            class="size-3 mr-1"
          />
          {{ action.label }}
        </Button>

        <Popconfirm
          title="彻底删除此投稿？"
          positive-text="删除"
          negative-text="取消"
          @positive-click="emit('removeVideo', videoInfo)"
        >
          <template #trigger>
            <span class="inline-flex">
              <SimpleTooltip content="彻底删除此投稿">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  :disabled="loading"
                  aria-label="彻底删除此投稿"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </SimpleTooltip>
            </span>
          </template>
          删除后无法恢复，确定删除吗？
        </Popconfirm>
      </div>
    </div>
  </article>
</template>
