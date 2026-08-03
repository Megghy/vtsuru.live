<script setup lang="ts">
import { computed } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { Setting_LiveRequest } from '@/api/api-models'
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
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
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
          feedback('success', '已保存')
          return true
        } else {
          feedback('error', `保存失败: ${msg}`)
        }
      })
      .finally(() => {
        liveRequest.isLoading = false
      })
  } else {
    feedback('success', '完成')
  }
}
</script>

<template>
  <div :show="liveRequest.isLoading">
    <div
      vertical
      :size="12"
    >
      <UCard
        size="small"
        bordered
        title="规则"
      >
        <div
          vertical
          :size="12"
        >
          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <div class="song-request-settings__w-280">
              <span>点播弹幕前缀</span>
              <template v-if="liveRequest.configCanEdit">
                <UInput
                  v-model="accountInfo.settings.songRequest.orderPrefix"
                  size="small"
                />
                <UButton
                  color="primary"
                  variant="soft"
                  size="small"
                  @click="updateSettings"
                >
                  保存
                </UButton>
              </template>
              <UInput
                v-else
                v-model="liveRequest.defaultPrefix"
                size="small"
              />
            </div>
            <UAlert
              v-if="
                accountInfo.settings.songRequest.orderPrefix &&
                accountInfo.settings.songRequest.orderPrefix.includes(' ')
              "
              type="info"
              size="small"
              :bordered="false"
            >
              前缀包含空格，可能导致用户输入困难。
            </UAlert>
          </div>

          <div class="song-request-settings__w-280">
            <span>最大队列长度</span>
            <UInputNumber
              v-model="accountInfo.settings.songRequest.queueMaxSize"
              :disabled="!liveRequest.configCanEdit"
              size="small"
            />
            <UButton
              color="primary"
              variant="soft"
              size="small"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </UButton>
          </div>

          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <UCheckbox
              v-model="accountInfo.settings.songRequest.enableOnStreaming"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              仅在直播时允许加入
            </UCheckbox>
            <UCheckbox
              v-model="accountInfo.settings.songRequest.allowAllDanmaku"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              允许所有弹幕点播
            </UCheckbox>
          </div>

          <template v-if="!accountInfo.settings.songRequest.allowAllDanmaku">
            <div
              align="center"
              :wrap="true"
              :size="12"
            >
              <UCheckbox
                v-model="accountInfo.settings.songRequest.needWearFanMedal"
                :disabled="!liveRequest.configCanEdit"
                @update:model-value="updateSettings"
              >
                需要拥有粉丝牌
              </UCheckbox>

              <div
                v-if="accountInfo.settings.songRequest.needWearFanMedal"
                class="song-request-settings__w-280"
              >
                <span>最低粉丝牌等级</span>
                <UInputNumber
                  v-model="accountInfo.settings.songRequest.fanMedalMinLevel"
                  :disabled="!liveRequest.configCanEdit"
                  size="small"
                />
                <UButton
                  color="primary"
                  variant="soft"
                  size="small"
                  :disabled="!liveRequest.configCanEdit"
                  @click="updateSettings"
                >
                  保存
                </UButton>
              </div>

              <UCheckbox
                v-model="accountInfo.settings.songRequest.needJianzhang"
                :disabled="!liveRequest.configCanEdit"
                @update:model-value="updateSettings"
              >
                只允许舰长
              </UCheckbox>
              <UCheckbox
                v-model="accountInfo.settings.songRequest.needTidu"
                :disabled="!liveRequest.configCanEdit"
                @update:model-value="updateSettings"
              >
                只允许提督
              </UCheckbox>
              <UCheckbox
                v-model="accountInfo.settings.songRequest.needZongdu"
                :disabled="!liveRequest.configCanEdit"
                @update:model-value="updateSettings"
              >
                只允许总督
              </UCheckbox>
            </div>
          </template>

          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <UCheckbox
              v-model="accountInfo.settings.songRequest.allowSC"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              允许通过 SuperChat 点播
            </UCheckbox>
            <UCheckbox
              v-if="accountInfo.settings.songRequest.allowSC"
              v-model="accountInfo.settings.songRequest.scIgnoreLimit"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              SC 点播无视限制
            </UCheckbox>

            <div
              v-if="accountInfo.settings.songRequest.allowSC"
              class="song-request-settings__w-280"
            >
              <span>最低 SC 价格</span>
              <UInputNumber
                v-model="accountInfo.settings.songRequest.scMinPrice"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <UCard
        size="small"
        bordered
        title="点歌"
      >
        <div
          align="center"
          :wrap="true"
          :size="12"
        >
          <UCheckbox
            v-model="accountInfo.settings.songRequest.onlyAllowSongList"
            :disabled="!liveRequest.configCanEdit"
            @update:model-value="updateSettings"
          >
            仅允许点
            <UButton
              variant="link"
              tag="a"
              href="/manage/song-list"
              target="_blank"
              color="info"
              size="small"
            >
              歌单
            </UButton>
            内的歌曲
          </UCheckbox>
          <UCheckbox
            v-model="accountInfo.settings.songRequest.allowReorderSong"
            :disabled="!liveRequest.configCanEdit"
            @update:model-value="updateSettings"
          >
            允许重复点歌
          </UCheckbox>
          <UCheckbox
            v-model="accountInfo.settings.songRequest.allowFromWeb"
            :disabled="!liveRequest.configCanEdit"
            @update:model-value="updateSettings"
          >
            允许通过网页点歌
          </UCheckbox>
          <UCheckbox
            v-if="accountInfo.settings.songRequest.allowFromWeb"
            v-model="accountInfo.settings.songRequest.allowAnonymousFromWeb"
            :disabled="!liveRequest.configCanEdit"
            @update:model-value="updateSettings"
          >
            允许匿名网页点歌
          </UCheckbox>
        </div>
      </UCard>

      <UCard
        size="small"
        bordered
        title="冷却（秒）"
      >
        <div
          vertical
          :size="12"
        >
          <div
            align="center"
            :wrap="true"
            :size="12"
          >
            <UCheckbox
              v-model="accountInfo.settings.songRequest.enableCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              启用点播冷却
            </UCheckbox>
            <UCheckbox
              v-model="accountInfo.settings.songRequest.enableWebCooldown"
              :disabled="!liveRequest.configCanEdit"
              @update:model-value="updateSettings"
            >
              启用网页点播冷却
            </UCheckbox>
          </div>

          <div
            v-if="accountInfo.settings.songRequest.enableCooldown"
            :wrap="true"
            :size="12"
          >
            <div class="song-request-settings__w-280">
              <span>普通弹幕</span>
              <UInputNumber
                v-model="accountInfo.settings.songRequest.cooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </UButton>
            </div>
            <div class="song-request-settings__w-260">
              <span>舰长</span>
              <UInputNumber
                v-model="accountInfo.settings.songRequest.jianzhangCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </UButton>
            </div>
            <div class="song-request-settings__w-260">
              <span>提督</span>
              <UInputNumber
                v-model="accountInfo.settings.songRequest.tiduCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </UButton>
            </div>
            <div class="song-request-settings__w-260">
              <span>总督</span>
              <UInputNumber
                v-model="accountInfo.settings.songRequest.zongduCooldownSecond"
                :disabled="!liveRequest.configCanEdit"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                :disabled="!liveRequest.configCanEdit"
                @click="updateSettings"
              >
                保存
              </UButton>
            </div>
          </div>

          <div
            v-if="accountInfo.settings.songRequest.enableWebCooldown"
            class="song-request-settings__w-280"
          >
            <span>网页点播</span>
            <UInputNumber
              v-model="accountInfo.settings.songRequest.webCooldownSecond"
              :disabled="!liveRequest.configCanEdit"
              size="small"
            />
            <UButton
              color="primary"
              variant="soft"
              size="small"
              :disabled="!liveRequest.configCanEdit"
              @click="updateSettings"
            >
              保存
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard
        size="small"
        bordered
        title="OBS"
      >
        <div
          align="center"
          :wrap="true"
          :size="12"
        >
          <div class="song-request-settings__w-260">
            <span>标题</span>
            <template v-if="configCanEdit">
              <UInput
                v-model="settings.obsTitle"
                placeholder="默认为 点播"
                size="small"
              />
              <UButton
                color="primary"
                variant="soft"
                size="small"
                @click="updateSettings"
              >
                保存
              </UButton>
            </template>
          </div>
          <UCheckbox
            v-model="settings.showRequireInfo"
            :disabled="!configCanEdit"
            @update:model-value="updateSettings"
          >
            显示底部需求信息
          </UCheckbox>
          <UCheckbox
            v-model="settings.showUserName"
            :disabled="!configCanEdit"
            @update:model-value="updateSettings"
          >
            显示点播用户名
          </UCheckbox>
          <UCheckbox
            v-model="settings.showFanMadelInfo"
            :disabled="!configCanEdit"
            @update:model-value="updateSettings"
          >
            显示点播用户粉丝牌
          </UCheckbox>
        </div>
      </UCard>

      <UCard
        size="small"
        bordered
        title="警告消息"
      >
        <UCheckbox
          :model-value="liveRequest.isWarnMessageAutoClose"
          @update:model-value="liveRequest.isWarnMessageAutoClose = $event === true"
        >
          自动关闭警告消息
        </UCheckbox>
      </UCard>
    </div>
  </div>
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
