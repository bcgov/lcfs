#!/usr/bin/env python3
"""
Fetch closed GitHub tickets.
Output includes:
- title
- ticket_number
- created_at
- closed_at
- body
- ticket_url
- comments (list of dicts: user, created_at, body)

Exports one of:
- JSON (default): closed_tickets.json
- CSV (if --csv): closed_tickets.csv

Usage:
1. (Optional) Create/activate a Python virtual environment:
     python3 -m venv env
     source env/bin/activate  # On macOS/Linux
     env\Scripts\activate     # On Windows

2. Install dependencies:
     pip install requests

3. Get/Set GITHUB_TOKEN:
   - Go to https://github.com/settings/tokens to create a token.
   - For private repos: 'repo' scope; for public repos: 'public_repo'.
   - export GITHUB_TOKEN="your_token_here" (macOS/Linux)
     or set GITHUB_TOKEN=your_token_here    (Windows)

4. Run the script:
   python3 fetch_closed_tickets.py        # Exports closed_tickets.json
   python3 fetch_closed_tickets.py --csv  # Exports closed_tickets.csv
"""

import os
import sys
import csv
import json
import requests

# Customize for your repo:
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = "bcgov"
REPO_NAME = "lcfs"

PER_PAGE = 100
JSON_FILENAME = "closed_tickets.json"
CSV_FILENAME = "closed_tickets.csv"


def get_comments(session, comments_url):
    """Retrieve all comments for one ticket."""
    all_comments = []
    page = 1
    while True:
        params = {"per_page": PER_PAGE, "page": page}
        resp = session.get(comments_url, params=params)
        if resp.status_code != 200:
            print(f"Error fetching comments: {resp.status_code} {resp.text}")
            break

        data = resp.json()
        if not data:
            break

        for c in data:
            all_comments.append(
                {
                    "user": c.get("user", {}).get("login"),
                    "created_at": c.get("created_at"),
                    "body": c.get("body"),
                }
            )
        page += 1
    return all_comments


def get_closed_tickets(owner, repo, token):
    """
    Fetch closed tickets, filtering out:
      - Pull requests (key 'pull_request'),
      - Bot-created tickets (user.type == 'Bot').

    Returns a list of dicts, each containing:
      title, ticket_number, created_at, closed_at, body, ticket_url, comments.
    """
    base_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    session = requests.Session()
    session.headers.update(
        {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    )

    all_tickets = []
    page = 1

    while True:
        params = {"state": "closed", "per_page": PER_PAGE, "page": page}
        resp = session.get(base_url, params=params)
        if resp.status_code != 200:
            print(f"Error: {resp.status_code}, {resp.text}")
            break

        data = resp.json()
        if not data:
            break

        for item in data:
            # Skip PRs
            if "pull_request" in item:
                continue
            # Skip bot-created
            if item.get("user", {}).get("type") == "Bot":
                continue

            # Retrieve comments
            comments_url = item.get("comments_url")
            comments = get_comments(session, comments_url) if comments_url else []

            # Build minimal record
            ticket_record = {
                "title": item.get("title"),
                "ticket_number": item.get("number"),
                "created_at": item.get("created_at"),
                "closed_at": item.get("closed_at"),
                "body": item.get("body"),
                "ticket_url": item.get("html_url"),
                "comments": comments,
            }
            all_tickets.append(ticket_record)

        page += 1

    return all_tickets


def export_to_json(tickets):
    """
    Export tickets to a single JSON file with all fields.
    """
    with open(JSON_FILENAME, "w", encoding="utf-8") as f:
        json.dump(tickets, f, indent=2)
    print(f"Exported {len(tickets)} tickets to JSON: {JSON_FILENAME}")


def export_to_csv(tickets):
    """
    Export tickets to a single CSV file with all fields.
    """
    fieldnames = [
        "ticket_number",
        "title",
        "created_at",
        "closed_at",
        "body",
        "ticket_url",
        "comments",
    ]
    with open(CSV_FILENAME, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()

        for t in tickets:
            # Convert the comments list to a JSON string to store in one cell
            comments_json = json.dumps(t["comments"], ensure_ascii=False)
            row = {
                "ticket_number": t["ticket_number"],
                "title": t["title"],
                "created_at": t["created_at"],
                "closed_at": t["closed_at"],
                "body": t["body"],
                "ticket_url": t["ticket_url"],
                "comments": comments_json,
            }
            writer.writerow(row)

    print(f"Exported {len(tickets)} tickets to CSV: {CSV_FILENAME}")


def main():
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN not set.")
        print('  export GITHUB_TOKEN="your_token_here"  (macOS/Linux)')
        print("  set GITHUB_TOKEN=your_token_here        (Windows)")
        sys.exit(1)

    tickets_data = get_closed_tickets(REPO_OWNER, REPO_NAME, GITHUB_TOKEN)
    if not tickets_data:
        print("No closed tickets found or an error occurred.")
        sys.exit(0)

    if "--csv" in sys.argv:
        export_to_csv(tickets_data)
    else:
        export_to_json(tickets_data)


if __name__ == "__main__":
    main()
