#!/usr/bin/env node
/**
 * build-release-notes.mjs
 *
 * Parses GitHub-generated release notes markdown and merges a new entry
 * into frontend/public/release-notes.json. Zero external dependencies.
 *
 * Usage:
 *   node scripts/build-release-notes.mjs \
 *     --tag         "1.0.0-20260612120000"  \
 *     --display-version "1.0.0"             \
 *     --native-notes   /tmp/native-notes.md  \
 *     --enhanced-notes /tmp/enhanced-notes.md
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Resolve output path relative to this script's location
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../frontend/public/release-notes.json");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const getArg = (name) => {
  const idx = argv.indexOf(name);
  return idx !== -1 ? (argv[idx + 1] ?? null) : null;
};

const tag = getArg("--tag");
const displayVersion = getArg("--display-version") ?? tag;
const nativeNotesPath = getArg("--native-notes");
const enhancedNotesPath = getArg("--enhanced-notes");

if (!tag || !nativeNotesPath || !enhancedNotesPath) {
  console.error(
    "Usage: build-release-notes.mjs --tag <tag> [--display-version <ver>]" +
      " --native-notes <path> --enhanced-notes <path>",
  );
  process.exit(1);
}

const nativeMarkdown = readFileSync(nativeNotesPath, "utf8");
const enhancedMarkdown = readFileSync(enhancedNotesPath, "utf8");

// ---------------------------------------------------------------------------
// Markdown parser
//
// Parses the structured output of GitHub's generateReleaseNotes API
// (optionally configured via .github/release.yml) into typed sections.
// ---------------------------------------------------------------------------

/** Map normalised section headings → JSON key */
const HEADING_TO_KEY = {
  // Emoji variants from .github/release.yml
  "new features": "features",
  "bug fixes": "fixes",
  security: "security",
  "breaking changes": "breaking",
  dependencies: "dependencies",
  // Fallback — raw GitHub output without release.yml categories
  "what's changed": "other",
  "other changes": "other",
  other: "other",
};

/** Strip emoji codepoints and common punctuation to normalise a heading */
const normaliseHeading = (raw) =>
  raw
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/[^\w\s']/g, "")
    .toLowerCase()
    .trim();

/** Strip conventional commit prefixes (feat:, fix:, chore:, …) */
const stripConventionalPrefix = (text) =>
  text.replace(
    /^(feat|fix|chore|docs|style|refactor|test|perf|ci|build|sec)(!?\(.+?\))?!?:\s*/i,
    "",
  );

/** Strip the "by @user in #NNN" or "by @user in https://…/pull/NNN" suffix */
const stripGitHubSuffix = (text) =>
  text
    .replace(/\s+by\s+@[\w-]+\s+in\s+(?:https?:\/\/[^\s]+|#\d+)/gi, "")
    .trim();

/**
 * Parse GitHub-generated release notes markdown into a structured object.
 * Returns { sections, contributors, fullChangelogUrl }.
 */
function parseNativeNotes(markdown) {
  const sections = {
    features: [],
    fixes: [],
    security: [],
    breaking: [],
    dependencies: [],
    other: [],
  };
  const contributors = [];
  let fullChangelogUrl = "";
  let currentKey = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Section heading (## or ###) ─────────────────────────────────────────
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      const normalised = normaliseHeading(headingMatch[1]);
      if (normalised.includes("contributor")) {
        currentKey = "__contributors__";
      } else {
        const matchedKey = Object.keys(HEADING_TO_KEY).find((k) =>
          normalised.includes(k),
        );
        currentKey = matchedKey ? HEADING_TO_KEY[matchedKey] : "other";
      }
      continue;
    }

    // ── List item (*, -, •) ──────────────────────────────────────────────────
    if (/^[*\-•]\s/.test(line) && currentKey) {
      const rawText = line.replace(/^[*\-•]\s+/, "");

      if (currentKey === "__contributors__") {
        const match = rawText.match(/@([\w-]+)/);
        if (match) contributors.push(`@${match[1]}`);
        continue;
      }

      const cleaned = stripConventionalPrefix(stripGitHubSuffix(rawText));
      if (cleaned) {
        // If we're in the catch-all "other" section, try to infer category
        // from a conventional-commit prefix still present before stripping
        let targetKey = currentKey;
        if (currentKey === "other") {
          const lower = rawText.toLowerCase();
          if (/^feat[(!:]/.test(lower)) targetKey = "features";
          else if (/^fix[(!:]/.test(lower)) targetKey = "fixes";
          else if (/^sec[(!:]|security/.test(lower)) targetKey = "security";
          else if (/^break|breaking/.test(lower)) targetKey = "breaking";
        }
        sections[targetKey].push(cleaned);
      }
      continue;
    }

    // ── Full Changelog link ──────────────────────────────────────────────────
    const changelogMatch = line.match(
      /\*\*Full Changelog\*\*:\s*(https?:\/\/\S+)/,
    );
    if (changelogMatch) {
      fullChangelogUrl = changelogMatch[1];
    }
  }

  return { sections, contributors, fullChangelogUrl };
}

// ---------------------------------------------------------------------------
// Build new entry
// ---------------------------------------------------------------------------
const { sections, contributors, fullChangelogUrl } =
  parseNativeNotes(nativeMarkdown);

const today = new Date().toISOString().split("T")[0];
const REPO_URL = "https://github.com/bcgov/lcfs";

const newEntry = {
  version: displayVersion,
  tag,
  date: today,
  releaseUrl: `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}`,
  fullChangelogUrl,
  summary: enhancedMarkdown.trim(),
  sections,
  contributors,
};

// ---------------------------------------------------------------------------
// Load existing file and merge (idempotent — replace entry with same tag)
// ---------------------------------------------------------------------------
let existing = [];
if (existsSync(OUTPUT_PATH)) {
  try {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
}

const updated = [newEntry, ...existing.filter((e) => e.tag !== tag)];

writeFileSync(OUTPUT_PATH, JSON.stringify(updated, null, 2) + "\n");
console.log(`✅  release-notes.json updated — added entry for ${tag}`);
console.log(
  `    features:     ${sections.features.length}  items`,
  `\n    fixes:        ${sections.fixes.length}  items`,
  `\n    security:     ${sections.security.length}  items`,
  `\n    breaking:     ${sections.breaking.length}  items`,
  `\n    dependencies: ${sections.dependencies.length}  items`,
  `\n    other:        ${sections.other.length}  items`,
  `\n    contributors: ${contributors.length}`,
);
