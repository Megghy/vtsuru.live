<script setup lang="ts">
import { defineComponent, h, onMounted, shallowRef } from 'vue'

import { useAccount } from '@/api/account'
import { ConsumptionTypes } from '@/api/models/consumption'
import { isDev } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const DanmakuStorageView = defineComponent({
  setup() {
    return () => h('div', { class: 'pt-3 border-t border-border text-xs text-muted-foreground' }, 'WIP...')
  },
})

const accountInfo = useAccount()
const currentComponent = shallowRef(DanmakuStorageView)

function tabDisplay(type: ConsumptionTypes) {
  switch (type) {
    case ConsumptionTypes.DanmakuStorage:
      return DanmakuStorageView
  }
  return DanmakuStorageView
}

onMounted(() => {
  currentComponent.value = tabDisplay(ConsumptionTypes.DanmakuStorage)
})
</script>

<template>
  <Card class="p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-foreground">增值服务</h3>
    </div>

    <Alert
      v-if="!isDev"
      variant="default"
    >
      <AlertTitle>开发中</AlertTitle>
      <AlertDescription class="text-xs"> 增值服务面板正在开发中（WIP） </AlertDescription>
    </Alert>

    <template v-else>
      <Tabs
        default-value="overview"
        class="w-full space-y-3"
      >
        <TabsList>
          <TabsTrigger value="overview"> 概览 </TabsTrigger>
        </TabsList>
        <TabsContent
          value="overview"
          class="space-y-3"
        >
          <div class="text-xs text-muted-foreground">
            当前积分：<strong class="text-foreground font-mono">{{ accountInfo.point }}</strong>
          </div>
          <component :is="tabDisplay(ConsumptionTypes.DanmakuStorage)" />
        </TabsContent>
      </Tabs>
    </template>
  </Card>
</template>
