<script setup lang="ts">
import { ref } from 'vue'

import { AddBiliBlackList, DelBiliBlackList, DelBlackList, useAccount } from '@/api/account'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { useMessage } from '@/shared/utils'
import { GuidUtils } from '@/shared/utils'

const accountInfo = useAccount()
const message = useMessage()

const biliId = ref<number | null>(null)
const biliName = ref('')
const isAdding = ref(false)

/** 黑名单键为 OUId：由 uid 派生的显示为 UID，开放平台用户显示原始 OpenID */
function displayOuid(ouid: string) {
  return GuidUtils.isGuidFromUserId(ouid) ? `UID ${GuidUtils.guidToLong(ouid)}` : ouid
}

async function addBiliUser() {
  if (!biliId.value || biliId.value <= 0) {
    message.warning('请输入有效的 B 站 UID')
    return
  }
  const name = biliName.value.trim() || String(biliId.value)
  isAdding.value = true
  try {
    const data = await AddBiliBlackList(GuidUtils.numToGuid(biliId.value), name)
    if (data.code === 200) {
      message.success(`已将 ${name} 加入 B 站黑名单`)
      biliId.value = null
      biliName.value = ''
    } else {
      message.error(data.message || '添加失败')
    }
  } catch (err) {
    message.error(String(err))
  } finally {
    isAdding.value = false
  }
}

function unblockBiliUser(ouid: string) {
  DelBiliBlackList(ouid)
    .then((data) => {
      if (data.code === 200) {
        message.success(`[${displayOuid(ouid)}] 已移除黑名单`)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => message.error(String(err)))
}

function unblockUser(id: number) {
  DelBlackList(id)
    .then((data) => {
      if (data.code === 200) {
        message.success(`[${id}] 已移除黑名单`)
        if (accountInfo.value) accountInfo.value.blackList = accountInfo.value.blackList.filter((u) => u.id !== id)
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => message.error(String(err)))
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert class="border-border bg-muted/30">
      <AlertDescription class="text-xs text-muted-foreground">
        黑名单用于限制互动：B 站 UID 黑名单主要影响弹幕相关互动；站内黑名单限制本站注册用户（提问箱等）。
      </AlertDescription>
    </Alert>

    <!-- B 站黑名单 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold uppercase tracking-wide"> B 站黑名单 </CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <Input
            v-model="biliId"
            type="number"
            placeholder="B 站 UID"
            class="w-40 font-mono"
          />
          <Input
            v-model="biliName"
            placeholder="备注名（可选）"
            class="w-48"
          />
          <Button
            variant="brand"
            :loading="isAdding"
            @click="addBiliUser"
          >
            添加
          </Button>
        </div>

        <ul
          v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0"
          class="divide-y divide-border rounded-md border border-border"
        >
          <li
            v-for="item in Object.entries(accountInfo.biliBlackList)"
            :key="item[0]"
            class="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">{{ item[1] }}</span>
              <code class="px-1.5 py-0.5 rounded bg-muted text-[11px] text-muted-foreground font-mono">
                {{ displayOuid(item[0]) }}
              </code>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="text-destructive hover:bg-destructive/10"
              @click="unblockBiliUser(item[0])"
            >
              移除
            </Button>
          </li>
        </ul>
        <div
          v-else
          class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md"
        >
          暂无 B 站黑名单
        </div>
      </CardContent>
    </Card>

    <!-- 站内黑名单 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 站内黑名单 </CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 space-y-3">
        <div class="text-xs text-muted-foreground">站内用户通常在提问箱等场景操作时加入；此处支持移除。</div>

        <ul
          v-if="accountInfo.blackList && accountInfo.blackList.length > 0"
          class="divide-y divide-border rounded-md border border-border"
        >
          <li
            v-for="item in accountInfo.blackList"
            :key="item.id"
            class="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">{{ item.name }}</span>
              <code class="px-1.5 py-0.5 rounded bg-muted text-[11px] text-muted-foreground font-mono">
                #{{ item.id }}
              </code>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="text-destructive hover:bg-destructive/10"
              @click="unblockUser(item.id)"
            >
              移除
            </Button>
          </li>
        </ul>
        <div
          v-else
          class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md"
        >
          暂无站内黑名单
        </div>
      </CardContent>
    </Card>
  </div>
</template>
