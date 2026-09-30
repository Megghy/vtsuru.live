import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    workspace?: 'streamer' | 'user'
  }
}
