# Local AI browser examples

Playwright Test and Playwright MCP serve different purposes:

- Playwright Test runs repeatable automated specs and Gherkin scenarios.
- Playwright MCP lets an AI client inspect and operate a live local browser.

The MCP server is a local process and uses a local browser. Install/run it from
the frontend directory:

    npx --yes @playwright/mcp@latest --browser=chromium --user-data-dir=.playwright-mcp

Add the server to an MCP-capable client using its local command configuration:

    {
      "mcpServers": {
        "lcfs-playwright": {
          "command": "npx",
          "args": [
            "--yes",
            "@playwright/mcp@latest",
            "--browser=chromium",
            "--user-data-dir=.playwright-mcp"
          ]
        }
      }
    }

Example requests:

- “Open http://localhost:3000/login, inspect the accessible page snapshot, and tell me which sign-in options are shown. Do not click either sign-in button.”
- “Open http://localhost:3000/organizations in a fresh browser session. Report the final URL and whether the login form is visible. Do not sign in.”
- “Inspect the public login screen and suggest a Gherkin scenario using only user-visible behavior. Do not change the feature file.”

For AI-assisted test authoring, Playwright Test includes planner, generator,
and healer agent definitions. They can explore an application to propose a
test plan, turn a plan into candidate Playwright tests, and investigate failing
tests. Initialize the instructions for a supported coding client with:

    node ./node_modules/playwright/cli.js init-agents --loop=codex

Review generated plans, test code, and repairs before accepting them. Agent
workflows complement the deterministic suite; they do not replace its review
or repeatable pass/fail checks.

The browser server and browser remain local. A remote AI model can still receive
page snapshots, screenshots, and user-provided prompts. Use a locally hosted
AI client/model if all page content must stay on the machine.
