<script setup lang="ts">
import { CodeOutline, HeartOutline, LogoGithub, ServerOutline } from '@vicons/ionicons5'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import UpdateNoteContainer from '@/apps/web/components/UpdateNoteContainer.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'

// 获取编译时间
const buildTime = computed(() => {
  try {
    const buildDate = new Date(__BUILD_TIME__)
    return {
      date: buildDate.toLocaleString('zh-CN'),
      relative: formatDistanceToNow(buildDate, { addSuffix: true, locale: zhCN }),
    }
  } catch {
    return {
      date: '未知',
      relative: '未知',
    }
  }
})

interface TimelineRecord {
  type: 'info' | 'success' | 'warning'
  title: string
  content: string
  time: string
  dashed?: boolean
}

const timelineData: TimelineRecord[] = [
  { type: 'info', title: '功能更新', content: '新增歌单样式: 列表', time: '2025-3-31' },
  { type: 'success', title: '功能添加', content: '上线直播数据分析', time: '2025-3-18' },
  { type: 'info', title: '功能添加', content: '点歌允许从网页匿名点歌', time: '2025-3-18' },
  { type: 'success', title: '功能添加', content: '棉花糖添加内容审查功能', time: '2025-3-2' },
  { type: 'info', title: '功能更新', content: '允许棉花糖设置页滚动条进度同步到obs组件', time: '2024-11-23' },
  { type: 'info', title: '功能更新', content: '礼物兑换允许上舰用户免费兑换, 以及仅允许上舰用户兑换', time: '2024-4-23' },
  { type: 'info', title: '功能更新', content: '积分订单添加导出功能, 允许删除积分用户', time: '2024-3-22' },
  { type: 'info', title: '功能更新', content: '1. 点歌(歌势) 修改为点播 2. 棉花糖支持创建话题(标签) 3. 一些bug修复', time: '2024-3-12' },
  { type: 'info', title: '功能更新', content: '棉花糖添加展示页面', time: '2024-2-20' },
  { type: 'info', title: '功能更新', content: '歌单新增从文件导入', time: '2024-2-10' },
  { type: 'info', title: '功能更新', content: '排队的OBS组件添加设置项', time: '2024-1-27' },
  { type: 'warning', title: 'Bug修复', content: '修复点歌会直接跳到下一首的问题 (怎么没人跟我说', time: '2024-1-22' },
  { type: 'info', title: '功能更新', content: '读弹幕支持自定义API', time: '2023-12-25' },
  { type: 'success', title: '功能添加', content: '弹幕点歌 (点播)', time: '2023-12-24' },
  { type: 'success', title: '功能添加', content: '读弹幕', time: '2023-12-17' },
  { type: 'success', title: '功能添加', content: '直播记录', time: '2023-12-3' },
  { type: 'info', title: '功能更新', content: '歌单添加 \'简单\' 模板', time: '2023-11-30' },
  { type: 'success', title: '功能添加', content: '排队', time: '2023-11-25' },
  { type: 'success', title: '功能添加', content: '点歌', time: '2023-11-20' },
  { type: 'success', title: '上架幻星平台', content: '如题', time: '2023-11-4' },
  { type: 'success', title: '功能添加', content: '视频征集', time: '2023-10-30' },
  { type: 'info', title: '功能更新', content: '日程表添加 \'粉粉\' 模板', time: '2023-10-27' },
  { type: 'info', title: '功能更新', content: '提问箱新增公开选项', time: '2023-10-26' },
  { type: 'success', title: '功能添加', content: '提问箱分享卡片', time: '2023-10-25' },
  { type: 'success', title: '功能添加', content: '舰长及SC记录', time: '2023-10-24', dashed: true },
  { type: 'info', title: '开始运行', content: '开始运行', time: '2023-10-23' },
]
</script>

