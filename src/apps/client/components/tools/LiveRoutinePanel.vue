<script setup lang="ts">
import { CheckCircle2, CircleSlash, Loader2, Play, PowerOff, XCircle } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import StartLiveConfirmDialog from '@/apps/client/components/tools/StartLiveConfirmDialog.vue'
import { useLiveRoutine } from '@/apps/client/store/useLiveRoutine'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useObsSceneControl } from '@/apps/client/store/useObsSceneControl'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'

const routine = useLiveRoutine()
const obs = useOBSStore()
const vts = useVtsStore()
const sceneCtrl = useObsSceneControl()
const showStartConfirm = ref(false)

onMounted(async () => {
  await routine.init()
  await sceneCtrl.refreshProjects()
  if (routine.config.start.obsSceneProjectId) {
    await sceneCtrl.loadProject(routine.config.start.obsSceneProjectId)
  }
})

const NONE = '__none__'

const obsProfileSelect = computed({
  get: () => routine.config.start.obsProfile || NONE,
  set: (v: string) => {
    routine.config.start.obsProfile = v === NONE ? '' : v
    void saveQuietly()
  },
})

const obsCollectionSelect = computed({
  get: () => routine.config.start.obsSceneCollection || NONE,
  set: (v: string) => {
    routine.config.start.obsSceneCollection = v === NONE ? '' : v
    void saveQuietly()
  },
})

const vtsPostPresetSelect = computed({
  get: () => routine.config.start.vtsPostProcessingPreset || NONE,
  set: (v: string) => {
    routine.config.start.vtsPostProcessingPreset = v === NONE ? '' : v
    void saveQuietly()
  },
})

const obsSceneProjectSelect = computed({
  get: () => (routine.config.start.obsSceneProjectId ? String(routine.config.start.obsSceneProjectId) : NONE),
  set: (v: string) => {
    const id = v === NONE ? null : Number(v)
    routine.config.start.obsSceneProjectId = id
    routine.config.start.obsSubSceneId = ''
    if (id) void sceneCtrl.loadProject(id)
    void saveQuietly()
  },
})

const obsSubSceneSelect = computed({
  get: () => routine.config.start.obsSubSceneId || NONE,
  set: (v: string) => {
    routine.config.start.obsSubSceneId = v === NONE ? '' : v
    void saveQuietly()
  },
})

const routineSubScenes = computed(() =>
  routine.config.start.obsSceneProjectId ? sceneCtrl.getSubScenesFor(routine.config.start.obsSceneProjectId) : [],
)

const postProcessingPresets = computed(() => vts.postProcessing?.presets ?? [])

const startSceneModel = computed({
  get: () => routine.config.start.obsTargetScene || NONE,
  set: (v: string) => {
    routine.config.start.obsTargetScene = v === NONE ? '' : v
    void saveQuietly()
  },
})

const vtsModelSelect = computed({
  get: () => routine.config.start.vtsModelId || NONE,
  set: (v: string) => {
    routine.config.start.vtsModelId = v === NONE ? '' : v
    void saveQuietly()
  },
})

const startPresetSelect = computed({
  get: () => routine.config.start.vtsPresetId || NONE,
  set: (v: string) => {
    routine.config.start.vtsPresetId = v === NONE ? '' : v
    void saveQuietly()
  },
})

const stopPresetSelect = computed({
  get: () => routine.config.stop.vtsPresetId || NONE,
  set: (v: string) => {
    routine.config.stop.vtsPresetId = v === NONE ? '' : v
    void saveQuietly()
  },
})

async function saveQuietly() {
  await routine.save()
}

async function saveAndNotify() {
  await routine.save()
  toast.success('已保存编排配置')
}
</script>

