<script setup lang="ts">
import { GitMerge } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { postApiSongListMergeDuplicates } from '@/api/songRequestExtras'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { toast } from '@/shared/utils'

const props = defineProps<{
  open: boolean
  songs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  merged: [payload: { primary: ResponseSongModel; removedKeys: string[] }]
}>()

function normalizeDuplicateKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s()（）[\]【】「」『』·•.,，。!！?？\-_~～'"“”‘’]/g, '')
}

interface DuplicateGroup {
  groupKey: string
  items: ResponseSongModel[]
}

const duplicateGroups = computed<DuplicateGroup[]>(() => {
  const map = new Map<string, ResponseSongModel[]>()
  for (const song of props.songs) {
    const norm = normalizeDuplicateKey(song.name)
    if (!norm) continue
    const list = map.get(norm) ?? []
    list.push(song)
    map.set(norm, list)
  }
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 1)
    .map(([groupKey, items]) => ({ groupKey, items }))
})

const selectedPrimaryByGroup = ref<Record<string, string>>({})
const mergingGroup = ref<string | null>(null)

watch(
  duplicateGroups,
  (groups) => {
    const next: Record<string, string> = { ...selectedPrimaryByGroup.value }
    for (const g of groups) {
      if (!next[g.groupKey] || !g.items.some((i) => i.key === next[g.groupKey])) {
        // 默认优先选有封面或被点次数最多的作为主曲目
        const sorted = [...g.items].toSorted(
          (a, b) =>
            (b.requestCount ?? 0) - (a.requestCount ?? 0) ||
            Number(Boolean(b.cover)) - Number(Boolean(a.cover)) ||
            Number(Boolean(b.url)) - Number(Boolean(a.url)),
        )
        next[g.groupKey] = sorted[0].key
      }
    }
    selectedPrimaryByGroup.value = next
  },
  { immediate: true },
)

async function mergeGroup(group: DuplicateGroup) {
  const primaryKey = selectedPrimaryByGroup.value[group.groupKey] ?? group.items[0]?.key
  if (!primaryKey) return
  const duplicateKeys = group.items.map((i) => i.key).filter((k) => k !== primaryKey)
  if (duplicateKeys.length === 0) return

  mergingGroup.value = group.groupKey
  try {
    const res = await postApiSongListMergeDuplicates({ primaryKey, duplicateKeys })
    if (res.code === 200 && res.data) {
      toast.success(`已合并 ${duplicateKeys.length} 首重复曲目至《${res.data.name}》`)
      emit('merged', { primary: res.data, removedKeys: duplicateKeys })
    } else {
      toast.error(res.message || '合并失败')
    }
  } catch (err) {
    toast.error(`合并失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    mergingGroup.value = null
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-1.5">
          <GitMerge class="size-4 text-primary" />
          曲库查重与合并
        </DialogTitle>
        <DialogDescription>
          按去空格与标点后的歌名自动检测疑似重复曲目。合并会保留主曲目、合并标签/别名并迁移历史点播关联。
        </DialogDescription>
      </DialogHeader>

      <Empty
        v-if="duplicateGroups.length === 0"
        description="太棒了，当前曲库未发现重复曲目"
        class="py-10"
      />

      <ScrollArea
        v-else
        class="max-h-[55vh] pr-2"
      >
        <div class="space-y-3">
          <div
            v-for="group in duplicateGroups"
            :key="group.groupKey"
            class="rounded-lg border border-border/80 bg-card p-3 space-y-2"
          >
            <div class="flex-between gap-2">
              <div class="flex items-center gap-2">
                <Badge
                  variant="warning"
                  size="xs"
                >
                  {{ group.items.length }} 条重复
                </Badge>
                <span class="text-xs font-medium text-foreground">{{ group.items[0].name }}</span>
              </div>
              <Button
                size="xs"
                variant="default"
                :loading="mergingGroup === group.groupKey"
                @click="mergeGroup(group)"
              >
                <GitMerge class="size-3.5 mr-1" />
                合并此组
              </Button>
            </div>

            <div class="space-y-1">
              <label
                v-for="item in group.items"
                :key="item.key"
                class="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors"
                :class="
                  selectedPrimaryByGroup[group.groupKey] === item.key
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border/60 hover:bg-muted/40'
                "
              >
                <div class="flex items-center gap-2 min-w-0">
                  <input
                    v-model="selectedPrimaryByGroup[group.groupKey]"
                    type="radio"
                    :name="`dup-${group.groupKey}`"
                    :value="item.key"
                    class="accent-primary"
                  />
                  <img
                    v-if="item.cover"
                    :src="item.cover"
                    :alt="item.name"
                    class="size-6 rounded object-cover shrink-0"
                    referrerpolicy="no-referrer"
                  />
                  <div class="min-w-0">
                    <div class="font-medium text-foreground truncate">
                      {{ item.name }}
                      <span
                        v-if="selectedPrimaryByGroup[group.groupKey] === item.key"
                        class="text-[11px] text-primary ml-1"
                      >
                        (保留为主曲目)
                      </span>
                    </div>
                    <div class="text-[11px] text-muted-foreground truncate">
                      {{ item.author?.join(' / ') || '未知原唱' }}
                      {{ item.tags?.length ? ` · 标签: ${item.tags.join(',')}` : '' }}
                    </div>
                  </div>
                </div>
                <span class="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  被点 {{ item.requestCount ?? 0 }} 次
                </span>
              </label>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button
          variant="outline"
          @click="emit('update:open', false)"
        >
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
