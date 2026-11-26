import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)))

test('spreadsheet support uses the patched SheetJS vendor build', () => {
  assert.match(packageJson.dependencies.xlsx, /^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.[2-9]/)
  assert.match(lock.packages['node_modules/xlsx'].resolved, /^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\./)
})

test('rich text editor uses the maintained React wrapper and patched Quill fork', () => {
  assert.ok(packageJson.dependencies['react-quill-new'])
  assert.equal(packageJson.dependencies['react-quill'], undefined)
  assert.equal(packageJson.dependencies['@dotwee/quill'], '2.0.9')
  assert.equal(packageJson.overrides.quill, 'npm:@dotwee/quill@2.0.9')
  assert.equal(
    lock.packages['node_modules/react-quill-new/node_modules/quill'].version,
    '2.0.9'
  )
  assert.equal(lock.packages['node_modules/react-quill'], undefined)
})
