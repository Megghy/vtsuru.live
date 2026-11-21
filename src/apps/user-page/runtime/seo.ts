import type { ComputedRef } from 'vue'
import { onScopeDispose, watchEffect } from 'vue'

type SeoSource = {
  title: ComputedRef<string>
  description: ComputedRef<string>
  image?: ComputedRef<string>
}

type RestorableElement = {
  element: HTMLElement
  attribute: string
  previous: string | null
  created: boolean
}

export function usePublicPageSeo(source: SeoSource) {
  const originalTitle = document.title
  const managed = new Map<string, RestorableElement>()

  function setElement(
    selector: string,
    tag: 'meta' | 'link',
    attribute: string,
    value: string,
    attrs: Record<string, string>,
  ) {
    let record = managed.get(selector)
    if (!record) {
      const existing = document.head.querySelector<HTMLElement>(selector)
      const element = existing ?? document.createElement(tag)
      const created = !existing
      if (created) {
        for (const [name, attrValue] of Object.entries(attrs)) element.setAttribute(name, attrValue)
        document.head.appendChild(element)
      }
      record = { element, attribute, previous: element.getAttribute(attribute), created }
      managed.set(selector, record)
    }
    record.element.setAttribute(attribute, value)
  }

  function removeElement(selector: string) {
    const record = managed.get(selector)
    if (!record) return
    if (record.created) record.element.remove()
    else if (record.previous === null) record.element.removeAttribute(record.attribute)
    else record.element.setAttribute(record.attribute, record.previous)
    managed.delete(selector)
  }

  watchEffect(() => {
    const title = source.title.value
    const description = source.description.value
    const image = source.image?.value?.trim() || ''
    const canonical = `${window.location.origin}${window.location.pathname}`
    document.title = title
    setElement('meta[name="description"]', 'meta', 'content', description, { name: 'description' })
    setElement('meta[property="og:title"]', 'meta', 'content', title, { property: 'og:title' })
    setElement('meta[property="og:description"]', 'meta', 'content', description, { property: 'og:description' })
    setElement('meta[property="og:type"]', 'meta', 'content', 'profile', { property: 'og:type' })
    setElement('meta[property="og:url"]', 'meta', 'content', canonical, { property: 'og:url' })
    setElement('link[rel="canonical"]', 'link', 'href', canonical, { rel: 'canonical' })
    if (image) {
      setElement('meta[property="og:image"]', 'meta', 'content', image, { property: 'og:image' })
      setElement('meta[name="twitter:card"]', 'meta', 'content', 'summary_large_image', { name: 'twitter:card' })
      setElement('meta[name="twitter:image"]', 'meta', 'content', image, { name: 'twitter:image' })
    } else {
      removeElement('meta[property="og:image"]')
      removeElement('meta[name="twitter:card"]')
      removeElement('meta[name="twitter:image"]')
    }
  })

  onScopeDispose(() => {
    document.title = originalTitle
    for (const record of managed.values()) {
      if (record.created) record.element.remove()
      else if (record.previous === null) record.element.removeAttribute(record.attribute)
      else record.element.setAttribute(record.attribute, record.previous)
    }
  })
}
