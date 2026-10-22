<script setup lang="ts">
defineProps<{
  active: boolean
  title: string
  description?: string
  badge?: string
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="appearance-none bg-background border-[1.5px] border-border rounded-lg py-2.5 px-3 cursor-pointer text-left flex flex-col gap-1 transition-colors min-h-14 w-full font-inherit text-inherit hover:border-primary"
    :class="{ 'border-primary bg-primary/10 shadow-[inset_0_0_0_1.5px_var(--primary)]': active }"
    @click="$emit('click')"
  >
    <div class="flex items-center justify-between gap-1.5">
      <span class="text-[13px] font-semibold leading-tight">{{ title }}</span>
      <span
        v-if="badge"
        class="text-[11px] py-px px-1.5 rounded bg-muted text-muted-foreground border border-border"
        >{{ badge }}</span
      >
    </div>
    <p
      v-if="description"
      class="text-[11px] text-muted-foreground m-0 leading-snug"
    >
      {{ description }}
    </p>
  </button>
</template>
