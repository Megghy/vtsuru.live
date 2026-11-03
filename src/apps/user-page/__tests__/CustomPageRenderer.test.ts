import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createDefaultCustomPageProps } from '../block/customHtmlContract'
import CustomPageRenderer from '../components/CustomPageRenderer.vue'

vi.mock('../runtime/observability', () => ({ reportPublicPageError: vi.fn() }))
vi.mock('../block/blocks/CustomHtmlBlock.vue', () => ({ default: { template: '<iframe title="sandbox" />' } }))

describe('CustomPageRenderer', () => {
  it('renders the runnable default template', () => {
    const wrapper = mount(CustomPageRenderer, { props: { config: createDefaultCustomPageProps() } })
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('页面配置错误')
  })

  it.each([
    undefined,
    { ...createDefaultCustomPageProps(), js: null },
    {
      ...createDefaultCustomPageProps(),
      html: '<script>alert(1)</script>',
    },
  ])('rejects invalid published configuration before creating the sandbox', (config) => {
    const wrapper = mount(CustomPageRenderer, { props: { config: config as never } })
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('页面配置错误')
  })
})
