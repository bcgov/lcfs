import { CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// GitHub issue lookup schema
export const githubIssueSchema = z.object({
  issue_number: z.number().positive(),
});

export const githubTools: Tool[] = [
  {
    name: "github-issue-lookup",
    description: "Look up GitHub issue details by issue number from the LCFS repository (https://github.com/bcgov/lcfs)",
    inputSchema: {
      type: "object",
      properties: {
        issue_number: {
          type: "number",
          description: "The GitHub issue number to look up",
          minimum: 1,
        },
      },
      required: ["issue_number"],
      additionalProperties: false,
    },
  },
];

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: {
    login: string;
    html_url: string;
  };
  assignees: Array<{
    login: string;
    html_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
    description: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  milestone: {
    title: string;
    html_url: string;
  } | null;
}

interface GitHubError {
  message: string;
  documentation_url?: string;
}

export async function handleGitHubTool(name: string, args: unknown) {
  const request = CallToolRequestSchema.parse({ 
    method: "tools/call", 
    params: { name, arguments: args } 
  });
  
  switch (name) {
    case "github-issue-lookup":
      const lookupArgs = githubIssueSchema.parse(args);
      
      try {
        const response = await fetch(
          `https://api.github.com/repos/bcgov/lcfs/issues/${lookupArgs.issue_number}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'LCFS-MCP-Server/1.0.0',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `❌ Issue #${lookupArgs.issue_number} not found in the LCFS repository.\n\nPlease verify the issue number exists at: https://github.com/bcgov/lcfs/issues/${lookupArgs.issue_number}`,
                },
              ],
            };
          }

          if (response.status === 403) {
            const errorData = await response.json() as GitHubError;
            return {
              content: [
                {
                  type: "text" as const,
                  text: `❌ GitHub API rate limit exceeded or access denied.\n\nError: ${errorData.message}\n\nPlease try again later or check GitHub's rate limiting documentation.`,
                },
              ],
            };
          }

          throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
        }

        const issue = await response.json() as GitHubIssue;

        // Format the issue information
        const assigneesList = issue.assignees.length > 0 
          ? issue.assignees.map(a => `@${a.login}`).join(', ')
          : 'None';

        const labelsList = issue.labels.length > 0
          ? issue.labels.map(l => `${l.name}`).join(', ')
          : 'None';

        const milestoneInfo = issue.milestone 
          ? `${issue.milestone.title} (${issue.milestone.html_url})`
          : 'None';

        const issueBody = issue.body || 'No description provided';

        const statusEmoji = issue.state === 'open' ? '🟢' : '🔴';
        const stateText = issue.state === 'open' ? 'Open' : 'Closed';

        return {
          content: [
            {
              type: "text" as const,
              text: `# ${statusEmoji} Issue #${issue.number}: ${issue.title}

**Status:** ${stateText}
**URL:** ${issue.html_url}
**Author:** @${issue.user.login} (${issue.user.html_url})
**Created:** ${new Date(issue.created_at).toLocaleString()}
**Updated:** ${new Date(issue.updated_at).toLocaleString()}
${issue.closed_at ? `**Closed:** ${new Date(issue.closed_at).toLocaleString()}` : ''}

**Assignees:** ${assigneesList}
**Labels:** ${labelsList}
**Milestone:** ${milestoneInfo}

## Description

${issueBody}

---
*Retrieved from LCFS GitHub repository: https://github.com/bcgov/lcfs*`,
            },
          ],
        };

      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ Error fetching GitHub issue #${lookupArgs.issue_number}

Error: ${error.message}

This could be due to:
- Network connectivity issues
- GitHub API temporary unavailability
- Invalid issue number
- Repository access issues

Please verify the issue number and try again. You can also check the issue manually at:
https://github.com/bcgov/lcfs/issues/${lookupArgs.issue_number}`,
            },
          ],
        };
      }

    default:
      throw new Error(`Unknown GitHub tool: ${name}`);
  }
}