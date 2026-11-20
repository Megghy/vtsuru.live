<script setup lang="ts">
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { useDebounceFn } from '@vueuse/core'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, ref, watch } from 'vue'

import { SaveEnableFunctions, useAccount } from '@/api/account'
import { getApiCheckinAdminUsers } from '@/api/generated/check-in/check-in'
import { FunctionTypes, type ResponseUserCheckInModel } from '@/api/generated/model'
import { CURRENT_HOST } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { toast } from '@/shared/utils'

type CheckInSortKey = 'consecutive' | 'total' | 'monthly' | 'recent'

const accountInfo = useAccount()
const isLoading = ref(false)
const isSavingPublic = ref(false)
const records = ref<ResponseUserCheckInModel[]>([])
const searchKeyword = ref('')
const debouncedKeyword = ref('')
const sortBy = ref<CheckInSortKey>('consecutive')

const isRankingPublic = computed(() =>
  Boolean(accountInfo.value?.settings?.enableFunctions?.includes(FunctionTypes.CheckInRanking)),
)

const publicRankingUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/checkin-ranking` : '',
)

const updateSearch = useDebounceFn((v: string) => {
  debouncedKeyword.value = v
}, 250)

watch(searchKeyword, (v) => updateSearch(v))

const stats = computed(() => {
  const list = records.value
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = list.filter((u) => u.lastCheckInTime >= todayStart.getTime()).length
  const maxStreak = list.reduce((max, u) => Math.max(max, u.consecutiveDays), 0)
  const totalCheckIns = list.reduce((sum, u) => sum + u.totalCheckInCount, 0)
  return {
    users: list.length,
    todayCount,
    maxStreak,
    totalCheckIns,
  }
})

const filteredRecords = computed(() => {
  const kw = debouncedKeyword.value.trim().toLowerCase()
  return records.value
    .filter((item) => !kw || item.name?.toLowerCase().includes(kw))
    .toSorted((a, b) => {
      switch (sortBy.value) {
        case 'total':
          return b.totalCheckInCount - a.totalCheckInCount
        case 'monthly':
          return b.monthlyCheckInCount - a.monthlyCheckInCount
        case 'recent':
          return b.lastCheckInTime - a.lastCheckInTime
        case 'consecutive':
        default:
          return b.consecutiveDays - a.consecutiveDays || b.totalCheckInCount - a.totalCheckInCount
      }
    })
})

async function loadRecords() {
  isLoading.value = true
  try {
    const res = await getApiCheckinAdminUsers()
    if (res.code === 200 && res.data) {
      records.value = res.data
    } else {
      toast.error(res.message || '加载签到记录失败')
    }
  } catch (err) {
    toast.error(`加载签到记录失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isLoading.value = false
  }
}

