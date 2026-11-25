<script setup lang="ts">
import { ref } from 'vue'

import router from '@/app/router'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Skeleton } from '@/shared/ui/skeleton'
import { useQuestionBox } from '@/store/useQuestionBox'

import QuestionBoxFollowUpComposer from './QuestionBoxFollowUpComposer.vue'

const useQB = useQuestionBox()
const composingId = ref<number>()

async function onSent() {
  composingId.value = undefined
  await useQB.GetSendQAInfo()
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return '-'
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  return `${Math.floor(diffSec / 86400)}天前`
}
</script>

<template>
  <div
    v-if="useQB.isLoadingSend && useQB.sendThreads.length === 0"
    class="space-y-3"
  >
    <Skeleton
      v-for="n in 3"
      :key="n"
      class="h-28 w-full rounded-lg"
    />
  </div>

  <Empty
    v-else-if="useQB.sendThreads.length === 0"
    description="暂无发送的提问"
    class="py-14 border border-dashed rounded-lg"
  />

  <div
    v-else
    class="space-y-3"
  >
    <Card
      v-for="thread in useQB.sendThreads"
      :key="thread.root.id"
      class="hover:border-brand/30 transition-colors"
    >
      <CardHeader class="p-3.5">
        <div class="flex-between text-xs">
          <div class="flex items-center gap-1.5">
            <Badge
              variant="outline"
              size="xs"
            >
              发给
            </Badge>
            <Button
              variant="link"
              class="h-auto p-0 font-semibold text-primary"
              @click="router.push(`/user/${thread.root.target.id}`)"
            >
              {{ thread.root.target.name }}
            </Button>
            <Badge
              v-if="thread.root.tag"
              variant="secondary"
              size="xs"
            >
              #{{ thread.root.tag }}
            </Badge>
          </div>

          <span class="text-muted-foreground font-mono tabular-nums">
            {{ formatRelativeTime(thread.root.sendAt) }}
          </span>
        </div>
      </CardHeader>

      <CardContent class="space-y-3">
        <div
          v-for="(entry, index) in [thread.root, ...thread.followUps]"
          :key="entry.id"
          class="space-y-2"
          :class="{ 'pt-3 border-t border-border/60': index > 0 }"
        >
          <div
            v-if="index > 0"
            class="flex-between text-[11px] text-muted-foreground"
          >
            <span class="font-medium">追问 {{ index }}</span>
            <span class="font-mono tabular-nums">{{ formatRelativeTime(entry.sendAt) }}</span>
          </div>

          <p class="text-sm text-foreground leading-relaxed m-0 whitespace-pre-wrap break-words">
            {{ entry.question?.message }}
          </p>

          <div
            v-if="entry.questionImages && entry.questionImages.length > 0"
            class="flex items-center gap-2 flex-wrap"
          >
            <ImagePreview
              v-for="(img, imgIdx) in entry.questionImages"
              :key="img.id || imgIdx"
              :src="img.path || ''"
              :alt="img.name || '提问附图'"
              :gallery="entry.questionImages"
              :index="imgIdx"
              class="h-16 w-20"
            />
          </div>

          <div
            v-if="entry.answer"
            class="p-3 rounded-md bg-muted/40 border border-border/60 space-y-1.5"
          >
            <div class="flex-between text-xs text-muted-foreground">
              <span class="font-medium">
                对方的回复
                <span
                  v-if="entry.isEdited"
                  class="text-[11px] text-muted-foreground/80 font-normal ml-1"
                >
                  (已编辑)
                </span>
              </span>
              <span
                v-if="entry.answer.createdAt"
                class="font-mono text-[11px] tabular-nums"
              >
                {{ formatRelativeTime(entry.answer.createdAt) }}
              </span>
            </div>
            <p class="text-xs text-foreground leading-relaxed m-0 whitespace-pre-wrap break-words">
              {{ entry.answer.message }}
            </p>
            <div
              v-if="entry.answerImages && entry.answerImages.length > 0"
              class="flex items-center gap-2 flex-wrap pt-1"
            >
              <ImagePreview
                v-for="(img, imgIdx) in entry.answerImages"
                :key="img.id || imgIdx"
                :src="img.path || ''"
                :alt="img.name || '回复附图'"
                :gallery="entry.answerImages"
                :index="imgIdx"
                class="h-16 w-20"
              />
            </div>
          </div>
        </div>

        <template v-if="thread.root.canFollowUp">
          <QuestionBoxFollowUpComposer
            v-if="composingId === thread.root.id"
            :root="thread.root"
            class="pt-3 border-t border-border/60"
            @sent="onSent"
          />
          <Button
            v-else
            variant="outline"
            @click="composingId = thread.root.id"
          >
            追问
          </Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
