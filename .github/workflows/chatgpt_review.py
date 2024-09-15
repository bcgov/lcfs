import os
from openai import OpenAI
client = OpenAI()
from github import Github

# Set up OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Set up GitHub API
g = Github(os.getenv("GITHUB_TOKEN"))
repo = g.get_repo(os.getenv("GITHUB_REPOSITORY"))
# Get the pull request number from environment variable
pr_number = os.getenv("PR_NUMBER")
if not pr_number:
    raise ValueError("PR_NUMBER environment variable is not set.")
pr = repo.get_pull(int(pr_number))

# Initialize variables
diff = ""
changed_dirs = set()

# Get the diff and determine changed directories
for file in pr.get_files():
    if file.patch:
        diff += f"File: {file.filename}\n"
        diff += file.patch + "\n\n"

        # Determine if the file is in frontend or backend
        if file.filename.startswith('frontend/'):
            changed_dirs.add('frontend')
        elif file.filename.startswith('backend/'):
            changed_dirs.add('backend')

# Read configuration files based on changed directories
configurations = ""

if 'frontend' in changed_dirs:
    # Read ESLint configuration
    eslint_path = os.path.join('frontend', '.eslintrc')
    if os.path.exists(eslint_path):
        with open(eslint_path, 'r') as f:
            eslint_config = f.read()
        configurations += f"ESLint Configuration (.eslintrc):\n{eslint_config}\n\n"
    else:
        configurations += "No ESLint configuration file found.\n\n"

    # Read Prettier configuration
    prettier_path = os.path.join('frontend', '.prettierrc')
    if os.path.exists(prettier_path):
        with open(prettier_path, 'r') as f:
            prettier_config = f.read()
        configurations += f"Prettier Configuration (.prettierrc):\n{prettier_config}\n\n"
    else:
        configurations += "No Prettier configuration file found.\n\n"

if 'backend' in changed_dirs:
    # Read Flake8 configuration
    flake8_path = os.path.join('backend', '.flake8')
    if os.path.exists(flake8_path):
        with open(flake8_path, 'r') as f:
            flake8_config = f.read()
        configurations += f"Flake8 Configuration (.flake8):\n{flake8_config}\n\n"
    else:
        configurations += "No Flake8 configuration file found.\n\n"

# Prepare the prompt
prompt = f"""
You are an AI code reviewer. Please review the following code changes and provide feedback, focusing on potential issues, bugs, code style, and best practices.

Before providing feedback, please refer to the project's configuration files to understand the code style and linting rules that should be followed.

Project Configuration Files:
{configurations}

Code Changes:
{diff}
"""

# Handle token limits
max_prompt_tokens = 3500  # Adjust based on the model's context length
prompt = prompt[:max_prompt_tokens]

# Call OpenAI API
response = client.chat_completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": prompt}],
    max_tokens=500,
    n=1,
    temperature=0.5,
)

feedback = response.choices[0].message['content'].strip()

# Post feedback as a comment on the PR
pr.create_issue_comment(f"## ChatGPT Code Review Feedback\n\n{feedback}")
