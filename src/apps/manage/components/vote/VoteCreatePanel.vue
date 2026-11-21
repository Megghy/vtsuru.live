<script setup lang="ts">
import { Bookmark, FileUp, Play, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  type CreateVotePayload,
  getMultiVoteModeLabel,
  VOTE_MULTI_MODE_OPTIONS,
  type VoteConfigModel,
  VoteMultiMode,
  type VoteTemplateItem,
} from '@/api/vote'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { VOTE_QUICK_PRESETS, type VotePreset } from '@/shared/utils/votePresets'

const props = defineProps<{
  config: VoteConfigModel
  templates: VoteTemplateItem[]
  hasActiveVote: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  create: [payload: CreateVotePayload]
  saveTemplate: [template: VoteTemplateItem]
  deleteTemplate: [templateId: string]
}>()

const title = ref(props.config.voteTitle || '观众投票')
const options = ref<string[]>(
  props.config.defaultOptions?.length >= 2 ? [...props.config.defaultOptions] : ['选项 1', '选项 2'],
)
const durationSeconds = ref(props.config.voteDurationSeconds ?? 60)
const multiVoteMode = ref<VoteMultiMode>(props.config.multiVoteMode ?? VoteMultiMode.Single)

const hasEditedForm = ref(false)
watch(
  () => [props.config.voteTitle, props.config.defaultOptions, props.config.voteDurationSeconds, props.config.multiVoteMode] as const,
  ([cfgTitle, cfgOptions, cfgDuration, cfgMode]) => {
    if (hasEditedForm.value) return
    if (cfgTitle) title.value = cfgTitle
    if (cfgOptions?.length >= 2) options.value = [...cfgOptions]
    durationSeconds.value = cfgDuration ?? 60
    multiVoteMode.value = cfgMode ?? VoteMultiMode.Single
  },
)

const validOptions = computed(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const raw of options.value) {
    const clean = raw.trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      list.push(clean)
    }
  }
  return list
})

const canSubmit = computed(() => !props.busy && title.value.trim().length > 0 && validOptions.value.length >= 2)

// 二次确认覆盖进行中投票
const overwriteConfirmOpen = ref(false)

// 批量导入弹窗
const batchModalOpen = ref(false)
const batchText = ref('')

// 保存模板弹窗
const saveTemplateOpen = ref(false)
const templateName = ref('')

function addOption() {
  if (options.value.length >= 50) {
    toast.warning('最多支持 50 个选项')
    return
  }
  hasEditedForm.value = true
  options.value.push('')
}

function removeOptionAt(index: number) {
  if (options.value.length <= 2) return
  hasEditedForm.value = true
  options.value.splice(index, 1)
}

function resetOptions() {
  hasEditedForm.value = true
  options.value = ['', '']
}

function openBatchImport() {
  batchText.value = options.value.filter((o) => o.trim()).join('\n')
  batchModalOpen.value = true
}

function confirmBatchImport() {
  const lines = batchText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50)
  if (lines.length < 2) {
    toast.warning('请至少输入 2 行有效选项')
    return
  }
  hasEditedForm.value = true
  options.value = lines
  batchModalOpen.value = false
  toast.success(`已导入 ${lines.length} 个选项`)
}

function applyPreset(preset: VotePreset) {
  hasEditedForm.value = true
  title.value = preset.title
  options.value = [...preset.options]
  if (preset.durationSeconds !== undefined) durationSeconds.value = preset.durationSeconds
  if (preset.multiVoteMode !== undefined) multiVoteMode.value = preset.multiVoteMode
  toast.success(`已应用「${preset.name}」`)
}

function openSaveTemplate() {
  if (!title.value.trim() || validOptions.value.length < 2) {
    toast.warning('请先填写标题和至少 2 个有效选项')
    return
  }
  templateName.value = title.value.trim().slice(0, 24)
  saveTemplateOpen.value = true
}

