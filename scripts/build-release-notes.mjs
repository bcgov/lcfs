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

if (!tag || !nativeNotesPath) {
  console.error(
    "Usage: build-release-notes.mjs --tag <tag> [--display-version <ver>]" +
      " --native-notes <path> [--enhanced-notes <path>]",
  );
  process.exit(1);
}

const nativeMarkdown = readFileSync(nativeNotesPath, "utf8");
// Optional. A prose summary from an external writer, if one is wired up. When
// absent — or when it is really just the raw notes handed back unchanged — the
// summary is composed from the parsed sections instead. Dumping raw GitHub
// markdown onto a public page is never an acceptable fallback.
const enhancedMarkdown =
  enhancedNotesPath && existsSync(enhancedNotesPath)
    ? readFileSync(enhancedNotesPath, "utf8")
    : "";

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

/**
 * Release-branch bookkeeping ("Release v1.3.6", "Prod Release v1.3.7"). These
 * are merges of the release process itself, not changes a fuel supplier or
 * ministry analyst would recognise, so they never belong on the page.
 */
const isReleaseBookkeeping = (text) =>
  /^(prod\s+)?release\s+v?\d+\.\d+\.\d+\b/i.test(text.trim());

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
  const seenItems = new Set();
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

      if (isReleaseBookkeeping(rawText)) continue;

      const cleaned = stripConventionalPrefix(stripGitHubSuffix(rawText));
      // The same change can land more than once (a fix re-applied on a release
      // branch, a reverted-and-retried PR), which would otherwise show up as a
      // repeated bullet on the page.
      const dedupeKey = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
      if (cleaned && seenItems.has(dedupeKey)) continue;
      if (cleaned) seenItems.add(dedupeKey);

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
// Summary
//
// The summary is what the page shows under "What's in this release", so it has
// to be readable prose. It used to be whatever an external writer returned,
// falling back to the raw GitHub markdown — which meant that when that service
// went away the page started rendering nine thousand characters of
// "* chore(deps): bump … by @dependabot[bot] in https://…". Composing from the
// parsed sections instead has no external dependency and cannot degrade.
// ---------------------------------------------------------------------------

/**
 * True when the supplied text is really the raw GitHub notes rather than a
 * written summary — a generation comment, a "What's Changed" heading, or
 * "by @user in <url>" attributions all give it away.
 */
const looksLikeRawNotes = (text) =>
  !text.trim() ||
  /^<!--/.test(text.trim()) ||
  /^#{1,3}\s+What's Changed/im.test(text) ||
  /\bby @[\w-]+ in https?:\/\//.test(text);

/** Trim an "LCFS - " prefix and trailing issue/PR references off a bullet. */
const titleOf = (text) =>
  text
    .replace(/^LCFS\s*[-–—]\s*/i, "")
    .replace(/\s*\(#\d+(?:\s*,\s*#\d+)*\)\s*\.?\s*$/, "")
    .replace(/\s*[-–—]\s*#?\d{3,}\s*\.?\s*$/, "")
    .replace(/\s+#\d{3,}\s*\.?\s*$/, "")
    .replace(/\.\s*$/, "")
    .trim();

const countPhrase = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

/** "a, b and c" */
const joinList = (items) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function composeSummary(sections) {
  const counts = [
    [sections.breaking, "breaking change", "breaking changes"],
    [sections.features, "new feature", "new features"],
    [sections.fixes, "bug fix", "bug fixes"],
    [sections.security, "security update", "security updates"],
    [sections.dependencies, "dependency update", "dependency updates"],
    [sections.other, "other change", "other changes"],
  ]
    .filter(([items]) => items.length)
    .map(([items, one, many]) => countPhrase(items.length, one, many));

  const sentences = [
    counts.length
      ? `This release includes ${joinList(counts)}.`
      : "No recorded changes in this release.",
  ];

  // Lead with the things a reader most needs to know about; fall back to the
  // uncategorised bucket only when there is nothing else to show.
  const primary = [
    ...sections.breaking,
    ...sections.features,
    ...sections.security,
  ];
  const highlights = (primary.length ? primary : sections.other)
    .map(titleOf)
    .filter(Boolean)
    .slice(0, 4);
  if (highlights.length) sentences.push(`Highlights: ${highlights.join("; ")}.`);

  return sentences.join(" ");
}

// ---------------------------------------------------------------------------
// Build new entry
// ---------------------------------------------------------------------------
const { sections, contributors, fullChangelogUrl } =
  parseNativeNotes(nativeMarkdown);

const summary = looksLikeRawNotes(enhancedMarkdown)
  ? composeSummary(sections)
  : enhancedMarkdown.trim();

const today = new Date().toISOString().split("T")[0];
const REPO_URL = "https://github.com/bcgov/lcfs";

const newEntry = {
  version: displayVersion,
  tag,
  date: today,
  releaseUrl: `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}`,
  fullChangelogUrl,
  summary,
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
