import { exec } from "child_process";
import { promisify } from "util";
import Docker from "dockerode";
import { ContainerInfo, DockerStats } from "../types/index.js";

export const execAsync = promisify(exec);

export const docker = new Docker();

export function parseViTestFailures(output: string): string {
  const lines = output.split('\n');
  let isInFailureSection = false;
  let currentTest = '';
  const failures: string[] = [];
  let captureError = false;
  let errorLines: string[] = [];

  for (const line of lines) {
    if (line.includes('FAIL') && (line.includes('.test.') || line.includes('.spec.'))) {
      isInFailureSection = true;
      continue;
    }

    if (isInFailureSection) {
      if (line.match(/^\s*✓/) || line.match(/^\s*×/) || line.match(/^\s*✗/)) {
        if (line.match(/^\s*✓/)) {
          continue;
        }
        
        if (line.match(/^\s*×/) || line.match(/^\s*✗/)) {
          currentTest = line.trim();
          captureError = true;
          errorLines = [];
          continue;
        }
      }

      if (captureError && line.trim().startsWith('AssertionError:') || 
          line.trim().startsWith('Error:') || 
          line.trim().startsWith('Expected:') ||
          line.trim().startsWith('Received:') ||
          line.trim().includes('toEqual') ||
          line.trim().includes('toBe')) {
        errorLines.push(line.trim());
      }

      if (captureError && line.trim() === '' && errorLines.length > 0) {
        failures.push(`${currentTest}\n${errorLines.join('\n')}`);
        captureError = false;
        currentTest = '';
        errorLines = [];
      }

      if (line.includes('Test Files') || line.includes('Tests ') || line.match(/^\s*\d+\s+(passed|failed)/)) {
        isInFailureSection = false;
      }
    }
  }

  if (captureError && errorLines.length > 0) {
    failures.push(`${currentTest}\n${errorLines.join('\n')}`);
  }

  return failures.length > 0 ? failures.join('\n\n') : 'All tests passed!';
}

export function parsePytestFailures(output: string): string {
  const lines = output.split('\n');
  const failures: string[] = [];
  let isInFailureSection = false;
  let currentFailure: string[] = [];

  for (const line of lines) {
    if (line.includes('FAILURES') || line.includes('FAILED')) {
      isInFailureSection = true;
      if (line.startsWith('FAILED ')) {
        if (currentFailure.length > 0) {
          failures.push(currentFailure.join('\n').trim());
          currentFailure = [];
        }
        currentFailure.push(line);
      }
      continue;
    }

    if (isInFailureSection) {
      if (line.startsWith('=') && (line.includes('short test summary') || line.includes('FAILED'))) {
        if (currentFailure.length > 0) {
          failures.push(currentFailure.join('\n').trim());
          currentFailure = [];
        }
        if (line.includes('FAILED')) {
          currentFailure.push(line);
        }
        continue;
      }

      if (line.startsWith('FAILED ')) {
        if (currentFailure.length > 0) {
          failures.push(currentFailure.join('\n').trim());
          currentFailure = [];
        }
        currentFailure.push(line);
        continue;
      }

      if (line.trim() && !line.startsWith('=')) {
        currentFailure.push(line);
      }

      if (line.startsWith('=') && line.includes('test summary')) {
        break;
      }
    }
  }

  if (currentFailure.length > 0) {
    failures.push(currentFailure.join('\n').trim());
  }

  return failures.length > 0 ? failures.join('\n\n') : 'All tests passed!';
}

export async function getDockerStats(): Promise<DockerStats> {
  const containers = await docker.listContainers({ all: true });
  
  const running: ContainerInfo[] = [];
  const stopped: ContainerInfo[] = [];
  
  for (const container of containers) {
    const info: ContainerInfo = {
      Id: container.Id,
      Names: container.Names,
      State: container.State,
      Status: container.Status,
    };
    
    if (container.State === 'running') {
      running.push(info);
    } else {
      stopped.push(info);
    }
  }
  
  return {
    running,
    stopped,
    all: [...running, ...stopped],
  };
}

export function findContainersByFilter(containers: ContainerInfo[], filter: string): ContainerInfo[] {
  const normalizedFilter = filter.toLowerCase();
  return containers.filter(container =>
    container.Names.some(name => 
      name.toLowerCase().includes(normalizedFilter)
    )
  );
}

export async function performContainerAction(containers: ContainerInfo[], action: 'start' | 'stop' | 'restart'): Promise<string[]> {
  const results: string[] = [];
  
  for (const container of containers) {
    try {
      const dockerContainer = docker.getContainer(container.Id);
      
      switch (action) {
        case 'start':
          await dockerContainer.start();
          break;
        case 'stop':
          await dockerContainer.stop();
          break;
        case 'restart':
          await dockerContainer.restart();
          break;
      }
      
      results.push(`✓ ${action}ed ${container.Names[0]}`);
    } catch (error: any) {
      results.push(`✗ Failed to ${action} ${container.Names[0]}: ${error.message}`);
    }
  }
  
  return results;
}