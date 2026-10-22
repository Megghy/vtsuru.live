<script setup lang="ts">
import { Add20Regular, LineHorizontal320Regular, QuestionCircle20Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

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
  { title: '数据查询', desc: '随时问主播信息、积分商城、舰长情况、点歌队列、近期直播数据与粉丝趋势' },
  { title: '提问箱回复', desc: '帮你起草棉花糖提问的回复, 确认后发布' },
  { title: '上舰记录', desc: '查看最近的上舰记录, 采集漏报时帮你补录, 误录可删除' },
  { title: '视频征集 / 积分商品', desc: '发起视频征集表、上架积分商城商品, 生成方案待你确认' },
  { title: '展示页概览', desc: '读取你已发布的展示页布局, 给出调整建议' },
  { title: '图片识别', desc: '上传或粘贴日程截图, 自动识别其中的日期、时间与标题' },
  { title: '上下文感知', desc: '结合当前页面与时间自动换算"下周三""这周末"等相对日期' },
  { title: '安全确认', desc: '所有变更都需你点击确认后才会执行, 不会直接改动数据' },
]

function onClose() {
  store.close()
}
</script>

<template>
  <Dialog
    :open="store.visible"
    @update:open="!$event && onClose()"
  >
    <DialogContent class="sm:max-w-4xl h-[85vh] max-h-[850px] p-0 flex flex-col overflow-hidden gap-0">
      <DialogHeader
        class="px-4 py-3 border-b border-border/80 flex flex-row items-center justify-between space-y-0 shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            class="assistant-modal__menu-btn size-7 -ml-1 text-muted-foreground"
            @click="drawerVisible = true"
          >
            <component
              :is="LineHorizontal320Regular"
              class="size-4"
            />
          </Button>

          <DialogTitle class="text-sm font-semibold text-foreground">VTsuru 助手</DialogTitle>

          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-6 text-muted-foreground hover:text-foreground"
              >
                <component
                  :is="QuestionCircle20Regular"
                  class="size-3.5"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-72 p-3 text-xs space-y-2">
              <strong class="text-xs font-semibold block text-foreground">我能帮你做这些</strong>
              <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div
                  v-for="f in features"
                  :key="f.title"
                  class="space-y-0.5"
                >
                  <strong class="text-foreground block text-[11px]">{{ f.title }}</strong>
                  <p class="text-muted-foreground text-[11px] leading-relaxed">{{ f.desc }}</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Badge
            variant="secondary"
            class="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-muted"
          >
            {{ ctx.title || '管理后台' }}
          </Badge>
        </div>

        <div class="flex items-center gap-1 mr-6">
          <Button
            variant="ghost"
            class="flex items-center gap-1"
            @click="store.reset"
          >
            <component
              :is="Add20Regular"
              class="size-3.5"
            />
            新对话
          </Button>
        </div>
      </DialogHeader>

      <div class="assistant-modal__layout flex flex-1 min-h-0 overflow-hidden p-4 gap-3">
        <aside
          class="assistant-modal__sidebar w-52 shrink-0 border-r border-border/60 pr-3 overflow-hidden flex flex-col"
        >
          <AssistantConversationList />
        </aside>

        <div class="assistant-modal__main flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          <AssistantChatWindow />
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- 窄屏: 会话列表抽屉 -->
  <Sheet
    :open="drawerVisible"
    @update:open="drawerVisible = $event"
  >
    <SheetContent
      side="left"
      class="w-64 p-4 flex flex-col"
    >
      <SheetHeader class="pb-3 border-b border-border/60">
        <SheetTitle class="text-sm font-semibold">历史会话</SheetTitle>
      </SheetHeader>
      <div class="flex-1 min-h-0 pt-3">
        <AssistantConversationList @click="drawerVisible = false" />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.assistant-modal__menu-btn {
  display: none;
}

@media (max-width: 720px) {
  .assistant-modal__menu-btn {
    display: inline-flex;
  }
  .assistant-modal__sidebar {
    display: none;
  }
}
</style>
