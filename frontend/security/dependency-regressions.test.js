import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url))
)
const lock = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url))
)

test('spreadsheet support uses the patched SheetJS vendor build', () => {
  assert.match(
    packageJson.dependencies.xlsx,
    /^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.[2-9]/
  )
  assert.match(
    lock.packages['node_modules/xlsx'].resolved,
    /^https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\./
  )
})

test('rich text editor resolves Quill Next through the maintained React wrapper', () => {
  assert.ok(packageJson.dependencies['react-quill-new'])
  assert.equal(packageJson.dependencies['react-quill'], undefined)
  assert.equal(packageJson.dependencies.quill, 'npm:quill-next@2.2.6')
  assert.equal(packageJson.dependencies['quill-next'], '2.2.6')
  assert.equal(
    packageJson.overrides['react-quill-new'].quill,
    'npm:quill-next@2.2.6'
  )
  assert.equal(lock.packages['node_modules/quill'].version, '2.2.6')
  assert.match(
    lock.packages['node_modules/quill'].resolved,
    /quill-next-2\.2\.6\.tgz$/
  )
  assert.equal(lock.packages['node_modules/react-quill'], undefined)
  assert.equal(
    lock.packages['node_modules/react-quill-new/node_modules/quill'],
    undefined
  )
})
