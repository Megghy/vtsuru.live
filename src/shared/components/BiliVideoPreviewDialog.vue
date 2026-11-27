<script setup lang="ts">
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { buildBiliPlayerUrl, buildBiliVideoUrl } from '@/shared/utils/videoCollect'

const props = withDefaults(
  defineProps<{
    open: boolean
    bvid: string
    title?: string
    page?: number
    subtitle?: string
  }>(),
  {
    title: '',
    page: 1,
    subtitle: '',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const currentPage = ref(1)

watch(
  () => [props.open, props.bvid, props.page] as const,
  ([isOpen, , initialPage]) => {
    if (isOpen) {
      currentPage.value = Math.max(1, Math.floor(initialPage || 1))
    }
  },
  { immediate: true },
)

const playerUrl = computed(() => buildBiliPlayerUrl(props.bvid, currentPage.value))

function openInBili() {
  if (!props.bvid) return
  window.open(buildBiliVideoUrl(props.bvid, currentPage.value), '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="truncate pr-6">
          {{ title || '视频预览' }}
        </DialogTitle>
        <DialogDescription class="flex items-center gap-2 flex-wrap text-xs">
          <span class="font-mono">{{ bvid }}</span>
          <Badge
            v-if="currentPage > 1"
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            P{{ currentPage }}
          </Badge>
          <span
            v-if="subtitle"
            class="text-muted-foreground truncate"
          >
            {{ subtitle }}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div class="w-full aspect-video bg-black rounded-lg overflow-hidden my-1">
        <iframe
          v-if="open && playerUrl"
          :key="playerUrl"
          :src="playerUrl"
          scrolling="no"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          class="w-full h-full"
        />
        <div
          v-else
          class="w-full h-full flex-center text-xs text-muted-foreground"
        >
          无法加载播放器预览，请尝试在哔哩哔哩打开
        </div>
      </div>

      <DialogFooter class="flex-between flex-wrap gap-2">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>分 P 切换</span>
          <Button
            size="icon-xs"
            variant="outline"
            :disabled="currentPage <= 1"
            aria-label="上一 P"
            @click="currentPage = Math.max(1, currentPage - 1)"
          >
            <ChevronLeft class="size-3.5" />
          </Button>
          <span class="font-mono tabular-nums min-w-8 text-center text-foreground">P{{ currentPage }}</span>
          <Button
            size="icon-xs"
            variant="outline"
            aria-label="下一 P"
            @click="currentPage = Math.min(999, currentPage + 1)"
          >
            <ChevronRight class="size-3.5" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <slot name="footer-extra" />
          <Button
            variant="outline"
            @click="openInBili"
          >
            <ExternalLink class="size-3.5 mr-1" />
            在哔哩哔哩打开
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
