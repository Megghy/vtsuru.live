<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { Desktop24Filled, Live24Filled } from '@vicons/fluent'
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FaceAuthModal from '@/apps/client/components/live-manage/FaceAuthModal.vue'
import LiveControlPanel from '@/apps/client/components/live-manage/LiveControlPanel.vue'
import LivePreflightPanel from '@/apps/client/components/live-manage/LivePreflightPanel.vue'
import LiveStreamInfo from '@/apps/client/components/live-manage/LiveStreamInfo.vue'
import ObsControlPanel from '@/apps/client/components/live-manage/ObsControlPanel.vue'
import type { CheckTarget } from '@/apps/client/components/live-manage/preflight'
import { useLiveControl } from '@/apps/client/composables/useLiveControl'
import { useLivePreflight } from '@/apps/client/composables/useLivePreflight'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const control = useLiveControl()
const preflight = useLivePreflight(control)
const activeTab = ref('control')
const settingsPanel = ref<HTMLElement>()
const router = useRouter()

async function navigateCheck(target: CheckTarget) {
  if (target === 'account') {
    await openUrl('https://vtsuru.live/manage')
    return
  }
  if (target === 'fetcher') {
    await router.push({ name: 'client-fetcher' })
    return
  }
  activeTab.value = target
  await nextTick()
  settingsPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="w-full flex flex-col gap-3.5">
    <!-- 标准页面标头 -->
    <ClientPageHeader
      title="直播管理"
      description="管理 B 站直播间标题、分区、封面与推流码，联动控制 OBS 本地推流"
    >
      <template #actions>
        <Badge
          variant="outline"
          class="text-xs h-6 px-2.5 gap-1.5"
          :class="
            control.isLiving.value
              ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
              : 'text-muted-foreground'
          "
        >
          <div
            class="size-1.5 rounded-full"
            :class="control.isLiving.value ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-muted-foreground/40'"
          />
          {{ control.isLiving.value ? '直播进行中' : '未开播' }}
        </Badge>
      </template>
    </ClientPageHeader>

    <LivePreflightPanel
      :checks="preflight.checks.value"
      :refreshing="preflight.refreshing.value"
      :error="preflight.error.value"
      :checked-at="preflight.checkedAt.value"
      @refresh="preflight.refresh"
      @navigate="navigateCheck"
    />

    <div ref="settingsPanel">
      <Tabs
        v-model="activeTab"
        class="w-full"
      >
        <TabsList class="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger
            value="control"
            class="text-xs gap-1.5"
          >
            <Live24Filled class="size-3.5" />
            直播控制
          </TabsTrigger>
          <TabsTrigger
            value="obs"
            class="text-xs gap-1.5"
          >
            <Desktop24Filled class="size-3.5" />
            OBS 与统计
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="control"
          class="pt-3 space-y-3 client-readable"
        >
          <LiveControlPanel :control="control" />
          <LiveStreamInfo :control="control" />
        </TabsContent>

        <TabsContent
          value="obs"
          class="pt-3 client-readable"
        >
          <ObsControlPanel :control="control" />
        </TabsContent>
      </Tabs>
    </div>

    <!-- 人脸认证弹窗 -->
    <FaceAuthModal :control="control" />
  </div>
</template>
