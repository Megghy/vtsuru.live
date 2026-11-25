<script setup lang="ts">
import { CheckSquare, Download, Loader2, Play, Search, Square } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { type BiliCollectionVideoItem, parseBiliCollection } from '@/api/bili-extra'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'

const props = defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [items: BiliCollectionVideoItem[]]
}>()

const urlInput = ref('')
const parsing = ref(false)
const sourceTitle = ref('')
const items = ref<BiliCollectionVideoItem[]>([])
const selectedBvids = ref<Set<string>>(new Set())

const selectedItems = computed(() => items.value.filter((item) => selectedBvids.value.has(item.bvid)))

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatPlay(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(n || 0)
}

async function handleParse() {
  if (!urlInput.value.trim()) {
    toast.error('请粘贴 B 站公开收藏夹、合集链接或 BV 号')
    return
  }
  parsing.value = true
  try {
    const res = await parseBiliCollection(urlInput.value.trim())
    sourceTitle.value = res.title
    items.value = res.items
    selectedBvids.value = new Set(res.items.map((i) => i.bvid))
    if (res.items.length === 0) {
      toast.info('未解析到可用视频')
    } else {
      toast.success(`解析到 ${res.items.length} 个视频（${res.title}）`)
    }
  } catch (err) {
    toast.error('解析失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    parsing.value = false
  }
}

function toggleSelect(bvid: string) {
  const next = new Set(selectedBvids.value)
  if (next.has(bvid)) next.delete(bvid)
  else next.add(bvid)
  selectedBvids.value = next
}

function selectAll(checked: boolean) {
  selectedBvids.value = checked ? new Set(items.value.map((i) => i.bvid)) : new Set()
}

function handleConfirm() {
  if (selectedItems.value.length === 0) {
    toast.warning('请至少勾选一个视频')
    return
  }
  emit('confirm', selectedItems.value)
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ title || '从 B 站收藏夹 / 合集批量导入' }}</DialogTitle>
        <DialogDescription>
          {{ description || '支持粘贴公开收藏夹链接（ml / fid）、UP 主合集链接（space + sid）或一个/多个 BV 号' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-1">
        <FormField label="B 站链接或 BV 号">
          <div class="flex items-center gap-2">
            <Input
              v-model="urlInput"
              class="flex-1"
              placeholder="例如 https://space.bilibili.com/.../favlist?fid=123456 或 BV1xx..."
              @keyup.enter="handleParse"
            />
            <Button
              :disabled="parsing"
              @click="handleParse"
            >
              <Loader2
                v-if="parsing"
                class="size-3.5 mr-1 animate-spin"
              />
              <Search
                v-else
                class="size-3.5 mr-1"
              />
              解析
            </Button>
          </div>
        </FormField>

        <div
          v-if="items.length > 0"
          class="space-y-2"
        >
          <div class="flex-between text-xs text-muted-foreground">
            <span>{{ sourceTitle }} · 已选 {{ selectedItems.length }} / {{ items.length }}</span>
            <div class="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                @click="selectAll(true)"
              >
                <CheckSquare class="size-3.5 mr-1" />
                全选
              </Button>
              <Button
                variant="ghost"
                size="xs"
                @click="selectAll(false)"
              >
                <Square class="size-3.5 mr-1" />
                清空
              </Button>
            </div>
          </div>

          <div class="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
            <label
              v-for="item in items"
              :key="item.bvid"
              class="flex items-center gap-2.5 rounded-md border border-border bg-muted/20 px-2.5 py-2 cursor-pointer hover:border-primary/40"
            >
              <Checkbox
                :checked="selectedBvids.has(item.bvid)"
                @update:checked="toggleSelect(item.bvid)"
              />
              <img
                v-if="item.cover"
                :src="item.cover"
                referrerpolicy="no-referrer"
                class="w-16 aspect-video rounded-sm object-cover shrink-0 bg-muted"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium truncate">{{ item.title }}</div>
                <div class="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                  <span class="font-mono">{{ item.bvid }}</span>
                  <span>{{ formatDuration(item.duration) }}</span>
                  <span class="inline-flex items-center gap-0.5">
                    <Play class="size-3" />
                    {{ formatPlay(item.play) }}
                  </span>
                  <span v-if="item.ownerName">UP: {{ item.ownerName }}</span>
                  <Badge
                    v-if="item.pages.length > 1"
                    variant="outline"
                    class="text-[10px] px-1 py-0"
                  >
                    {{ item.pages.length }}P
                  </Badge>
                </div>
              </div>
            </label>
          </div>
        </div>

        <Empty
          v-else
          description="粘贴链接点击「解析」即可预览并勾选导入"
        />
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          :disabled="selectedItems.length === 0"
          @click="handleConfirm"
        >
          <Download class="size-3.5 mr-1.5" />
          {{ confirmLabel || `确认导入 (${selectedItems.length})` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
