<script setup lang="ts">
import { AlertTriangle, Keyboard, Play, Plus, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import {
  CLIENT_SHORTCUT_ACTION_META,
  type ClientShortcutActionType,
  type ClientShortcutItem,
  useClientShortcuts,
} from '@/apps/client/store/useClientShortcuts'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useObsSceneControl } from '@/apps/client/store/useObsSceneControl'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

const shortcuts = useClientShortcuts()
const obs = useOBSStore()
const vts = useVtsStore()
const sceneCtrl = useObsSceneControl()
const recordingId = ref<string | null>(null)

onMounted(async () => {
  await shortcuts.init()
  const list = await sceneCtrl.refreshProjects()
  await Promise.all(list.map((p) => sceneCtrl.loadProject(p.id)))
})

const actionOptions = computed(() =>
  (Object.keys(CLIENT_SHORTCUT_ACTION_META) as ClientShortcutActionType[]).map((key) => ({
    value: key,
    label: CLIENT_SHORTCUT_ACTION_META[key].label,
    group: CLIENT_SHORTCUT_ACTION_META[key].group,
  })),
)

function targetOptionsFor(item: ClientShortcutItem): Array<{ label: string; value: string }> {
  switch (item.actionType) {
    case 'obs_switch_scene':
      return obs.obsScenes.map((s) => ({ label: s, value: s }))
    case 'obs_scene_switch': {
      const opts: Array<{ label: string; value: string }> = []
      for (const proj of sceneCtrl.projects) {
        const subs = sceneCtrl.getSubScenesFor(proj.id)
        for (const sub of subs) {
          opts.push({ label: `${proj.name} / ${sub.name}`, value: `${proj.id}:${sub.id}` })
        }
      }
      return opts
    }
    case 'obs_toggle_mute':
      return obs.obsInputs.map((i) => ({ label: i, value: i }))
    case 'vts_preset':
      return vts.presets.map((p) => ({ label: p.name, value: p.id }))
    case 'vts_hotkey':
      return vts.hotkeys.map((h) => ({ label: h.name || h.hotkeyID, value: h.hotkeyID }))
    case 'vts_macro':
      return vts.macros.map((m) => ({ label: m.name, value: m.id }))
    default:
      return []
  }
}

function formatKeyEvent(event: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Super')

  let key = event.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  parts.push(key)
  return parts.join('+')
}

function handleRecordKey(item: ClientShortcutItem, event: KeyboardEvent) {
  if (recordingId.value !== item.id) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    recordingId.value = null
    return
  }
  if (event.key === 'Backspace' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    recordingId.value = null
    void shortcuts.upsertItem({ ...item, shortcut: '' })
    return
  }
  const combo = formatKeyEvent(event)
  if (!combo) return
  recordingId.value = null
  void shortcuts.upsertItem({ ...item, shortcut: combo })
}

async function testRun(item: ClientShortcutItem) {
  try {
    await shortcuts.executeItem(item)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <div class="space-y-3.5">
    <ClientMinVersionNotice
      feature="global-shortcut"
      compact
    />

    <Alert
      v-if="shortcuts.shortcutConflicts.length > 0"
      variant="warning"
    >
      <AlertTriangle class="size-4" />
      <AlertTitle>检测到跨模块全局快捷键冲突</AlertTitle>
      <AlertDescription class="text-xs space-y-1">
        <div
          v-for="c in shortcuts.shortcutConflicts"
          :key="c.shortcut"
        >
          <span class="font-mono font-semibold">{{ c.shortcut }}</span> 同时绑定了：{{ c.owners.join('、') }}
        </div>
      </AlertDescription>
    </Alert>

    <Alert
      v-if="shortcuts.registerError"
      variant="destructive"
    >
      <AlertDescription class="text-xs">{{ shortcuts.registerError }}</AlertDescription>
    </Alert>

    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <Keyboard class="size-4 text-primary" />
          <CardTitle>全局热键中心</CardTitle>
          <Badge
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ shortcuts.items.length }}
          </Badge>
        </div>
        <Button
          size="xs"
          class="gap-1.5"
          @click="shortcuts.addItem('obs_save_replay')"
        >
          <Plus class="size-3.5" />
          添加全局热键
        </Button>
      </CardHeader>

      <CardContent class="p-3 space-y-2.5">
        <Empty
          v-if="shortcuts.items.length === 0"
          description="统一绑定 OBS 切场/静音/保存高光、VTS 预设/校准、浮窗显隐与读弹幕跳过，支持系统级后台触发"
        />

        <div
          v-for="item in shortcuts.items"
          :key="item.id"
          class="p-2.5 rounded-md border border-border bg-muted/20 space-y-2"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <Switch
              :checked="item.enabled"
              @update:checked="(v) => shortcuts.upsertItem({ ...item, enabled: v })"
            />
            <Badge
              variant="outline"
              size="xs"
            >
              {{ CLIENT_SHORTCUT_ACTION_META[item.actionType].group }}
            </Badge>
            <Input
              v-model="item.label"
              placeholder="备注名称"
              class="w-36"
              @blur="shortcuts.upsertItem({ ...item })"
            />
            <div class="min-w-[180px] flex-1">
              <Select
                :model-value="item.actionType"
                @update:model-value="
                  (v) =>
                    v &&
                    shortcuts.upsertItem({
                      ...item,
                      actionType: v as ClientShortcutActionType,
                      targetId: '',
                    })
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in actionOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 录制组合键 -->
            <Button
              size="xs"
              :variant="recordingId === item.id ? 'default' : 'outline'"
              class="min-w-[120px] font-mono"
              @click="recordingId = recordingId === item.id ? null : item.id"
              @keydown="handleRecordKey(item, $event)"
            >
              {{ recordingId === item.id ? '请按下组合键...' : item.shortcut || '点击录制热键' }}
            </Button>

            <Button
              size="icon-xs"
              variant="ghost"
              title="测试执行"
              @click="testRun(item)"
            >
              <Play class="size-3.5" />
            </Button>
            <Popconfirm
              title="确认删除此热键？"
              @confirm="shortcuts.removeItem(item.id)"
            >
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-destructive"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </Popconfirm>
          </div>

          <div
            v-if="CLIENT_SHORTCUT_ACTION_META[item.actionType].needsTarget"
            class="flex items-center gap-2 pl-9 flex-wrap"
          >
            <span class="text-[11px] text-muted-foreground shrink-0">
              {{ CLIENT_SHORTCUT_ACTION_META[item.actionType].needsTarget }}:
            </span>
            <div
              v-if="targetOptionsFor(item).length > 0"
              class="w-56"
            >
              <Select
                :model-value="item.targetId ?? ''"
                @update:model-value="(v) => shortcuts.upsertItem({ ...item, targetId: String(v ?? '') })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择目标" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in targetOptionsFor(item)"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              v-model="item.targetId"
              placeholder="或手动输入目标名/ID"
              class="w-56"
              @blur="shortcuts.upsertItem({ ...item })"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
