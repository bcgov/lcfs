import { exec } from 'child_process'
import chokidar from 'chokidar'

// Path to the file or directory you want to watch
const watchedPath = './shared/openapi.json'

// Initialize watcher
const watcher = chokidar.watch(watchedPath, {
  persistent: true
})

// Define the command to run when the file changes
const cliCommand = 'npm run openapi:generate'

// Watch for changes
watcher.on('change', (path) => {
  console.log(`File ${path} has been modified.`)

  // Execute CLI command
  exec(cliCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`)
      return
    }
    if (stderr) {
      console.error(`Command stderr: ${stderr}`)
      return
    }
    console.log(`Command output: ${stdout}`)
  })
})

watcher.on('error', (error) => {
  console.error(`Watcher error: ${error}`)
})
