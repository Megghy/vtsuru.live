<script setup lang="ts">
import { Delete24Regular, Eye24Filled, EyeOff24Filled, Info24Filled } from '@vicons/fluent'
import { SettingsOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NFlex,
  NGrid,
  NGi,
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
  useQB.addTag(addTagName.value)
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
            placeholder="输入新标签名称"
            maxlength="30"
            show-count
            clearable
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
          v-if="useQB.tags.length === 0"
          description="暂无标签"
        />
        <NList
          v-else
          bordered
          hoverable
          class="question-box-tag-list"
        >
          <NListItem
            v-for="item in sortedTags"
            :key="item.name"
          >
            <NFlex
              class="question-box-tag-row"
              align="center"
              justify="space-between"
            >
              <NTag
                :bordered="false"
                :type="item.visiable ? 'success' : 'default'"
                :style="!item.visiable ? { textDecoration: 'line-through', color: 'grey' } : {}"
              >
                {{ item.name }}
              </NTag>
              <NFlex
                class="question-box-tag-actions"
                size="small"
              >
                <NTooltip placement="top">
                  <template #trigger>
                    <NPopconfirm @positive-click="useQB.updateTagVisiable(item.name, !item.visiable)">
                      <template #trigger>
                        <NButton
                          :type="item.visiable ? 'success' : 'warning'"
                          text
                          size="small"
                        >
                          <template #icon>
                            <NIcon :component="item.visiable ? Eye24Filled : EyeOff24Filled" />
                          </template>
                        </NButton>
                      </template>
                      确定要{{ item.visiable ? '隐藏' : '显示' }}这个标签吗?
                    </NPopconfirm>
                  </template>
                  {{ item.visiable ? '隐藏标签' : '显示标签' }}
                </NTooltip>
                <NTooltip placement="top">
                  <template #trigger>
                    <NPopconfirm @positive-click="useQB.delTag(item.name)">
                      <template #trigger>
                        <NButton
                          type="error"
                          text
                          size="small"
                        >
                          <template #icon>
                            <NIcon :component="Delete24Regular" />
                          </template>
                        </NButton>
                      </template>
                      确定要删除这个标签吗?
                    </NPopconfirm>
                  </template>
                  删除标签
                </NTooltip>
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
  --question-box-card-gap: 12px;
}

.question-box-settings-stack {
  gap: var(--question-box-card-gap);
}

.question-box-settings-content {
  gap: 10px;
}

.question-box-settings-grid :deep(.n-card__content) {
  padding: 14px 16px 16px;
}

.question-box-safety-content {
  padding: 0 2px 4px;
}

.question-box-help-text {
  margin-bottom: 12px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.question-box-tags-card {
  height: 100%;
}

.question-box-tag-input {
  margin-bottom: 10px;
}

.question-box-tag-list {
  max-height: 500px;
  overflow-y: auto;
}

.question-box-tag-row {
  gap: 8px;
}

.question-box-tag-actions {
  flex: none;
  gap: 2px;
}

.question-box-tag-list :deep(.n-list-item) {
  padding: 7px 10px;
}

@media (max-width: 520px) {
  .question-box-settings-grid :deep(.n-card__content) {
    padding: 12px;
  }

  .question-box-tag-list :deep(.n-list-item) {
    padding: 6px 8px;
  }
}
</style>
