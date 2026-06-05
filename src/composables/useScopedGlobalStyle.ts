import { onBeforeUnmount, onMounted } from 'vue'

let seq = 0

/**
 * 组件存活期间向 <head> 注入一段全局 CSS, 并可选地在 <html> 上添加一个标识 class,
 * 卸载时自动移除两者。
 *
 * 用于模板临时覆盖站点布局样式(scoped 样式无法触达的部分), 例如沉浸式歌单
 * 让侧栏与右侧内容融合、铺设贯穿整个内容区的背景。配合 `html.<class> .xxx`
 * 形式的选择器可稳定压过 UserLayout 的 scoped 规则。
 */
export function useScopedGlobalStyle(css: string, htmlClass?: string) {
  const styleEl = document.createElement('style')
  styleEl.dataset.vtsuruScopedStyle = String(++seq)

  onMounted(() => {
    styleEl.textContent = css
    document.head.appendChild(styleEl)
    if (htmlClass) document.documentElement.classList.add(htmlClass)
  })

  onBeforeUnmount(() => {
    styleEl.remove()
    if (htmlClass) document.documentElement.classList.remove(htmlClass)
  })
}
