<script setup lang="ts">
import { FunctionTypes } from '@/api/api-models';
import { useLiveRequest } from '@/composables/useLiveRequest';
import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDivider,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NSpace,
  NSpin,
  useMessage
} from 'naive-ui';
import { computed } from 'vue';

// 使用useLiveRequest
const liveRequest = useLiveRequest()
const accountInfo = useAccount()
const message = useMessage()

const enableSongRequest = computed({
  get: () => {
    return accountInfo.value?.settings?.enableFunctions?.includes(FunctionTypes.SongRequest) || false
  },
  set: async () => {
    await updateEnableFunctions()
  }
})

// 控制歌曲请求功能开关
async function updateEnableFunctions() {
  if (accountInfo.value.id) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest)) {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
        (f: number) => f != FunctionTypes.SongRequest,
      )
    } else {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.SongRequest)
    }
    if (!accountInfo.value.settings.songRequest.orderPrefix) {
      accountInfo.value.settings.songRequest.orderPrefix = liveRequest.defaultPrefix
    }
    await SaveEnableFunctions(accountInfo.value?.settings.enableFunctions)
      .then((data) => {
        if (data.code == 200) {
          message.success(
            `已${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}点播功能`,
          )
        } else {
          if (accountInfo.value.id) {
            accountInfo.value.settings.enableFunctions = oldValue
          }
          message.error(
            `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${data.message}`,
          )
        }
      })
      .catch((err) => {
        message.error(
          `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.SongRequest) ? '启用' : '禁用'}失败: ${err}`,
        )
      })
  }
}

// 更新歌曲请求设置
async function updateSettings() {
  if (accountInfo.value.id) {
    liveRequest.isLoading = true
    await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      .then((msg) => {
        if (msg) {
          message.success('已保存')
          return true
        } else {
          message.error('保存失败: ' + msg)
        }
      })
      .finally(() => {
        liveRequest.isLoading = false
      })
  } else {
    message.success('完成')
  }
}
</script>

