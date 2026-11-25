<script setup lang="ts">
import { Copy, ExternalLink, Film, Link2, Loader2, Pin, Sparkles, Wand2 } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  fetchLiveReplayInfo,
  generateLiveTimelineChapters,
  type LiveReplayMatchCandidate,
  type LiveTimelineChapter,
  matchLiveReplayCandidates,
  saveLiveReplayInfo,
} from '@/api/bili-extra'
import { isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Textarea } from '@/shared/ui/textarea'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  liveId: string
}>()

const inTauri = isTauri()
const replayBvid = ref('')
const replayAid = ref<number>(0)
const replayTitle = ref('')
const replayOffsetSeconds = ref(0)

const saving = ref(false)
const matching = ref(false)
const candidates = ref<LiveReplayMatchCandidate[]>([])

const generating = ref(false)
const chapters = ref<LiveTimelineChapter[]>([])
const commentDraft = ref('')
const postingComment = ref(false)

const replayJumpBaseUrl = computed(() =>
  replayBvid.value.trim() ? `https://www.bilibili.com/video/${replayBvid.value.trim()}` : '',
)

function buildJumpUrl(offsetSeconds: number) {
  if (!replayJumpBaseUrl.value) return ''
  const sec = Math.max(0, Math.floor(offsetSeconds - replayOffsetSeconds.value))
  return `${replayJumpBaseUrl.value}?t=${sec}`
}

async function loadReplayInfo() {
  if (!props.liveId) return
  try {
    const info = await fetchLiveReplayInfo(props.liveId)
    replayBvid.value = info.replayBvid || ''
    replayAid.value = info.replayAid || 0
    replayTitle.value = info.replayTitle || ''
    replayOffsetSeconds.value = info.replayOffsetSeconds || 0
  } catch {
    // 未绑定过时保持默认
  }
}

