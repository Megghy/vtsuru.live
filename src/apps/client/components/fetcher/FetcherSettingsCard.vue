<script setup lang="ts">
import { UserCog } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useFetcherControl } from '@/apps/client/composables/useFetcherControl'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const router = useRouter()
const biliCookie = useBiliCookie()
const settings = useSettings()
const { isBusy, switchMode } = useFetcherControl()

const credentialBadge = computed(() => {
  if (biliCookie.isCookieValid) {
    return {
      variant: 'success' as const,
      text: biliCookie.userInfo?.name || '主凭据有效',
    }
  }
  return {
    variant: 'warning' as const,
    text: '未登录 / 需验证',
  }
})

async function handleFallbackToggle(val: boolean) {
  settings.settings.fallbackToOpenLive = val
  await settings.save()
}
</script>

<template>
  <Card class="w-full">
    <CardHeader class="p-3 border-b flex-row items-center justify-between space-y-0">
      <CardTitle>采集模式与凭据</CardTitle>
      <div class="flex items-center gap-2">
        <Badge
          :variant="credentialBadge.variant"
          size="sm"
        >
          {{ credentialBadge.text }}
        </Badge>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="router.push({ name: 'client-account-manage' })"
        >
          <UserCog class="size-3.5" />
          <span>账号与凭据</span>
        </Button>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-2.5">
      <SettingRow
        variant="compact"
        title="弹幕客户端模式"
        description="开放平台无需 B 站 Cookie 即可使用；直接连接依赖主账号凭据，可采集更完整的互动事件"
      >
        <ToggleGroup
          type="single"
          :model-value="settings.settings.useDanmakuClientType"
          @update:model-value="
            (val) => {
              if (val === 'openlive' || val === 'direct') switchMode(val)
            }
          "
        >
          <ToggleGroupItem
            value="openlive"
            :disabled="isBusy"
          >
            开放平台
          </ToggleGroupItem>

          <TooltipProvider>
            <Tooltip v-if="!biliCookie.isCookieValid">
              <TooltipTrigger as-child>
                <span>
                  <ToggleGroupItem
                    value="direct"
                    disabled
                  >
                    直接连接
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent>请先在「账号与凭据」登录有效 B 站主凭据</TooltipContent>
            </Tooltip>
            <ToggleGroupItem
              v-else
              value="direct"
              :disabled="isBusy"
            >
              直接连接
            </ToggleGroupItem>
          </TooltipProvider>
        </ToggleGroup>
      </SettingRow>

      <SettingRow
        variant="compact"
        title="无凭据时自动回退开放平台"
        description="启动初始化检测到未配置有效 B 站 Cookie 时，自动切换为开放平台模式避免采集失败"
      >
        <Switch
          :checked="settings.settings.fallbackToOpenLive"
          @update:checked="handleFallbackToggle($event)"
        />
      </SettingRow>
    </CardContent>
  </Card>
</template>