<template>
  <main class="min-h-screen py-10 px-4 flex flex-col items-center bg-muted/30">
    <div class="w-full max-w-2xl flex flex-col items-center gap-6">
      <Card class="w-full shadow-sm">
        <CardHeader class="pb-3 border-b border-border/50">
          <CardTitle class="text-xl font-bold">关于</CardTitle>
          <p class="text-xs text-muted-foreground mt-1">
            构建时间: {{ buildTime.date }} ({{ buildTime.relative }})
          </p>
        </CardHeader>
        <CardContent class="pt-5 space-y-6 text-sm text-foreground">
          <div>
            <p class="leading-relaxed">一个兴趣使然的网站</p>
            <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span>反馈 | 建议 | 需求 | 闲聊: 🐧</span>
              <a
                href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=uJNTU6LQ7xANoxP1IyZxS1xYkOKVOF7G&authKey=nl3Bv4UascE4tJ98UDTihEZSvivzuaQGfMViy1BqUe5lYgrz6hi0huK6dyAYq1hi&noverify=0&group_code=873260337"
                target="_blank"
                rel="noreferrer"
                class="text-primary hover:underline font-mono"
              >
                873260337
              </a>
              <span>或者</span>
              <button
                type="button"
                class="text-primary hover:underline cursor-pointer"
                @click="$router.push({ name: 'manage-feedback' })"
              >
                反馈页面
              </button>
              <Separator orientation="vertical" class="h-3" />
              <a
                href="mailto:admin@vtsuru.live"
                class="text-primary hover:underline font-mono"
              >
                admin@vtsuru.live
              </a>
            </div>
          </div>

          <Separator />

          <!-- 作者与项目状态 -->
          <div class="flex flex-col items-center gap-2 py-2">
            <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>MADE WITH</span>
              <component :is="HeartOutline" class="size-4 text-destructive inline" />
              <span>BY</span>
              <a
                href="https://space.bilibili.com/10021741"
                target="_blank"
                rel="noreferrer"
                class="font-bold text-foreground hover:text-primary transition"
              >
                Megghy
              </a>
            </div>
            <div class="flex items-center gap-4 text-xs mt-1">
              <a
                href="https://github.com/Megghy/vtsuru.live"
                target="_blank"
                rel="noreferrer"
                class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
              >
                <component :is="LogoGithub" class="size-3.5" />
                <span>源代码仓库</span>
              </a>
              <a
                href="https://stats.uptimerobot.com/vGKZv8uhVC"
                target="_blank"
                rel="noreferrer"
                class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
              >
                <component :is="ServerOutline" class="size-3.5" />
                <span>服务状态</span>
              </a>
            </div>
          </div>

          <!-- 技术栈 -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">技术栈</span>
              <Separator class="flex-1" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                <component :is="CodeOutline" class="size-4 text-emerald-500" />
                <span class="font-medium">前端:</span>
                <div class="flex gap-1.5 flex-wrap">
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">Vue 3</Badge>
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">TypeScript</Badge>
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">shadcn + UnoCSS</Badge>
                </div>
              </div>
              <div class="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                <component :is="ServerOutline" class="size-4 text-blue-500" />
                <span class="font-medium">后端:</span>
                <div class="flex gap-1.5 flex-wrap">
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">C# .NET 10</Badge>
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">PostgreSQL</Badge>
                  <Badge variant="secondary" class="font-normal text-[11px] h-5">Garnet</Badge>
                </div>
              </div>
            </div>
          </div>

          <!-- 赞助 -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">赞助我</span>
              <Separator class="flex-1" />
            </div>
            <iframe
              id="afdian_leaflet_vtsuru"
              src="https://afdian.com/leaflet?slug=vtsuru"
              width="100%"
              scrolling="no"
              height="200"
              frameborder="0"
              class="rounded-lg border border-border"
            />
          </div>

          <!-- 更新日志 -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">更新日志</span>
              <Separator class="flex-1" />
            </div>
            <UpdateNoteContainer />
          </div>

          <!-- 历程时间线 -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">项目历程</span>
              <Separator class="flex-1" />
            </div>
            <div class="relative pl-5 border-l border-border/80 space-y-4 py-2">
              <div
                v-for="(item, idx) in timelineData"
                :key="idx"
                class="relative text-xs group"
              >
                <!-- 点 -->
                <span
                  class="absolute -left-[25px] top-1 size-2 rounded-full border-2 border-background ring-1"
                  :class="[
                    item.type === 'success' ? 'bg-emerald-500 ring-emerald-500/30' : '',
                    item.type === 'warning' ? 'bg-amber-500 ring-amber-500/30' : '',
                    item.type === 'info' ? 'bg-blue-500 ring-blue-500/30' : '',
                  ]"
                />
                <div class="flex items-baseline justify-between gap-2">
                  <div class="font-medium text-foreground flex items-center gap-1.5">
                    <span>{{ item.title }}</span>
                  </div>
                  <span class="text-[11px] font-mono text-muted-foreground">{{ item.time }}</span>
                </div>
                <p class="text-muted-foreground mt-0.5 leading-relaxed">{{ item.content }}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter class="pt-4 border-t border-border/50 flex justify-center">
          <Button
            size="lg"
            class="px-8"
            @click="$router.push({ name: 'manage-index' })"
          >
            回到控制台
          </Button>
        </CardFooter>
      </Card>
    </div>
  </main>
</template>
