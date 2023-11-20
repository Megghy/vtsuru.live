const fs = require('fs')
const path = require('path')

const version = Date.now()
const versionModule = `export const version = "${version}"`
fs.writeFileSync(path.resolve(__dirname, 'src/version.js'), versionModule)
