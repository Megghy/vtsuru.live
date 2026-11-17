import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { resolveUserPageReadableAccent } from '@/apps/user-page/theme'

import CustomHtmlEditorModal from '../components/CustomHtmlEditorModal.vue'
import { UserPageEditorKey } from '../context'

vi.mock('@/shared/services/fileUpload', () => ({
  uploadFiles: vi.fn(),
  FileStore: { Configs: 'configs', Library: 'library', Questions: 'questions' },
}))

vi.mock('../components/CustomHtmlCodeEditor.vue', () => ({
  default: {
    name: 'CustomHtmlCodeEditor',
    template: '<div class="mock-code-editor" />',
  },
}))

describe('CustomHtmlEditorModal setup and initial mount', () => {
  it('mounts without throwing ReferenceError when show is false initially', () => {
    const mockEditor = {
      message: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      fileRefs: ref([]),
      currentKey: ref('home'),
      account: ref(undefined),
      currentProject: ref({
        version: 1,
        blocks: [],
      }),
    }

    expect(() => {
      mount(CustomHtmlEditorModal, {
        props: {
          show: false,
          block: {
            id: 'b1',
            type: 'customHtml',
            props: { source: '', assets: [] },
          },
        },
        global: {
          provide: {
            [UserPageEditorKey as symbol]: mockEditor,
          },
          stubs: {
            CustomHtmlBlock: true,
            Dialog: { template: '<div><slot /></div>' },
            DialogContent: { template: '<div><slot /></div>' },
            DialogHeader: { template: '<div><slot /></div>' },
            DialogTitle: { template: '<div><slot /></div>' },
            DialogDescription: { template: '<div><slot /></div>' },
            DialogFooter: { template: '<div><slot /></div>' },
            Tabs: { template: '<div><slot /></div>' },
            TabsList: { template: '<div><slot /></div>' },
            TabsTrigger: { template: '<button><slot /></button>' },
            TooltipProvider: { template: '<div><slot /></div>' },
            Tooltip: { template: '<div><slot /></div>' },
            TooltipTrigger: { template: '<div><slot /></div>' },
            TooltipContent: { template: '<div><slot /></div>' },
            Button: { template: '<button><slot /></button>' },
            Input: { template: '<input />' },
            Textarea: { template: '<textarea />' },
            Tag: { template: '<span><slot /></span>' },
            ToggleGroup: { template: '<div><slot /></div>' },
            ToggleGroupItem: { template: '<button><slot /></button>' },
          },
        },
      })
    }).not.toThrow()
  })

  it('applies settings and currentPage theme context when show is true', () => {
    const settings = ref({
      version: 2 as const,
      home: {
        mode: 'custom' as const,
        theme: { primaryColor: '#ff3366' },
        custom: { source: '<template><div>hi</div></template>', assets: [] },
      },
      pages: {},
      theme: { borderRadius: 'lg' },
      customCss: '.custom-card { opacity: 0.9; }',
    })
    const currentPage = ref(settings.value.home)
    const mockEditor = {
      message: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      fileRefs: ref([]),
      currentKey: ref('home'),
      account: ref(undefined),
      settings,
      currentPage,
      currentProject: ref(null),
      batchHistory: vi.fn((fn: () => void) => fn()),
    }

    const wrapper = mount(CustomHtmlEditorModal, {
      props: {
        show: true,
        page: true,
      },
      global: {
        provide: {
          [UserPageEditorKey as symbol]: mockEditor,
        },
        stubs: {
          CustomHtmlBlock: true,
          Dialog: { template: '<div><slot /></div>' },
          DialogContent: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<div><slot /></div>' },
          DialogDescription: { template: '<div><slot /></div>' },
          DialogFooter: { template: '<div><slot /></div>' },
          DropdownMenu: { template: '<div><slot /></div>' },
          DropdownMenuTrigger: { template: '<div><slot /></div>' },
          DropdownMenuContent: { template: '<div><slot /></div>' },
          DropdownMenuItem: { template: '<div><slot /></div>' },
          Sheet: { template: '<div><slot /></div>' },
          SheetContent: { template: '<div><slot /></div>' },
          SheetHeader: { template: '<div><slot /></div>' },
          SheetTitle: { template: '<div><slot /></div>' },
          SheetDescription: { template: '<div><slot /></div>' },
          Switch: { template: '<input type="checkbox" />' },
          TooltipProvider: { template: '<div><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          Input: { template: '<input />' },
          Textarea: { template: '<textarea />' },
          Tag: { template: '<span><slot /></span>' },
          ToggleGroup: { template: '<div><slot /></div>' },
          ToggleGroupItem: { template: '<button><slot /></button>' },
        },
      },
    })

    const customBlock = wrapper.findComponent({ name: 'CustomHtmlBlock' })
    expect(customBlock.exists()).toBe(true)
    expect(customBlock.props('theme')).toEqual(
      expect.objectContaining({
        primary: resolveUserPageReadableAccent('#ff3366', undefined, false),
      }),
    )
    wrapper.unmount()
  })
})
