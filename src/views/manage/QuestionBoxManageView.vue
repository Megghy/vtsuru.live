<script setup lang="ts">
import { copyToClipboard, downloadImage } from '@/Utils'
import { DisableFunction, EnableFunction, SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import { FunctionTypes, QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { CN_HOST, CURRENT_HOST } from '@/data/constants'
import router from '@/router'
import QuestionItem from '@/components/QuestionItem.vue'
import QuestionItems from '@/components/QuestionItems.vue'
import QuestionDisplayCard from './QuestionDisplayCard.vue'
import { useQuestionBox } from '@/store/useQuestionBox'
import { Delete24Filled, Delete24Regular, Eye24Filled, EyeOff24Filled, Info24Filled } from '@vicons/fluent'
import { Heart, HeartOutline, TrashBin } from '@vicons/ionicons5'
import { useStorage } from '@vueuse/core'
// @ts-ignore
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NImage,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NList,
  NListItem,
  NModal,
  NPagination,
  NPopconfirm,
  NSelect,
  NSlider,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage
} from 'naive-ui'
import QrcodeVue from 'qrcode.vue'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// --- 响应式状态和全局实例 ---
const accountInfo = useAccount() // 获取账户信息
const route = useRoute() // 获取路由信息
const message = useMessage() // NaiveUI 消息提示
const useQB = useQuestionBox() // 问题箱状态管理

// --- 组件内部状态 ---
const selectedTabItem = ref(route.query.send ? '1' : '0') // 当前选中的标签页, 默认为'我收到的', 如果路由带send参数则为'我发送的'
const replyModalVisiable = ref(false) // 回复模态框可见性
const shareModalVisiable = ref(false) // 分享模态框可见性
const showOBSModal = ref(false) // OBS预览模态框可见性
const replyMessage = ref('') // 回复输入框内容
const addTagName = ref('') // 添加标签输入框内容
const shareCardRef = ref<HTMLElement | null>(null) // 分享卡片DOM引用
const selectedShareTag = ref<string | null>(null) // 分享时选择的标签
const selectedDirectShareTag = ref<string | null>(null) // 主链接区域选择的标签
const ps = ref(20) // 分页大小 (每页条数)
const pn = ref(1) // 当前页码
const savedCardSize = useStorage<{ width: number; height: number }>('Settings.QuestionDisplay.CardSize', { // 问题展示卡片尺寸 (持久化存储)
  width: 400,
  height: 400,
})
const tempSaftyLevel = ref(0) // 临时存储安全等级滑块值, 用于延迟更新

// --- 计算属性 ---
// 问题展示设置, 提供默认值
const setting = computed({
  get: (): Setting_QuestionDisplay => {
    return accountInfo.value?.settings?.questionDisplay ?? {} as Setting_QuestionDisplay
  },
  set: (value) => {
    if (accountInfo.value?.settings) { // 安全设置, 确保 accountInfo 存在
      accountInfo.value.settings.questionDisplay = value
    }
  },
})

// 分享链接 (统一 Host, 根据选择的标签附加参数)
const shareUrlWithTag = (tag: string | null) => {
  const base = `${CURRENT_HOST}@${accountInfo.value?.name}/question-box`
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base
}

// 主链接区域显示的链接
const directShareUrl = computed(() => shareUrlWithTag(selectedDirectShareTag.value))

// 分享模态框中的二维码/卡片链接 (也基于selectedShareTag)
const modalShareUrl = computed(() => shareUrlWithTag(selectedShareTag.value))

// 分页后的问题列表 (仅限收到的问题)
const pagedQuestions = computed(() =>
  useQB.recieveQuestionsFiltered.slice((pn.value - 1) * ps.value, pn.value * ps.value),
)

// 安全等级标记渲染函数
const remarkLevel = {
  0: () => h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
    '无', // 等级0: 无审查
    h(NTooltip, null, { trigger: () => h(NIcon, { component: Info24Filled, color: '#c2e77f' }), default: () => '完全关闭内容审查机制，用户可自由提问，系统不会进行任何内容过滤' }),
  ]),
  1: () => h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
    '宽松', // 等级1: 宽松审查
    h(NTooltip, null, { trigger: () => h(NIcon, { component: Info24Filled, color: '#e1d776' }), default: () => '基础内容审查，仅过滤极端攻击性、暴力或违法内容，保留大部分用户提问 (得分 > 30)' }),
  ]),
  2: () => h(NFlex, { align: 'center', justify: 'center', size: 3 }, () => [
    '一般', // 等级2: 一般审查
    h(NTooltip, null, { trigger: () => h(NIcon, { component: Info24Filled, color: '#ef956d' }), default: () => '适度内容审查，过滤更广泛的潜在冒犯性内容 (得分 > 60)' }),
  ]),
  3: () => h(NFlex, { align: 'center', justify: 'center', size: 3, wrap: false }, () => [
    '严格', // 等级3: 严格审查
    h(NTooltip, null, { trigger: () => h(NIcon, { component: Info24Filled, color: '#ea6262' }), default: () => '最高级别内容审查，过滤所有可能令人不适或冒犯的内容 (得分 > 90)' }),
  ]),
}
// 安全等级文本映射
const remarkLevelString: { [key: number]: string } = {
  0: '无',
  1: '宽松',
  2: '一般',
  3: '严格',
}

