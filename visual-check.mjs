import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:51000';
const SCREENSHOTS_DIR = 'F:\\Temp';

(async () => {
  // 确保截图目录存在
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 监听页面错误
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  console.log('=== 检查主页卡片 ===\n');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 检查 CSS 变量
  const cssVars = await page.evaluate(() => {
    const root = document.documentElement;
    const computed = window.getComputedStyle(root);
    return {
      '--popover': computed.getPropertyValue('--popover'),
      '--popover-rgb': computed.getPropertyValue('--popover-rgb'),
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches
    };
  });
  console.log('CSS 变量:', JSON.stringify(cssVars, null, 2));

  // 检查 entry-card
  const entryCards = await page.locator('.entry-card').all();
  console.log(`\n找到 ${entryCards.length} 个 entry-card`);

  if (entryCards.length > 0) {
    const styles = await entryCards[0].evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        backdropFilter: computed.backdropFilter,
      };
    });
    console.log('entry-card 计算样式:', JSON.stringify(styles, null, 2));
  }

  // 检查 feature-card
  const featureCards = await page.locator('.feature-card').all();
  console.log(`\n找到 ${featureCards.length} 个 feature-card`);

  if (featureCards.length > 0) {
    const styles = await featureCards[0].evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        backdropFilter: computed.backdropFilter,
      };
    });
    console.log('feature-card 计算样式:', JSON.stringify(styles, null, 2));
  }

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/index-page.png`, fullPage: true });
  console.log('\n✓ 主页截图已保存');

  console.log('\n=== 检查 /goods 页面搜索框 ===\n');
  await page.goto(`${BASE_URL}/goods`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 查找所有输入框
  const allInputs = await page.$$eval('input', (els) => {
    return els.map(el => ({
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      className: el.className,
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      computedWidth: window.getComputedStyle(el).width,
      computedHeight: window.getComputedStyle(el).height,
      computedPadding: window.getComputedStyle(el).padding,
      computedFontSize: window.getComputedStyle(el).fontSize,
    }));
  });

  console.log(`找到 ${allInputs.length} 个输入框`);
  allInputs.forEach((input, idx) => {
    console.log(`\n输入框 ${idx + 1}:`);
    console.log(`  - type: ${input.type}`);
    console.log(`  - placeholder: ${input.placeholder}`);
    console.log(`  - className: ${input.className}`);
    console.log(`  - 实际宽度: ${input.offsetWidth}px (计算值: ${input.computedWidth})`);
    console.log(`  - 实际高度: ${input.offsetHeight}px (计算值: ${input.computedHeight})`);
    console.log(`  - padding: ${input.computedPadding}`);
    console.log(`  - fontSize: ${input.computedFontSize}`);
  });

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/goods-page.png`, fullPage: true });
  console.log('\n✓ /goods 页面截图已保存');

  console.log('\n=== 检查展示页卡片 ===\n');
  await page.goto(`${BASE_URL}/@megghy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const blockCards = await page.locator('.block-card').all();
  console.log(`找到 ${blockCards.length} 个 block-card`);

  if (blockCards.length > 0) {
    const styles = await blockCards[0].evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        backdropFilter: computed.backdropFilter,
        background: computed.background,
      };
    });
    console.log('block-card 计算样式:', JSON.stringify(styles, null, 2));
  }

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/display-page.png`, fullPage: true });
  console.log('\n✓ 展示页截图已保存');

  console.log('\n所有截图已保存到 F:\\Temp\\');
  await browser.close();
})();
