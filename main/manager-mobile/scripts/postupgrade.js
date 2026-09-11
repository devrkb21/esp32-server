// # Upgrades uniapp dependencies after running `pnpm upgrade`
// # Clean up redundant dependencies after upgrade
// # Execute following commands

const { exec } = require('node:child_process')

// Define commands to execute
const dependencies = [
  '@dcloudio/uni-app-harmony',
  // TODO: Remove platforms that are not needed
  '@dcloudio/uni-mp-alipay',
  '@dcloudio/uni-mp-baidu',
  '@dcloudio/uni-mp-jd',
  '@dcloudio/uni-mp-kuaishou',
  '@dcloudio/uni-mp-lark',
  '@dcloudio/uni-mp-qq',
  '@dcloudio/uni-mp-toutiao',
  '@dcloudio/uni-mp-xhs',
  '@dcloudio/uni-quickapp-webview',
  // Comment out below for i18n template
  'vue-i18n',
]

// Execute command using exec
exec(`pnpm un ${dependencies.join(' ')}`, (error, stdout, stderr) => {
  if (error) {
    // Print error message if failed
    console.error(`Execution error: ${error}`)
    return
  }
  // Print standard output
  console.log(`stdout: ${stdout}`)
  // Print error output if present
  console.error(`stderr: ${stderr}`)
})
