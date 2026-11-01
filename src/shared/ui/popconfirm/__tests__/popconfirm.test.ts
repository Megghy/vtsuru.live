import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import Popconfirm from '@/shared/ui/popconfirm/Popconfirm.vue'

describe('Popconfirm component', () => {
  it('renders default slot as trigger when #trigger slot is not provided', async () => {
    const onConfirm = ref(false)
    const wrapper = mount({
      components: { Popconfirm },
      setup() {
        return {
          handleConfirm() {
            onConfirm.value = true
          },
        }
      },
      template: `
        <Popconfirm
          title="确认删除话题？"
          description="确认删除话题「生活杂谈」吗？"
          @confirm="handleConfirm"
        >
          <button id="del-btn">删除话题</button>
        </Popconfirm>
      `,
    })

    const trigger = wrapper.find('#del-btn')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe('删除话题')
  })

  it('renders #trigger slot when explicitly provided', () => {
    const wrapper = mount({
      components: { Popconfirm },
      template: `
        <Popconfirm title="清除图片">
          <template #trigger>
            <button id="clear-btn">清除</button>
          </template>
          确定要清除图片吗？
        </Popconfirm>
      `,
    })

    const trigger = wrapper.find('#clear-btn')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe('清除')
  })

  it('triggers both confirm and positive-click events when confirmed', async () => {
    const wrapper = mount(Popconfirm, {
      props: {
        title: '确认操作',
        description: '详细描述',
      },
      slots: {
        default: '<button id="btn">操作</button>',
      },
    })

    expect(wrapper.find('#btn').exists()).toBe(true)

    // 触发内部 onConfirm
    const vm = wrapper.vm as any
    vm.onConfirm(new MouseEvent('click'))

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('positive-click')).toBeTruthy()
  })

  it('triggers both cancel and negative-click events when cancelled', async () => {
    const wrapper = mount(Popconfirm, {
      props: {
        title: '确认操作',
      },
      slots: {
        default: '<button id="btn">操作</button>',
      },
    })

    const vm = wrapper.vm as any
    vm.onCancel(new MouseEvent('click'))

    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('negative-click')).toBeTruthy()
  })

  it('resolves okText/cancelText alias props correctly', () => {
    const wrapper = mount(Popconfirm, {
      props: {
        okText: '确定清空',
        cancelText: '算了',
      },
      slots: {
        default: '<button id="btn">清空</button>',
      },
    })

    const vm = wrapper.vm as any
    expect(vm.resolvedPositiveText).toBe('确定清空')
    expect(vm.resolvedNegativeText).toBe('算了')
  })
})
