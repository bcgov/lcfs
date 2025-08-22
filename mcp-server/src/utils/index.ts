import { exec } from "child_process";
import { promisify } from "util";
import Docker from "dockerode";
import { ContainerInfo, DockerStats } from "../types/index.js";

export const execAsync = promisify(exec);

export const docker = new Docker();

export function parseViTestFailures(output: string): string {
  const lines = output.split('\n');
  const failures: string[] = [];
  let isInFailureSection = false;
  let currentFailure: string[] = [];
  
  for (const line of lines) {
    // Check for start of failed tests section
    if (line.includes('Failed Tests') && line.includes('⎯')) {
      isInFailureSection = true;
      continue;
    }
    
    // Check for individual FAIL lines in the detailed section
    if (line.trim().startsWith('FAIL') && (line.includes('.test.') || line.includes('.spec.'))) {
      if (currentFailure.length > 0) {
        failures.push(currentFailure.join('\n').trim());
      }
      currentFailure = [line.trim()];
      continue;
    }
    
    // Capture failure content
    if (isInFailureSection) {
      // Stop at summary section (the line with multiple ⎯ and numbers)
      if (line.match(/⎯+\[\d+\/\d+\]⎯+/) || 
          line.includes('Test Files') || 
          line.includes('Tests ') ||
          line.match(/^\s*\d+\s+(failed|passed)/)) {
        if (currentFailure.length > 0) {
          failures.push(currentFailure.join('\n').trim());
          currentFailure = [];
        }
        isInFailureSection = false;
        continue;
      }
      
      // Skip empty separator lines but capture meaningful content
      if (line.trim() === '' || line.match(/^⎯+$/)) {
        if (currentFailure.length > 0) {
          currentFailure.push(''); // Preserve spacing for readability
        }
        continue;
      }
      
      // Capture all failure information
      if (line.trim()) {
        currentFailure.push(line);
      }
    }
  }
  
  // Add final failure if exists
  if (currentFailure.length > 0) {
    failures.push(currentFailure.join('\n').trim());
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

export function findContainersByNames(containers: ContainerInfo[], names: string[]): ContainerInfo[] {
  return containers.filter(container =>
    names.some(name => 
      container.Names.some(containerName => 
        containerName.includes(name) || 
        normalizeContainerName(containerName) === name
      )
    )
  );
}

// Define LCFS project container patterns
const LCFS_CONTAINER_PATTERNS = [
  /^\/db$/,
  /^\/redis$/,
  /^\/rabbitmq$/,
  /^\/backend$/,
  /^\/frontend$/,
  /^\/lcfs-minio-\d+$/,
  /^\/minio_init$/,
  /^\/lcfs-mcp-server$/,
];

// Container dependency mapping based on docker-compose.yml
const CONTAINER_DEPENDENCIES: Record<string, string[]> = {
  // Infrastructure containers (no dependencies)
  'db': [],
  'redis': [],
  'rabbitmq': [],
  'minio': [],
  
  // MinIO initialization depends on MinIO
  'minio_init': ['minio'],
  
  // Application containers depend on infrastructure
  'backend': ['db', 'redis', 'rabbitmq', 'minio_init'],
  'frontend': [], // Frontend doesn't have strict dependencies on other containers
  'lcfs-mcp-server': ['db', 'redis'],
};

// Reverse dependency mapping (what depends on each container)
const REVERSE_DEPENDENCIES: Record<string, string[]> = {};
Object.entries(CONTAINER_DEPENDENCIES).forEach(([container, deps]) => {
  deps.forEach(dep => {
    if (!REVERSE_DEPENDENCIES[dep]) {
      REVERSE_DEPENDENCIES[dep] = [];
    }
    REVERSE_DEPENDENCIES[dep].push(container);
  });
});

export function isLcfsContainer(containerName: string): boolean {
  return LCFS_CONTAINER_PATTERNS.some(pattern => pattern.test(containerName));
}

export async function discoverLcfsContainers(statusFilter?: 'running' | 'stopped'): Promise<ContainerInfo[]> {
  const stats = await getDockerStats();
  let containers = stats.all;
  
  if (statusFilter === 'running') {
    containers = stats.running;
  } else if (statusFilter === 'stopped') {
    containers = stats.stopped;
  }
  
  return containers.filter(container => 
    container.Names.some(name => isLcfsContainer(name))
  );
}

export function normalizeContainerName(containerName: string): string {
  // Remove leading slash and extract the base service name
  const cleanName = containerName.replace(/^\//, '');
  
  // Handle minio with instance number
  if (cleanName.match(/^lcfs-minio-\d+$/)) {
    return 'minio';
  }
  
  return cleanName;
}

export function getContainerStartOrder(containers: ContainerInfo[]): ContainerInfo[] {
  const visited = new Set<string>();
  const result: ContainerInfo[] = [];
  const containerMap = new Map<string, ContainerInfo>();
  
  // Create a map for easy lookup
  containers.forEach(container => {
    const serviceName = normalizeContainerName(container.Names[0]);
    containerMap.set(serviceName, container);
  });
  
  function visit(serviceName: string) {
    if (visited.has(serviceName)) return;
    visited.add(serviceName);
    
    // Visit dependencies first
    const deps = CONTAINER_DEPENDENCIES[serviceName] || [];
    for (const dep of deps) {
      if (containerMap.has(dep)) {
        visit(dep);
      }
    }
    
    const container = containerMap.get(serviceName);
    if (container) {
      result.push(container);
    }
  }
  
  containers.forEach(container => {
    const serviceName = normalizeContainerName(container.Names[0]);
    visit(serviceName);
  });
  
  return result;
}

export function getContainerStopOrder(containers: ContainerInfo[]): ContainerInfo[] {
  const visited = new Set<string>();
  const result: ContainerInfo[] = [];
  const containerMap = new Map<string, ContainerInfo>();
  
  // Create a map for easy lookup
  containers.forEach(container => {
    const serviceName = normalizeContainerName(container.Names[0]);
    containerMap.set(serviceName, container);
  });
  
  function visit(serviceName: string) {
    if (visited.has(serviceName)) return;
    visited.add(serviceName);
    
    // Visit dependents first
    const dependents = REVERSE_DEPENDENCIES[serviceName] || [];
    for (const dependent of dependents) {
      if (containerMap.has(dependent)) {
        visit(dependent);
      }
    }
    
    const container = containerMap.get(serviceName);
    if (container) {
      result.push(container);
    }
  }
  
  containers.forEach(container => {
    const serviceName = normalizeContainerName(container.Names[0]);
    visit(serviceName);
  });
  
  return result;
}

export async function performContainerAction(containers: ContainerInfo[], action: 'start' | 'stop' | 'restart'): Promise<string[]> {
  const results: string[] = [];
  
  // Order containers based on action
  let orderedContainers: ContainerInfo[];
  if (action === 'start') {
    orderedContainers = getContainerStartOrder(containers);
  } else if (action === 'stop') {
    orderedContainers = getContainerStopOrder(containers);
  } else {
    // For restart, stop in reverse order, then start in forward order
    orderedContainers = containers;
  }
  
  for (const container of orderedContainers) {
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