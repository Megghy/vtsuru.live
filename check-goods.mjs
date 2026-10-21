import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:51000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('=== 检查 /goods 页面 DOM 结构 ===\n');
  await page.goto(`${BASE_URL}/goods`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 查找所有输入框和相关元素
  const pageStructure = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const searchRelated = Array.from(document.querySelectorAll('[class*="search"], [placeholder*="搜索"], [placeholder*="礼物"]'));
    
    return {
      inputs: inputs.map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        className: el.className,
        id: el.id,
        name: el.name,
        parent: el.parentElement?.className,
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        computedStyles: {
          width: window.getComputedStyle(el).width,
          height: window.getComputedStyle(el).height,
          fontSize: window.getComputedStyle(el).fontSize,
          padding: window.getComputedStyle(el).padding,
        }
      })),
      textareas: textareas.map(el => ({
        tag: el.tagName,
        placeholder: el.placeholder,
        className: el.className,
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
      })),
      searchRelated: searchRelated.map(el => ({
        tag: el.tagName,
        className: el.className,
        placeholder: el.getAttribute('placeholder'),
        text: el.textContent?.slice(0, 50),
      }))
    };
  });

  console.log('输入框数量:', pageStructure.inputs.length);
  pageStructure.inputs.forEach((input, idx) => {
    console.log(`\n输入框 ${idx + 1}:`);
    console.log('  类型:', input.type);
    console.log('  占位符:', input.placeholder);
    console.log('  类名:', input.className);
    console.log('  尺寸:', `${input.offsetWidth}x${input.offsetHeight}px`);
    console.log('  计算宽度:', input.computedStyles.width);
    console.log('  计算高度:', input.computedStyles.height);
    console.log('  字体大小:', input.computedStyles.fontSize);
    console.log('  内边距:', input.computedStyles.padding);
  });

  console.log('\n\nTextarea 数量:', pageStructure.textareas.length);
  pageStructure.textareas.forEach((ta, idx) => {
    console.log(`\nTextarea ${idx + 1}:`);
    console.log('  占位符:', ta.placeholder);
    console.log('  类名:', ta.className);
    console.log('  尺寸:', `${ta.offsetWidth}x${ta.offsetHeight}px`);
  });

  console.log('\n\n搜索相关元素:', pageStructure.searchRelated.length);
  pageStructure.searchRelated.forEach((el, idx) => {
    console.log(`\n元素 ${idx + 1}:`);
    console.log('  标签:', el.tag);
    console.log('  类名:', el.className);
    console.log('  占位符:', el.placeholder);
  });

  await browser.close();
})();
