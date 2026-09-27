/**
 * build-emails.mjs
 *
 * 将 emails/templates/*.njk 编译为静态 HTML，输出到后端邮件模板目录。
 * Nunjucks 变量定界符改用 [[ ]]，{{ }} 原样透传供 C# EmailManager 替换。
 *
 * 用法：bun run build:emails
 */

import nunjucks from 'nunjucks'
import path from 'node:path'
import fs from 'node:fs'

const EMAILS_DIR = path.resolve(import.meta.dirname, '..', 'emails')
const TEMPLATES_DIR = path.join(EMAILS_DIR, 'templates')
const OUT_DIR = path.resolve(import.meta.dirname, '..', '..', 'VTsuru', 'VTsuru', 'VtsuruData', 'Email')

// 配置 Nunjucks：以 emails/ 为根，自定义定界符避免与 C# {{}} 冲突
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(EMAILS_DIR),
  {
    autoescape: false,
    tags: {
      variableStart: '[[',
      variableEnd:   ']]',
      commentStart:  '[#',
      commentEnd:    '#]',
      // block / raw 标签保留默认 {% %}
    },
  }
)

// 注入构建时固定的占位符（Nunjucks 层面，最终写入 HTML 的是字面量）
const buildVars = {
  site_name:   'VTsuru',
  logo_url:    'https://oss.suki.club/vtsuru/icon.ico',
  current_year: new Date().getFullYear().toString(),
}

const templates = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.njk'))

let ok = 0, fail = 0
for (const tpl of templates) {
  const outName = tpl.replace('.njk', '.html')
  const outPath = path.join(OUT_DIR, outName)
  try {
    const html = env.render(`templates/${tpl}`, buildVars)
    fs.writeFileSync(outPath, html, 'utf-8')
    console.log(`  ✓  ${tpl} → ${outName}`)
    ok++
  } catch (err) {
    console.error(`  ✗  ${tpl}: ${err.message}`)
    fail++
  }
}

console.log(`\n${ok} 成功, ${fail} 失败`)
if (fail > 0) process.exit(1)
