import { chromium } from 'playwright'

const outDir = 'C:/Users/User/AppData/Local/claude/jobs/04bf9b9b/tmp'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
await page.screenshot({ path: `${outDir}/home.png` })

await page.goto('http://localhost:3000/tasks', { waitUntil: 'networkidle' })
await page.screenshot({ path: `${outDir}/tasks.png` })

await browser.close()
console.log('Done')
