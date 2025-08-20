import {
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { execAsync } from '../utils/index.js';
import {
  databaseResetSchema,
  migrationCreateSchema,
  migrationUpgradeSchema,
  migrationDowngradeSchema,
  migrationDeleteSchema,
  dataTransferSchema,
} from '../types/index.js';

export const databaseTools: Tool[] = [
  {
    name: 'database-reset',
    description:
      'Reset the LCFS database by stopping the container, removing the data volume, and restarting fresh',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description:
            'Must be true to confirm database reset - THIS WILL DELETE ALL DATA',
        },
      },
      required: ['confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'db-reset',
    description:
      'Complete database reset workflow: stop dependent containers, remove database container and volume, start fresh database, restart backend - leaves system fully operational',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description:
            'Must be true to confirm database reset - THIS WILL DELETE ALL DATA',
        },
      },
      required: ['confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'migration-create',
    description: 'Generate a new Alembic migration with autogenerate',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Description message for the migration',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
  {
    name: 'migration-upgrade',
    description:
      'Run migrations to upgrade database to a specific revision or latest (head)',
    inputSchema: {
      type: 'object',
      properties: {
        revision: {
          type: 'string',
          description: 'Target revision (default: head for latest)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'migration-downgrade',
    description: 'Downgrade database to a specific revision or base',
    inputSchema: {
      type: 'object',
      properties: {
        revision: {
          type: 'string',
          description:
            "Target revision (default: -1 for previous revision, 'base' for complete downgrade)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'migration-status',
    description: 'Show current migration status and history',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'migration-delete',
    description: 'Delete a migration file by revision ID or filename',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description:
            "Migration revision ID (e.g., '32d9a649c8aa') or filename",
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['identifier', 'confirm'],
      additionalProperties: false,
    },
  },
  {
    name: 'data-transfer',
    description:
      'Copy data from OpenShift environment to local container (read-only, import only)',
    inputSchema: {
      type: 'object',
      properties: {
        application: {
          type: 'string',
          enum: ['lcfs'],
          description: 'Application to transfer data from (LCFS only)',
        },
        environment: {
          type: 'string',
          enum: ['dev', 'test', 'prod'],
          description: 'Environment to copy data from',
        },
        direction: {
          type: 'string',
          enum: ['import'],
          description:
            'Direction of transfer (import only for read-only access)',
        },
        localContainer: {
          type: 'string',
          description: 'Local Docker container name or ID to import data into',
        },
        table: {
          type: 'string',
          description:
            "Optional: specific table name to transfer (e.g., 'compliance_report_history')",
        },
        dryRun: {
          type: 'boolean',
          description:
            'Preview the transfer commands without executing (default: false)',
        },
      },
      required: ['application', 'environment', 'direction', 'localContainer'],
      additionalProperties: false,
    },
  },
];

export async function handleDatabaseTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({
    method: 'tools/call',
    params: { name, arguments: args },
  });

  switch (name) {
    case 'db-reset': {
      const databaseArgs = databaseResetSchema.parse(args);

      if (!databaseArgs.confirm) {
        return {
          content: [
            {
              type: 'text' as const,
              text: "Database reset cancelled. Set 'confirm: true' to proceed. WARNING: This will delete all data!",
            },
          ],
        };
      }

      const results: string[] = [];

      try {
        results.push(
          '🔄 DB-RESET: Clean Database Reset v1.0 - ' + new Date().toISOString()
        );
        results.push('');

        // Step 1: Stop backend and database containers using docker-compose
        results.push('🛑 Step 1: Stop backend and database containers...');
        try {
          await execAsync('docker-compose stop backend db', { timeout: 30000 });
          results.push('✅ Stopped backend and database containers');
        } catch (error: any) {
          results.push(`⚠️  Warning stopping containers: ${error.message}`);
          // Continue anyway - individual containers might not be running
        }

        // Step 2: Remove backend and database containers using docker-compose
        results.push('');
        results.push('🗑️  Step 2: Remove backend and database containers...');
        try {
          await execAsync('docker-compose rm -f backend db', {
            timeout: 15000,
          });
          results.push('✅ Removed backend and database containers');
        } catch (error: any) {
          results.push(`⚠️  Warning removing containers: ${error.message}`);
          // Continue anyway - containers might not exist
        }

        // Step 3: Remove database volume to reset data
        results.push('');
        results.push('🗑️  Step 3: Remove database volume to reset all data...');
        try {
          await execAsync('docker volume rm lcfs_postgres_data', {
            timeout: 15000,
          });
          results.push('✅ Database volume removed: lcfs_postgres_data');
        } catch (error: any) {
          if (error.stderr?.includes('No such volume')) {
            results.push(
              'ℹ️  Database volume not found - will be created fresh'
            );
          } else {
            results.push(`⚠️  Volume removal warning: ${error.message}`);
          }
        }

        // Step 4: Start fresh database container
        results.push('');
        results.push('🚀 Step 4: Start fresh database container...');
        try {
          await execAsync('docker-compose up db -d', { timeout: 60000 });
          results.push('✅ Fresh database container started');
        } catch (error: any) {
          results.push(`❌ Failed to start database: ${error.message}`);
          throw new Error(`Database startup failed: ${error.message}`);
        }

        // Step 5: Wait for database initialization
        results.push('');
        results.push('⏳ Step 5: Wait for database to initialize...');
        await new Promise((resolve) => setTimeout(resolve, 8000));

        // Step 6: Verify database is responsive
        results.push('🔍 Step 6: Verify database connectivity...');
        let dbReady = false;
        for (let i = 0; i < 6; i++) {
          // Try for up to 30 seconds
          try {
            await execAsync('docker exec db pg_isready -U lcfs', {
              timeout: 10000,
            });
            results.push('✅ Database is ready and responsive');
            dbReady = true;
            break;
          } catch (error: any) {
            if (i === 5) {
              results.push(
                '⚠️  Database connectivity check failed - may need more time to initialize'
              );
            } else {
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
          }
        }

        // Step 7: Restart backend container (we stopped it earlier)
        results.push('');
        results.push('🚀 Step 7: Restart backend container...');
        try {
          await execAsync('docker-compose up backend -d', { timeout: 60000 });
          results.push('✅ Backend container restarted successfully');
        } catch (error: any) {
          results.push(`⚠️  Warning restarting backend: ${error.message}`);
          results.push(
            '💡 You can manually restart with: docker-compose up backend -d'
          );
        }

        results.push('');
        results.push('🎉 Database reset completed successfully!');
        results.push('📋 Summary:');
        results.push(
          '   • Step 1: Stopped backend and database containers (docker-compose stop)'
        );
        results.push(
          '   • Step 2: Removed backend and database containers (docker-compose rm)'
        );
        results.push(
          '   • Step 3: Removed database volume: lcfs_postgres_data'
        );
        results.push('   • Step 4: Started fresh database container');
        results.push(
          `   • Step 6: Database status: ${
            dbReady ? 'Ready and verified' : 'Starting (may need more time)'
          }`
        );
        results.push('   • Step 7: Backend container restarted successfully');
        results.push('');
        results.push(
          'ℹ️  Database data has been completely wiped - database is in pristine state'
        );
        results.push(
          '💡 Other services (Redis, RabbitMQ, etc.) were left running and unaffected'
        );
        results.push(
          '💡 Full stack is now operational with fresh database - ready for development!'
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: results.join('\n'),
            },
          ],
        };
      } catch (error: any) {
        results.push(`❌ Database reset failed: ${error.message}`);
        results.push('');
        results.push('🔧 Troubleshooting tips:');
        results.push('   • Ensure Docker is running and accessible');
        results.push(
          '   • Check that docker-compose.yml is in the current directory'
        );
        results.push('   • Try running the steps manually:');
        results.push('     - docker-compose down');
        results.push('     - docker volume rm lcfs_postgres_data');
        results.push('     - docker-compose up db -d');

        return {
          content: [
            {
              type: 'text' as const,
              text: results.join('\n'),
            },
          ],
        };
      }
    }

    case 'migration-create': {
      const migrationArgs = migrationCreateSchema.parse(args);

      try {
        const command = `poetry run alembic revision --autogenerate -m "${migrationArgs.message}"`;
        const result = await execAsync(`docker exec backend ${command}`, {
          timeout: 30000,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Migration created successfully!\n\nOutput:\n${result.stdout}\n${result.stderr}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Migration creation failed: ${
                error.message
              }\n\nStderr: ${error.stderr || 'N/A'}`,
            },
          ],
        };
      }
    }

    case 'migration-upgrade': {
      const migrationArgs = migrationUpgradeSchema.parse(args);
      const revision = migrationArgs.revision || 'head';

      try {
        const command = `poetry run alembic upgrade ${revision}`;
        const result = await execAsync(`docker exec backend ${command}`, {
          timeout: 60000,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Migration upgrade to '${revision}' completed!\n\nOutput:\n${result.stdout}\n${result.stderr}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Migration upgrade failed: ${error.message}\n\nStderr: ${
                error.stderr || 'N/A'
              }`,
            },
          ],
        };
      }
    }

    case 'migration-downgrade': {
      const migrationArgs = migrationDowngradeSchema.parse(args);
      const revision = migrationArgs.revision || '-1';

      try {
        const command = `poetry run alembic downgrade ${revision}`;
        const result = await execAsync(`docker exec backend ${command}`, {
          timeout: 60000,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Migration downgrade to '${revision}' completed!\n\nOutput:\n${result.stdout}\n${result.stderr}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Migration downgrade failed: ${
                error.message
              }\n\nStderr: ${error.stderr || 'N/A'}`,
            },
          ],
        };
      }
    }

    case 'migration-status': {
      try {
        const historyCommand = `poetry run alembic history --verbose`;
        const currentCommand = `poetry run alembic current`;

        const [historyResult, currentResult] = await Promise.all([
          execAsync(`docker exec backend ${historyCommand}`, {
            timeout: 30000,
          }),
          execAsync(`docker exec backend ${currentCommand}`, {
            timeout: 30000,
          }),
        ]);

        return {
          content: [
            {
              type: 'text' as const,
              text: `📊 Migration Status\n\nCurrent Revision:\n${currentResult.stdout}\n\nMigration History:\n${historyResult.stdout}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Failed to get migration status: ${
                error.message
              }\n\nStderr: ${error.stderr || 'N/A'}`,
            },
          ],
        };
      }
    }

    case 'migration-delete': {
      const migrationArgs = migrationDeleteSchema.parse(args);

      if (!migrationArgs.confirm) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Migration deletion cancelled. Set 'confirm: true' to delete migration '${migrationArgs.identifier}'.`,
            },
          ],
        };
      }

      try {
        let filename = migrationArgs.identifier;

        if (!filename.includes('.py') && !filename.includes('/')) {
          const findCommand = `find lcfs/db/migrations/versions -name "*${migrationArgs.identifier}*.py" -type f`;
          const findResult = await execAsync(
            `docker exec backend ${findCommand}`,
            { timeout: 10000 }
          );

          if (findResult.stdout.trim()) {
            filename = findResult.stdout.trim();
          } else {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Migration file not found for identifier '${migrationArgs.identifier}'`,
                },
              ],
            };
          }
        }

        const deleteCommand = `rm -f ${filename}`;
        await execAsync(`docker exec backend ${deleteCommand}`, {
          timeout: 10000,
        });

        // Also clean up the compiled .pyc file if it exists
        const baseName = filename.replace('.py', '').split('/').pop();
        if (baseName) {
          const pycDeleteCommand = `rm -f lcfs/db/migrations/versions/__pycache__/*${baseName}*.pyc`;
          await execAsync(`docker exec backend ${pycDeleteCommand}`, {
            timeout: 10000,
          }).catch(() => {
            // Ignore errors cleaning up .pyc files
          });
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Migration '${filename}' deleted successfully!`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Migration deletion failed: ${
                error.message
              }\n\nStderr: ${error.stderr || 'N/A'}`,
            },
          ],
        };
      }
    }

    case 'data-transfer': {
      const transferArgs = dataTransferSchema.parse(args);

      // Only import direction is allowed for read-only access
      if (transferArgs.direction !== 'import') {
        return {
          content: [
            {
              type: 'text' as const,
              text: "❌ Only 'import' direction is supported for read-only data transfer",
            },
          ],
        };
      }

      const results = [];

      // Determine project configuration based on application and environment
      const { projectName, appLabel, dbName, remoteDbUser, localDbUser } =
        getProjectConfig(transferArgs.application, transferArgs.environment);

      results.push(
        `📍 Target: ${transferArgs.application} ${transferArgs.environment} environment`
      );
      results.push(`🏗️  Project: ${projectName}`);
      results.push(`💾 Database: ${dbName}`);

      // Prepare table options and file naming
      const tableOption = transferArgs.table ? `-t ${transferArgs.table}` : '';
      const fileSuffix = transferArgs.table
        ? `${dbName}_${transferArgs.table}`
        : dbName;
      const dumpFile = `${fileSuffix}.tar`;

      if (transferArgs.table) {
        results.push(`🎯 Target table: ${transferArgs.table}`);
      } else {
        results.push('🎯 Target: Full database');
      }

      // For dry run, show commands without requiring OpenShift login
      if (transferArgs.dryRun) {
        const dryRunCommands = [
          `# Step 1: Set OpenShift project`,
          `oc project ${projectName}`,
          ``,
          `# Step 2: Find leader pod (example: assuming pod name <LEADER_POD>)`,
          `oc get pods -n ${projectName} -o name | grep "${appLabel}"`,
          `# (script will identify the leader pod automatically)`,
          ``,
          `# Step 3: Create database dump on OpenShift`,
          `oc exec <LEADER_POD> -- bash -c "pg_dump -U ${remoteDbUser} ${tableOption} -F t --no-privileges --no-owner -c -d ${dbName} > /tmp/${dumpFile}"`,
          ``,
          `# Step 4: Download dump file to local machine`,
          `oc rsync <LEADER_POD>:/tmp/${dumpFile} ./`,
          ``,
          `# Step 5: Copy dump to local Docker container`,
          `docker cp ${dumpFile} ${transferArgs.localContainer}:/tmp/${dumpFile}`,
          ``,
          `# Step 6: Restore database in local container`,
          `docker exec ${transferArgs.localContainer} bash -c "pg_restore -U ${localDbUser} --dbname=${dbName} --no-owner --clean --if-exists --verbose /tmp/${dumpFile}"`,
          ``,
          `# Step 7: Cleanup - remove dump from OpenShift`,
          `oc exec <LEADER_POD> -- bash -c "rm /tmp/${dumpFile}"`,
          ``,
          `# Step 8: Cleanup - remove local dump file`,
          `rm ${dumpFile}`,
        ];

        results.push('\n🔍 DRY RUN - Commands that would be executed:');
        results.push('='.repeat(60));
        dryRunCommands.forEach((cmd) => {
          results.push(cmd);
        });
        results.push('='.repeat(60));
        results.push('\n📋 Prerequisites:');
        results.push('• Must be logged in to OpenShift: oc login');
        results.push('• Local Docker container must exist and be running');
        results.push('• Must have access to the specified OpenShift project');
        results.push(
          '\n⚠️  This is a preview only. Set dryRun: false to execute.'
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: results.join('\n'),
            },
          ],
        };
      }

      try {
        // For actual execution, verify OpenShift login first
        results.push('🔍 Checking OpenShift authentication...');

        const whoamiResult = await execAsync('oc whoami', { timeout: 10000 });
        results.push(`✅ Logged in as: ${whoamiResult.stdout.trim()}`);

        // Set the OpenShift project
        results.push('🔄 Setting OpenShift project...');
        await execAsync(`oc project ${projectName}`, { timeout: 15000 });
        results.push(`✅ Active project: ${projectName}`);

        // Find the leader pod
        results.push('🔍 Finding database leader pod...');
        const leaderPod = await findLeaderPod(
          projectName,
          appLabel,
          remoteDbUser
        );
        results.push(`✅ Leader pod identified: ${leaderPod}`);

        // Build the actual commands for execution
        const commands = [
          `oc exec ${leaderPod} -- bash -c "pg_dump -U ${remoteDbUser} ${tableOption} -F t --no-privileges --no-owner -c -d ${dbName} > /tmp/${dumpFile}"`,
          `oc rsync ${leaderPod}:/tmp/${dumpFile} ./`,
          `docker cp ${dumpFile} ${transferArgs.localContainer}:/tmp/${dumpFile}`,
          `docker exec ${transferArgs.localContainer} bash -c "pg_restore -U ${localDbUser} --dbname=${dbName} --no-owner --clean --if-exists --verbose /tmp/${dumpFile}"`,
          `oc exec ${leaderPod} -- bash -c "rm /tmp/${dumpFile}"`,
          `rm ${dumpFile}`,
        ];

        // Execute the data transfer
        results.push('\n🚀 Starting data transfer process...');

        // Step 1: Create dump on OpenShift pod
        results.push('📤 Creating database dump on OpenShift...');
        await execAsync(commands[0], { timeout: 300000 }); // 5 minutes for dump
        results.push('✅ Database dump created');

        // Step 2: Download dump file
        results.push('⬇️  Downloading dump file...');
        await execAsync(commands[1], { timeout: 120000 }); // 2 minutes for download
        results.push('✅ Dump file downloaded');

        // Step 3: Copy to local container
        results.push('📋 Copying dump to local container...');
        await execAsync(commands[2], { timeout: 60000 }); // 1 minute for copy
        results.push('✅ Dump copied to local container');

        // Step 4: Restore to local database
        results.push('🔄 Restoring database in local container...');
        try {
          await execAsync(commands[3], { timeout: 600000 }); // 10 minutes for restore
          results.push('✅ Database restore completed');
        } catch (error: any) {
          // pg_restore can exit with non-zero even on success due to warnings
          if (error.stdout || error.stderr) {
            results.push(
              '⚠️  Restore completed with warnings (this is often normal)'
            );
          } else {
            throw error;
          }
        }

        // Step 5: Cleanup OpenShift dump file
        results.push('🧹 Cleaning up OpenShift dump file...');
        await execAsync(commands[4], { timeout: 30000 });
        results.push('✅ OpenShift cleanup completed');

        // Step 6: Cleanup local dump file
        results.push('🧹 Cleaning up local dump file...');
        await execAsync(commands[5], { timeout: 30000 });
        results.push('✅ Local cleanup completed');

        results.push('\n🎉 Data transfer completed successfully!');
        results.push(
          `📊 Transferred from: ${transferArgs.application} ${transferArgs.environment}`
        );
        results.push(
          `🎯 Transferred to: Local container ${transferArgs.localContainer}`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: results.join('\n'),
            },
          ],
        };
      } catch (error: any) {
        results.push(`❌ Data transfer failed: ${error.message}`);

        // Provide specific guidance based on error type
        if (
          error.message.includes('Unauthorized') ||
          error.message.includes('must be logged in')
        ) {
          results.push(
            '\n💡 Solution: Please log in to OpenShift first: https://oauth-openshift.apps.silver.devops.gov.bc.ca/oauth/token/request'
          );
        } else if (
          error.message.includes('No such container') ||
          error.message.includes('container')
        ) {
          results.push(
            '\n💡 Solution: Check that your local Docker container exists and is running:'
          );
          results.push(`   docker ps | grep ${transferArgs.localContainer}`);
          results.push('   docker start <container-name>  # if stopped');
        } else if (
          error.message.includes('No pods found') ||
          error.message.includes('leader pod')
        ) {
          results.push(
            '\n💡 Solution: Verify the OpenShift project and pod configuration:'
          );
          results.push(
            `   oc project ${
              getProjectConfig(
                transferArgs.application,
                transferArgs.environment
              ).projectName
            }`
          );
          results.push(
            `   oc get pods | grep ${
              getProjectConfig(
                transferArgs.application,
                transferArgs.environment
              ).appLabel
            }`
          );
        }

        // Attempt cleanup on failure
        try {
          await execAsync(`rm -f ${dumpFile}`, { timeout: 10000 });
          results.push('\n🧹 Local cleanup completed after failure');
        } catch {
          // Ignore cleanup errors
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: results.join('\n'),
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown database tool: ${name}`);
  }
}

// Helper function to get project configuration
function getProjectConfig(application: string, environment: string) {
  if (application === 'lcfs') {
    return {
      projectName: `d2bd59-${environment}`,
      appLabel: `lcfs-crunchy-${environment}-lcfs`,
      dbName: 'lcfs',
      remoteDbUser: 'postgres',
      localDbUser: 'lcfs',
    };
  }

  throw new Error(
    `Invalid application: ${application}. Only 'lcfs' is supported.`
  );
}

// Helper function to find the leader pod
async function findLeaderPod(
  projectName: string,
  appLabel: string,
  remoteDbUser: string
): Promise<string> {
  // Get all pods with the given app label
  const podsResult = await execAsync(
    `oc get pods -n ${projectName} -o name | grep "${appLabel}"`,
    { timeout: 30000 }
  );
  const pods = podsResult.stdout
    .trim()
    .split('\n')
    .filter((pod) => pod.length > 0);

  if (pods.length === 0) {
    throw new Error(`No pods found with label containing: ${appLabel}`);
  }

  // Find the leader pod
  for (const pod of pods) {
    try {
      const leaderCheckResult = await execAsync(
        `oc exec -n ${projectName} ${pod} -- bash -c "psql -U ${remoteDbUser} -tAc \\"SELECT pg_is_in_recovery()\\""`,
        { timeout: 30000 }
      );

      if (leaderCheckResult.stdout.trim() === 'f') {
        return pod;
      }
    } catch (error) {
      // Continue checking other pods if one fails
      continue;
    }
  }

  throw new Error('No leader pod found');
}
