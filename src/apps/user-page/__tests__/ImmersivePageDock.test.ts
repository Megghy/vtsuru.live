// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ImmersivePageDock from '../components/ImmersivePageDock.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const props = {
  navGroups: [],
  isOwner: true,
  pageSlug: 'songs',
  isDark: false,
  themeLocked: false,
  themeSwitchTitle: '切换为深色主题',
}

describe('ImmersivePageDock', () => {
  beforeEach(() => push.mockClear())

  it('折叠后保留展开入口', async () => {
    const wrapper = mount(ImmersivePageDock, { props })
    await wrapper.get('[aria-label="折叠页面工具栏"]').trigger('click')
    expect(wrapper.find('[aria-label="页面导航"]').exists()).toBe(false)
    await wrapper.get('[aria-label="展开页面工具栏"]').trigger('click')
    expect(wrapper.find('[aria-label="页面导航"]').exists()).toBe(true)
  })

  it('遵守主题限制并把当前页面交给编辑器', async () => {
    const wrapper = mount(ImmersivePageDock, { props: { ...props, themeLocked: true } })
    expect(wrapper.get('[aria-label="切换为深色主题"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="编辑当前页面"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'manage-userPageBuilder', query: { page: 'songs' } })
  })
})
