<script setup lang="ts">
import { KeyRound, Play, Plug, Plus, Radar, ScanSearch, Trash2, Unplug } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import { useManagedTools } from '@/apps/client/store/useManagedTools'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { DEFAULT_WS_URL } from '@/apps/client/store/vts/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const managedTools = useManagedTools()
const { run } = useVtsAction()
const wsUrlInput = ref(vts.wsUrl)
const newInstanceName = ref('')
const newInstancePort = ref(8002)
const showAddInstance = ref(false)
const probing = ref(false)
const scanningPorts = ref(false)
const discoveredPorts = ref<Array<{ port: number; latencyMs?: number }>>([])

function suggestNextPort(): number {
  const used = new Set(
    vts.instances.map((i) => {
      const m = i.wsUrl.match(/:(\d+)/)
      return m ? Number.parseInt(m[1], 10) : 8001
    }),
  )
  let port = 8002
  while (used.has(port) && port < 8099) port++
  return port
}

function toggleAddInstance() {
  showAddInstance.value = !showAddInstance.value
  if (showAddInstance.value) {
    newInstancePort.value = suggestNextPort()
  }
}

watch(
  () => vts.wsUrl,
  (next) => {
    wsUrlInput.value = next
  },
)

const faceBadge = computed(() => {
  if (vts.faceFound == null) return null
  return vts.faceFound
    ? { variant: 'success' as const, text: '面部已识别' }
    : { variant: 'warning' as const, text: '面部丢失' }
})

const handText = computed(() => {
  if (vts.leftHandFound == null && vts.rightHandFound == null) return null
  return `手部 ${vts.leftHandFound ? '左' : '-'}/${vts.rightHandFound ? '右' : '-'}`
})

function handleConnect() {
  run(async () => {
    await vts.setWsUrl(wsUrlInput.value || DEFAULT_WS_URL)
    await vts.connect()
  })
}

function handleSwitchInstance(id: unknown) {
  const nextId = String(id ?? '')
  if (!nextId || nextId === vts.activeInstanceId) return
  run(() => vts.switchInstance(nextId, true), '已切换 VTS 实例')
}

function handleCreateInstance() {
  const port = Math.max(1024, Math.min(65535, Math.round(newInstancePort.value || 8002)))
  const url = `ws://127.0.0.1:${port}`
  run(async () => {
    const created = await vts.createInstance(
      newInstanceName.value || `VTS 实例 (${port})`,
      url,
    )
    newInstanceName.value = ''
    showAddInstance.value = false
    await vts.switchInstance(created.id, false)
  }, `已添加并切换到 ${url}`)
}

async function handleScanLocalPorts() {
  if (scanningPorts.value) return
  scanningPorts.value = true
  discoveredPorts.value = []
  try {
    const ports = Array.from({ length: 10 }, (_, idx) => 8001 + idx)
    const results = await Promise.all(ports.map((p) => managedTools.probePort(p)))
    const openList = results
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.open))
      .map((r) => ({ port: r.port, latencyMs: r.latencyMs }))
    discoveredPorts.value = openList
    if (openList.length > 0) {
      toast.success(`发现 ${openList.length} 个可用本地端口: ${openList.map((i) => i.port).join(', ')}`)
    } else {
      toast.warning('未扫描到开放的 8001~8010 端口，请确认 VTube Studio 已启动并开启 API')
    }
  } finally {
    scanningPorts.value = false
  }
}

function connectDiscoveredPort(port: number) {
  const targetUrl = `ws://127.0.0.1:${port}`
  const existing = vts.instances.find((i) => i.wsUrl === targetUrl)
  run(async () => {
    if (existing) {
      await vts.switchInstance(existing.id, true)
    } else {
      const created = await vts.createInstance(`VTS (${port})`, targetUrl)
      await vts.switchInstance(created.id, true)
    }
  }, `已切换并连接端口 ${port}`)
}