<template>
  <div class="space-y-3.5">
    <ClientMinVersionNotice
      feature="tool-manager"
      compact
      description="自动启动 OBS/VTS 与读取 OBS 配置需要客户端 ≥ v0.1.14；旧版本仍可执行连接、切场、VTS 预设与浮窗等纯前端步骤。"
    />

    <!-- 执行进度日志 -->
    <Card v-if="routine.stepLogs.length > 0">
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <CardTitle>最近一次编排执行记录</CardTitle>
        <Button
          size="xs"
          variant="ghost"
          :disabled="Boolean(routine.runningMode)"
          @click="routine.stepLogs = []"
        >
          清空记录
        </Button>
      </CardHeader>
      <CardContent class="p-3 space-y-1.5">
        <div
          v-for="log in routine.stepLogs"
          :key="log.id"
          class="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted/20"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Loader2
              v-if="log.status === 'running'"
              class="size-3.5 animate-spin text-primary shrink-0"
            />
            <CheckCircle2
              v-else-if="log.status === 'ok'"
              class="size-3.5 text-emerald-500 shrink-0"
            />
            <CircleSlash
              v-else-if="log.status === 'skipped'"
              class="size-3.5 text-muted-foreground shrink-0"
            />
            <XCircle
              v-else
              class="size-3.5 text-destructive shrink-0"
            />
            <span class="font-medium text-foreground truncate">{{ log.title }}</span>
          </div>
          <span class="text-[11px] text-muted-foreground truncate max-w-[50%]">{{ log.detail }}</span>
        </div>
      </CardContent>
    </Card>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      <!-- 一键开播准备 -->
      <Card>
        <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <CardTitle>一键开播准备流程</CardTitle>
            <Badge
              variant="outline"
              size="xs"
            >
              Start Routine
            </Badge>
          </div>
          <Button
            size="xs"
            class="gap-1.5"
            :disabled="Boolean(routine.runningMode)"
            @click="showStartConfirm = true"
          >
            <Loader2
              v-if="routine.runningMode === 'start'"
              class="size-3 animate-spin"
            />
            <Play
              v-else
              class="size-3"
            />
            执行开播准备
          </Button>
        </CardHeader>

        <CardContent class="p-3 space-y-2.5">
          <SettingRow
            type="switch"
            variant="compact"
            title="1. 启动 VTube Studio"
            description="需客户端 ≥ v0.1.14，已运行时自动跳过"
            v-model="routine.config.start.launchVts"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="2. 启动 OBS Studio"
            description="需客户端 ≥ v0.1.14，按预设启动参数拉起"
            v-model="routine.config.start.launchObs"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="3. 自动同步本机 OBS WebSocket 配置"
            description="需客户端 ≥ v0.1.14"
            v-model="routine.config.start.syncObsConfigFromDisk"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="4. 自动连接 OBS 与 VTS"
            :model-value="routine.config.start.connectObs && routine.config.start.connectVts"
            @update:model-value="
              (v: boolean) => {
                routine.config.start.connectObs = v
                routine.config.start.connectVts = v
                void saveQuietly()
              }
            "
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="5. 自动开启 OBS 回放缓存"
            v-model="routine.config.start.enableReplayBuffer"
            @update:model-value="saveQuietly"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <FormField
              label="切至 OBS Profile（可选）"
              class="min-w-0"
            >
              <Select
                v-if="obs.obsProfiles.length > 0"
                v-model="obsProfileSelect"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="留空不切换" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">留空不切换</SelectItem>
                  <SelectItem
                    v-for="p in obs.obsProfiles"
                    :key="p"
                    :value="p"
                  >
                    {{ p }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                v-model="routine.config.start.obsProfile"
                placeholder="留空不切换（连 OBS 后自动下拉）"
                @blur="saveAndNotify"
              />
            </FormField>
            <FormField
              label="切至 OBS 场景集合（可选）"
              class="min-w-0"
            >
              <Select
                v-if="obs.obsSceneCollections.length > 0"
                v-model="obsCollectionSelect"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="留空不切换" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">留空不切换</SelectItem>
                  <SelectItem
                    v-for="c in obs.obsSceneCollections"
                    :key="c"
                    :value="c"
                  >
                    {{ c }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                v-model="routine.config.start.obsSceneCollection"
                placeholder="留空不切换（连 OBS 后自动下拉）"
                @blur="saveAndNotify"
              />
            </FormField>
            <FormField
              label="切至 OBS 场景（留空优先用等待场景）"
              class="min-w-0"
            >
              <Select v-model="startSceneModel">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="跟随等待/开播场景" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">优先使用等待场景/开播场景</SelectItem>
                  <SelectItem
                    v-for="scene in obs.obsScenes"
                    :key="scene"
                    :value="scene"
                  >
                    {{ scene }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="切换 VTS 模型（可选）"
              class="min-w-0"
            >
              <Select v-model="vtsModelSelect">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="保持当前模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">保持当前模型</SelectItem>
                  <SelectItem
                    v-for="m in vts.availableModels"
                    :key="m.modelID"
                    :value="m.modelID"
                  >
                    {{ m.modelName }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="应用 VTS 机位预设（可选）"
              class="min-w-0"
            >
              <Select v-model="startPresetSelect">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="不调整机位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">不调整机位</SelectItem>
                  <SelectItem
                    v-for="p in vts.presets"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="启用 VTS 后处理预设（可选）"
              class="min-w-0"
            >
              <Select
                v-if="postProcessingPresets.length > 0"
                v-model="vtsPostPresetSelect"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="留空跳过" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NONE">留空跳过</SelectItem>
                  <SelectItem
                    v-for="preset in postProcessingPresets"
                    :key="preset"
                    :value="preset"
                  >
                    {{ preset }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                v-model="routine.config.start.vtsPostProcessingPreset"
                placeholder="连 VTS 后自动加载滤镜预设"
                @blur="saveAndNotify"
              />
            </FormField>
          </div>

          <!-- VTsuru 场景编辑器联动 (obs-scene) -->
          <div class="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
            <div class="text-xs font-medium text-foreground">联动 VTsuru 场景编辑器 (obs-scene)</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormField
                label="场景项目（可选）"
                class="min-w-0"
              >
                <Select v-model="obsSceneProjectSelect">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="不联动云端场景" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="NONE">不联动云端场景</SelectItem>
                    <SelectItem
                      v-for="p in sceneCtrl.projects"
                      :key="p.id"
                      :value="String(p.id)"
                    >
                      {{ p.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="目标子场景"
                class="min-w-0"
              >
                <Select
                  v-model="obsSubSceneSelect"
                  :disabled="!routine.config.start.obsSceneProjectId || routineSubScenes.length === 0"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="先选择场景项目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="NONE">不切换子场景</SelectItem>
                    <SelectItem
                      v-for="sub in routineSubScenes"
                      :key="sub.id"
                      :value="sub.id"
                    >
                      {{ sub.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <SettingRow
              v-if="routine.config.start.obsSceneProjectId && routine.config.start.obsSubSceneId"
              type="switch"
              variant="compact"
              title="开播时顺便推送布局到 OBS"
              description="确保浏览器源槽位与本地 OBS 源 Z 序就位"
              v-model="routine.config.start.syncObsSceneLayout"
              @update:model-value="saveQuietly"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <SettingRow
              type="switch"
              variant="compact"
              title="开弹幕浮窗"
              v-model="routine.config.start.openDanmakuWindow"
              @update:model-value="saveQuietly"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="开礼物浮窗"
              v-model="routine.config.start.openGiftWindow"
              @update:model-value="saveQuietly"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="启语音转写"
              v-model="routine.config.start.startTranscription"
              @update:model-value="saveQuietly"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 一键下播收尾 -->
      <Card>
        <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <CardTitle>一键下播收尾流程</CardTitle>
            <Badge
              variant="outline"
              size="xs"
            >
              Stop Routine
            </Badge>
          </div>
          <Button
            size="xs"
            variant="destructive"
            class="gap-1.5"
            :disabled="Boolean(routine.runningMode)"
            @click="routine.executeStopRoutine()"
          >
            <Loader2
              v-if="routine.runningMode === 'stop'"
              class="size-3 animate-spin"
            />
            <PowerOff
              v-else
              class="size-3"
            />
            执行下播收尾
          </Button>
        </CardHeader>

        <CardContent class="p-3 space-y-2.5">
          <SettingRow
            type="switch"
            variant="compact"
            title="1. 切换 OBS 至下播场景"
            :description="obs.obsSceneConfig.stopScene ? `目标：${obs.obsSceneConfig.stopScene}` : '请先在 OBS 控制页设置下播场景'"
            v-model="routine.config.stop.switchObsStopScene"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="2. 停止 OBS 推流"
            v-model="routine.config.stop.stopObsStream"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="3. 关闭 OBS 回放缓存"
            v-model="routine.config.stop.stopReplayBuffer"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="4. 清除 VTS 全部激活表情"
            v-model="routine.config.stop.vtsClearExpressions"
            @update:model-value="saveQuietly"
          />
          <SettingRow
            type="switch"
            variant="compact"
            title="5. 恢复 VTS 模型原色"
            v-model="routine.config.stop.vtsResetTint"
            @update:model-value="saveQuietly"
          />

          <FormField label="下播时切换 VTS 机位预设（可选）">
            <Select v-model="stopPresetSelect">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="不调整机位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE">不调整机位</SelectItem>
                <SelectItem
                  v-for="p in vts.presets"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <SettingRow
              type="switch"
              variant="compact"
              title="关弹幕浮窗"
              v-model="routine.config.stop.closeDanmakuWindow"
              @update:model-value="saveQuietly"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="关礼物浮窗"
              v-model="routine.config.stop.closeGiftWindow"
              @update:model-value="saveQuietly"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="停语音转写"
              v-model="routine.config.stop.stopTranscription"
              @update:model-value="saveQuietly"
            />
          </div>
        </CardContent>
      </Card>
    </div>
    <StartLiveConfirmDialog v-model:open="showStartConfirm" />
  </div>
</template>
