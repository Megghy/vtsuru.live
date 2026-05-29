<script setup lang="ts">
import type { QAInfo } from '@/api/api-models'
import { ArrowSync24Filled, Copy24Filled, Delete24Filled, Link24Filled, Share24Filled } from '@vicons/fluent'
import { TrashBin } from '@vicons/ionicons5'
import {
  NBadge, NButton, NCard, NDivider, NEmpty, NFlex, NIcon, NInput, NInputGroup,
  NList, NListItem, NPopconfirm, NSelect, NSpin, NSwitch, NTabPane, NTabs,
  NTag, NText, NTime, NTooltip, useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { useFunctionToggle } from '@/apps/manage/composables/useFunctionToggle'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import QuestionItem from '@/components/QuestionItem.vue'
import QuestionBoxReceivedTab from '@/apps/manage/components/question-box/QuestionBoxReceivedTab.vue'
import QuestionBoxReplyModal from '@/apps/manage/components/question-box/QuestionBoxReplyModal.vue'
import QuestionBoxShareModal from '@/apps/manage/components/question-box/QuestionBoxShareModal.vue'
import QuestionBoxOBSModal from '@/apps/manage/components/question-box/QuestionBoxOBSModal.vue'
import QuestionBoxSettings from '@/apps/manage/components/question-box/QuestionBoxSettings.vue'
import { CURRENT_HOST } from '@/shared/config'
import { useQuestionBox } from '@/store/useQuestionBox'
import { copyToClipboard } from '@/shared/utils'
import router from '@/app/router'

const accountInfo = useAccount()
const route = useRoute()
const message = useMessage()
const useQB = useQuestionBox()

const selectedTabItem = ref(route.query.send ? '1' : '0')
const replyModalVisible = ref(false)
const shareModalVisible = ref(false)
const showOBSModal = ref(false)
const { loading: functionSwitchLoading, setEnable: setFunctionEnable } = useFunctionToggle(FunctionTypes.QuestionBox, '提问箱')

const selectedDirectShareTag = ref<string | null>(null)
const directShareUrl = computed(() => {
  const base = `${CURRENT_HOST}@${accountInfo.value?.name}/question-box`
  return selectedDirectShareTag.value ? `${base}?tag=${selectedDirectShareTag.value}` : base
})

function onOpenReply(question: QAInfo) {
  useQB.currentQuestion = question
  replyModalVisible.value = true
}

async function refresh() {
  if (selectedTabItem.value === '0' || selectedTabItem.value === '2') await useQB.GetRecieveQAInfo()
  if (selectedTabItem.value === '1') await useQB.GetSendQAInfo()
  message.success('已刷新')
}

// 按需加载发送数据
watch(selectedTabItem, (tab) => {
  if (tab === '1' && useQB.sendQuestions.length === 0) useQB.GetSendQAInfo()
})

onMounted(() => {
  useQB.GetTags()
  useQB.GetRecieveQAInfo()
  useQB.displayQuestion = useQB.recieveQuestions.find(
    s => s.id === accountInfo.value?.settings?.questionDisplay?.currentQuestion,
  )
})
</script>

<template>
  <NSpin :show="!accountInfo">
    <template v-if="accountInfo">
      <ManagePageHeader title="提问箱管理" :function-type="FunctionTypes.QuestionBox" :loading="useQB.isLoading">
        <template #action>
          <NButton secondary circle type="primary" :loading="useQB.isLoading" @click="refresh">
            <template #icon>
              <NIcon :component="ArrowSync24Filled" />
            </template>
          </NButton>
          <NTooltip>
            <template #trigger>
              <NButton secondary circle @click="shareModalVisible = true">
                <template #icon>
                  <NIcon :component="Share24Filled" />
                </template>
              </NButton>
            </template>
            分享提问箱
          </NTooltip>
          <NButton secondary @click="showOBSModal = true">
            OBS 组件
          </NButton>
          <NButton primary @click="$router.push({ name: 'user-questionBox', params: { id: accountInfo.name } })">
            <template #icon>
              <NIcon :component="Link24Filled" />
            </template>
            前往提问页
          </NButton>
        </template>
      </ManagePageHeader>

      <!-- 链接卡片 -->
      <NCard size="small" :bordered="true" content-style="padding: 12px;" style="width: fit-content;">
        <NFlex align="center" wrap :size="12">
          <NTag :type="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.QuestionBox) ? 'success' : 'warning'" :bordered="false" size="small">
            {{ accountInfo.settings?.enableFunctions?.includes(FunctionTypes.QuestionBox) ? '展示页已开启' : '展示页已关闭' }}
          </NTag>
          <NSwitch
            :value="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.QuestionBox)"
            :loading="functionSwitchLoading"
            :disabled="functionSwitchLoading"
            @update:value="setFunctionEnable"
          />
          <NDivider vertical />
          <NIcon :component="Link24Filled" size="20" depth="3" />
          <NText depth="3">
            我的提问链接:
          </NText>
          <NInputGroup style="max-width: 400px;">
            <NInput :value="directShareUrl" readonly size="small" />
            <NButton secondary size="small" @click="copyToClipboard(directShareUrl)">
              <template #icon>
                <NIcon :component="Copy24Filled" />
              </template>
              复制
            </NButton>
          </NInputGroup>
          <NSelect
            v-model:value="selectedDirectShareTag"
            placeholder="附加话题 (可选)"
            filterable clearable size="small"
            :options="useQB.tags.filter(t => t.visiable).map(s => ({ label: s.name, value: s.name }))"
            style="width: 160px;"
          />
        </NFlex>
      </NCard>

      <!-- 主要内容 -->
      <NSpin :show="useQB.isLoading">
        <NTabs v-model:value="selectedTabItem" animated type="line" size="large">
          <!-- 我收到的 -->
          <NTabPane name="0" display-directive="show:lazy">
            <template #tab>
              <NBadge :value="useQB.recieveQuestionsFiltered.length" :max="999" type="info" :offset="[8, -2]">
                我收到的
              </NBadge>
            </template>
            <QuestionBoxReceivedTab @reply="onOpenReply" />
          </NTabPane>

          <!-- 我发送的 -->
          <NTabPane name="1" display-directive="show:lazy">
            <template #tab>
              <NBadge :value="useQB.sendQuestions.length" :max="999" :offset="[8, -2]">
                我发送的
              </NBadge>
            </template>
            <NEmpty v-if="useQB.sendQuestions.length === 0" description="暂无发送的提问" style="margin-top: 40px;" />
            <NList v-else :show-divider="false">
              <NListItem v-for="item in useQB.sendQuestions" :key="item.id" style="padding: 0 0 12px 0;">
                <NCard size="small" hoverable embedded content-style="padding: 12px 16px;">
                  <template #header>
                    <NFlex align="center" justify="space-between">
                      <NFlex :size="8" align="center">
                        <NTag size="small" :bordered="false" type="info">
                          发给
                        </NTag>
                        <NButton text type="primary" @click="router.push(`/user/${item.target.id}`)">
                          {{ item.target.name }}
                        </NButton>
                      </NFlex>
                      <NText depth="3" style="font-size: 12px;">
                        <NTooltip placement="top-end">
                          <template #trigger>
                            <NTime :time="item.sendAt" :to="Date.now()" type="relative" />
                          </template>
                          <NTime :time="item.sendAt" format="yyyy-MM-dd HH:mm:ss" />
                        </NTooltip>
                      </NText>
                    </NFlex>
                  </template>
                  <NText style="font-size: 15px; line-height: 1.6; display: block; margin-bottom: 8px;">
                    {{ item.question?.message }}
                  </NText>
                  <template v-if="item.answer" #footer>
                    <NCard size="small" :bordered="false" embedded>
                      <template #header>
                        <NFlex justify="space-between" align="center">
                          <NText depth="3" style="font-size: 13px;">
                            对方的回复
                          </NText>
                          <NText v-if="item.answer.createdAt" depth="3" style="font-size: 12px;">
                            <NTime :time="item.answer.createdAt" :to="Date.now()" type="relative" />
                          </NText>
                        </NFlex>
                      </template>
                      <NText style="line-height: 1.5;">
                        {{ item.answer.message }}
                      </NText>
                    </NCard>
                  </template>
                </NCard>
              </NListItem>
            </NList>
          </NTabPane>

          <!-- 垃圾站 -->
          <NTabPane name="2" display-directive="show:lazy">
            <template #tab>
              <NBadge :value="useQB.trashQuestions.length" :max="99" type="warning" :offset="[8, -2]">
                <NFlex align="center">
                  <NIcon :component="TrashBin" />垃圾站
                </NFlex>
              </NBadge>
            </template>
            <NEmpty v-if="useQB.trashQuestions.length === 0" description="暂无被过滤的提问" />
            <div v-else style="display: flex; flex-direction: column; gap: 8px;">
              <QuestionItem v-for="question in useQB.trashQuestions" :key="question.id" :item="question">
                <template #footer="{ item }">
                  <NFlex justify="end">
                    <NButton size="small" type="primary" ghost @click="useQB.markAsNormal(item)">
                      标记为正常
                    </NButton>
                    <NButton size="small" type="warning" ghost @click="useQB.blacklist(item)">
                      拉黑提问者
                    </NButton>
                    <NPopconfirm @positive-click="useQB.DelQA(item.id)">
                      <template #trigger>
                        <NButton size="small" type="error" ghost>
                          <template #icon>
                            <NIcon :component="Delete24Filled" />
                          </template>
                          彻底删除
                        </NButton>
                      </template>
                      确认彻底删除？
                    </NPopconfirm>
                  </NFlex>
                </template>
                <template #header-extra />
              </QuestionItem>
            </div>
          </NTabPane>

          <!-- 设置 -->
          <NTabPane tab="设置" name="3" display-directive="show:lazy">
            <QuestionBoxSettings />
          </NTabPane>
        </NTabs>
      </NSpin>
    </template>
    <template #description>
      正在加载账户信息...
    </template>
  </NSpin>

  <!-- 模态框 -->
  <QuestionBoxReplyModal v-model:show="replyModalVisible" />
  <QuestionBoxShareModal v-model:show="shareModalVisible" />
  <QuestionBoxOBSModal v-model:show="showOBSModal" />
</template>
