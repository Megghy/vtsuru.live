<script setup lang="ts">
import RegisterAndLogin from '@/components/RegisterAndLogin.vue';
import { NGradientText, NSpace, NText } from 'naive-ui'
</script>

<template>
  <div class="index-background">
    <NSpace justify="center">
      <NGradientText
        :size="50"
        :gradient="{
          deg: 180,
          from: '#e5e5e5',
          to: '#c2ebeb',
        }"
        style="font-family: Microsoft YaHei,Times New Roman, Times, serif;"
      >
        VTSURU.LIVE
      </NGradientText>
    </NSpace>
    <div style="width:500px;">
        <RegisterAndLogin />
    </div>
  </div>
</template>

<style lang="stylus">
body
    margin:0
.index-background
    height: 100vh;
    background: #8360c3;  /* fallback for old browsers */
    background: -webkit-linear-gradient(to right, #2ebf91, #8360c3);  /* Chrome 10-25, Safari 5.1-6 */
    background: linear-gradient(to right, #2ebf91, #8360c3); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
</style>
