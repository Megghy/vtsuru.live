<script setup lang="ts">
import { Loader2, Send } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { publishBiliDynamicWithBlobs, setTopBiliDynamic } from '@/apps/client/api/bili-dynamic'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Textarea } from '@/shared/ui/textarea'

const props = defineProps<{
  open: boolean
  blobs: Blob[]
  defaultText?: string
  title?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  published: [dynId: string]
}>()

const text = ref('')
const pin = ref(false)
const publishing = ref(false)
const progress = ref('')
const previews = ref<string[]>([])

function revokePreviews() {
  for (const url of previews.value) URL.revokeObjectURL(url)
  previews.value = []
}

watch(
  () => [props.open, props.blobs] as const,
  ([isOpen, blobs]) => {
    revokePreviews()
    if (isOpen) {
      text.value = props.defaultText ?? ''
      previews.value = blobs.slice(0, 9).map((b) => URL.createObjectURL(b))
    }
  },
  { immediate: true },
)

onUnmounted(revokePreviews)

const countLabel = computed(() => `${Math.min(props.blobs.length, 9)} 张图片`)

async function handleSubmit() {
  publishing.value = true
  progress.value = ''
  try {
    const dynId = await publishBiliDynamicWithBlobs(
      text.value,
      props.blobs.slice(0, 9).map((blob, i) => ({ blob, filename: `vtsuru_${i + 1}.png` })),
      (done, total) => {
        progress.value = `上传图片 ${done}/${total}...`
      },
    )
    if (pin.value) {
      await setTopBiliDynamic(dynId).catch(() => {})
    }
    toast.success('已发布到 B 站动态', { description: `动态 ID: ${dynId}` })
    emit('published', dynId)
    emit('update:open', false)
  } catch (err) {
    toast.error('发布 B 站动态失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    publishing.value = false
    progress.value = ''
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ title || '一键发布到 B 站动态' }}</DialogTitle>
        <DialogDescription>将使用客户端主账号 Cookie 上传 {{ countLabel }}并发布图文动态</DialogDescription>
      </DialogHeader>
      <div class="space-y-3 py-1">
        <FormField label="动态正文">
          <Textarea
            v-model="text"
            class="min-h-[84px]"
            placeholder="输入配文（可选）..."
          />
        </FormField>

        <div
          v-if="previews.length > 0"
          class="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto scrollbar-thin"
        >
          <img
            v-for="url in previews"
            :key="url"
            :src="url"
            class="w-full aspect-square object-cover rounded border border-border bg-muted"
          />
        </div>

        <SettingRow
          type="switch"
          variant="compact"
          title="发布后自动置顶该动态"
          v-model="pin"
        />
      </div>
      <DialogFooter class="flex-between sm:justify-between">
        <span class="text-xs text-muted-foreground">{{ progress }}</span>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
          <Button
            :disabled="publishing"
            @click="handleSubmit"
          >
            <Loader2
              v-if="publishing"
              class="size-3.5 mr-1.5 animate-spin"
            />
            <Send
              v-else
              class="size-3.5 mr-1.5"
            />
            {{ publishing ? '发布中...' : '立即发布' }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
