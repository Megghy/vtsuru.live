<script setup lang="ts">
import { useAccount } from '@/api/account';
import { onMounted } from 'vue';

const accountInfo = useAccount()

const { } = defineProps<{

}>()

async function getAccountPaymentSettings() {
  try {

  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  getAccountPaymentSettings()
});
</script>

<template>
  WIP...
</template>