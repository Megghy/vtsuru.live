<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import UpdateNoteContainer from '@/apps/web/components/UpdateNoteContainer.vue'

const buildTime = computed(() => {
  const buildDate = new Date(__BUILD_TIME__)
  return {
    date: buildDate.toLocaleString('zh-CN'),
    relative: formatDistanceToNow(buildDate, { addSuffix: true, locale: zhCN }),
  }
})

const frontend = [
  { label: 'Vue.js', href: 'https://vuejs.org/', color: 'success' as const },
  { label: 'TypeScript', href: 'https://www.typescriptlang.org/', color: 'info' as const },
  { label: 'Nuxt UI', href: 'https://ui.nuxt.com/', color: 'warning' as const },
]

const backend = [
  { label: 'C# .NET 10', href: 'https://dotnet.microsoft.com/', color: 'primary' as const },
  { label: 'PostgreSQL', href: 'https://www.postgresql.org/', color: 'error' as const },
  { label: 'Garnet', href: 'https://microsoft.github.io/garnet/', color: 'neutral' as const },
]

const history = [
  ['2025-3-31', '功能更新', '新增歌单样式: 列表', 'info'],
  ['2025-3-18', '功能添加', '上线直播数据分析', 'success'],
  ['2025-3-18', '功能添加', '点歌允许从网页匿名点歌', 'info'],
  ['2025-3-2', '功能添加', '棉花糖添加内容审查功能', 'success'],
  ['2024-11-23', '功能更新', '允许棉花糖设置页滚动条进度同步到obs组件', 'info'],
  ['2024-4-23', '功能更新', '礼物兑换允许上舰用户免费兑换, 以及仅允许上舰用户兑换', 'info'],
  ['2024-3-22', '功能更新', '积分订单添加导出功能, 允许删除积分用户', 'info'],
  ['2024-3-12', '功能更新', '1. 点歌(歌势) 修改为点播 2. 棉花糖支持创建话题(标签) 3. 一些bug修复', 'info'],
  ['2024-2-20', '功能更新', '棉花糖添加展示页面', 'info'],
  ['2024-2-10', '功能更新', '歌单新增从文件导入', 'info'],
  ['2024-1-27', '功能更新', '排队的OBS组件添加设置项', 'info'],
  ['2024-1-22', 'Bug修复', '修复点歌会直接跳到下一首的问题 (怎么没人跟我说', 'warning'],
  ['2023-12-25', '功能更新', '读弹幕支持自定义API', 'info'],
  ['2023-12-24', '功能添加', '弹幕点歌 (点播)', 'success'],
  ['2023-12-17', '功能添加', '读弹幕', 'success'],
  ['2023-12-3', '功能添加', '直播记录', 'success'],
  ['2023-11-30', '功能更新', "歌单添加 '简单' 模板", 'info'],
  ['2023-11-25', '功能添加', '排队', 'success'],
  ['2023-11-20', '功能添加', '点歌', 'success'],
  ['2023-11-4', '上架幻星平台', '如题', 'success'],
  ['2023-10-30', '功能添加', '视频征集', 'success'],
  ['2023-10-27', '功能更新', "日程表添加 '粉粉' 模板", 'info'],
  ['2023-10-26', '功能更新', '提问箱新增公开选项', 'info'],
  ['2023-10-25', '功能添加', '提问箱分享卡片', 'success'],
  ['2023-10-24', '功能添加', '舰长及SC记录', 'success'],
  ['2023-10-23', '', '开始运行', 'info'],
] as const
</script>

