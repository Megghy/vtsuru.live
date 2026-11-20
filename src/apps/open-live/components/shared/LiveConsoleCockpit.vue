<template>
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
    <div class="xl:col-span-8 min-w-0 space-y-3">
      <slot name="main" />
    </div>
    <div class="xl:col-span-4 space-y-3">
      <slot name="aside" />
    </div>
  </div>
</template>
