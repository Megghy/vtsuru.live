<script setup lang="ts">
import { NButton, NCard, NDivider, NLayoutContent, NSpace, NText, NTimeline, NTimelineItem } from 'naive-ui'
</script>
<template>
  <NLayoutContent style="height: 100vh">
    <NSpace style="margin-top: 50px" justify="center" align="center" vertical>
      <NCard style="max-width: 80vw; width: 700px" embedded>
        <template #header> 关于 </template>
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
          <NButton text type="info" @click="$router.push({ name: 'manage-feedback' })"> 反馈页面 </NButton>
          <NDivider vertical />
          邮箱:
          <NButton tag="a" type="info" href="mailto:admin@vtsuru.live" text> admin@vtsuru.live </NButton>
        </NText>
        <template #footer>
          <NSpace vertical align="center">
            <span style="color: gray">
              MADE WITH ❤️ BY
              <NButton type="primary" tag="a" href="https://space.bilibili.com/10021741" target="_blank" text style="">
                Megghy
              </NButton>
            </span>
          </NSpace>
          <NDivider title-placement="left"> 赞助我 </NDivider>
          <iframe
            id="afdian_leaflet_vtsuru"
            src="https://afdian.com/leaflet?slug=vtsuru"
            width="100%"
            scrolling="no"
            height="200"
            frameborder="0"
          ></iframe>
          <NDivider title-placement="left"> 更新日志 </NDivider>
          <NTimeline>
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
            <NTimelineItem type="info" title="功能更新" content="棉花糖添加展示页面" time="2024-2-20" />
            <NTimelineItem type="info" title="功能更新" content="歌单新增从文件导入" time="2024-2-10" />
            <NTimelineItem type="info" title="功能更新" content="排队的OBS组件添加设置项" time="2024-1-27" />
            <NTimelineItem
              type="warning"
              title="Bug修复"
              content="修复点歌会直接跳到下一首的问题 (怎么没人跟我说"
              time="2024-1-22"
            />
            <NTimelineItem type="info" title="功能更新" content="读弹幕支持自定义API" time="2023-12-25" />
            <NTimelineItem type="success" title="功能添加" content="弹幕点歌 (点播)" time="2023-12-24" />
            <NTimelineItem type="success" title="功能添加" content="读弹幕" time="2023-12-17" />
            <NTimelineItem type="success" title="功能添加" content="直播记录" time="2023-12-3" />
            <NTimelineItem type="info" title="功能更新" content="歌单添加 '简单' 模板" time="2023-11-30" />
            <NTimelineItem type="success" title="功能添加" content="排队" time="2023-11-25" />
            <NTimelineItem type="success" title="功能添加" content="点歌" time="2023-11-20" />
            <NTimelineItem type="success" title="上架幻星平台" content="如题" time="2023-11-4" />
            <NTimelineItem type="success" title="功能添加" content="视频征集" time="2023-10-30" />
            <NTimelineItem type="info" title="功能更新" content="日程表添加 '粉粉' 模板" time="2023-10-27" />
            <NTimelineItem type="info" title="功能更新" content="提问箱新增公开选项" time="2023-10-26" />
            <NTimelineItem type="success" title="功能添加" content="提问箱分享卡片" time="2023-10-25" />
            <NTimelineItem
              type="success"
              title="功能添加"
              content="舰长及SC记录"
              time="2023-10-24"
              line-type="dashed"
            />
            <NTimelineItem type="info" content="开始运行" time="2023-10-23" />
          </NTimeline>
        </template>
      </NCard>
      <NButton @click="$router.push({ name: 'manage-index' })"> 回到控制台 </NButton>
    </NSpace>
  </NLayoutContent>
</template>
