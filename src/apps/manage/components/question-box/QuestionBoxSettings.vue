<script setup lang="ts">
import { Delete24Regular, Eye24Filled, EyeOff24Filled, Info24Filled } from '@vicons/fluent'
import { SettingsOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NList,
  NListItem,
  NPopconfirm,
  NSlider,
  NTag,
  NTooltip,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

import { SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const useQB = useQuestionBox()
const message = useMessage()
const themeVars = useThemeVars()

const addTagName = ref('')
const tempSaftyLevel = ref(accountInfo.value?.settings?.questionBox?.saftyLevel ?? 0)
const sortedTags = computed(() => useQB.tags.toSorted((a, b) => b.createAt - a.createAt))

watch(
  () => accountInfo.value?.settings?.questionBox?.saftyLevel,
  (v) => {
    if (v !== undefined) tempSaftyLevel.value = v
  },
  { immediate: true },
)

const remarkLevel = {
  0: () =>
    h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
      '无',
      h(NTooltip, null, {
        trigger: () => h(NIcon, { component: Info24Filled, color: themeVars.value.successColor }),
        default: () => '完全关闭内容审查',
      }),
    ]),
  1: () =>
    h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
      '宽松',
      h(NTooltip, null, {
        trigger: () => h(NIcon, { component: Info24Filled, color: themeVars.value.infoColor }),
        default: () => '仅过滤极端内容 (得分 > 30)',
      }),
    ]),
  2: () =>
    h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
      '一般',
      h(NTooltip, null, {
        trigger: () => h(NIcon, { component: Info24Filled, color: themeVars.value.warningColor }),
        default: () => '过滤潜在冒犯性内容 (得分 > 60)',
      }),
    ]),
  3: () =>
    h(NFlex, { align: 'center', justify: 'center', size: 3, wrap: false }, () => [
      '严格',
      h(NTooltip, null, {
        trigger: () => h(NIcon, { component: Info24Filled, color: themeVars.value.errorColor }),
        default: () => '过滤所有可能不适内容 (得分 > 90)',
      }),
    ]),
}

async function saveQuestionBoxSettings() {
  if (!accountInfo.value?.settings?.questionBox) return
  try {
    const success = await SaveSetting('QuestionBox', accountInfo.value.settings.questionBox)
    if (success) message.success('设置已保存')
    else message.error('保存设置失败')
  } catch (err) {
    message.error(`保存设置时出错: ${err}`)
  }
}

async function saveNotificationSetting() {
  if (!accountInfo.value?.settings?.sendEmail) return
  try {
    const response = await SaveAccountSettings()
    if (response.code === 200) message.success('通知设置已保存')
    else message.error(`修改通知设置失败: ${response.message}`)
  } catch (err) {
    message.error(`修改通知设置失败: ${err}`)
  }
}

function addTag() {
  if (!addTagName.value.trim()) return
  useQB.addTag(addTagName.value.trim())
  addTagName.value = ''
}
</script>

