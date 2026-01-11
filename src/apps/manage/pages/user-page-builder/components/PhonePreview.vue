<script setup lang="ts">
const props = defineProps<{ transparent?: boolean }>()
</script>

<template>
  <div class="phone-preview">
    <div class="device">
      <div class="notch" />
      <div class="screen" :class="{ transparent: !!props.transparent }">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-preview {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0;
}

.device {
  width: 100%;
  height: 100%;
  background: #111;
  border-radius: 28px;
  padding: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
}

.notch {
  width: 120px;
  height: 18px;
  margin: 2px auto 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
}

.screen {
  background: var(--n-color);
  border-radius: 20px;
  overflow: hidden;
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.screen.transparent {
  background: transparent;
}
</style>