async function togglePublicRanking(enabled: boolean) {
  if (!accountInfo.value?.settings || isSavingPublic.value) return
  isSavingPublic.value = true
  try {
    const current = accountInfo.value.settings.enableFunctions ?? []
    const next = enabled
      ? Array.from(new Set([...current, FunctionTypes.CheckInRanking]))
      : current.filter((f) => f !== FunctionTypes.CheckInRanking)
    const res = await SaveEnableFunctions(next)
    if (res.code !== 200) {
      toast.error(res.message || '更新失败')
      return
    }
    accountInfo.value.settings.enableFunctions = next
    toast.success(enabled ? '已开启公开签到排行榜' : '已关闭公开签到排行榜')
  } catch (err) {
    toast.error(`更新失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSavingPublic.value = false
  }
}

function formatRecent(ts: number) {
  if (!ts) return '未记录'
  try {
    return `${format(ts, 'MM-dd HH:mm')} (${formatDistanceToNow(ts, { addSuffix: true, locale: zhCN })})`
  } catch {
    return String(ts)
  }
}

onMounted(() => {
  void loadRecords()
})
</script>

<template>
  <div class="space-y-3.5">
    <!-- 汇总与公开榜控制 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">累计签到观众</span>
          <span class="text-lg font-bold font-mono text-foreground">{{ stats.users }}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">今日已签到</span>
          <span class="text-lg font-bold font-mono text-emerald-500">{{ stats.todayCount }}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">最高连续天数</span>
          <span class="text-lg font-bold font-mono text-primary">{{ stats.maxStreak }} 天</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">总签到次数</span>
          <span class="text-lg font-bold font-mono text-blue-500">{{ stats.totalCheckIns }}</span>
        </CardContent>
      </Card>
    </div>

    <!-- 工具栏 + 公开排行切换 -->
    <div class="p-3 rounded-lg border border-border/80 bg-card flex-between flex-wrap gap-2.5 text-xs">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-52 max-w-full">
          <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索观众昵称"
            class="pl-8"
          />
        </div>

        <Select v-model="sortBy">
          <SelectTrigger class="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consecutive">按连续签到天数</SelectItem>
            <SelectItem value="total">按累计签到次数</SelectItem>
            <SelectItem value="monthly">按本月签到次数</SelectItem>
            <SelectItem value="recent">按最近签到时间</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border/70 bg-muted/20">
          <span class="text-foreground">公开签到排行榜</span>
          <Switch
            :checked="isRankingPublic"
            :disabled="isSavingPublic"
            @update:checked="togglePublicRanking"
          />
          <Button
            v-if="isRankingPublic && publicRankingUrl"
            variant="ghost"
            size="xs"
            as="a"
            :href="publicRankingUrl"
            target="_blank"
            class="gap-1 text-primary"
          >
            <Open24Regular class="size-3.5" />
            查看公开榜
          </Button>
        </div>

        <Button
          variant="outline"
          :loading="isLoading"
          @click="loadRecords"
        >
          <ArrowSync24Regular class="size-3.5 mr-1" />
          刷新
        </Button>
      </div>
    </div>

    <!-- 签到榜单 -->
    <Card>
      <CardContent class="p-0">
        <Spin :show="isLoading">
          <Empty
            v-if="filteredRecords.length === 0"
            description="暂无签到用户记录"
            class="py-12"
          />
          <div
            v-else
            class="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-16 text-center">排名</TableHead>
                  <TableHead>观众</TableHead>
                  <TableHead class="w-28 text-right">连续签到</TableHead>
                  <TableHead class="w-28 text-right">本月次数</TableHead>
                  <TableHead class="w-28 text-right">累计次数</TableHead>
                  <TableHead class="w-28 text-right">当前积分</TableHead>
                  <TableHead class="w-52">最近签到</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="(item, idx) in filteredRecords.slice(0, 100)"
                  :key="`${item.ouId ?? item.name}-${idx}`"
                  class="hover:bg-muted/30"
                >
                  <TableCell class="text-center font-mono font-semibold text-xs">
                    <Badge
                      v-if="idx < 3"
                      :variant="idx === 0 ? 'warning' : 'secondary'"
                      size="xs"
                    >
                      #{{ idx + 1 }}
                    </Badge>
                    <span
                      v-else
                      class="text-muted-foreground"
                    >
                      {{ idx + 1 }}
                    </span>
                  </TableCell>
                  <TableCell class="text-xs">
                    <div class="flex items-center gap-1.5">
                      <span class="font-medium text-foreground">{{ item.name || '未知用户' }}</span>
                      <Badge
                        v-if="item.isAuthed"
                        variant="success"
                        size="xs"
                      >
                        已认证
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono font-semibold text-primary text-xs">
                    {{ item.consecutiveDays }} 天
                  </TableCell>
                  <TableCell class="text-right font-mono text-xs">{{ item.monthlyCheckInCount }}</TableCell>
                  <TableCell class="text-right font-mono text-xs">{{ item.totalCheckInCount }}</TableCell>
                  <TableCell class="text-right font-mono text-xs">
                    {{ Number((item.points ?? 0).toFixed(1)) }}
                  </TableCell>
                  <TableCell class="text-xs text-muted-foreground">
                    {{ formatRecent(item.lastCheckInTime) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Spin>
      </CardContent>
    </Card>
  </div>
</template>