<template>
  <main class="about-page">
    <div class="about-page__content">
      <header class="about-page__header">
        <div>
          <h1>关于</h1>
          <p>构建时间: {{ buildTime.date }} ({{ buildTime.relative }})</p>
        </div>
        <UButton
          icon="i-lucide-layout-dashboard"
          @click="$router.push({ name: 'manage-index' })"
        >
          回到控制台
        </UButton>
      </header>

      <section class="about-page__intro">
        <p>一个兴趣使然的网站</p>
        <div class="about-page__links">
          <UButton
            variant="link"
            tag="a"
            target="_blank"
            href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=uJNTU6LQ7xANoxP1IyZxS1xYkOKVOF7G&authKey=nl3Bv4UascE4tJ98UDTihEZSvivzuaQGfMViy1BqUe5lYgrz6hi0huK6dyAYq1hi&noverify=0&group_code=873260337"
          >
            QQ 群 873260337
          </UButton>
          <UButton
            variant="link"
            @click="$router.push({ name: 'manage-feedback' })"
          >
            反馈页面
          </UButton>
          <UButton
            variant="link"
            tag="a"
            href="mailto:admin@vtsuru.live"
          >
            admin@vtsuru.live
          </UButton>
        </div>
      </section>

      <USeparator label="技术栈" />
      <section class="about-page__stack">
        <div class="about-page__stack-row">
          <UIcon name="i-lucide-code-2" />
          <strong>前端</strong>
          <UBadge
            v-for="item in frontend"
            :key="item.label"
            :color="item.color"
            variant="subtle"
          >
            <a
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              >{{ item.label }}</a
            >
          </UBadge>
        </div>
        <div class="about-page__stack-row">
          <UIcon name="i-lucide-server" />
          <strong>后端</strong>
          <UBadge
            v-for="item in backend"
            :key="item.label"
            :color="item.color"
            variant="subtle"
          >
            <a
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              >{{ item.label }}</a
            >
          </UBadge>
        </div>
      </section>

      <USeparator label="赞助" />
      <iframe
        id="afdian_leaflet_vtsuru"
        src="https://afdian.com/leaflet?slug=vtsuru"
        width="100%"
        scrolling="no"
        height="200"
        frameborder="0"
        class="about-page__sponsor"
      />

      <USeparator label="更新日志" />
      <UpdateNoteContainer />

      <USeparator label="历史节点" />
      <ol class="about-timeline">
        <li
          v-for="item in history"
          :key="`${item[0]}-${item[2]}`"
          class="about-timeline__item"
          :data-tone="item[3]"
        >
          <time>{{ item[0] }}</time>
          <div>
            <strong v-if="item[1]">{{ item[1] }}</strong>
            <p>{{ item[2] }}</p>
          </div>
        </li>
      </ol>

      <footer class="about-page__footer">
        <span>MADE WITH</span>
        <UIcon
          name="i-lucide-heart"
          class="about-page__heart"
        />
        <span>BY</span>
        <a
          href="https://space.bilibili.com/10021741"
          target="_blank"
          rel="noopener noreferrer"
          >Megghy</a
        >
        <a
          href="https://github.com/Megghy/vtsuru.live"
          target="_blank"
          rel="noopener noreferrer"
          >源代码</a
        >
        <a
          href="https://stats.uptimerobot.com/vGKZv8uhVC"
          target="_blank"
          rel="noopener noreferrer"
          >服务状态</a
        >
      </footer>
    </div>
  </main>
</template>

<style scoped>
.about-page {
  min-height: 100vh;
  padding: 32px 16px;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
}

.about-page__content {
  display: flex;
  width: min(760px, 100%);
  margin: 0 auto;
  flex-direction: column;
  gap: 20px;
}

.about-page__header,
.about-page__links,
.about-page__stack-row,
.about-page__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.about-timeline {
  display: flex;
  margin: 0;
  padding: 0 0 0 6px;
  flex-direction: column;
  list-style: none;
}

.about-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 14px;
  padding: 0 0 18px 18px;
  border-left: 1px solid var(--vtsuru-border);
}

.about-timeline__item::before {
  position: absolute;
  top: 4px;
  left: -5px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--vtsuru-bg);
  border-radius: 50%;
  background: var(--vtsuru-info);
  content: '';
}

.about-timeline__item[data-tone='success']::before {
  background: var(--vtsuru-success);
}

.about-timeline__item[data-tone='warning']::before {
  background: var(--vtsuru-warning);
}

.about-timeline__item time {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.about-timeline__item p {
  margin: 3px 0 0;
  color: var(--vtsuru-fg-toned);
  line-height: 1.5;
}

.about-page__header {
  justify-content: space-between;
}

.about-page__header h1,
.about-page__intro p {
  margin: 0;
}

.about-page__header p {
  margin: 4px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.about-page__intro,
.about-page__stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.about-page__stack-row > svg {
  color: var(--vtsuru-brand);
}

.about-page__sponsor {
  border: 0;
  border-radius: 8px;
}

.about-page__footer {
  justify-content: center;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.about-page__heart {
  color: var(--vtsuru-error);
}
</style>
