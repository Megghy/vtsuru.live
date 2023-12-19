<script setup lang="ts">
import { NButton, NLayoutContent, NResult } from 'naive-ui'
</script>

<template>
  <NLayoutContent tag="div" style="height: 100vh; position: relative">
    <NResult status="404" title="404" description="页面不存在" style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%)">
      <template #footer>
        <NButton type="primary" size="large" @click="$router.push({ name: 'index' })">返回首页</NButton>
      </template>
    </NResult>
  </NLayoutContent>
</template>