// --- 方法 ---
// 打开回复模态框
function onOpenModal(question: QAInfo) {
  useQB.currentQuestion = question // 设置当前操作的问题
  replyMessage.value = question.answer?.message ?? '' // 初始化回复内容 (如果是已有回复则加载)
  replyModalVisiable.value = true // 显示模态框
}

// 刷新数据
async function refresh() {
  // 重置页码为第一页
  pn.value = 1;
  // 根据当前标签页重新获取数据
  if (selectedTabItem.value == '0') {
    await useQB.GetRecieveQAInfo()
  } else if (selectedTabItem.value == '1') {
    await useQB.GetSendQAInfo()
  }
  // 如果在垃圾站或设置页, 额外刷新收到的问题列表 (可能需要更新状态)
  if (selectedTabItem.value === '2' || selectedTabItem.value === '3') {
     await useQB.GetRecieveQAInfo()
     // 如果需要，也可以刷新发送的列表
     // await useQB.GetSendQAInfo()
  }
  message.success('已刷新')
}

// 保存分享卡片图片
function saveShareImage() {
  if (!shareCardRef.value || !accountInfo.value?.name) return // 防御式编程

  html2canvas(shareCardRef.value, {
    width: shareCardRef.value.clientWidth, // 使用DOM原始宽度
    height: shareCardRef.value.clientHeight, // 使用DOM原始高度
    backgroundColor: null, // 透明背景
    scrollY: 0,
    scrollX: 0,
    useCORS: true, // 尝试使用CORS
    scale: window.devicePixelRatio * 2, // 提高截图分辨率以获得更清晰的图像 (2倍)
  }).then((canvas) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, `vtsuru-提问箱-${accountInfo.value?.name}.png`) // 保存Blob对象
        } else {
          message.error('无法生成图片 Blob')
        }
      },
      'image/png', // 指定图片格式
      1, // 图片质量 (无损)
    )
  }).catch(err => {
    message.error('生成分享卡片失败: ' + err)
    console.error("html2canvas error:", err);
  })
}

