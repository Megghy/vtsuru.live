<script setup lang="ts">
import { NAlert, NButton, NCard, NEmpty, NFlex, NInput, NInputNumber, NList, NListItem, NText, useMessage } from 'naive-ui'
import { ref } from 'vue'

import { AddBiliBlackList, DelBiliBlackList, DelBlackList, useAccount } from '@/api/account'
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
    .catch((err) => message.error(err))
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
    .catch((err) => message.error(err))
}
</script>

<template>
  <NFlex
    vertical
    :size="12"
  >
    <NAlert
      type="info"
      size="small"
      :bordered="false"
    >
      黑名单用于限制互动：B 站 UID 黑名单主要影响弹幕相关互动；站内黑名单限制本站注册用户（提问箱等）。
    </NAlert>

    <NCard
      title="B 站黑名单"
      size="small"
      bordered
      :segmented="{ content: true }"
    >
      <NFlex
        vertical
        :size="10"
      >
        <NFlex
          align="center"
          :wrap="true"
          :size="8"
        >
          <NInputNumber
            v-model:value="biliId"
            placeholder="B 站 UID"
            :show-button="false"
            :min="1"
            style="width: 160px"
          />
          <NInput
            v-model:value="biliName"
            placeholder="备注名（可选）"
            style="width: 180px"
            clearable
          />
          <NButton
            type="primary"
            size="small"
            :loading="isAdding"
            @click="addBiliUser"
          >
            添加
          </NButton>
        </NFlex>

        <NList v-if="accountInfo.biliBlackList && Object.keys(accountInfo.biliBlackList).length > 0">
          <NListItem
            v-for="item in Object.entries(accountInfo.biliBlackList)"
            :key="item[0]"
          >
            <NFlex
              align="center"
              justify="space-between"
              :wrap="true"
              :size="12"
            >
              <NFlex
                align="center"
                :wrap="true"
                :size="8"
              >
                <NText>{{ item[1] }}</NText>
                <NText
                  depth="3"
                  code
                >
                  {{ displayOuid(item[0]) }}
                </NText>
              </NFlex>
              <NButton
                type="error"
                size="small"
                secondary
                @click="unblockBiliUser(item[0])"
              >
                移除
              </NButton>
            </NFlex>
          </NListItem>
        </NList>
        <NEmpty
          v-else
          size="small"
          description="暂无 B 站黑名单"
        />
      </NFlex>
    </NCard>

    <NCard
      title="站内黑名单"
      size="small"
      bordered
      :segmented="{ content: true }"
    >
      <NText
        depth="3"
        style="display: block; margin-bottom: 8px; font-size: 12px"
      >
        站内用户通常在提问箱等场景操作时加入；此处支持移除。
      </NText>
      <NList v-if="accountInfo.blackList && accountInfo.blackList.length > 0">
        <NListItem
          v-for="item in accountInfo.blackList"
          :key="item.id"
        >
          <NFlex
            align="center"
            justify="space-between"
            :wrap="true"
            :size="12"
          >
            <NFlex
              align="center"
              :wrap="true"
              :size="8"
            >
              <NText>{{ item.name }}</NText>
              <NText
                depth="3"
                code
              >
                {{ item.id }}
              </NText>
            </NFlex>
            <NButton
              type="error"
              size="small"
              secondary
              @click="unblockUser(item.id)"
            >
              移除
            </NButton>
          </NFlex>
        </NListItem>
      </NList>
      <NEmpty
        v-else
        size="small"
        description="暂无站内黑名单"
      />
    </NCard>
  </NFlex>
</template>
