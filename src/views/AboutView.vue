<script setup lang="ts">
import { NButton, NCard, NDivider, NLayoutContent, NSpace, NText, NTimeline, NTimelineItem, NTag, NIcon } from 'naive-ui'
import { h } from 'vue'
import { CodeOutline, ServerOutline, HeartOutline, LogoGithub } from '@vicons/ionicons5'
</script>
<template>
  <NLayoutContent style="height: 100vh; padding: 20px 0;">
    <NSpace
      style="margin-top: 30px"
      justify="center"
      align="center"
      vertical
    >
      <NCard
        style="max-width: 80vw; width: 700px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);"
        embedded
      >
        <template #header>
          <div style="font-size: 22px; font-weight: bold; padding: 8px 0;">
            关于
          </div>
        </template>
        <NText>
          一个兴趣使然的网站
          <br>
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
          邮箱:
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
          <NSpace
            vertical
            align="center"
            style="margin-bottom: 16px;"
          >
            <span style="color: #666; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              MADE WITH <NIcon
                size="18"
                color="#f56c6c"
              ><HeartOutline /></NIcon> BY
              <NButton
                type="primary"
                tag="a"
                href="https://space.bilibili.com/10021741"
                target="_blank"
                text
                style="font-weight: bold;"
              >
                Megghy
              </NButton>
            </span>
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
              <NButton
                tag="a"
                href="https://github.com/Megghy/vtsuru.live"
                target="_blank"
                text
                style="display: flex; align-items: center; gap: 4px; color: #666;"
              >
                <NIcon size="16">
                  <LogoGithub />
                </NIcon>
                <span>源代码仓库</span>
              </NButton>
            </div>
          </NSpace>
          <NDivider
            title-placement="left"
            style="margin-top: 12px;"
          >
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>技术栈</span>
            </div>
          </NDivider>
          <NSpace
            vertical
            style="padding: 0 12px; margin-bottom: 16px;"
          >
            <div style="display: flex; align-items: center; gap: 8px;">
              <NIcon
                size="20"
                color="#709e7e"
              >
                <CodeOutline />
              </NIcon>
              <NText style="font-weight: 500;">
                前端:
              </NText>
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
                  style="padding: 0; color: inherit;"
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
                  style="padding: 0; color: inherit;"
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
                  style="padding: 0; color: inherit;"
                >
                  Naive UI
                </NButton>
              </NTag>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <NIcon
                size="20"
                color="#7c7ca0"
              >
                <ServerOutline />
              </NIcon>
              <NText style="font-weight: 500;">
                后端:
              </NText>
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
                  style="padding: 0; color: inherit;"
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
                  style="padding: 0; color: inherit;"
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
                  href="https://keydb.dev/"
                  target="_blank"
                  text
                  style="padding: 0; color: inherit;"
                >
                  KeyDB
                </NButton>
              </NTag>
            </div>
          </NSpace>
          <NDivider title-placement="left">
            <div style="display: flex; align-items: center; gap: 6px;">
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
            style="border-radius: 8px;"
          />
          <NDivider title-placement="left">
            <div style="display: flex; align-items: center; gap: 6px;">
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
        style="margin-top: 20px; padding: 8px 24px; font-size: 15px; border-radius: 8px;"
        @click="$router.push({ name: 'manage-index' })"
      >
        回到控制台
      </NButton>
    </NSpace>
  </NLayoutContent>
</template>

<style scoped>
:deep(.n-timeline) {
  padding: 0 8px;
}

:deep(.n-timeline-item-content) {
  margin-bottom: 12px;
}

:deep(.n-card-header) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

:deep(.n-divider.n-divider--title-position-left .n-divider__title) {
  font-weight: 600;
  font-size: 16px;
  color: #444;
}

:deep(.n-timeline-item-content__title) {
  font-weight: 600;
}

:deep(.n-timeline-item-content__content) {
  color: #555;
}

:deep(.n-timeline-item-content__time) {
  color: #888;
  font-size: 13px;
}
</style>
