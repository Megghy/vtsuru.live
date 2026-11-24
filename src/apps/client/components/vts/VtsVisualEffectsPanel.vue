<script setup lang="ts">
import { Check, Crosshair, Palette, Plus, RefreshCw, RotateCcw, Search, Sparkles, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const customColor = ref('#ff6b9d')
const fadeTime = ref(0.3)
const refreshing = ref(false)
const tintScope = ref<'all' | 'part'>('all')
const partKeyword = ref('')
const selectedArtMeshes = ref<string[]>([])
const selectedArtMeshTag = ref('__none__')
const artMeshSearch = ref('')
const pickingArtMesh = ref(false)

const filteredArtMeshNames = computed(() => {
  const all = vts.artMeshInfo?.artMeshNames ?? []
  const q = artMeshSearch.value.trim().toLowerCase()
  const matched = q ? all.filter((name) => name.toLowerCase().includes(q)) : all
  return matched.slice(0, 60)
})

function toggleArtMeshName(name: string) {
  if (selectedArtMeshes.value.includes(name)) {
    selectedArtMeshes.value = selectedArtMeshes.value.filter((n) => n !== name)
  } else {
    selectedArtMeshes.value = [...selectedArtMeshes.value, name]
  }
}

const currentMatcher = computed(() => {
  if (tintScope.value === 'all') return undefined
  const nameExact = selectedArtMeshes.value.length > 0 ? selectedArtMeshes.value : undefined
  const nameContains = partKeyword.value.trim() ? [partKeyword.value.trim()] : undefined
  const tagExact =
    selectedArtMeshTag.value && selectedArtMeshTag.value !== '__none__' ? [selectedArtMeshTag.value] : undefined
  if (!nameExact && !nameContains && !tagExact) return undefined
  return { tintAll: false, nameExact, nameContains, tagExact }
})

const TINT_PRESETS = [
  { name: '恢复原色', targetId: 'reset', color: '#ffffff', reset: true },
  { name: '彩虹循环', targetId: 'rainbow', color: '', rainbow: true },
  { name: '暗影黑化', targetId: '#3b3b4f', color: '#3b3b4f' },
  { name: '心动粉', targetId: '#ff8fb1', color: '#ff8fb1' },
  { name: '冰霜蓝', targetId: '#7dd3fc', color: '#7dd3fc' },
  { name: '暖日金', targetId: '#fcd34d', color: '#fcd34d' },
  { name: '警告红', targetId: '#f87171', color: '#f87171' },
  { name: '森系绿', targetId: '#86efac', color: '#86efac' },
] as const

function applyPresetTint(preset: (typeof TINT_PRESETS)[number]) {
  run(
    () =>
      vts.tintModel({
        colorHex: preset.color || undefined,
        rainbow: 'rainbow' in preset ? preset.rainbow : false,
        reset: 'reset' in preset ? preset.reset : false,
        artMeshMatcher: 'reset' in preset && preset.reset ? undefined : currentMatcher.value,
      }),
    `已应用：${preset.name}`,
  )
}

function applyCustomTint() {
  run(
    () => vts.tintModel({ colorHex: customColor.value, artMeshMatcher: currentMatcher.value }),
    currentMatcher.value ? '已应用分部位染色' : '已应用染色',
  )
}

async function pickArtMeshesFromVts() {
  if (pickingArtMesh.value || !vts.connected) return
  pickingArtMesh.value = true
  try {
    toast.info('请在 VTube Studio 窗口中点选目标部位并确认')
    const res = await vts.selectArtMeshesInVts({ activeArtMeshes: selectedArtMeshes.value })
    if (res.success) {
      selectedArtMeshes.value = res.activeArtMeshes
      tintScope.value = 'part'
      toast.success(`已选中 ${res.activeArtMeshes.length} 个部位`)
    }
  } catch (err) {
    toast.error(`部位点选失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    pickingArtMesh.value = false
  }
}

function addTintToDeck(targetId: string, label: string, color?: string) {
  run(
    () => vts.upsertDeckTile({ ...newDeckTile('colorTint', targetId, label, '视觉'), color: color || undefined }),
    '已加入操作台',
  )
}

function togglePostProcessing(enabled: boolean) {
  run(() => vts.updatePostProcessing({ enabled, fadeTime: fadeTime.value }), enabled ? '已开启滤镜' : '已关闭滤镜')
}

function applyFilterPreset(preset: string) {
  run(() => vts.updatePostProcessing({ enabled: true, preset, fadeTime: fadeTime.value }), `已切换滤镜：${preset}`)
}

function addFilterToDeck(preset: string, label: string) {
  run(() => vts.upsertDeckTile(newDeckTile('postProcessing', preset, label, '视觉')), '已加入操作台')
}

function refreshPostProcessing() {
  if (refreshing.value) return
  refreshing.value = true
  run(async () => {
    try {
      await vts.refreshPostProcessing()
    } finally {
      refreshing.value = false
    }
  }, '已刷新滤镜列表')
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
    <!-- 模型染色 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Palette class="size-4 text-primary" />
          <CardTitle>模型染色</CardTitle>
        </div>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          :disabled="!vts.connected"
          @click="run(() => vts.tintModel({ reset: true }), '已恢复原色')"
        >
          <RotateCcw class="size-3" />
          恢复原色
        </Button>
      </CardHeader>

      <CardContent class="p-3 space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div
            v-for="p in TINT_PRESETS"
            :key="p.name"
            class="flex items-center gap-1 min-w-0"
          >
            <Button
              variant="outline"
              class="flex-1 min-w-0 justify-start px-2 gap-1.5"
              :disabled="!vts.connected"
              @click="applyPresetTint(p)"
            >
              <span
                class="size-3 rounded-full shrink-0 border border-border"
                :style="
                  'rainbow' in p
                    ? { background: 'conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#c084fc,#f87171)' }
                    : { backgroundColor: p.color }
                "
              />
              <span class="truncate">{{ p.name }}</span>
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              class="shrink-0 text-muted-foreground"
              title="加入操作台"
              @click="addTintToDeck(p.targetId, p.name, p.color || undefined)"
            >
              <Plus class="size-3" />
            </Button>
          </div>
        </div>

        <FormField
          label="染色范围（全模型 / 分部位 ArtMesh）"
          description="可单独染头发、眼睛、衣服等局部 ArtMesh，支持直接在 VTS 中点选部位"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                v-model="tintScope"
                type="single"
                class="w-44 grid grid-cols-2"
              >
                <ToggleGroupItem value="all">全模型</ToggleGroupItem>
                <ToggleGroupItem value="part">分部位</ToggleGroupItem>
              </ToggleGroup>
              <Button
                v-if="tintScope === 'part'"
                size="xs"
                variant="outline"
                class="gap-1"
                :disabled="!vts.connected || pickingArtMesh"
                @click="pickArtMeshesFromVts"
              >
                <Crosshair class="size-3" />
                {{ pickingArtMesh ? '等待 VTS 点选...' : '在 VTS 中点选部位' }}
              </Button>
              <Button
                v-if="tintScope === 'part' && selectedArtMeshes.length > 0"
                size="xs"
                variant="ghost"
                @click="selectedArtMeshes = []"
              >
                清空已选 ({{ selectedArtMeshes.length }})
              </Button>
            </div>

            <div
              v-if="tintScope === 'part'"
              class="space-y-2 rounded-md border border-border bg-muted/20 p-2.5"
            >
              <!-- 模型 ArtMesh 标签快捷分组芯片 -->
              <div
                v-if="(vts.artMeshInfo?.artMeshTags.length ?? 0) > 0"
                class="flex items-center gap-1 flex-wrap"
              >
                <span class="text-[11px] text-muted-foreground shrink-0">分组标签:</span>
                <Button
                  type="button"
                  size="xs"
                  :variant="selectedArtMeshTag === '__none__' ? 'default' : 'outline'"
                  @click="selectedArtMeshTag = '__none__'"
                >
                  全部
                </Button>
                <Button
                  v-for="tag in vts.artMeshInfo?.artMeshTags ?? []"
                  :key="tag"
                  type="button"
                  size="xs"
                  :variant="selectedArtMeshTag === tag ? 'default' : 'outline'"
                  @click="selectedArtMeshTag = selectedArtMeshTag === tag ? '__none__' : tag"
                >
                  {{ tag }}
                </Button>
              </div>

              <!-- 关键词 + 可搜索 ArtMesh 多选 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  v-model="partKeyword"
                  placeholder="模糊关键词匹配（如 Hair / Eye）"
                />
                <div class="relative">
                  <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    v-model="artMeshSearch"
                    class="pl-8"
                    placeholder="搜索精确 ArtMesh 勾选..."
                  />
                </div>
              </div>

              <div
                v-if="filteredArtMeshNames.length > 0"
                class="max-h-28 overflow-y-auto scrollbar-thin flex flex-wrap gap-1 pt-1"
              >
                <button
                  v-for="mesh in filteredArtMeshNames"
                  :key="mesh"
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors"
                  :class="
                    selectedArtMeshes.includes(mesh)
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
                  "
                  @click="toggleArtMeshName(mesh)"
                >
                  <Check
                    v-if="selectedArtMeshes.includes(mesh)"
                    class="size-2.5 shrink-0"
                  />
                  <span class="truncate max-w-[140px]">{{ mesh }}</span>
                </button>
              </div>
              <div
                v-else-if="vts.connected"
                class="text-[11px] text-muted-foreground"
              >
                {{ (vts.artMeshInfo?.artMeshNames.length ?? 0) === 0 ? '当前模型暂未读取到 ArtMesh 列表' : '无匹配的 ArtMesh 部位' }}
              </div>
            </div>

            <div
              v-if="tintScope === 'part' && selectedArtMeshes.length > 0"
              class="flex items-center gap-1 flex-wrap"
            >
              <Badge
                v-for="mesh in selectedArtMeshes.slice(0, 10)"
                :key="mesh"
                variant="secondary"
                size="xs"
                class="gap-1"
              >
                <span>{{ mesh }}</span>
                <button
                  type="button"
                  class="hover:text-destructive"
                  @click="toggleArtMeshName(mesh)"
                >
                  <X class="size-2.5" />
                </button>
              </Badge>
              <span
                v-if="selectedArtMeshes.length > 10"
                class="text-[11px] text-muted-foreground"
              >
                +{{ selectedArtMeshes.length - 10 }}
              </span>
            </div>
          </div>
        </FormField>

        <FormField
          label="自定义颜色"
          description="按上方选定范围应用叠加色，适合礼物/弹幕整活"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <ColorPicker
              :model-value="customColor"
              @update:model-value="(v: string) => (customColor = v || '#ffffff')"
            />
            <Button
              :disabled="!vts.connected"
              @click="applyCustomTint"
            >
              应用染色
            </Button>
            <Button
              variant="outline"
              class="gap-1"
              @click="addTintToDeck(customColor, '自定义染色', customColor)"
            >
              <Plus class="size-3.5" />
              加入操作台
            </Button>
          </div>
        </FormField>
      </CardContent>
    </Card>

    <!-- 后处理滤镜 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Sparkles class="size-4 text-primary" />
          <CardTitle>后处理滤镜</CardTitle>
          <Badge
            v-if="vts.postProcessing"
            :variant="vts.postProcessing.active ? 'success' : 'secondary'"
            size="xs"
          >
            {{ vts.postProcessing.active ? vts.postProcessing.activePreset || '已开启' : '未开启' }}
          </Badge>
        </div>
        <Button
          size="xs"
          variant="secondary"
          class="gap-1"
          :disabled="!vts.connected || refreshing"
          @click="refreshPostProcessing"
        >
          <RefreshCw
            class="size-3"
            :class="refreshing ? 'animate-spin' : ''"
          />
          刷新
        </Button>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <div
          v-if="!vts.connected"
          class="py-6"
        >
          <Empty description="连接 VTS 后可读取并切换后处理滤镜预设" />
        </div>
        <div
          v-else-if="!vts.postProcessing || !vts.postProcessing.supported"
          class="py-6"
        >
          <Empty description="当前 VTube Studio 未启用或不支持后处理滤镜 API" />
        </div>
        <template v-else>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <SettingRow
              type="switch"
              variant="none"
              title="滤镜总开关"
              :model-value="vts.postProcessing.active"
              @update:model-value="togglePostProcessing"
            />
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">过渡 (s)</span>
              <NumberField
                v-model="fadeTime"
                :min="0"
                :max="5"
                :step="0.1"
                class="w-24"
              />
              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                @click="addFilterToDeck('__off__', '关闭滤镜')"
              >
                <Plus class="size-3" />
                关闭入台
              </Button>
            </div>
          </div>

          <div
            v-if="vts.postProcessing.presets.length === 0"
            class="py-4"
          >
            <Empty description="VTS 中尚未保存任何后处理预设，请先在 VTS 视觉特效里创建预设" />
          </div>
          <div
            v-else
            class="grid grid-cols-2 sm:grid-cols-3 gap-2"
          >
            <div
              v-for="preset in vts.postProcessing.presets"
              :key="preset"
              class="flex items-center gap-1 min-w-0"
            >
              <Button
                :variant="
                  vts.postProcessing.active && vts.postProcessing.activePreset === preset ? 'default' : 'outline'
                "
                class="flex-1 min-w-0 justify-start px-2.5 truncate"
                @click="applyFilterPreset(preset)"
              >
                <span class="truncate">{{ preset }}</span>
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                class="shrink-0 text-muted-foreground"
                title="加入操作台"
                @click="addFilterToDeck(preset, preset)"
              >
                <Plus class="size-3" />
              </Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