async function handleProbePort() {
  probing.value = true
  try {
    const portMatch = (wsUrlInput.value || DEFAULT_WS_URL).match(/:(\d+)/)
    const port = portMatch ? Number.parseInt(portMatch[1], 10) : 8001
    const result = await managedTools.probePort(port)
    if (!result) return
    if (result.open) {
      toast.success(`VTS 端口 ${result.port} 可用 (${result.latencyMs ?? 0}ms)`)
    } else {
      toast.warning(`端口 ${result.port} 未开放，请确认 VTS 已启动并开启 API`)
    }
  } finally {
    probing.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
      <CardTitle>VTS 连接与多实例</CardTitle>
      <div class="flex items-center gap-1.5 flex-wrap">
        <Badge
          v-if="vts.connected"
          variant="success"
          size="xs"
        >
          已连接
        </Badge>
        <Badge
          v-else-if="vts.connecting"
          variant="secondary"
          size="xs"
        >
          {{ vts.wsRetryCount > 0 ? `重连中 (${vts.wsRetryCount})` : '等待 VTS / 授权中' }}
        </Badge>
        <Badge
          v-else
          variant="destructive"
          size="xs"
        >
          未连接
        </Badge>
        <span
          v-if="vts.apiVersion"
          class="text-[11px] text-muted-foreground tabular-nums"
        >
          v{{ vts.apiVersion }}
        </span>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <!-- 多实例切换 -->
      <FormField
        label="VTS 实例"
        description="支持保存多个 VTube Studio 端口与独立授权 Token，一键切换"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex-1 min-w-[180px]">
            <Select
              :model-value="vts.activeInstanceId"
              @update:model-value="handleSwitchInstance"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 VTS 实例" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="inst in vts.instances"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }} ({{ inst.wsUrl }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            @click="toggleAddInstance"
          >
            <Plus class="size-3" />
            新增实例
          </Button>
          <Popconfirm
            v-if="vts.instances.length > 1"
            title="确认删除当前选中的 VTS 实例？"
            @confirm="run(() => vts.removeInstance(vts.activeInstanceId), '已删除实例')"
          >
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-destructive"
              title="删除当前实例"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </Popconfirm>
        </div>

        <div
          v-if="showAddInstance"
          class="mt-2 p-2.5 rounded-md border border-border bg-muted/20 flex items-center gap-2 flex-wrap"
        >
          <Input
            v-model="newInstanceName"
            placeholder="实例名称（如 副机位）"
            class="w-36"
          />
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground shrink-0">端口</span>
            <NumberField
              v-model="newInstancePort"
              :min="1024"
              :max="65535"
              :step="1"
              :format-options="{ useGrouping: false }"
              class="w-28"
            />
          </div>
          <span class="text-[11px] font-mono text-muted-foreground">
            ws://127.0.0.1:{{ newInstancePort }}
          </span>
          <Button
            size="xs"
            class="ml-auto"
            @click="handleCreateInstance"
          >
            保存
          </Button>
        </div>
      </FormField>

      <FormField
        label="WebSocket 地址"
        description="在 VTube Studio 设置中开启「启动 API」（默认端口 8001）。首次连接需在 VTS 弹窗中点击「允许」，之后自动保存授权。"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <Input
            v-model="wsUrlInput"
            class="min-w-[200px] flex-1"
            :placeholder="DEFAULT_WS_URL"
          />
          <Button
            v-if="!vts.connected && !vts.connecting"
            class="gap-1.5"
            @click="handleConnect"
          >
            <Plug class="size-3.5" />
            连接
          </Button>
          <Button
            v-else
            variant="outline"
            class="gap-1.5"
            @click="run(() => vts.disconnect())"
          >
            <Unplug class="size-3.5" />
            {{ vts.connecting ? '取消' : '断开' }}
          </Button>
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="!vts.authToken"
            @click="run(() => vts.reauthorize())"
          >
            <KeyRound class="size-3.5" />
            重新授权
          </Button>
        </div>
      </FormField>

      <!-- 原生一键启停 & 端口探测 -->
      <ClientMinVersionNotice
        feature="tool-manager"
        compact
      >
        <div class="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="managedTools.launchingTool === 'vts'"
            @click="managedTools.launchVts()"
          >
            <Play class="size-3" />
            一键启动 VTS
          </Button>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="probing"
            @click="handleProbePort"
          >
            <Radar class="size-3" />
            探测当前端口
          </Button>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="scanningPorts"
            @click="handleScanLocalPorts"
          >
            <ScanSearch class="size-3" />
            {{ scanningPorts ? '扫描中...' : '扫描端口 (8001~8010)' }}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            @click="managedTools.syncVtsPortAndConnect()"
          >
            同步注册表端口
          </Button>
        </div>
        <div
          v-if="discoveredPorts.length > 0"
          class="flex items-center gap-1.5 flex-wrap pt-1.5"
        >
          <span class="text-[11px] text-muted-foreground">已发现开放端口:</span>
          <Button
            v-for="item in discoveredPorts"
            :key="item.port"
            type="button"
            size="xs"
            variant="secondary"
            class="font-mono gap-1"
            @click="connectDiscoveredPort(item.port)"
          >
            :{{ item.port }}
            <span
              v-if="item.latencyMs != null"
              class="text-[10px] text-muted-foreground"
            >
              {{ item.latencyMs }}ms
            </span>
          </Button>
        </div>
      </ClientMinVersionNotice>

      <div
        v-if="faceBadge || handText"
        class="flex items-center gap-2 flex-wrap"
      >
        <Badge
          v-if="faceBadge"
          :variant="faceBadge.variant"
          size="xs"
        >
          {{ faceBadge.text }}
        </Badge>
        <span
          v-if="handText"
          class="text-[11px] text-muted-foreground"
        >
          {{ handText }}
        </span>
      </div>

      <Alert
        v-if="vts.monitorLastError"
        size="sm"
        variant="destructive"
      >
        <AlertDescription class="m-0">状态监控异常: {{ vts.monitorLastError }}</AlertDescription>
      </Alert>
    </CardContent>
  </Card>
</template>