async function handleSave() {
  if (!replayBvid.value.trim()) {
    toast.error('请填写 B 站录播 BV 号')
    return
  }
  saving.value = true
  try {
    const saved = await saveLiveReplayInfo({
      liveId: props.liveId,
      replayBvid: replayBvid.value.trim(),
      replayAid: replayAid.value || undefined,
      replayTitle: replayTitle.value.trim() || undefined,
      replayOffsetSeconds: replayOffsetSeconds.value,
    })
    replayBvid.value = saved.replayBvid || replayBvid.value
    replayAid.value = saved.replayAid || replayAid.value
    replayTitle.value = saved.replayTitle || replayTitle.value
    toast.success('已保存本场录播关联')
  } catch (err) {
    toast.error('保存录播关联失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    saving.value = false
  }
}

async function handleAutoMatch() {
  matching.value = true
  try {
    candidates.value = await matchLiveReplayCandidates(props.liveId)
    if (candidates.value.length === 0) {
      toast.info('未在主播近期投稿中找到时间接近的录播视频')
    }
  } catch (err) {
    toast.error('自动匹配录播失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    matching.value = false
  }
}

function selectCandidate(item: LiveReplayMatchCandidate) {
  replayBvid.value = item.bvid
  replayAid.value = item.aid
  replayTitle.value = item.title
  void handleSave()
}

async function handleGenerateChapters() {
  generating.value = true
  try {
    const res = await generateLiveTimelineChapters(props.liveId)
    chapters.value = res.chapters
    commentDraft.value = res.commentText
    if (res.chapters.length === 0) {
      toast.info('本场弹幕样本较少，未检测到明显波峰时间点')
    }
  } catch (err) {
    toast.error('生成空降目录失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    generating.value = false
  }
}

async function handlePostAndPinComment() {
  if (!replayAid.value || replayAid.value <= 0) {
    toast.error('请先保存关联的录播 BV 号以获取视频 AID')
    return
  }
  if (!commentDraft.value.trim()) {
    toast.error('空降目录评论内容不能为空')
    return
  }
  postingComment.value = true
  try {
    const { postBiliVideoComment, topBiliVideoComment } = await import('@/apps/client/api/bili-reply')
    const { rpid } = await postBiliVideoComment(replayAid.value, commentDraft.value)
    if (rpid > 0) {
      await topBiliVideoComment(replayAid.value, rpid, 1)
      toast.success('空降目录已发送至录播评论区并置顶')
    } else {
      toast.success('空降目录评论已发送')
    }
  } catch (err) {
    toast.error('评论发送或置顶失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    postingComment.value = false
  }
}

watch(() => props.liveId, loadReplayInfo)
onMounted(loadReplayInfo)
</script>

<template>
  <div class="space-y-4">
    <!-- 录播绑定 -->
    <Card>
      <CardHeader class="p-4 border-b flex-between flex-row flex-wrap gap-2">
        <div>
          <CardTitle class="text-sm font-semibold flex items-center gap-1.5">
            <Film class="size-4 text-brand" />
            B 站录播关联
          </CardTitle>
          <CardDescription class="text-xs">
            将本场直播与 B 站录播投稿关联，点击高能章节可直接带时间戳空降播放
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="xs"
          :disabled="matching"
          @click="handleAutoMatch"
        >
          <Loader2
            v-if="matching"
            class="size-3.5 mr-1 animate-spin"
          />
          <Wand2
            v-else
            class="size-3.5 mr-1"
          />
          自动匹配录播
        </Button>
      </CardHeader>
      <CardContent class="p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField
            label="录播 BV 号"
            description="支持粘贴视频链接或 BV 号"
          >
            <Input
              v-model="replayBvid"
              placeholder="BV1xxxxxxxxx"
            />
          </FormField>
          <FormField
            label="录播标题（自动补全）"
          >
            <Input
              v-model="replayTitle"
              placeholder="保存后自动从 B 站拉取"
            />
          </FormField>
          <FormField
            label="录播起始偏移（秒）"
            description="录播相对开播时间晚开始填正数，早开始填负数"
          >
            <NumberField
              v-model="replayOffsetSeconds"
              :min="-3600"
              :max="3600"
            />
          </FormField>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            :disabled="saving"
            @click="handleSave"
          >
            <Link2 class="size-3.5 mr-1.5" />
            {{ saving ? '保存中...' : '保存录播关联' }}
          </Button>
          <Button
            v-if="replayJumpBaseUrl"
            variant="outline"
            as="a"
            :href="replayJumpBaseUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink class="size-3.5 mr-1.5" />
            打开 B 站录播
          </Button>
        </div>

        <div
          v-if="candidates.length > 0"
          class="space-y-1.5 border-t border-border pt-3"
        >
          <div class="text-xs font-medium text-muted-foreground">匹配到的候选录播（点击直接关联）</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              v-for="c in candidates"
              :key="c.bvid"
              type="button"
              class="flex items-center gap-2.5 text-left rounded-md border border-border bg-muted/20 p-2 hover:border-primary/50 transition-colors"
              @click="selectCandidate(c)"
            >
              <img
                v-if="c.cover"
                :src="c.cover"
                referrerpolicy="no-referrer"
                class="w-20 aspect-video rounded-sm object-cover shrink-0 bg-muted"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium truncate">{{ c.title }}</div>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  {{ c.bvid }} · {{ new Date(c.pubdate * 1000).toLocaleString() }}
                </div>
              </div>
              <Badge
                variant="secondary"
                class="shrink-0 tabular-nums"
              >
                匹配度 {{ c.score }}%
              </Badge>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 高能空降目录生成 & 一键置顶评论 -->
    <Card>
      <CardHeader class="p-4 border-b flex-between flex-row flex-wrap gap-2">
        <div>
          <CardTitle class="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles class="size-4 text-amber-500" />
            高能空降时间轴与评论置顶
          </CardTitle>
          <CardDescription class="text-xs">
            结合本场弹幕密度波峰与付费/互动事件，自动生成标准 B 站评论区空降目录
          </CardDescription>
        </div>
        <Button
          size="xs"
          :disabled="generating"
          @click="handleGenerateChapters"
        >
          <Loader2
            v-if="generating"
            class="size-3.5 mr-1 animate-spin"
          />
          <Sparkles
            v-else
            class="size-3.5 mr-1"
          />
          生成空降目录
        </Button>
      </CardHeader>
      <CardContent class="p-4 space-y-3">
        <Empty
          v-if="chapters.length === 0 && !commentDraft"
          description="点击右上角「生成空降目录」分析本场弹幕波峰与高光时间点"
        />
        <template v-else>
          <div class="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
            <div
              v-for="(ch, idx) in chapters"
              :key="`${ch.offsetSeconds}-${idx}`"
              class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono font-semibold text-brand shrink-0">{{ ch.timeText }}</span>
                <span class="truncate">{{ ch.label }}</span>
              </div>
              <Button
                v-if="replayJumpBaseUrl"
                variant="ghost"
                size="xs"
                as="a"
                :href="buildJumpUrl(ch.offsetSeconds)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink class="size-3 mr-1" />
                空降
              </Button>
            </div>
          </div>

          <FormField
            label="评论区空降目录文本（可直接编辑）"
          >
            <Textarea
              v-model="commentDraft"
              class="min-h-[120px] font-mono text-xs"
            />
          </FormField>

          <div class="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              @click="
                copyToClipboard(commentDraft);
                toast.success('已复制空降目录文本')
              "
            >
              <Copy class="size-3.5 mr-1.5" />
              复制目录
            </Button>
            <Button
              v-if="inTauri"
              :disabled="postingComment || !replayAid"
              @click="handlePostAndPinComment"
            >
              <Loader2
                v-if="postingComment"
                class="size-3.5 mr-1.5 animate-spin"
              />
              <Pin
                v-else
                class="size-3.5 mr-1.5"
              />
              {{ postingComment ? '发布置顶中...' : '一键发评论并置顶' }}
            </Button>
            <span
              v-else
              class="text-xs text-muted-foreground"
            >
              在桌面客户端中登录主账号可直接一键发评论并置顶
            </span>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
