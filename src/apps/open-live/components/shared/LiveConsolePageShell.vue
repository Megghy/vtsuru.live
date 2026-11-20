<script lang="ts">
import type { Component } from 'vue'

export interface LiveConsoleHeaderLink {
  label: string
  value: string
  copyValue?: string
  description?: string
}

export interface LiveConsoleTabItem {
  value: string
  label: string
  icon?: Component
  badge?: string | number | null
  keepMounted?: boolean
}
</script>

<script setup lang="ts">
import { useSlots } from 'vue'

import type { FunctionTypes } from '@/api/generated/model'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

defineProps<{
  title: string
  subtitle?: string
  functionType?: FunctionTypes
  links?: LiveConsoleHeaderLink[]
  tabs: LiveConsoleTabItem[]
}>()

const activeTab = defineModel<string>({ required: true })
const slots = useSlots()
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      :title="title"
      :subtitle="subtitle"
      :function-type="functionType"
      :links="links"
    >
      <template
        v-if="slots['header-action']"
        #action
      >
        <slot name="header-action" />
      </template>
    </ManagePageHeader>

    <Tabs
      v-model="activeTab"
      class="w-full"
    >
      <TabsList class="max-w-full overflow-x-auto no-scrollbar justify-start">
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.value"
          :value="tab.value"
          class="gap-1.5"
        >
          <component
            :is="tab.icon"
            v-if="tab.icon"
            class="size-4"
          />
          <span>{{ tab.label }}</span>
          <Badge
            v-if="tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && tab.badge !== 0"
            variant="secondary"
            size="xs"
          >
            {{ tab.badge }}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :force-mount="tab.keepMounted"
        class="mt-3 data-[state=inactive]:hidden"
      >
        <slot :name="tab.value" />
      </TabsContent>
    </Tabs>
  </div>
</template>
