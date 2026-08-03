import type { Component } from 'vue'

const iconModules = import.meta.glob<Component>(
  [
    '/node_modules/@vicons/ionicons5/es/*.js',
    '!/node_modules/@vicons/ionicons5/es/index.js',
    '!/node_modules/@vicons/ionicons5/es/async-index.js',
  ],
  { import: 'default' },
)

const iconLoaders = new Map<string, () => Promise<Component>>()

for (const [path, loader] of Object.entries(iconModules)) {
  const name = path.match(/\/([^/]+)\.js$/)?.[1]
  if (name) iconLoaders.set(name, loader)
}

export const USER_PAGE_NAV_ICON_NAMES = Object.freeze([...iconLoaders.keys()].toSorted())

export function loadUserPageNavIconComponent(name: string) {
  return iconLoaders.get(name)?.()
}
