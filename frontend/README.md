# Getting Started with Create React App

## Playwright pilot

The local pilot keeps the Cypress suite available. Playwright includes duplicate native and
Gherkin versions of the public login checks, nine public calculator and
calculation data checks, and two authenticated admin checks. The browser
projects cover Google Chrome, Firefox, and WebKit with parallel workers.

    npm run playwright:install
    npm run playwright:run

`playwright:install` downloads Playwright's Chromium, Firefox, and WebKit
binaries locally. The Chrome project uses the locally installed Google Chrome.
Open the interactive runner with npm run playwright:ui. The HTML, JSON, JUnit,
Cucumber HTML, videos, screenshots, and traces are written under
playwright/reports/ and playwright/artifacts/.

The runner starts Vite on localhost:3000 automatically. Set
PLAYWRIGHT_BASE_URL explicitly to target an already-running app. The existing
Cypress URL setting is not inherited, so the Playwright pilot stays local by
default.

The authenticated admin checks use the configured IDIR test account and the
application's existing Gov BC test identity service. Playwright reads the
existing Cypress credential keys from the ignored `cypress.env.json`, or you
can copy `.env.playwright.example` to `.env` and set
`PLAYWRIGHT_IDIR_TEST_USER` and `PLAYWRIGHT_IDIR_TEST_PASS`. They are skipped
when neither source has credentials. The browser runner and app remain local;
this sign-in path uses the same external test identity integration as the
Cypress login helper.

See [the Cypress config map](playwright/CYPRESS_CONFIG_MAP.md) for how the
existing Cypress settings correspond to Playwright, and
[AI browser examples](playwright/AI_BROWSER.md) for local MCP usage.

On macOS, Firefox gets an isolated local home directory for its browser data.
This works around a Firefox startup issue on macOS 27 without changing the
user's regular Firefox profile.

## Cypress local comparison

Install Cypress and its local WebKit binary with `npm run cypress:install`.
Chrome and Firefox must be installed locally on the machine.

`npm run cypress:run:comparison:chrome`,
`npm run cypress:run:comparison:firefox`, and
`npm run cypress:run:comparison:webkit` run the same public-login Gherkin
scenarios in the selected browser. Cypress runs one browser per invocation;
reports, screenshots, and videos use separate local folders for each browser.
`npm run cypress:open` starts Cypress's interactive runner, where you can
select an installed browser.

The matched benchmark covers the same 11 unique cases in both runners: nine
public calculator/reference-data cases and two authenticated admin cases. Run
the browser pair sequentially with `npm run cypress:run:benchmark:sequential`
and `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:run:benchmark:sequential`.
Playwright also has two-, three-, four-, and six-worker commands; WebKit has its own
documentation-only run. The Playwright benchmark selects native tests so the
duplicate Gherkin definitions are not counted twice. See the
[benchmark results and environment](playwright/BENCHMARK_RESULTS.md) for the
measured timings and worker scaling.

Run the complete normalized benchmark with `npm run benchmark:e2e`. It runs
three trials of each configuration in a rotating order, validates the full
test counts, and saves the raw logs, JSON reports, and timings locally under
`playwright/reports/benchmark-*/`. Use `-- --repetitions=1` for a single trial.
Both runners use the same selected admin credential pair and app URL, fresh
sessions, readiness checks, videos, failure screenshots, and JSON reporting.
The benchmark disables retries and Playwright tracing/additional reporters.

Configure the Cypress and Playwright IDIR credentials before benchmarking
authenticated cases. Cypress does not start the app server, so start the app
at `localhost:3000` before running Cypress. Playwright can use that same
already-running app by setting `PLAYWRIGHT_BASE_URL` as shown above.

Cypress WebKit support is experimental and uses the locally installed
`playwright-webkit` browser package. Cypress can run each browser locally, but
its built-in parallel scheduler requires Cypress Cloud recording. This pilot
does not enable recording or use hosted services. See
[the Cypress config map](playwright/CYPRESS_CONFIG_MAP.md) for details.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