// 保存二维码图片
function saveQRCode() {
  if (!modalShareUrl.value || !accountInfo.value?.name) return
  // 使用 QR Server API 生成并下载二维码
  downloadImage(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(modalShareUrl.value)}`, `vtsuru-提问箱二维码-${accountInfo.value.name}.png`)
  message.success('二维码已开始下载')
}

// 保存问题箱核心设置 (如允许匿名提问, 安全等级)
async function saveQuestionBoxSettings() {
  if (!accountInfo.value?.settings?.questionBox) return // 防御

  try {
    const success = await SaveSetting('QuestionBox', accountInfo.value.settings.questionBox)
    if (success) {
      message.success('设置已保存')
    } else {
      message.error('保存设置失败') // API 返回 false
    }
  } catch (err) {
    message.error('保存设置时出错: ' + err)
    console.error("SaveSetting error:", err);
  }
}

// 保存通知相关的账户设置
async function saveNotificationSetting() {
    if (!accountInfo.value?.settings?.sendEmail) return; // 防御

    try {
      const response = await SaveAccountSettings(); // API 应只保存账户相关的设置
      if (response.code === 200) {
        message.success('通知设置已保存');
      } else {
        message.error('修改通知设置失败: ' + response.message); // 使用后端返回的消息
      }
    } catch (err) {
      message.error('修改通知设置失败: ' + err);
      console.error("SaveAccountSettings error:", err);
    }
  }

// 启用或禁用提问箱功能
async function setFunctionEnable(enable: boolean) {
  let success = false
  try {
    if (enable) {
      success = await EnableFunction(FunctionTypes.QuestionBox) // 调用启用API
    } else {
      success = await DisableFunction(FunctionTypes.QuestionBox) // 调用禁用API
    }
    if (success) {
      message.success(`提问箱功能已${enable ? '启用' : '禁用'}`)
      // 成功后可能需要更新 accountInfo 中的 enableFunctions 状态, useAccount 可能需要提供更新方法或自动刷新
      // 假设 useAccount() 会自动更新或有刷新机制
      if (accountInfo.value?.settings?.enableFunctions) {
         if (enable && !accountInfo.value.settings.enableFunctions.includes(FunctionTypes.QuestionBox)) {
            accountInfo.value.settings.enableFunctions.push(FunctionTypes.QuestionBox)
         } else if (!enable) {
             const index = accountInfo.value.settings.enableFunctions.indexOf(FunctionTypes.QuestionBox);
             if (index > -1) {
                 accountInfo.value.settings.enableFunctions.splice(index, 1);
             }
         }
      }

    } else {
      message.error(`无法${enable ? '启用' : '禁用'}提问箱功能`)
    }
  } catch (err) {
     message.error(`操作失败: ${err}`)
     console.error("Enable/Disable Function error:", err);
     // 操作失败时可能需要恢复 Switch 的状态,防止UI与实际状态不一致
     // 这需要更复杂的逻辑,暂时不加
  }
}

// --- 生命周期钩子 ---
onMounted(() => {
  // 组件挂载时获取初始数据
  useQB.GetTags() // 获取标签列表
  useQB.GetRecieveQAInfo() // 获取收到的问题
  useQB.GetSendQAInfo() // 获取发送的问题

  // 初始化展示问题 (如果设置中存在)
  useQB.displayQuestion = useQB.recieveQuestions.find(
    (s) => s.id == accountInfo.value?.settings?.questionDisplay?.currentQuestion,
  )

  // 初始化安全等级滑块的临时值
  if (accountInfo.value?.settings?.questionBox?.saftyLevel !== undefined) {
      tempSaftyLevel.value = accountInfo.value.settings.questionBox.saftyLevel;
  }
});

// 监听 accountInfo 变化, 以确保 tempSaftyLevel 能在 accountInfo 加载后正确初始化
watch(() => accountInfo.value?.settings?.questionBox?.saftyLevel, (newLevel) => {
    if (newLevel !== undefined) {
        tempSaftyLevel.value = newLevel;
    }
}, { immediate: true }); // 立即执行一次以设置初始值

</script>

<template>
  <NSpin :show="!accountInfo">
    <template v-if="accountInfo">
      <!-- 顶部操作区域 -->
      <NSpace
        align="center"
        wrap
        item-style="margin-bottom: 8px;"
      >
        <!-- 提问箱启用开关 -->
        <NAlert
          :type="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.QuestionBox) ? 'success' : 'warning'"
          style="padding: 5px 10px;"
          :show-icon="false"
        >
          <NFlex align="center">
            启用提问箱
            <NSwitch
              :value="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.QuestionBox)"
              :disabled="useQB.isLoading"
              @update:value="setFunctionEnable"
            />
          </NFlex>
        </NAlert>

        <!-- 操作按钮 -->
        <NButton
          type="primary"
          :loading="useQB.isLoading"
          @click="refresh"
        >
          刷新
        </NButton>
        <NButton
          type="primary"
          secondary
          @click="shareModalVisiable = true"
        >
          分享
        </NButton>
        <NButton
          type="primary"
          secondary
          @click="$router.push({ name: 'user-questionBox', params: { id: accountInfo.name } })"
        >
          前往提问页
        </NButton>
        <NButton
          type="primary"
          secondary
          @click="showOBSModal = true"
        >
          预览OBS组件
        </NButton>

        <!-- 功能提示 -->
        <NAlert
          type="success"
          closable
          style="max-width: 550px;"
        >
          2025.3.1 本站已支持内容审查, 可前往提问箱设置页进行开启
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            新功能还不稳定, 如果启用后遇到任何问题请向我反馈
          </NTooltip>
        </NAlert>
      </NSpace>

      <!-- 提问页链接 -->
      <NDivider
        title-placement="left"
        style="margin: 16px 0;"
      >
        提问页链接
      </NDivider>
      <NFlex align="center">
        <!-- 主链接区域输入框和复制按钮 -->
        <NInputGroup style="flex-grow: 1; max-width: 500px;">
          <NInput
            :value="directShareUrl"
            readonly
          />
          <NButton
            secondary
            @click="copyToClipboard(directShareUrl)"
          >
            复制
          </NButton>
        </NInputGroup>
        <!-- 主链接区域标签选择器 -->
        <NSelect
          v-model:value="selectedDirectShareTag"
          placeholder="附加话题 (可选)"
          filterable
          clearable
          :options="useQB.tags.filter(t => t.visiable).map((s) => ({ label: s.name, value: s.name }))"
          style="min-width: 150px; max-width: 200px;"
        />
      </NFlex>

      <!-- 审核中提示 -->
      <template v-if="useQB.reviewing > 0">
        <NDivider style="margin: 10px 0" />
        <NAlert
          type="warning"
          title="有提问正在审核中"
        >
          当前有 {{ useQB.reviewing }} 条提问正在等待审核。
        </NAlert>
      </template>

      <NDivider style="margin: 16px 0;" />

      <!-- 主要内容区域: 标签页 -->
      <NSpin :show="useQB.isLoading">
        <NTabs
          v-model:value="selectedTabItem"
          animated
          type="line"
        >
          <!-- 我收到的 -->
          <NTabPane
            tab="我收到的"
            name="0"
            display-directive="show:lazy"
          >
            <NFlex
              align="center"
              justify="space-between"
              wrap
              item-style="margin-bottom: 8px;"
            >
              <!-- 左侧操作 -->
              <NSpace>
                <NButton
                  type="primary"
                  @click="$router.push({ name: 'question-display' })"
                >
                  打开展示页
                </NButton>
                <NSelect
                  v-model:value="useQB.displayTag"
                  placeholder="筛选话题"
                  filterable
                  clearable
                  :options="useQB.tags.map((s) => ({ label: s.name, value: s.name }))"
                  style="min-width: 150px;"
                >
                  <template #header>
                    <NText
                      strong
                      depth="3"
                      style="padding: 4px 8px; display: block;"
                    >
                      在设置选项卡中管理话题
                    </NText>
                  </template>
                </NSelect>
              </NSpace>
              <!-- 右侧筛选 -->
              <NSpace>
                <NCheckbox v-model:checked="useQB.onlyFavorite">
                  只看收藏
                </NCheckbox>
                <NCheckbox v-model:checked="useQB.onlyPublic">
                  只看公开
                </NCheckbox>
                <NCheckbox v-model:checked="useQB.onlyUnread">
                  只看未读
                </NCheckbox>
              </NSpace>
            </NFlex>

            <NDivider style="margin: 10px 0;" />

            <NEmpty
              v-if="useQB.recieveQuestionsFiltered.length === 0"
              description="暂无收到的提问"
            />
            <div v-else>
              <!-- 顶部页码 -->
              <NPagination
                v-if="useQB.recieveQuestionsFiltered.length > ps"
                v-model:page="pn"
                v-model:page-size="ps"
                :item-count="useQB.recieveQuestionsFiltered.length"
                show-quick-jumper
                show-size-picker
                :page-sizes="[20, 50, 100]"
                style="margin-bottom: 10px;"
              />
              <!-- 问题列表 -->
              <QuestionItems :questions="pagedQuestions">
                <template #footer="{ item }">
                  <NSpace>
                    <!-- 读/未读 按钮 -->
                    <NButton
                      size="small"
                      :type="item.isReaded ? 'warning' : 'info'"
                      ghost
                      @click="useQB.read(item, !item.isReaded)"
                    >
                      {{ item.isReaded ? '设为未读' : '设为已读' }}
                    </NButton>
                    <!-- 收藏按钮 -->
                    <NButton
                      size="small"
                      @click="useQB.favorite(item, !item.isFavorite)"
                    >
                      <template #icon>
                        <NIcon
                          :component="item.isFavorite ? Heart : HeartOutline"
                          :color="item.isFavorite ? '#dd484f' : undefined"
                        />
                      </template>
                      {{ item.isFavorite ? '取消收藏' : '收藏' }}
                    </NButton>
                    <!-- 拉黑按钮 -->
                    <NButton
                      size="small"
                      type="warning"
                      ghost
                      @click="useQB.blacklist(item)"
                    >
                      拉黑提问者
                    </NButton>
                    <!-- 删除按钮 -->
                    <NPopconfirm @positive-click="useQB.DelQA(item.id)">
                      <template #trigger>
                        <NButton
                          size="small"
                          type="error"
                          ghost
                        >
                          <template #icon>
                            <NIcon :component="Delete24Filled" />
                          </template>
                          删除
                        </NButton>
                      </template>
                      确认删除这条提问？ 删除后无法恢复。
                    </NPopconfirm>
                  </NSpace>
                </template>
                <template #header-extra="{ item }">
                  <!-- 回复/查看回复 按钮 -->
                  <NButton
                    :type="item.answer ? 'primary' : 'info'"
                    :tertiary="item.isReaded"
                    :secondary="!item.isReaded && !item.answer"
                    :ghost="!!item.answer"
                    @click="onOpenModal(item)"
                  >
                    {{ item.answer ? '查看/修改回复' : '回复' }}
                  </NButton>
                </template>
              </QuestionItems>

              <!-- 底部页码 -->
              <NDivider
                v-if="useQB.recieveQuestionsFiltered.length > ps"
                style="margin: 10px 0;"
              />
              <NPagination
                v-if="useQB.recieveQuestionsFiltered.length > ps"
                v-model:page="pn"
                v-model:page-size="ps"
                :item-count="useQB.recieveQuestionsFiltered.length"
                show-quick-jumper
                show-size-picker
                :page-sizes="[20, 50, 100]"
              />
            </div>
          </NTabPane>

          <!-- 我发送的 -->
          <NTabPane
            tab="我发送的"
            name="1"
            display-directive="show:lazy"
          >
            <NEmpty
              v-if="useQB.sendQuestions.length === 0"
              description="暂无发送的提问"
            />
            <NList
              v-else
              hoverable
              clickable
              style="background-color: transparent;"
            >
              <NListItem
                v-for="item in useQB.sendQuestions"
                :key="item.id"
              >
                <NCard
                  size="small"
                  :bordered="false"
                  style="background-color: var(--n-color);"
                >
                  <!-- 发送目标和时间 -->
                  <template #header>
                    <NFlex
                      align="center"
                      justify="space-between"
                    >
                      <NSpace
                        :size="4"
                        align="center"
                      >
                        <NText>发给</NText>
                        <NButton
                          text
                          type="info"
                          @click="router.push('/user/' + item.target.id)"
                        >
                          {{ item.target.name }}
                        </NButton>
                      </NSpace>
                      <NText
                        depth="3"
                        style="font-size: small;"
                      >
                        <NTooltip placement="top-end">
                          <template #trigger>
                            <NTime
                              :time="item.sendAt"
                              :to="Date.now()"
                              type="relative"
                            />
                          </template>
                          <NTime
                            :time="item.sendAt"
                            format="yyyy-MM-dd HH:mm:ss"
                          />
                        </NTooltip>
                      </NText>
                    </NFlex>
                  </template>
                  <!-- 问题内容 -->
                  <template v-if="item.question?.image">
                    <NImage
                      :src="item.question.image"
                      width="100"
                      object-fit="cover"
                      lazy
                      style="border-radius: 4px; margin-bottom: 5px;"
                    />
                    <br>
                  </template>
                  <NText>{{ item.question?.message }}</NText>

                  <!-- 回复内容 -->
                  <template
                    v-if="item.answer"
                    #footer
                  >
                    <NDivider style="margin-top: 8px; margin-bottom: 8px;" />
                    <NCard
                      size="small"
                      :bordered="false"
                      style="background-color: var(--n-action-color);"
                    >
                      <template #header>
                        <NText depth="2">
                          对方的回复
                        </NText>
                      </template>
                      <NText>{{ item.answer.message }}</NText>
                      <template #header-extra>
                        <NText
                          depth="3"
                          style="font-size: small;"
                        >
                          <NTooltip
                            v-if="item.answer.createdAt"
                            placement="top-end"
                          >
                            <template #trigger>
                              <NTime
                                :time="item.answer.createdAt"
                                :to="Date.now()"
                                type="relative"
                              />
                            </template>
                            <NTime
                              :time="item.answer.createdAt"
                              format="yyyy-MM-dd HH:mm:ss"
                            />
                          </NTooltip>
                        </NText>
                      </template>
                    </NCard>
                  </template>
                </NCard>
              </NListItem>
            </NList>
          </NTabPane>

          <!-- 垃圾站 -->
          <NTabPane
            tab="垃圾站"
            name="2"
            display-directive="show:lazy"
          >
            <template #tab>
              <NFlex align="center">
                <NIcon :component="TrashBin" />
                垃圾站
              </NFlex>
            </template>
            <NAlert
              type="info"
              title="关于垃圾站"
              closable
              style="margin-bottom: 10px;"
            >
              这里存放的是被内容审查机制自动过滤的提问。您可以查看、删除或将其标记为正常提问。标记为正常后，提问将移至"我收到的"列表。
            </NAlert>
            <NEmpty
              v-if="useQB.trashQuestions.length === 0"
              description="暂无被过滤的提问"
            />
            <NList
              v-else
              hoverable
              style="background-color: transparent;"
            >
              <NListItem
                v-for="question in useQB.trashQuestions"
                :key="question.id"
              >
                <QuestionItem
                  :item="question"
                  is-trash
                >
                  <template #footer="{ item }">
                    <NSpace justify="end">
                      <!-- 标记为正常 -->
                      <NButton
                        size="small"
                        type="primary"
                        ghost
                        @click="() => {
                          useQB.markAsNormal(item);
                        }"
                      >
                        标记为正常
                      </NButton>
                      <!-- 拉黑 -->
                      <NButton
                        size="small"
                        type="warning"
                        ghost
                        @click="useQB.blacklist(item)"
                      >
                        拉黑提问者
                      </NButton>
                      <!-- 删除 -->
                      <NPopconfirm @positive-click="useQB.DelQA(item.id)">
                        <!-- 增加isTrash参数 -->
                        <template #trigger>
                          <NButton
                            size="small"
                            type="error"
                            ghost
                          >
                            <template #icon>
                              <NIcon :component="Delete24Filled" />
                            </template>
                            彻底删除
                          </NButton>
                        </template>
                        确认彻底删除这条提问？ 删除后无法恢复。
                      </NPopconfirm>
                    </NSpace>
                  </template>
                  <template #header-extra>
                    <!-- 此处垃圾站问题不可回复, 不显示按钮 -->
                  </template>
                </QuestionItem>
              </NListItem>
            </NList>
          </NTabPane>

          <!-- 设置 -->
          <NTabPane
            tab="设置"
            name="3"
            display-directive="show:lazy"
          >
            <NSpace vertical>
              <!-- 基础设定 -->
              <NDivider title-placement="left">
                基础设定
              </NDivider>
              <NCheckbox
                v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
                :disabled="useQB.isLoading"
                @update:checked="saveQuestionBoxSettings"
              >
                允许未注册/匿名用户进行提问
              </NCheckbox>

              <!-- 内容审查 -->
              <NDivider title-placement="left">
                内容审查等级
                <NTag
                  type="success"
                  :bordered="false"
                  size="tiny"
                  style="margin-left: 5px;"
                >
                  新
                </NTag>
              </NDivider>
              <NSlider
                v-model:value="tempSaftyLevel"
                :marks="remarkLevel"
                step="mark"
                :max="3"
                style="max-width: 90%; margin: 10px auto;"
                :format-tooltip="(v) => remarkLevelString[v]"
                :disabled="useQB.isLoading"
                @dragend="() => { if (accountInfo?.settings?.questionBox) { accountInfo.settings.questionBox.saftyLevel = tempSaftyLevel; saveQuestionBoxSettings();} }"
              />

              <!-- 标签/话题管理 -->
              <NDivider title-placement="left">
                标签/话题管理
                <NTooltip placement="right">
                  <template #trigger>
                    <NIcon
                      :component="Info24Filled"
                      style="margin-left: 5px; cursor: help; vertical-align: middle;"
                    />
                  </template>
                  用于对收到的提问进行分类，或让提问者选择相关话题。
                </NTooltip>
              </NDivider>
              <NFlex align="center">
                <NInputGroup style="max-width: 400px">
                  <NInputGroupLabel> 新标签 </NInputGroupLabel>
                  <NInput
                    v-model:value="addTagName"
                    placeholder="输入标签名称"
                    maxlength="30"
                    show-count
                    clearable
                  />
                  <NButton
                    type="primary"
                    :disabled="!addTagName.trim()"
                    @click="useQB.addTag(addTagName); addTagName = ''"
                  >
                    添加
                  </NButton>
                </NInputGroup>
              </NFlex>
              <br>
              <NEmpty
                v-if="useQB.tags.length === 0"
                description="暂无标签"
              />
              <NList
                v-else
                bordered
                hoverable
                style="max-width: 500px; background-color: var(--n-color);"
              >
                <NListItem
                  v-for="item in useQB.tags.sort((a, b) => b.createAt - a.createAt)"
                  :key="item.name"
                >
                  <NFlex
                    align="center"
                    justify="space-between"
                  >
                    <!-- 标签名和状态 -->
                    <NTag
                      :bordered="false"
                      :type="item.visiable ? 'success' : 'default'"
                      :style="!item.visiable ? { textDecoration: 'line-through', color: 'grey' } : {}"
                    >
                      {{ item.name }}
                    </NTag>
                    <!-- 操作按钮 -->
                    <NSpace>
                      <!-- 显示/隐藏 -->
                      <NTooltip placement="top">
                        <template #trigger>
                          <NPopconfirm @positive-click="useQB.updateTagVisiable(item.name, !item.visiable)">
                            <template #trigger>
                              <NButton
                                :type="item.visiable ? 'success' : 'warning'"
                                text
                                style="font-size: 18px;"
                              >
                                <template #icon>
                                  <NIcon :component="item.visiable ? Eye24Filled : EyeOff24Filled" />
                                </template>
                              </NButton>
                            </template>
                            确定要{{ item.visiable ? '隐藏' : '显示' }}这个标签吗? (隐藏后提问者无法选择)
                          </NPopconfirm>
                        </template>
                        {{ item.visiable ? '隐藏标签' : '显示标签' }}
                      </NTooltip>
                      <!-- 删除 -->
                      <NTooltip placement="top">
                        <template #trigger>
                          <NPopconfirm @positive-click="useQB.delTag(item.name)">
                            <template #trigger>
                              <NButton
                                type="error"
                                text
                                style="font-size: 18px;"
                              >
                                <template #icon>
                                  <NIcon :component="Delete24Regular" />
                                </template>
                              </NButton>
                            </template>
                            确定要删除这个标签吗? 删除后不可恢复。
                          </NPopconfirm>
                        </template>
                        删除标签
                      </NTooltip>
                    </NSpace>
                  </NFlex>
                </NListItem>
              </NList>

              <!-- 通知设置 -->
              <NDivider title-placement="left">
                通知设置
              </NDivider>
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
            </NSpace>
            <NDivider />
          </NTabPane>
        </NTabs>
      </NSpin>

      <!-- 全局加载遮罩 (如果需要覆盖整个页面) -->
      <!-- <NSpin :show="useQB.isLoading" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.5); z-index: 9999;"></NSpin> -->
    </template>
    <template #description>
      正在加载账户信息...
    </template>
  </NSpin>

  <!-- 回复模态框 -->
  <NModal
    v-model:show="replyModalVisiable"
    preset="card"
    style="max-width: 90vw; width: 500px"
    title="回复提问"
    :mask-closable="false"
  >
    <template v-if="useQB.currentQuestion">
      <NText>正在回复给: {{ useQB.currentQuestion.sender?.name || '匿名用户' }}</NText>
      <NCard
        size="small"
        :bordered="false"
        style="margin-top: 5px; background-color: var(--n-action-color);"
      >
        {{ useQB.currentQuestion.question?.message }}
      </NCard>
      <NDivider style="margin: 15px 0;" />
      <NSpace vertical>
        <NInput
          v-model:value="replyMessage"
          placeholder="请输入回复内容..."
          type="textarea"
          maxlength="1000"
          show-count
          clearable
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
        <NSpin :show="useQB.isChangingPublic">
          <NCheckbox
            :checked="useQB.currentQuestion?.isPublic"
            @update:checked="(v) => useQB.setPublic(v)"
          >
            公开这条提问和我的回复 (其他人可在你的提问页看到)
          </NCheckbox>
        </NSpin>
      </NSpace>
      <NDivider style="margin: 15px 0;" />
      <NFlex justify="end">
        <NButton @click="replyModalVisiable = false">
          取消
        </NButton>
        <NButton
          :loading="useQB.isRepling"
          type="primary"
          @click="async () => { await useQB.reply(useQB.currentQuestion?.id ?? -1, replyMessage); replyModalVisiable = false; }"
        >
          {{ useQB.currentQuestion?.answer ? '修改回复' : '发送回复' }}
        </NButton>
      </NFlex>
    </template>
  </NModal>

  <!-- 分享模态框 -->
  <NModal
    v-model:show="shareModalVisiable"
    preset="card"
    title="分享我的提问箱"
    style="max-width: 95vw; width: 600px;"
  >
    <!-- 分享卡片预览 -->
    <div
      ref="shareCardRef"
      class="share-card-container"
    >
      <!-- 背景 -->
      <div class="share-card-background" />
      <!-- 内容 -->
      <div class="share-card-content">
        <div class="share-card-main">
          <div class="share-card-text">
            <div class="share-card-title">
              向我提问
            </div>
            <div class="share-card-name">
              {{ accountInfo?.name }}
            </div>
          </div>
          <div class="share-card-divider" />
          <div class="share-card-meta">
            <div class="share-card-type">
              提问箱
            </div>
            <div class="share-card-site">
              VTSURU.LIVE
            </div>
          </div>
        </div>
        <div class="share-card-qr">
          <QrcodeVue
            :value="modalShareUrl"
            level="Q"
            :size="90"
            background="#FFFFFF"
            foreground="#000000"
            :margin="1"
            render-as="svg"
          />
        </div>
      </div>
    </div>

    <NDivider style="margin-top: 20px; margin-bottom: 10px;">
      分享链接设置
    </NDivider>
    <NSpace vertical>
      <NSelect
        v-model:value="selectedShareTag"
        placeholder="选择要附加到链接的话题 (可选)"
        filterable
        clearable
        :options="useQB.tags.filter(t => t.visiable).map((s) => ({ label: s.name, value: s.name }))"
        style="width: 100%;"
      />
    </NSpace>

    <NDivider style="margin-top: 20px; margin-bottom: 10px;">
      分享链接
    </NDivider>
    <NInputGroup>
      <NInputGroupLabel> 链接 </NInputGroupLabel>
      <NInput
        :value="modalShareUrl"
        readonly
      />
      <NButton
        secondary
        @click="copyToClipboard(modalShareUrl)"
      >
        复制
      </NButton>
    </NInputGroup>

    <NDivider style="margin-top: 20px; margin-bottom: 15px;" />
    <NSpace justify="center">
      <NButton
        type="primary"
        @click="saveShareImage"
      >
        保存分享图
      </NButton>
      <NButton
        type="primary"
        secondary
        @click="saveQRCode"
      >
        保存二维码
      </NButton>
    </NSpace>
  </NModal>

  <!-- OBS预览模态框 -->
  <NModal
    v-model:show="showOBSModal"
    preset="card"
    closable
    style="max-width: 90vw; width: auto;"
    title="OBS 组件预览与链接"
    content-style="display: flex; align-items: center; justify-content: center; flex-direction: column;"
  >
    <NAlert
      type="info"
      :show-icon="false"
      style="margin-bottom: 15px;"
    >
      👇下方是实时预览效果。管理展示内容请前往
      <NButton
        text
        type="primary"
        @click="showOBSModal = false; $router.push({ name: 'question-display' })"
      >
        展示管理页
      </NButton>
    </NAlert>

    <!-- OBS组件预览区域 -->
    <div
      :style="{
        width: savedCardSize.width + 'px',
        height: savedCardSize.height + 'px',
        border: '1px dashed #ccc',
        overflow: 'hidden', // 确保内容不溢出预览框
        position: 'relative' // 用于定位内部组件
      }"
    >
      <QuestionDisplayCard
        :question="useQB.displayQuestion"
        :setting="setting"
      />
    </div>

    <NDivider
      title-placement="left"
      style="margin-top: 20px; margin-bottom: 10px;"
    >
      OBS 浏览器源链接
    </NDivider>
    <NInputGroup>
      <NInput
        readonly
        :value="`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`"
      />
      <NButton
        secondary
        @click="copyToClipboard(`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`)"
      >
        复制
      </NButton>
    </NInputGroup>

    <NDivider style="margin-top: 20px; margin-bottom: 15px;" />
    <NButton
      type="primary"
      @click="showOBSModal = false; $router.push({ name: 'question-display' })"
    >
      前往展示管理页
    </NButton>
  </NModal>
</template>

<style>
/* 全局列表背景透明 (如果需要主题背景色) */
.n-list {
  background-color: transparent;
}

/* --- 新版分享卡片样式 --- */
.share-card-container {
    position: relative;
    height: 200px; /* 固定高度 */
    width: 100%;   /* 宽度自适应父容器 */
    border-radius: 12px; /* 更圆润的边角 */
    overflow: hidden; /* 隐藏溢出内容 */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); /* 添加阴影 */
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; /* 使用更现代的字体 */
}

/* 背景渐变层 */
.share-card-background {
    position: absolute;
    inset: 0; /* 覆盖整个容器 */
    background: linear-gradient(135deg, #66bea3 0%, #9179be 100%); /* 平滑渐变 */
    z-index: 1;
}

/* 内容层 */
.share-card-content {
    position: relative; /* 使z-index生效 */
    z-index: 2;
    display: flex;
    justify-content: space-between; /* 主内容和二维码分开 */
    align-items: stretch; /* 让子项高度一致 */
    height: 100%;
    padding: 20px;
    color: #ffffff; /* 默认文字颜色 */
}

/* 主要内容区域 (左侧) */
.share-card-main {
    display: flex;
    flex-direction: column; /* 垂直排列 */
    justify-content: space-between; /* 上下分布 */
    flex-grow: 1; /* 占据剩余空间 */
    padding-right: 20px; /* 与二维码的间距 */
}

.share-card-text {
    /* 包含标题和名字 */
}

.share-card-title {
    font-size: 28px; /* 调整大小 */
    font-weight: bold; /* 加粗 */
    line-height: 1.2;
    margin-bottom: 8px;
    opacity: 0.9; /* 轻微透明 */
}

.share-card-name {
    font-size: 42px; /* 增大名字 */
    font-weight: 500; /* 中等粗细 */
    line-height: 1.1;
    max-width: 350px; /* 限制最大宽度 */
    word-wrap: break-word; /* 自动换行 */
    overflow: hidden; /* 隐藏溢出 */
    text-overflow: ellipsis; /* 显示省略号 */
    max-height: 90px; /* 限制最大高度，约两行 */
}

.share-card-divider {
    height: 1px;
    background-color: rgba(255, 255, 255, 0.3); /* 半透明分割线 */
    margin: 10px 0;
    width: 80%; /* 分割线宽度 */
}

.share-card-meta {
    display: flex;
    justify-content: space-between; /* 类型和站点分开 */
    align-items: center;
}

.share-card-type {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.8;
}

.share-card-site {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.7;
}

/* 二维码区域 (右侧) */
.share-card-qr {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0; /* 防止二维码被压缩 */
    background-color: rgba(255, 255, 255, 0.9); /* 二维码背景色，轻微透明 */
    padding: 8px; /* 内边距 */
    border-radius: 8px; /* 圆角 */
    height: 108px; /* 容器高度 */
    width: 108px; /* 容器宽度 */
    align-self: center; /* 垂直居中 */
}

/* 二维码SVG样式 */
.share-card-qr svg {
    display: block; /* 移除底部空白 */
    width: 100%;
    height: 100%;
}

/* 响应式调整 (可选) */
@media (max-width: 500px) {
    .share-card-content {
        flex-direction: column; /* 小屏幕时垂直排列 */
        align-items: center;
        text-align: center;
        padding: 15px;
    }
    .share-card-main {
        padding-right: 0;
        margin-bottom: 15px;
        align-items: center; /* 内部元素居中 */
    }
    .share-card-qr {
        align-self: center; /* 确保二维码居中 */
        width: 100px; /* 略微减小二维码尺寸 */
        height: 100px;
    }
     .share-card-name {
         font-size: 36px;
     }
     .share-card-divider {
        width: 100%; /* 分割线占满 */
     }
     .share-card-meta {
        width: 100%; /* 占满宽度方便对齐 */
     }
}

/* --- 其他样式微调 --- */
.n-list-item {
    margin-bottom: 10px; /* 列表项间距 */
}
.n-card {
    border-radius: 6px; /* 统一卡片圆角 */
}
</style>