<script setup lang="ts">
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import Cookies24Filled from '@vicons/fluent/es/Cookies24Filled'
import PeopleCommunity24Filled from '@vicons/fluent/es/PeopleCommunity24Filled'
import PersonAccounts24Filled from '@vicons/fluent/es/PersonAccounts24Filled'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import FetcherLoginCard from '@/apps/client/components/fetcher/FetcherLoginCard.vue'
import BiliAccountManagerCard from '@/apps/client/components/settings/BiliAccountManagerCard.vue'
import { useBiliAccountManager } from '@/apps/client/store/useBiliAccountManager'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const route = useRoute()
const router = useRouter()
const biliCookie = useBiliCookie()
const accountManager = useBiliAccountManager()

type TabKey = 'main' | 'pool'

// 从 query 确定默认激活的 tab
const initialTab = (route.query.tab as TabKey) || 'main'
const activeTab = ref<TabKey>(initialTab === 'pool' ? 'pool' : 'main')

watch(
  () => route.query.tab,
  (val) => {
    if (val === 'pool' || val === 'main') {
      activeTab.value = val
    }
  },
)

function onTabChange(val: string | number) {
  const next = val as TabKey
  activeTab.value = next
  void router.replace({
    query: {
      ...route.query,
      tab: next,
    },
  })
}

// 批量检测所有账号（主号 + 多账号池）
const isCheckingAll = ref(false)
async function handleCheckAll() {
  if (isCheckingAll.value) return
  isCheckingAll.value = true
  try {
    await Promise.allSettled([biliCookie.check(), accountManager.checkAllAccounts()])
  } finally {
    isCheckingAll.value = false
  }
}

const mainCookieBadge = computed(() => {
  if (!biliCookie.hasBiliCookie) {
    return {
      text: '主号未登录',
      class: 'border-destructive/40 text-destructive bg-destructive/10',
    }
  }
  if (biliCookie.isCookieValid) {
    return {
      text: `主号有效 (${biliCookie.userInfo?.name || '已登录'})`,
      class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
    }
  }
  return {
    text: '主号需重新验证',
    class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
  }
})

const poolCountBadge = computed(() => {
  const count = accountManager.accounts.length
  return `${count} 个自动化账号`
})
</script>

<template>
  <div class="flex flex-col gap-3.5 client-readable pb-8">
    <!-- 标头卡片 -->
    <Card class="p-3">
      <ClientPageHeader
        title="账号与凭据"
        description="统一管理主播 B 站主凭据登录、有效性监控与自动化弹幕多账号池"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <Badge
              variant="outline"
              size="xs"
              :class="mainCookieBadge.class"
            >
              {{ mainCookieBadge.text }}
            </Badge>
            <Button
              variant="outline"
              size="xs"
              class="gap-1.5"
              :disabled="isCheckingAll"
              @click="handleCheckAll"
            >
              <ArrowSync24Regular
                class="size-3.5"
                :class="{ 'animate-spin': isCheckingAll }"
              />
              <span>一键巡检所有凭据</span>
            </Button>
          </div>
        </template>
      </ClientPageHeader>
    </Card>

    <!-- Tab 分页导航 -->
    <Tabs
      :model-value="activeTab"
      class="w-full mt-0.5"
      @update:model-value="onTabChange"
    >
      <TabsList class="grid w-full max-w-md grid-cols-2">
        <TabsTrigger
          value="main"
          class="gap-1.5"
        >
          <Cookies24Filled class="size-3.5" />
          <span>主播主凭据</span>
        </TabsTrigger>
        <TabsTrigger
          value="pool"
          class="gap-1.5"
        >
          <PeopleCommunity24Filled class="size-3.5" />
          <span>多账号管理池</span>
          <span class="text-[10px] text-muted-foreground ml-1"> ({{ accountManager.accounts.length }}) </span>
        </TabsTrigger>
      </TabsList>

      <!-- Tab 1: 主播主凭据 -->
      <TabsContent
        value="main"
        class="pt-3 space-y-3 mt-0"
      >
        <div
          class="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs text-muted-foreground flex items-center justify-between"
        >
          <div>
            <span class="font-medium text-foreground mr-1.5">主播核心凭据:</span>
            用于直播管理（开播/关播/改标题分区）、房间禁言、获取弹幕流等官方核心接口。
          </div>
          <Badge
            variant="outline"
            size="xs"
            class="border-border"
          >
            单例凭据
          </Badge>
        </div>

        <FetcherLoginCard class="client-readable" />
      </TabsContent>

      <!-- Tab 2: 多账号管理池 -->
      <TabsContent
        value="pool"
        class="pt-3 space-y-3 mt-0"
      >
        <div
          class="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs text-muted-foreground flex items-center justify-between"
        >
          <div>
            <span class="font-medium text-foreground mr-1.5">自动化账号池:</span>
            可添加任意多个 B 站账号，用于欢迎进场、感谢礼物、自动回复、定时弹幕等自动化操作的分流与代发。
          </div>
          <Badge
            variant="outline"
            size="xs"
            class="border-border"
          >
            {{ poolCountBadge }}
          </Badge>
        </div>

        <BiliAccountManagerCard />
      </TabsContent>
    </Tabs>
  </div>
</template>
