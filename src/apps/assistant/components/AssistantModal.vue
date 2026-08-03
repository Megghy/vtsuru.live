<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAssistantStore } from '../store/useAssistantStore'
import AssistantChatWindow from './AssistantChatWindow.vue'
import AssistantConversationList from './AssistantConversationList.vue'

const store = useAssistantStore()

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
  <UModal
    v-model:open="store.visible"
    :ui="{ content: 'sm:max-w-[840px]' }"
    @update:open="(open) => !open && onClose()"
  >
    <template #header>
      <div class="assistant-modal__header">
        <UButton
          class="assistant-modal__menu-btn"
          size="xs"
          variant="ghost"
          square
          icon="i-lucide-menu"
          title="历史会话"
          @click="drawerVisible = true"
        />
        <span class="assistant-modal__brand">VTsuru 助手</span>
        <UPopover
          mode="hover"
          :content="{ align: 'start', side: 'bottom' }"
        >
          <UButton
            size="xs"
            variant="ghost"
            square
            icon="i-lucide-circle-help"
            class="assistant-modal__help"
            title="助手能力"
          />
          <template #content>
            <div class="assistant-features">
              <div class="assistant-features__title">我能帮你做这些</div>
              <div
                v-for="f in features"
                :key="f.title"
                class="assistant-features__item"
              >
                <strong>{{ f.title }}</strong>
                <span class="assistant-features__desc">
                  {{ f.desc }}
                </span>
              </div>
            </div>
          </template>
        </UPopover>
        <UBadge
          size="sm"
          color="info"
          variant="subtle"
        >
          {{ ctx.title || '管理后台' }}
        </UBadge>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-plus"
          class="assistant-modal__new"
          @click="store.reset"
        >
          新对话
        </UButton>
      </div>
    </template>

    <template #body>
      <div class="assistant-modal__layout">
        <aside class="assistant-modal__sidebar">
          <AssistantConversationList />
        </aside>

        <div class="assistant-modal__main">
          <div class="assistant-modal__body">
            <AssistantChatWindow />
          </div>
        </div>
      </div>
    </template>

    <USlideover
      v-model:open="drawerVisible"
      title="历史会话"
      side="left"
      :ui="{ content: 'max-w-[260px]' }"
    >
      <template #body>
        <AssistantConversationList @click="drawerVisible = false" />
      </template>
    </USlideover>
  </UModal>
</template>

<style scoped>
.assistant-modal__header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.assistant-modal__brand {
  font-size: 15px;
  font-weight: 600;
}
.assistant-modal__menu-btn {
  display: none;
}

.assistant-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(280px, calc(100vw - 48px));
  padding: 10px;
}
.assistant-features__title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}
.assistant-features__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.assistant-features__desc {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.4;
}

.assistant-modal__layout {
  display: flex;
  gap: 12px;
  height: min(64vh, 560px);
  min-height: 0;
}
.assistant-modal__sidebar {
  flex: 0 0 200px;
  min-width: 0;
  border-right: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  padding-right: 12px;
}
.assistant-modal__main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.assistant-modal__body {
  flex: 1 1 0;
  min-height: 0;
}

.assistant-modal__new {
  margin-left: auto;
}

@media (max-width: 720px) {
  .assistant-modal__menu-btn {
    display: inline-flex;
  }
  .assistant-modal__sidebar {
    display: none;
  }
  .assistant-modal__layout {
    height: 70vh;
  }
}
</style>
