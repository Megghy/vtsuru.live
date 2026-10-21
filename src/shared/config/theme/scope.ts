import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'

export type ThemeStyle = Record<string, string>
const themeScope: InjectionKey<ComputedRef<ThemeStyle>> = Symbol('theme-scope')

/** Vue injection follows component ownership across Reka portals. */
export function provideThemeScope(style: ComputedRef<ThemeStyle>) {
  const parent = useThemeScope()
  provide(themeScope, computed(() => ({ ...parent.value, ...style.value })))
}

export function useThemeScope() {
  return inject(themeScope, computed<ThemeStyle>(() => ({})))
}
