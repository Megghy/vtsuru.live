import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Tag from '@/shared/ui/tag/Tag.vue'

describe('Tag component', () => {
  it('renders correctly with default type', () => {
    const wrapper = mount(Tag, {
      slots: {
        default: '测试标签',
      },
    })
    expect(wrapper.text()).toBe('测试标签')
    expect(wrapper.classes()).toContain('border')
  })

  it('supports type prop', () => {
    const wrapper = mount(Tag, {
      props: {
        type: 'success',
      },
      slots: {
        default: '成功',
      },
    })
    expect(wrapper.classes()).toContain('text-emerald-600')
  })

  it('supports variant="secondary" prop alias', () => {
    const wrapper = mount(Tag, {
      props: {
        variant: 'secondary',
      },
      slots: {
        default: '次要',
      },
    })
    expect(wrapper.classes()).toContain('bg-secondary')
    expect(wrapper.classes()).toContain('text-secondary-foreground')
  })

  it('supports closable and emits close event', async () => {
    const wrapper = mount(Tag, {
      props: {
        closable: true,
      },
      slots: {
        default: '可关闭',
      },
    })
    const closeBtn = wrapper.find('button')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
