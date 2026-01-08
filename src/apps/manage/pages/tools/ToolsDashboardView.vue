<script setup lang="ts">
import { ImagesOutline as NineGridIcon } from '@vicons/ionicons5' // Example Icon
import { NButton, NCard, NGrid, NGridItem, NH1, NIcon, NLayout, NLayoutContent, NLayoutHeader } from 'naive-ui'
import { shallowRef } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface ToolDefinition {
  name: string
  displayName: string
  description: string
  routeName: string
  icon?: any // Using 'any' for icon component type for simplicity
}

const availableTools = shallowRef<ToolDefinition[]>([
  {
    name: 'DynamicNineGrid',
    displayName: '动态九图生成器',
    description: '快速创建用于B站动态的九宫格图片，支持自定义拼接。',
    routeName: 'ManageToolDynamicNineGrid',
    icon: NineGridIcon,
  },
  // Add more tools here as they are created
  // {
  //   name: 'AnotherTool',
  //   displayName: '另一个工具',
  //   description: '这是另一个很棒的工具。',
  //   routeName: 'ManageToolAnotherTool',
  //   icon: AnotherIconComponent,
  // },
])

function navigateToTool(routeName: string) {
  router.push({ name: routeName })
}
</script>

<template>
  <NLayout class="tools-dashboard">
    <NLayoutHeader bordered class="header">
      <NH1 style="margin: 0; padding: 16px;">
        直播工具箱
      </NH1>
    </NLayoutHeader>
    <NLayoutContent style="padding: 24px;">
      <NGrid cols="1 s:2 m:3 l:4 xl:4 xxl:5" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem v-for="tool in availableTools" :key="tool.name">
          <NCard :title="tool.displayName" hoverable @click="navigateToTool(tool.routeName)">
            <template v-if="tool.icon" #cover>
              <!-- Placeholder for an icon or image -->
              <div style="font-size: 48px; text-align: center; padding: 20px 0;">
                <NIcon :component="tool.icon" />
              </div>
            </template>
            {{ tool.description }}
            <template #action>
              <NButton type="primary" block @click.stop="navigateToTool(tool.routeName)">
                打开工具
              </NButton>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.tools-dashboard {
  min-height: calc(100vh - 64px); /* Adjust based on your header/footer height */
}
.n-card {
  cursor: pointer;
}
</style>
