<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { SaveSetting, useAccount } from '@/api/account'
import type { Setting_LiveRequest } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'

const defaultSettings = {
  orderPrefix: '点播',
  onlyAllowSongList: false,
  queueMaxSize: 10,
  allowAllDanmaku: true,
  allowFromWeb: true,
  needWearFanMedal: false,
  needJianzhang: false,
  needTidu: false,
  needZongdu: false,
  allowSC: true,
  scIgnoreLimit: true,
  scMinPrice: 30,
  fanMedalMinLevel: 0,
  allowReorderSong: false,
  enableCooldown: false,
  cooldownSecond: 1200,
  zongduCooldownSecond: 300,
  tiduCooldownSecond: 600,
  jianzhangCooldownSecond: 900,
  enableWebCooldown: true,
  webCooldownSecond: 600,
  isReverse: false,
} as Setting_LiveRequest

const liveRequest = useLiveRequest()
const accountInfo = useAccount()
const configCanEdit = computed(() => {
  return accountInfo.value != null && accountInfo.value != undefined
})
const settings = computed({
  get: () => accountInfo.value?.settings?.songRequest ?? defaultSettings,
  set: (value) => {
    if (accountInfo.value.id) {
      accountInfo.value.settings.songRequest = value
    }
  },
})

async function updateSettings() {
  if (accountInfo.value.id) {
    liveRequest.isLoading = true
    try {
      const msg = await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      if (msg) {
        toast.success('已保存')
        return true
      } else {
        toast.error(`保存失败: ${msg}`)
      }
    } finally {
      liveRequest.isLoading = false
    }
  } else {
    toast.success('完成')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 规则卡片 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-1">
        <CardTitle class="text-sm font-semibold">规则</CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-2 space-y-3">
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-1.5 w-[320px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-24">点播弹幕前缀</span>
            <template v-if="liveRequest.configCanEdit">
              <Input
                v-model="settings.orderPrefix"
                class="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                class="h-8 text-xs shrink-0"
                @click="updateSettings"
              >
                保存
              </Button>
            </template>
            <Input
              v-else
              v-model="liveRequest.defaultPrefix"
              class="h-8 text-xs flex-1"
            />
          </div>

          <Alert
            v-if="settings.orderPrefix && settings.orderPrefix.includes(' ')"
            class="py-1 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit"
          >
            <AlertDescription class="text-xs m-0">
              前缀包含空格，可能导致用户输入困难。
            </AlertDescription>
          </Alert>
        </div>

        <div class="flex items-center gap-1.5 w-[320px] max-w-full">
          <span class="text-xs text-muted-foreground shrink-0 w-24">最大队列长度</span>
          <NInputNumber
            :value="settings.queueMaxSize"
            :disabled="!liveRequest.configCanEdit"
            size="small"
            class="flex-1"
            @update:value="settings.queueMaxSize = $event || 10"
          />
          <Button
            size="sm"
            variant="secondary"
            class="h-8 text-xs shrink-0"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            保存
          </Button>
        </div>

        <div class="flex items-center gap-4 flex-wrap text-xs">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.enableOnStreaming"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.enableOnStreaming = $event; updateSettings()"
            />
            <span>仅在直播时允许加入</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.allowAllDanmaku"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.allowAllDanmaku = $event; updateSettings()"
            />
            <span>允许所有弹幕点播</span>
          </label>
        </div>

        <template v-if="!settings.allowAllDanmaku">
          <div class="flex items-center gap-4 flex-wrap text-xs pt-1 border-t">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="settings.needWearFanMedal"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="settings.needWearFanMedal = $event; updateSettings()"
              />
              <span>需要拥有粉丝牌</span>
            </label>

            <div
              v-if="settings.needWearFanMedal"
              class="flex items-center gap-1.5 w-[280px] max-w-full"
            >
              <span class="text-xs text-muted-foreground shrink-0">最低粉丝牌等级</span>
              <NInputNumber
                :value="settings.fanMedalMinLevel"
                :disabled="!liveRequest.configCanEdit"
                size="small"
                class="flex-1"
                @update:value="settings.fanMedalMinLevel = $event || 0"
              />
              <Button
                size="sm"
                variant="secondary"
                class="h-8 text-xs shrink-0"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </Button>
            </div>

            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="settings.needJianzhang"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="settings.needJianzhang = $event; updateSettings()"
              />
              <span>只允许舰长</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="settings.needTidu"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="settings.needTidu = $event; updateSettings()"
              />
              <span>只允许提督</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="settings.needZongdu"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="settings.needZongdu = $event; updateSettings()"
              />
              <span>只允许总督</span>
            </label>
          </div>
        </template>

        <div class="flex items-center gap-4 flex-wrap text-xs pt-1 border-t">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.allowSC"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.allowSC = $event; updateSettings()"
            />
            <span>允许通过 SuperChat 点播</span>
          </label>
          <label
            v-if="settings.allowSC"
            class="flex items-center gap-1.5 cursor-pointer"
          >
            <Checkbox
              :checked="settings.scIgnoreLimit"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.scIgnoreLimit = $event; updateSettings()"
            />
            <span>SC 点播无视限制</span>
          </label>

          <div
            v-if="settings.allowSC"
            class="flex items-center gap-1.5 w-[260px] max-w-full"
          >
            <span class="text-xs text-muted-foreground shrink-0">最低 SC 价格</span>
            <NInputNumber
              :value="settings.scMinPrice"
              :disabled="!liveRequest.configCanEdit"
              size="small"
              class="flex-1"
              @update:value="settings.scMinPrice = $event || 30"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-8 text-xs shrink-0"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 点歌卡片 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-1">
        <CardTitle class="text-sm font-semibold">点歌</CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-2">
        <div class="flex items-center gap-4 flex-wrap text-xs">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.onlyAllowSongList"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.onlyAllowSongList = $event; updateSettings()"
            />
            <span>
              仅允许点
              <a
                href="/manage/song-list"
                target="_blank"
                class="text-primary hover:underline font-medium"
              >
                歌单
              </a>
              内的歌曲
            </span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.allowReorderSong"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.allowReorderSong = $event; updateSettings()"
            />
            <span>允许重复点歌</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.allowFromWeb"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.allowFromWeb = $event; updateSettings()"
            />
            <span>允许通过网页点歌</span>
          </label>
          <label
            v-if="settings.allowFromWeb"
            class="flex items-center gap-1.5 cursor-pointer"
          >
            <Checkbox
              :checked="settings.allowAnonymousFromWeb"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.allowAnonymousFromWeb = $event; updateSettings()"
            />
            <span>允许匿名网页点歌</span>
          </label>
        </div>
      </CardContent>
    </Card>

    <!-- 冷却卡片 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-1">
        <CardTitle class="text-sm font-semibold">冷却（秒）</CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-2 space-y-3">
        <div class="flex items-center gap-4 flex-wrap text-xs">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.enableCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.enableCooldown = $event; updateSettings()"
            />
            <span>启用点播冷却</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.enableWebCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="settings.enableWebCooldown = $event; updateSettings()"
            />
            <span>启用网页点播冷却</span>
          </label>
        </div>

        <div
          v-if="settings.enableCooldown"
          class="flex items-center gap-3 flex-wrap pt-2 border-t"
        >
          <div class="flex items-center gap-1.5 w-[260px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-16">普通弹幕</span>
            <NInputNumber
              :value="settings.cooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
              class="flex-1"
              @update:value="settings.cooldownSecond = $event || 1200"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-8 text-xs shrink-0"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </Button>
          </div>

          <div class="flex items-center gap-1.5 w-[240px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-12">舰长</span>
            <NInputNumber
              :value="settings.jianzhangCooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
              class="flex-1"
              @update:value="settings.jianzhangCooldownSecond = $event || 900"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-8 text-xs shrink-0"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </Button>
          </div>

          <div class="flex items-center gap-1.5 w-[240px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-12">提督</span>
            <NInputNumber
              :value="settings.tiduCooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
              class="flex-1"
              @update:value="settings.tiduCooldownSecond = $event || 600"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-8 text-xs shrink-0"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </Button>
          </div>

          <div class="flex items-center gap-1.5 w-[240px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-12">总督</span>
            <NInputNumber
              :value="settings.zongduCooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
              class="flex-1"
              @update:value="settings.zongduCooldownSecond = $event || 300"
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-8 text-xs shrink-0"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </Button>
          </div>
        </div>

        <div
          v-if="settings.enableWebCooldown"
          class="flex items-center gap-1.5 w-[260px] max-w-full pt-2 border-t"
        >
          <span class="text-xs text-muted-foreground shrink-0 w-16">网页点播</span>
          <NInputNumber
            :value="settings.webCooldownSecond"
            :disabled="!liveRequest.configCanEdit"
            size="small"
            class="flex-1"
            @update:value="settings.webCooldownSecond = $event || 600"
          />
          <Button
            size="sm"
            variant="secondary"
            class="h-8 text-xs shrink-0"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            保存
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- OBS 卡片 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-1">
        <CardTitle class="text-sm font-semibold">OBS</CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-2">
        <div class="flex items-center gap-4 flex-wrap text-xs">
          <div class="flex items-center gap-1.5 w-[260px] max-w-full">
            <span class="text-xs text-muted-foreground shrink-0 w-10">标题</span>
            <template v-if="configCanEdit">
              <Input
                v-model="settings.obsTitle"
                placeholder="默认为 点播"
                class="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                class="h-8 text-xs shrink-0"
                @click="updateSettings"
              >
                保存
              </Button>
            </template>
          </div>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.showRequireInfo"
              :disabled="!configCanEdit"
              @update:checked="settings.showRequireInfo = $event; updateSettings()"
            />
            <span>显示底部需求信息</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.showUserName"
              :disabled="!configCanEdit"
              @update:checked="settings.showUserName = $event; updateSettings()"
            />
            <span>显示点播用户名</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              :checked="settings.showFanMadelInfo"
              :disabled="!configCanEdit"
              @update:checked="settings.showFanMadelInfo = $event; updateSettings()"
            />
            <span>显示点播用户粉丝牌</span>
          </label>
        </div>
      </CardContent>
    </Card>

    <!-- 警告消息卡片 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-1">
        <CardTitle class="text-sm font-semibold">警告消息</CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-2">
        <label class="flex items-center gap-1.5 cursor-pointer text-xs">
          <Checkbox
            :checked="liveRequest.isWarnMessageAutoClose"
            @update:checked="liveRequest.isWarnMessageAutoClose = $event"
          />
          <span>自动关闭警告消息</span>
        </label>
      </CardContent>
    </Card>
  </div>
</template>
