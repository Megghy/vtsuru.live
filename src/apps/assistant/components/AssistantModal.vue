<script setup lang="ts">
import { LineHorizontal320Regular, Add20Regular, QuestionCircle20Regular } from '@vicons/fluent'
import { NButton, NDrawer, NDrawerContent, NFlex, NIcon, NModal, NPopover, NTag, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantChatWindow from './AssistantChatWindow.vue'
import AssistantConversationList from './AssistantConversationList.vue'

const store = useAssistantStore()
const route = useRoute()

const ctx = computed(() => store.context)

/** 窄屏下用抽屉展示会话列表 */
const drawerVisible = ref(false)

/** 当前支持的功能, 在帮助气泡中展示 */
const features = [
  { title: '日程管理', desc: '用自然语言增加 / 修改 / 删除直播日程, 生成方案卡片待你确认' },
  { title: '数据查询', desc: '随时问主播信息、积分商城、舰长情况、近期直播数据与粉丝趋势' },
  { title: '提问箱回复', desc: '帮你起草棉花糖提问的回复, 确认后发布' },
  { title: '视频征集 / 积分商品', desc: '发起视频征集表、上架积分商城商品, 生成方案待你确认' },
  { title: '图片识别', desc: '上传或粘贴日程截图, 自动识别其中的日期、时间与标题' },
  { title: '上下文感知', desc: '结合当前页面与时间自动换算"下周三""这周末"等相对日期' },
  { title: '安全确认', desc: '所有变更都需你点击确认后才会执行, 不会直接改动数据' },
]

function onClose() {
  store.close()
}
</script>

<template>
  <NModal
    v-model:show="store.visible"
    preset="card"
    class="assistant-modal"
    :title="undefined"
    :bordered="false"
    :mask-closable="false"
    @after-leave="onClose"
  >
    <template #header>
      <NFlex align="center" :size="8" :wrap="false" class="assistant-modal__header">
        <NButton class="assistant-modal__menu-btn" size="tiny" quaternary circle @click="drawerVisible = true">
          <template #icon>
            <NIcon :component="LineHorizontal320Regular" />
          </template>
        </NButton>
        <NText class="assistant-modal__brand">
          AI 助手
        </NText>
        <NPopover trigger="hover" placement="bottom-start" style="max-width: 280px">
          <template #trigger>
            <NButton size="tiny" quaternary circle class="assistant-modal__help">
              <template #icon>
                <NIcon :component="QuestionCircle20Regular" />
              </template>
            </NButton>
          </template>
          <div class="assistant-features">
            <div class="assistant-features__title">
              我能帮你做这些
            </div>
            <div v-for="f in features" :key="f.title" class="assistant-features__item">
              <NText strong>
                {{ f.title }}
              </NText>
              <NText depth="3" class="assistant-features__desc">
                {{ f.desc }}
              </NText>
            </div>
          </div>
        </NPopover>
        <NTag size="small" :bordered="false" type="info">
          {{ ctx.title || '管理后台' }}
        </NTag>
      </NFlex>
    </template>
    <template #header-extra>
      <NButton size="tiny" quaternary @click="store.reset">
        <template #icon>
          <NIcon :component="Add20Regular" />
        </template>
        新对话
      </NButton>
    </template>

    <div class="assistant-modal__layout">
      <aside class="assistant-modal__sidebar">
        <AssistantConversationList />
      </aside>

      <div class="assistant-modal__main">
        <div class="assistant-modal__ctx">
          <NText depth="3" class="assistant-modal__ctx-line">
            route: {{ ctx.routeName || route.name?.toString() || '-' }} · path: {{ ctx.path || route.path }}
          </NText>
        </div>
        <div class="assistant-modal__body">
          <AssistantChatWindow />
        </div>
      </div>
    </div>

    <!-- 窄屏: 会话列表抽屉 -->
    <NDrawer v-model:show="drawerVisible" :width="260" placement="left">
      <NDrawerContent title="历史会话" closable>
        <AssistantConversationList @click="drawerVisible = false" />
      </NDrawerContent>
    </NDrawer>
  </NModal>
</template>

<style scoped>
.assistant-modal__header { min-width: 0; }
.assistant-modal__brand { font-size: 15px; font-weight: 600; }
.assistant-modal__menu-btn { display: none; }

.assistant-features { display: flex; flex-direction: column; gap: 8px; }
.assistant-features__title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
.assistant-features__item { display: flex; flex-direction: column; gap: 1px; }
.assistant-features__desc { font-size: 12px; line-height: 1.4; }

.assistant-modal__layout { display: flex; gap: 12px; height: 100%; min-height: 0; }
.assistant-modal__sidebar {
  flex: 0 0 200px; min-width: 0;
  border-right: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
  padding-right: 12px;
}
.assistant-modal__main { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; min-height: 0; }

.assistant-modal__ctx {
  flex: 0 0 auto;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
  margin-bottom: 8px;
}
.assistant-modal__ctx-line { font-size: 12px; word-break: break-all; }
.assistant-modal__body { flex: 1 1 0; min-height: 0; }

:deep(.n-card__content) { display: flex; flex-direction: column; }

@media (max-width: 720px) {
  .assistant-modal__menu-btn { display: inline-flex; }
  .assistant-modal__sidebar { display: none; }
}
</style>

<!-- 非 scoped：class 透传到 NModal 内部 card 元素上，scoped 属性无法命中 -->
<style>
.assistant-modal {
  width: 840px;
  max-width: calc(100vw - 32px);
}
.assistant-modal .assistant-modal__layout { height: min(64vh, 560px); }
@media (max-width: 720px) {
  .assistant-modal {
    width: calc(100vw - 24px);
  }
  .assistant-modal .assistant-modal__layout { height: 70vh; }
}
</style>
