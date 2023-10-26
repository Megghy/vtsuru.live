<script setup lang="ts">
import { NButton, NCard, NDivider, NLayoutContent, NSpace, NText, NTimeline, NTimelineItem } from 'naive-ui'
</script>
<template>
  <NLayoutContent style="height: 100vh">
    <NSpace style="margin-top: 50px" justify="center" align="center" vertical>
      <NCard style="max-width: 80vw; width: 700px">
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
          <NDivider vertical />
          邮箱:
          <NButton tag="a" type="info" href="mailto:admin@vtsuru.live" text> admin@vtsuru.live </NButton>
        </NText>
        <template #footer>
          <NSpace vertical>
            <span>
              开发者:
              <NButton type="primary" tag="a" href="https://space.bilibili.com/10021741" target="_blank" text style=""> Megghy </NButton>
            </span>
            <span> 技术栈: 前端 VUE3 + NAIVE UI, 后端 .NET 8 </span>
          </NSpace>
          <NDivider title-placement="left"> 更新日志 </NDivider>
          <NTimeline>
            <NTimelineItem type="info" title="功能更新" content="提问箱新增公开选项" time="2023-10-26" />
            <NTimelineItem type="success" title="功能添加" content="提问箱分享卡片" time="2023-10-25" />
            <NTimelineItem type="success" title="功能添加" content="舰长及SC记录" time="2023-10-24" line-type="dashed" />
            <NTimelineItem type="info" content="开始运行" time="2023-10-23" />
          </NTimeline>
        </template>
      </NCard>
      <NButton @click="$router.push({ name: 'manage-index' })"> 回到控制台 </NButton>
    </NSpace>
  </NLayoutContent>
</template>
