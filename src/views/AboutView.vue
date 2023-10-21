<script setup lang="ts">
import { NButton, NCard, NDivider, NLayoutContent, NSpace, NText } from 'naive-ui'
</script>
<template>
  <NLayoutContent style="height: 100vh">
    <NSpace style="margin-top: 50px" justify="center" align="center" vertical>
      <NCard style="max-width: 80vw; width: 700px">
        <template #header> 关于 </template>
        <NText>
          一个兴趣释然的网站.
          <br />
          反馈 | 建议 | 需求 | 闲聊: 群:
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
          <NButton
            tag="a"
            type="info"
            href="mailto:megghy@qq.com"
            text
          >
            megghy@qq.com
          </NButton>
        </NText>
        <template #footer>
          <NSpace vertical>
            <span>
              开发者:
              <NButton type="primary" tag="a" href="https://space.bilibili.com/10021741" target="_blank" text style=""> Megghy </NButton>
            </span>
            <span>
              技术栈: 前端 VUE3 + NAIVE UI, 后端 .NET 8
            </span>
          </NSpace>
        </template>
      </NCard>
      <NButton @click="$router.push({ name: 'manage-index' })">
        回到主页
      </NButton>
    </NSpace>
  </NLayoutContent>
</template>
