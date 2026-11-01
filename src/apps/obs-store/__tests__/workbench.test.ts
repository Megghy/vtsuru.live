import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import ObsComponentWorkbench from '../components/store/ObsComponentWorkbench.vue'
import { getObsComponentById } from '../registry'

const DummyIcon = defineComponent({
  render() {
    return h('svg', { class: 'dummy-icon' })
  },
})

describe('ObsComponentWorkbench', () => {
  it('正确渲染组件标题、状态、分类与返回按钮', async () => {
    const clock = getObsComponentById('clock')!
    expect(clock).toBeDefined()

    const wrapper = mount(ObsComponentWorkbench, {
      props: {
        component: clock,
      },
      global: {
        stubs: {
          Spin: { template: '<div><slot /></div>' },
          TooltipProvider: { template: '<div><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
        },
      },
    })

    // 标题渲染
    expect(wrapper.text()).toContain(clock.name)
    // 状态
    expect(wrapper.text()).toContain('已就绪')
    // 返回按钮
    const backBtn = wrapper.find('button')
    expect(backBtn.text()).toContain('返回组件库')

    // 触发点击返回
    await backBtn.trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
    expect(wrapper.emitted('back')!.length).toBe(1)

    wrapper.unmount()
  })

  it('规划中组件能够展示占位提示', () => {
    const plannedComponent = {
      id: 'test-planned',
      name: '测试规划中挂件',
      shortDescription: '测试说明',
      description: '详细测试说明',
      category: 'widget' as const,
      status: 'planned' as const,
      tags: ['测试'],
      icon: DummyIcon,
      features: ['特性 1'],
    }

    const wrapper = mount(ObsComponentWorkbench, {
      props: {
        component: plannedComponent,
      },
      global: {
        stubs: {
          Spin: { template: '<div><slot /></div>' },
          TooltipProvider: { template: '<div><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('该组件尚在开发规划中')
    expect(wrapper.text()).toContain('规划中')
    wrapper.unmount()
  })
})