<template>
  <NGrid
    class="question-box-settings-grid"
    x-gap="12"
    y-gap="12"
    cols="1 800:2"
  >
    <NGi>
      <NFlex
        class="question-box-settings-stack"
        vertical
        :size="12"
      >
        <NCard
          class="setting-card"
          title="基础设定"
          size="small"
          segmented
        >
          <template #header-extra>
            <NIcon
              :component="SettingsOutline"
              size="18"
            />
          </template>
          <NFlex
            class="question-box-settings-content"
            vertical
            :size="12"
          >
            <NCheckbox
              v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
              :disabled="useQB.isLoading"
              @update:checked="saveQuestionBoxSettings"
            >
              允许未注册/匿名用户进行提问
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.questionBox.allowImageUpload"
              :disabled="useQB.isLoading"
              @update:checked="saveQuestionBoxSettings"
            >
              允许上传图片
            </NCheckbox>
            <NCheckbox
              :checked="accountInfo.settings.questionBox.showPublicReplies !== false"
              :disabled="useQB.isLoading"
              @update:checked="
                (checked) => {
                  accountInfo.settings.questionBox.showPublicReplies = checked
                  saveQuestionBoxSettings()
                }
              "
            >
              在提问页显示公开回复
            </NCheckbox>
          </NFlex>
        </NCard>

        <NCard
          class="setting-card"
          title="内容审查"
          size="small"
          segmented
        >
          <div class="question-box-safety-content">
            <div class="question-box-help-text">设置过滤强度，自动拦截恶意提问</div>
            <NSlider
              v-model:value="tempSaftyLevel"
              :marks="remarkLevel"
              step="mark"
              :max="3"
              :disabled="useQB.isLoading"
              @dragend="
                () => {
                  if (accountInfo?.settings?.questionBox) {
                    accountInfo.settings.questionBox.saftyLevel = tempSaftyLevel
                    saveQuestionBoxSettings()
                  }
                }
              "
            />
          </div>
        </NCard>

        <NCard
          class="setting-card"
          title="通知设置"
          size="small"
          segmented
        >
          <NFlex
            class="question-box-settings-content"
            vertical
            :size="12"
          >
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQA"
              :disabled="useQB.isLoading"
              @update:checked="saveNotificationSetting"
            >
              收到新提问时发送邮件通知
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQAReply"
              :disabled="useQB.isLoading"
              @update:checked="saveNotificationSetting"
            >
              我发送的提问收到回复时发送邮件通知
            </NCheckbox>
          </NFlex>
        </NCard>
      </NFlex>
    </NGi>

    <NGi>
      <NCard
        class="setting-card question-box-tags-card"
        title="标签/话题管理"
        size="small"
        segmented
      >
        <template #header-extra>
          <NTooltip placement="left">
            <template #trigger>
              <NIcon
                :component="Info24Filled"
                style="cursor: help"
              />
            </template>
            用于对收到的提问进行分类，或让提问者选择相关话题。
          </NTooltip>
        </template>

        <NInputGroup class="question-box-tag-input">
          <NInput
            v-model:value="addTagName"
            placeholder="输入新标签名称..."
            maxlength="20"
            show-count
            clearable
            @keydown.enter="addTag"
          />
          <NButton
            type="primary"
            :disabled="!addTagName.trim()"
            @click="addTag"
          >
            添加
          </NButton>
        </NInputGroup>

        <NEmpty
          v-if="sortedTags.length === 0"
          description="暂无标签，添加后提问者可选择分类"
          style="margin-top: 24px"
        />

        <NList
          v-else
          class="question-box-tags-list"
        >
          <NListItem
            v-for="item in sortedTags"
            :key="item.name"
            class="tag-item"
          >
            <NFlex
              align="center"
              justify="space-between"
            >
              <NFlex
                align="center"
                :size="8"
              >
                <NTag
                  size="small"
                  :type="item.visiable ? 'primary' : 'default'"
                >
                  {{ item.name }}
                </NTag>
                <NTag
                  v-if="!item.visiable"
                  size="small"
                  :bordered="false"
                >
                  已隐藏
                </NTag>
              </NFlex>

              <NFlex :size="6">
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="tiny"
                      quaternary
                      circle
                      @click="useQB.changeTagVisiable(item.name, !item.visiable)"
                    >
                      <template #icon>
                        <NIcon :component="item.visiable ? Eye24Filled : EyeOff24Filled" />
                      </template>
                    </NButton>
                  </template>
                  {{ item.visiable ? '在提问页隐藏该话题' : '在提问页显示该话题' }}
                </NTooltip>

                <NPopconfirm @positive-click="useQB.delTag(item.name)">
                  <template #trigger>
                    <NButton
                      size="tiny"
                      quaternary
                      circle
                      type="error"
                    >
                      <template #icon>
                        <NIcon :component="Delete24Regular" />
                      </template>
                    </NButton>
                  </template>
                  确认删除标签「{{ item.name }}」吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>
          </NListItem>
        </NList>
      </NCard>
    </NGi>
  </NGrid>
</template>

<style scoped>
.question-box-settings-grid {
  margin-top: 4px;
}

.setting-card {
  border-radius: 8px;
}

.question-box-safety-content {
  padding: 8px 12px 16px;
}

.question-box-help-text {
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
}

.question-box-tag-input {
  margin-bottom: 12px;
}

.question-box-tags-list {
  max-height: 380px;
  overflow-y: auto;
}

.tag-item {
  padding: 8px 4px !important;
}
</style>
