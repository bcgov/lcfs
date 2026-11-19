import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeScriptPath = require.resolve('axe-core/axe.min.js')

export const runAccessibilityAudit = async (page, options, contextSelector) => {
  await page.addScriptTag({ path: axeScriptPath })
  return page.evaluate(
    async (runOptions) => {
      const context = runOptions.contextSelector
        ? document.querySelector(runOptions.contextSelector)
        : document
      if (!context) {
        throw new Error(
          'Accessibility audit context was not found: ' +
            runOptions.contextSelector
        )
      }
      return window.axe.run(context, runOptions.options)
    },
    { options, contextSelector }
  )
}

export const logAccessibilityViolations = (violations, tasks) => {
  const count = violations.length
  tasks.log(
    count +
      ' accessibility violation' +
      (count === 1 ? '' : 's') +
      ' ' +
      (count === 1 ? 'was' : 'were') +
      ' detected'
  )
  tasks.table(
    violations.map(({ id, impact, description, nodes }) => ({
      id,
      impact,
      description,
      nodes: nodes.length
    }))
  )
}
