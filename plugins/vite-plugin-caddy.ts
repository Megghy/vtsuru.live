// src/index.ts
import chalk from 'chalk'
import { spawn } from 'child_process'

// src/utils.ts
import { execSync } from 'child_process'
function validateCaddyIsInstalled() {
  let caddyInstalled = false
  try {
    execSync('caddy version')
    caddyInstalled = true
  } catch {
    caddyInstalled = false
    console.error('caddy cli is not installed')
  }
  return caddyInstalled
}

// src/index.ts
function viteCaddyTlsPlugin(url?:string) {
  return {
    name: 'vite:caddy-tls',
    async configResolved({ command }) {
      if (command !== 'serve') return
      console.log('starting caddy plugin...')
      validateCaddyIsInstalled()
      const handle = spawn(
        `caddy reverse-proxy ${url ? `--from ${url}` : ''} --to http://localhost:5173`,
        {
          shell: true
        }
      )
      handle.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
      })
      handle.stderr.on('data', () => {})
      //const servers = parseNamesFromCaddyFile(`${cwd}/Caddyfile`);
      console.log()
      console.log(
        chalk.green('\u{1F512} Caddy is running to proxy your traffic on https')
      )
      console.log()
      console.log(`\u{1F517} Access your local server `)
      console.log(chalk.blue(`\u{1F30D} https://${url ?? 'localhost'}`))
      console.log()
    }
  }
}
export { viteCaddyTlsPlugin as default }