function confirmSaveTemplate() {
  const name = templateName.value.trim()
  if (!name) {
    toast.warning('请输入模板名称')
    return
  }
  emit('saveTemplate', {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    title: title.value.trim(),
    options: [...validOptions.value],
    durationSeconds: Math.max(0, durationSeconds.value || 0),
    multiVoteMode: multiVoteMode.value,
  })
  saveTemplateOpen.value = false
}

function submitCreate() {
  if (!canSubmit.value) return
  if (props.hasActiveVote) {
    overwriteConfirmOpen.value = true
    return
  }
  doEmitCreate()
}

function doEmitCreate() {
  overwriteConfirmOpen.value = false
  emit('create', {
    title: title.value.trim(),
    options: validOptions.value,
    multiVoteMode: multiVoteMode.value,
    durationSeconds: durationSeconds.value > 0 ? durationSeconds.value : null,
  })
}

function fillFromHistory(historyTitle: string, historyOptions: string[], historyMode?: VoteMultiMode) {
  hasEditedForm.value = true
  title.value = historyTitle
  options.value = historyOptions.length >= 2 ? [...historyOptions] : ['选项 1', '选项 2']
  if (historyMode !== undefined) multiVoteMode.value = historyMode
}

defineExpose({ fillFromHistory })
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
    <!-- 左：发起投票表单 -->
    <Card class="border-border bg-card">
      <CardHeader class="pb-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle class="text-sm font-semibold">发起新投票</CardTitle>
            <CardDescription class="text-xs">
              观众发送序号、选项文本或「{{ config.voteCommand || '投票' }} 选项」即可参与
            </CardDescription>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <Button
              v-for="preset in VOTE_QUICK_PRESETS"
              :key="preset.name"
              variant="ghost"
              size="xs"
              @click="applyPreset(preset)"
            >
              <Sparkles class="size-3 text-brand" />
              {{ preset.name }}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="space-y-4">
        <FormField
          label="投票主题"
          :extra="`${title.length}/100`"
        >
          <Input
            v-model="title"
            maxlength="100"
            placeholder="例如：下一局玩什么游戏？"
            @input="hasEditedForm = true"
          />
        </FormField>

        <div class="space-y-2">
          <div class="flex-between gap-2">
            <span class="text-xs font-medium text-foreground">
              投票选项（{{ validOptions.length }}/{{ options.length }}）
            </span>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                @click="openBatchImport"
              >
                <FileUp class="size-3.5" />
                批量导入
              </Button>
              <Button
                variant="ghost"
                size="xs"
                @click="resetOptions"
              >
                <RotateCcw class="size-3.5" />
                重置
              </Button>
            </div>
          </div>

          <div class="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
            <div
              v-for="(_, index) in options"
              :key="index"
              class="flex items-center gap-1.5"
            >
              <span class="w-5 text-center text-xs text-muted-foreground tabular-nums shrink-0">
                {{ index + 1 }}.
              </span>
              <Input
                v-model="options[index]"
                maxlength="40"
                :placeholder="`选项 ${index + 1}`"
                @input="hasEditedForm = true"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="options.length <= 2"
                title="删除该选项"
                @click="removeOptionAt(index)"
              >
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            class="w-full border-dashed"
            :disabled="options.length >= 50"
            @click="addOption"
          >
            <Plus class="size-3.5" />
            添加选项（最多 50 项）
          </Button>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <FormField
            label="持续时长（秒）"
            description="设为 0 表示不限时，需手动结束"
          >
            <NumberField
              v-model="durationSeconds"
              :min="0"
              :max="3600"
              :step="30"
              @update:model-value="hasEditedForm = true"
            />
          </FormField>

          <FormField
            label="投票模式"
            :description="VOTE_MULTI_MODE_OPTIONS.find((m) => m.value === multiVoteMode)?.description"
          >
            <Select
              :model-value="String(multiVoteMode)"
              @update:model-value="
                (v) => {
                  hasEditedForm = true
                  multiVoteMode = Number(v) as VoteMultiMode
                }
              "
            >
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in VOTE_MULTI_MODE_OPTIONS"
                  :key="opt.value"
                  :value="String(opt.value)"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            :disabled="busy"
            @click="openSaveTemplate"
          >
            <Bookmark class="size-3.5" />
            存为云端模板
          </Button>

          <Button
            :disabled="!canSubmit"
            @click="submitCreate"
          >
            <Play class="size-3.5" />
            {{ hasActiveVote ? '覆盖并重新发起' : '立即发起投票' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 右：云端模板库 -->
    <Card class="border-border bg-card flex flex-col">
      <CardHeader class="pb-3">
        <div class="flex-between gap-2">
          <CardTitle class="text-sm font-semibold">我的模板</CardTitle>
          <Badge variant="secondary" class="tabular-nums">{{ templates.length }}</Badge>
        </div>
        <CardDescription class="text-xs">
          模板已自动同步至账号云端，换设备开播可直接复用
        </CardDescription>
      </CardHeader>

      <CardContent class="flex-1 min-h-0">
        <Empty
          v-if="templates.length === 0"
          description="暂无自定义模板，填好左侧内容后点击「存为云端模板」"
        />
        <div
          v-else
          class="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin"
        >
          <div
            v-for="tpl in templates"
            :key="tpl.id"
            class="group rounded-md border border-border p-2.5 list-item-interactive"
            @click="applyPreset(tpl)"
          >
            <div class="flex-between gap-2">
              <span class="text-xs font-semibold truncate">{{ tpl.name }}</span>
              <div @click.stop>
                <Popconfirm @positive-click="emit('deleteTemplate', tpl.id)">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="opacity-60 group-hover:opacity-100"
                      title="删除模板"
                    >
                      <Trash2 class="size-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </template>
                  确定删除模板「{{ tpl.name }}」？
                </Popconfirm>
              </div>
            </div>
            <p class="mt-0.5 text-[11px] text-muted-foreground truncate">{{ tpl.title }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1">
              <Badge variant="outline" class="text-[10px]">{{ tpl.options.length }} 项</Badge>
              <Badge variant="outline" class="text-[10px] tabular-nums">
                {{ tpl.durationSeconds > 0 ? `${tpl.durationSeconds}s` : '不限时' }}
              </Badge>
              <Badge variant="outline" class="text-[10px]">
                {{ getMultiVoteModeLabel(tpl.multiVoteMode) }}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 覆盖进行中投票确认 -->
    <AlertDialog v-model:open="overwriteConfirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>覆盖当前进行中的投票？</AlertDialogTitle>
          <AlertDialogDescription>
            当前仍有一场投票正在计票。确认后会立即结算当前投票，并用新配置开启下一场投票。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction @click="doEmitCreate">确认覆盖发起</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 批量导入弹窗 -->
    <Dialog v-model:open="batchModalOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量导入选项</DialogTitle>
          <DialogDescription>每行一个选项，自动去除空行与首尾空格（最多 50 项）</DialogDescription>
        </DialogHeader>
        <Textarea
          v-model="batchText"
          rows="8"
          placeholder="选项 A&#10;选项 B&#10;选项 C"
        />
        <DialogFooter>
          <Button variant="outline" @click="batchModalOpen = false">取消</Button>
          <Button @click="confirmBatchImport">确认导入</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 保存模板弹窗 -->
    <Dialog v-model:open="saveTemplateOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>保存为云端模板</DialogTitle>
          <DialogDescription>将同时保存标题、选项、时长和投票模式</DialogDescription>
        </DialogHeader>
        <FormField label="模板名称">
          <Input
            v-model="templateName"
            maxlength="30"
            placeholder="例如：周末选游戏"
            @keyup.enter="confirmSaveTemplate"
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" @click="saveTemplateOpen = false">取消</Button>
          <Button @click="confirmSaveTemplate">保存模板</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
