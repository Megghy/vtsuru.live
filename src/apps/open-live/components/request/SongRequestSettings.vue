<script setup lang="ts">
import type { Setting_LiveRequest } from '@/api/api-models'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui'
import { computed } from 'vue'
import { SaveSetting, useAccount } from '@/api/account'
import { useLiveRequest } from '@/composables/useLiveRequest'

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

// 使用useLiveRequest
const liveRequest = useLiveRequest()
const accountInfo = useAccount()
const message = useMessage()
const configCanEdit = computed(() => {
  return accountInfo.value != null && accountInfo.value != undefined
})
const settings = computed({
  get: () => {
    if (accountInfo.value.id) {
      return accountInfo.value.settings.songRequest
    }
    return defaultSettings
  },
  set: (value) => {
    if (accountInfo.value.id) {
      accountInfo.value.settings.songRequest = value
    }
  },
})

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
          message.error(`保存失败: ${msg}`)
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
    <NSpace vertical :size="12">
      <NCard size="small" bordered title="规则">
        <NSpace vertical :size="12">
          <NSpace align="center" :wrap="true" :size="12">
            <NInputGroup class="song-request-settings__w-280">
              <NInputGroupLabel>点播弹幕前缀</NInputGroupLabel>
              <template v-if="liveRequest.configCanEdit">
                <NInput v-model:value="accountInfo.settings.songRequest.orderPrefix" size="small" />
                <NButton type="primary" secondary size="small" @click="updateSettings">
                  保存
                </NButton>
              </template>
              <NInput
                v-else
                v-model:value="liveRequest.defaultPrefix"
                size="small"
              />
            </NInputGroup>
            <NAlert
              v-if="accountInfo.settings.songRequest.orderPrefix && accountInfo.settings.songRequest.orderPrefix.includes(' ')"
              type="info"
              size="small"
              :bordered="false"
            >
              前缀包含空格，可能导致用户输入困难。
            </NAlert>
          </NSpace>

          <NInputGroup class="song-request-settings__w-280">
            <NInputGroupLabel>最大队列长度</NInputGroupLabel>
            <NInputNumber
              v-model:value="accountInfo.settings.songRequest.queueMaxSize"
              :disabled="!liveRequest.configCanEdit"
              size="small"
            />
            <NButton
              type="primary"
              secondary
              size="small"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </NButton>
          </NInputGroup>

          <NSpace align="center" :wrap="true" :size="12">
            <NCheckbox
              v-model:checked="accountInfo.settings.songRequest.enableOnStreaming"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              仅在直播时允许加入
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.songRequest.allowAllDanmaku"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              允许所有弹幕点播
            </NCheckbox>
          </NSpace>

          <template v-if="!accountInfo.settings.songRequest.allowAllDanmaku">
            <NSpace align="center" :wrap="true" :size="12">
              <NCheckbox
                v-model:checked="accountInfo.settings.songRequest.needWearFanMedal"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="updateSettings"
              >
                需要拥有粉丝牌
              </NCheckbox>

              <NInputGroup
                v-if="accountInfo.settings.songRequest.needWearFanMedal"
                class="song-request-settings__w-280"
              >
                <NInputGroupLabel>最低粉丝牌等级</NInputGroupLabel>
                <NInputNumber
                  v-model:value="accountInfo.settings.songRequest.fanMedalMinLevel"
                  :disabled="!liveRequest.configCanEdit"
                  size="small"
                />
                <NButton
                  type="primary"
                  secondary
                  size="small"
                  :disabled="!liveRequest.configCanEdit"
                  @click="updateSettings"
                >
                  保存
                </NButton>
              </NInputGroup>

              <NCheckbox
                v-model:checked="accountInfo.settings.songRequest.needJianzhang"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="updateSettings"
              >
                只允许舰长
              </NCheckbox>
              <NCheckbox
                v-model:checked="accountInfo.settings.songRequest.needTidu"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="updateSettings"
              >
                只允许提督
              </NCheckbox>
              <NCheckbox
                v-model:checked="accountInfo.settings.songRequest.needZongdu"
                :disabled="!liveRequest.configCanEdit"
                @update:checked="updateSettings"
              >
                只允许总督
              </NCheckbox>
            </NSpace>
          </template>

          <NSpace align="center" :wrap="true" :size="12">
            <NCheckbox
              v-model:checked="accountInfo.settings.songRequest.allowSC"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              允许通过 SuperChat 点播
            </NCheckbox>
            <NCheckbox
              v-if="accountInfo.settings.songRequest.allowSC"
              v-model:checked="accountInfo.settings.songRequest.scIgnoreLimit"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              SC 点播无视限制
            </NCheckbox>

            <NInputGroup
              v-if="accountInfo.settings.songRequest.allowSC"
              class="song-request-settings__w-280"
            >
              <NInputGroupLabel>最低 SC 价格</NInputGroupLabel>
              <NInputNumber
                v-model:value="accountInfo.settings.songRequest.scMinPrice"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <NButton
                type="primary"
                secondary
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard size="small" bordered title="点歌">
        <NSpace align="center" :wrap="true" :size="12">
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
              size="small"
            >
              歌单
            </NButton>
            内的歌曲
          </NCheckbox>
          <NCheckbox
            v-model:checked="accountInfo.settings.songRequest.allowReorderSong"
            :disabled="!liveRequest.configCanEdit"
            @update:checked="updateSettings"
          >
            允许重复点歌
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
            允许匿名网页点歌
          </NCheckbox>
        </NSpace>
      </NCard>

      <NCard size="small" bordered title="冷却（秒）">
        <NSpace vertical :size="12">
          <NSpace align="center" :wrap="true" :size="12">
            <NCheckbox
              v-model:checked="accountInfo.settings.songRequest.enableCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              启用点播冷却
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.songRequest.enableWebCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:checked="updateSettings"
            >
              启用网页点播冷却
            </NCheckbox>
          </NSpace>

          <NSpace v-if="accountInfo.settings.songRequest.enableCooldown" :wrap="true" :size="12">
            <NInputGroup class="song-request-settings__w-280">
              <NInputGroupLabel>普通弹幕</NInputGroupLabel>
              <NInputNumber
                v-model:value="accountInfo.settings.songRequest.cooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <NButton
                type="primary"
                secondary
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
            <NInputGroup class="song-request-settings__w-260">
              <NInputGroupLabel>舰长</NInputGroupLabel>
              <NInputNumber
                v-model:value="accountInfo.settings.songRequest.jianzhangCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <NButton
                type="primary"
                secondary
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
            <NInputGroup class="song-request-settings__w-260">
              <NInputGroupLabel>提督</NInputGroupLabel>
              <NInputNumber
                v-model:value="accountInfo.settings.songRequest.tiduCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <NButton
                type="primary"
                secondary
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
            <NInputGroup class="song-request-settings__w-260">
              <NInputGroupLabel>总督</NInputGroupLabel>
              <NInputNumber
                v-model:value="accountInfo.settings.songRequest.zongduCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <NButton
                type="primary"
                secondary
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
          </NSpace>

          <NInputGroup
            v-if="accountInfo.settings.songRequest.enableWebCooldown"
            class="song-request-settings__w-280"
          >
            <NInputGroupLabel>网页点播</NInputGroupLabel>
            <NInputNumber
              v-model:value="accountInfo.settings.songRequest.webCooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
            />
            <NButton
              type="primary"
              secondary
              size="small"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </NButton>
          </NInputGroup>
        </NSpace>
      </NCard>

      <NCard size="small" bordered title="OBS">
        <NSpace align="center" :wrap="true" :size="12">
          <NInputGroup class="song-request-settings__w-260">
            <NInputGroupLabel>标题</NInputGroupLabel>
            <template v-if="configCanEdit">
              <NInput
                v-model:value="settings.obsTitle"
                placeholder="默认为 点播"
                size="small"
              />
              <NButton type="primary" secondary size="small" @click="updateSettings">
                保存
              </NButton>
            </template>
          </NInputGroup>
          <NCheckbox
            v-model:checked="settings.showRequireInfo"
            :disabled="!configCanEdit"
            @update:checked="updateSettings"
          >
            显示底部需求信息
          </NCheckbox>
          <NCheckbox
            v-model:checked="settings.showUserName"
            :disabled="!configCanEdit"
            @update:checked="updateSettings"
          >
            显示点播用户名
          </NCheckbox>
          <NCheckbox
            v-model:checked="settings.showFanMadelInfo"
            :disabled="!configCanEdit"
            @update:checked="updateSettings"
          >
            显示点播用户粉丝牌
          </NCheckbox>
        </NSpace>
      </NCard>

      <NCard size="small" bordered title="警告消息">
        <NCheckbox
          :checked="liveRequest.isWarnMessageAutoClose"
          @update:checked="liveRequest.isWarnMessageAutoClose = $event"
        >
          自动关闭警告消息
        </NCheckbox>
      </NCard>
    </NSpace>
  </NSpin>
</template>

<style scoped>
.song-request-settings__w-280 {
  width: 320px;
  max-width: 100%;
}

.song-request-settings__w-260 {
  width: 300px;
  max-width: 100%;
}
</style>
