<script setup lang="ts">
import { CodeOutline, HeartOutline, LogoGithub, ServerOutline } from '@vicons/ionicons5'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  NButton,
  NCard,
  NDivider,
  NIcon,
  NLayoutContent,
  NFlex,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
  useThemeVars,
} from 'naive-ui'
import { computed } from 'vue'

import UpdateNoteContainer from '@/apps/web/components/UpdateNoteContainer.vue'

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
const themeVars = useThemeVars()
</script>

<template>
  <NLayoutContent style="height: 100vh; padding: 20px 0">
    <NFlex
      style="margin-top: 30px"
      justify="center"
      align="center"
      vertical
    >
      <NCard
        style="max-width: 80vw; width: 700px"
        embedded
      >
        <template #header>
          <div style="font-size: 22px; font-weight: bold; padding: 8px 0">关于</div>
          <NText
            depth="3"
            style="font-size: 13px; margin-top: 4px; padding-bottom: 8px"
          >
            构建时间: {{ buildTime.date }} ({{ buildTime.relative }})
          </NText>
        </template>
        <NText>
          一个兴趣使然的网站
          <br />
          反馈 | 建议 | 需求 | 闲聊: 🐧
          <NButton
            tag="a"
            type="info"
            target="_blank"
            href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=uJNTU6LQ7xANoxP1IyZxS1xYkOKVOF7G&authKey=nl3Bv4UascE4tJ98UDTihEZSvivzuaQGfMViy1BqUe5lYgrz6hi0huK6dyAYq1hi&noverify=0&group_code=873260337"
            text
          >
            873260337
          </NButton>
          或者
          <NButton
            text
            type="info"
            @click="$router.push({ name: 'manage-feedback' })"
          >
            反馈页面
          </NButton>
          <NDivider vertical />
          <NButton
            tag="a"
            type="info"
            href="mailto:admin@vtsuru.live"
            text
          >
            admin@vtsuru.live
          </NButton>
        </NText>
        <template #footer>
          <NFlex
            vertical
            align="center"
            style="margin-bottom: 16px"
          >
            <NText
              depth="3"
              style="font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px"
            >
              MADE WITH
              <NIcon
                size="18"
                :color="themeVars.errorColor"
              >
                <HeartOutline />
              </NIcon>
              BY
              <NButton
                type="primary"
                tag="a"
                href="https://space.bilibili.com/10021741"
                target="_blank"
                text
                style="font-weight: bold"
              >
                Megghy
              </NButton>
            </NText>
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px">
              <NButton
                tag="a"
                href="https://github.com/Megghy/vtsuru.live"
                target="_blank"
                text
                style="display: flex; align-items: center; gap: 4px"
              >
                <NIcon size="16">
                  <LogoGithub />
                </NIcon>
                <span>源代码仓库</span>
              </NButton>
              <NButton
                tag="a"
                href="https://stats.uptimerobot.com/vGKZv8uhVC"
                target="_blank"
                text
                style="display: flex; align-items: center; gap: 4px"
              >
                <NIcon size="16">
                  <ServerOutline />
                </NIcon>
                <span>服务状态</span>
              </NButton>
            </div>
          </NFlex>
          <NDivider
            title-placement="left"
            style="margin-top: 12px"
          >
            <div style="display: flex; align-items: center; gap: 6px">
              <span>技术栈</span>
            </div>
          </NDivider>
          <NFlex
            vertical
            style="padding: 0 12px; margin-bottom: 16px"
          >
            <div style="display: flex; align-items: center; gap: 8px">
              <NIcon
                size="20"
                :color="themeVars.successColor"
              >
                <CodeOutline />
              </NIcon>
              <NText style="font-weight: 500"> 前端: </NText>
              <NTag
                type="success"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://vuejs.org/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  Vue.js
                </NButton>
              </NTag>
              <NTag
                type="info"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://www.typescriptlang.org/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  TypeScript
                </NButton>
              </NTag>
              <NTag
                type="warning"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://www.naiveui.com/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  Naive UI
                </NButton>
              </NTag>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <NIcon
                size="20"
                :color="themeVars.infoColor"
              >
                <ServerOutline />
              </NIcon>
              <NText style="font-weight: 500"> 后端: </NText>
              <NTag
                type="primary"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://dotnet.microsoft.com/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  C# .NET 10
                </NButton>
              </NTag>
              <NTag
                type="error"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://www.postgresql.org/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  PostgreSQL
                </NButton>
              </NTag>
              <NTag
                type="default"
                size="small"
                round
                :bordered="false"
              >
                <NButton
                  tag="a"
                  href="https://microsoft.github.io/garnet/"
                  target="_blank"
                  text
                  style="padding: 0"
                >
                  Garnet
                </NButton>
              </NTag>
            </div>
          </NFlex>
          <NDivider title-placement="left">
            <div style="display: flex; align-items: center; gap: 6px">
              <span>赞助我</span>
            </div>
          </NDivider>
          <iframe
            id="afdian_leaflet_vtsuru"
            src="https://afdian.com/leaflet?slug=vtsuru"
            width="100%"
            scrolling="no"
            height="200"
            frameborder="0"
            :style="{ borderRadius: themeVars.borderRadius }"
          />
          <NDivider title-placement="left">
            <div style="display: flex; align-items: center; gap: 6px">
              <span>更新日志</span>
            </div>
          </NDivider>
          <UpdateNoteContainer />
          <NDivider />
          <NTimeline>
            <NTimelineItem
              type="info"
              title="功能更新"
              content="新增歌单样式: 列表"
              time="2025-3-31"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="上线直播数据分析"
              time="2025-3-18"
            />
            <NTimelineItem
              type="info"
              title="功能添加"
              content="点歌允许从网页匿名点歌"
              time="2025-3-18"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="棉花糖添加内容审查功能"
              time="2025-3-2"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="允许棉花糖设置页滚动条进度同步到obs组件"
              time="2024-11-23"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="礼物兑换允许上舰用户免费兑换, 以及仅允许上舰用户兑换"
              time="2024-4-23"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="积分订单添加导出功能, 允许删除积分用户"
              time="2024-3-22"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="1. 点歌(歌势) 修改为点播 2. 棉花糖支持创建话题(标签) 3. 一些bug修复"
              time="2024-3-12"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="棉花糖添加展示页面"
              time="2024-2-20"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="歌单新增从文件导入"
              time="2024-2-10"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="排队的OBS组件添加设置项"
              time="2024-1-27"
            />
            <NTimelineItem
              type="warning"
              title="Bug修复"
              content="修复点歌会直接跳到下一首的问题 (怎么没人跟我说"
              time="2024-1-22"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="读弹幕支持自定义API"
              time="2023-12-25"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="弹幕点歌 (点播)"
              time="2023-12-24"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="读弹幕"
              time="2023-12-17"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="直播记录"
              time="2023-12-3"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="歌单添加 '简单' 模板"
              time="2023-11-30"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="排队"
              time="2023-11-25"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="点歌"
              time="2023-11-20"
            />
            <NTimelineItem
              type="success"
              title="上架幻星平台"
              content="如题"
              time="2023-11-4"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="视频征集"
              time="2023-10-30"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="日程表添加 '粉粉' 模板"
              time="2023-10-27"
            />
            <NTimelineItem
              type="info"
              title="功能更新"
              content="提问箱新增公开选项"
              time="2023-10-26"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="提问箱分享卡片"
              time="2023-10-25"
            />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="舰长及SC记录"
              time="2023-10-24"
              line-type="dashed"
            />
            <NTimelineItem
              type="info"
              content="开始运行"
              time="2023-10-23"
            />
          </NTimeline>
        </template>
      </NCard>
      <NButton
        type="primary"
        size="large"
        style="margin-top: 20px"
        @click="$router.push({ name: 'manage-index' })"
      >
        回到控制台
      </NButton>
    </NFlex>
  </NLayoutContent>
</template>

<style scoped>
:deep(.n-timeline) {
  padding: 0 8px;
}

:deep(.n-timeline-item-content) {
  margin-bottom: 12px;
}

:deep(.n-divider.n-divider--title-position-left .n-divider__title) {
  font-weight: 600;
  font-size: 16px;
  color: var(--vtsuru-fg);
}

:deep(.n-timeline-item-content__title) {
  font-weight: 600;
}

:deep(.n-timeline-item-content__content) {
  color: var(--vtsuru-fg);
}

:deep(.n-timeline-item-content__time) {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
</style>
