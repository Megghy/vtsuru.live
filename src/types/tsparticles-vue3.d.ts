declare module 'vue' {
  export interface GlobalComponents {
    'vue-particles': typeof import('@tsparticles/vue3/dist/vue-particles.vue')['default']
  }
}

export {}