<template>
  <NSpin :show="liveRequest.isLoading">
    <NDivider> 规则 </NDivider>
    <NSpace vertical>
      <NSpace align="center">
        <NInputGroup style="width: 250px">
          <NInputGroupLabel> 点播弹幕前缀 </NInputGroupLabel>
          <template v-if="liveRequest.configCanEdit">
            <NInput v-model:value="accountInfo.settings.songRequest.orderPrefix" />
            <NButton
              type="primary"
              @click="updateSettings"
            >
              确定
            </NButton>
          </template>
          <NInput
            v-else
            v-model:value="liveRequest.defaultPrefix"
          />
        </NInputGroup>
        <NAlert
          v-if="accountInfo.settings.songRequest.orderPrefix && accountInfo.settings.songRequest.orderPrefix.includes(' ')"
          type="info"
        >
          前缀包含空格
        </NAlert>
      </NSpace>
      <NInputGroup style="width: 250px">
        <NInputGroupLabel> 最大队列长度 </NInputGroupLabel>
        <NInputNumber
          v-model:value="accountInfo.settings.songRequest.queueMaxSize"
          :disabled="!liveRequest.configCanEdit"
        />
        <NButton
          type="info"
          :disabled="!liveRequest.configCanEdit"
          @click="updateSettings"
        >
          确定
        </NButton>
      </NInputGroup>
      <NSpace align="center">
        <NCheckbox
          v-model:checked="accountInfo.settings.songRequest.enableOnStreaming"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          仅在直播时才允许加入
        </NCheckbox>
        <NCheckbox
          v-model:checked="accountInfo.settings.songRequest.allowAllDanmaku"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          允许所有弹幕点播
        </NCheckbox>
        <template v-if="!accountInfo.settings.songRequest.allowAllDanmaku">
          <NCheckbox
            v-model:checked="accountInfo.settings.songRequest.needWearFanMedal"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            需要拥有粉丝牌
          </NCheckbox>
          <NInputGroup
            v-if="accountInfo.settings.songRequest.needWearFanMedal"
            style="width: 250px"
          >
            <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
            <NInputNumber
              v-model:value="accountInfo.settings.songRequest.fanMedalMinLevel"
              :disabled="!liveRequest.configCanEdit"
            />
            <NButton
              type="info"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              确定
            </NButton>
          </NInputGroup>
          <NCheckbox
            v-if="!accountInfo.settings.songRequest.allowAllDanmaku"
            v-model:checked="accountInfo.settings.songRequest.needJianzhang"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            只允许舰长
          </NCheckbox>
          <NCheckbox
            v-if="!accountInfo.settings.songRequest.allowAllDanmaku"
            v-model:checked="accountInfo.settings.songRequest.needTidu"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            只允许提督
          </NCheckbox>
          <NCheckbox
            v-if="!accountInfo.settings.songRequest.allowAllDanmaku"
            v-model:checked="accountInfo.settings.songRequest.needZongdu"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            只允许总督
          </NCheckbox>
        </template>
      </NSpace>
      <NSpace align="center">
        <NCheckbox
          v-model:checked="accountInfo.settings.songRequest.allowSC"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          允许通过 SuperChat 点播
        </NCheckbox>
        <span v-if="accountInfo.settings.songRequest.allowSC">
          <NCheckbox
            v-model:checked="accountInfo.settings.songRequest.scIgnoreLimit"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            SC 点播无视限制
          </NCheckbox>
        </span>
        <NInputGroup
          v-if="accountInfo.settings.songRequest.allowSC"
          style="width: 250px"
        >
          <NInputGroupLabel> 最低SC价格 </NInputGroupLabel>
          <NInputNumber
            v-model:value="accountInfo.settings.songRequest.scMinPrice"
            :disabled="!liveRequest.configCanEdit"
          />
          <NButton
            type="info"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            确定
          </NButton>
        </NInputGroup>
      </NSpace>
      <NDivider> 点歌 </NDivider>
      <NSpace>
        <NCheckbox
          v-model:checked="accountInfo.settings.songRequest.onlyAllowSongList"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          仅允许点
          <NButton
            text
            tag="a"
            href="/manage/song-list"
            target="_blank"
            type="info"
          >
            歌单
          </NButton>
          内的歌曲
        </NCheckbox>
        <NCheckbox
          v-model:checked="accountInfo.settings.songRequest.allowFromWeb"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          允许通过网页点歌
        </NCheckbox>
        <NCheckbox
          v-if="accountInfo.settings.songRequest.allowFromWeb"
          v-model:checked="accountInfo.settings.songRequest.allowAnonymousFromWeb"
          :disabled="!liveRequest.configCanEdit"
          @update:checked="updateSettings"
        >
          允许匿名通过网页点歌
        </NCheckbox>
      </NSpace>
      <NDivider> 冷却 (单位: 秒) </NDivider>
      <NCheckbox
        v-model:checked="accountInfo.settings.songRequest.enableCooldown"
        :disabled="!liveRequest.configCanEdit"
        @update:checked="updateSettings"
      >
        启用点播冷却
      </NCheckbox>
      <NSpace v-if="accountInfo.settings.songRequest.enableCooldown">
        <NInputGroup style="width: 250px">
          <NInputGroupLabel> 普通弹幕 </NInputGroupLabel>
          <NInputNumber
            v-model:value="accountInfo.settings.songRequest.cooldownSecond"
            :disabled="!liveRequest.configCanEdit"
          />
          <NButton
            type="info"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            确定
          </NButton>
        </NInputGroup>
        <NInputGroup style="width: 220px">
          <NInputGroupLabel> 舰长 </NInputGroupLabel>
          <NInputNumber
            v-model:value="accountInfo.settings.songRequest.jianzhangCooldownSecond"
            :disabled="!liveRequest.configCanEdit"
          />
          <NButton
            type="info"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            确定
          </NButton>
        </NInputGroup>
      </NSpace>
      <NSpace v-if="accountInfo.settings.songRequest.enableCooldown">
        <NInputGroup style="width: 220px">
          <NInputGroupLabel> 提督 </NInputGroupLabel>
          <NInputNumber
            v-model:value="accountInfo.settings.songRequest.tiduCooldownSecond"
            :disabled="!liveRequest.configCanEdit"
          />
          <NButton
            type="info"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            确定
          </NButton>
        </NInputGroup>
        <NInputGroup style="width: 220px">
          <NInputGroupLabel> 总督 </NInputGroupLabel>
          <NInputNumber
            v-model:value="accountInfo.settings.songRequest.zongduCooldownSecond"
            :disabled="!liveRequest.configCanEdit"
          />
          <NButton
            type="info"
            :disabled="!liveRequest.configCanEdit"
            @click="updateSettings"
          >
            确定
          </NButton>
        </NInputGroup>
      </NSpace>
      <NDivider> 警告消息 </NDivider>
      <NSpace>
        <NCheckbox
          :checked="liveRequest.isWarnMessageAutoClose"
          @update:checked="liveRequest.isWarnMessageAutoClose = $event"
        >
          自动关闭警告消息
        </NCheckbox>
      </NSpace>
    </NSpace>
  </NSpin>
</template>