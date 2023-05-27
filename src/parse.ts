import { notNullish } from './shared';
import type { GitCommit, RawGitCommit, GitCommitAuthor, ChangelogConfig, Reference } from './types';

// https://www.conventionalcommits.org/en/v1.0.0/
// https://regex101.com/r/FSfNvA/1
const ConventionalCommitRegex = /(?<type>[a-z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
const CoAuthoredByRegex = /co-authored-by:\s*(?<name>.+)(<(?<email>.+)>)/gim;
const PullRequestRE = /\([a-z]*(#\d+)\s*\)/gm;
const IssueRE = /(#\d+)/gm;

export function parseGitCommit(commit: RawGitCommit, config: ChangelogConfig): GitCommit | null {
  const match = commit.message.match(ConventionalCommitRegex);
  if (!match?.groups) {
    return null;
  }

  const type = match.groups.type;

  let scope = match.groups.scope || '';
  scope = config.scopeMap[scope] || scope;

  const isBreaking = Boolean(match.groups.breaking);
  let description = match.groups.description;

  // Extract references from message
  const references: Reference[] = [];
  for (const m of description.matchAll(PullRequestRE)) {
    references.push({ type: 'pull-request', value: m[1] });
  }
  for (const m of description.matchAll(IssueRE)) {
    if (!references.some(i => i.value === m[1])) {
      references.push({ type: 'issue', value: m[1] });
    }
  }
  references.push({ value: commit.shortHash, type: 'hash' });

  // Remove references and normalize
  description = description.replace(PullRequestRE, '').trim();

  // Find all authors
  const authors: GitCommitAuthor[] = [commit.author];

  const matchs = commit.body.matchAll(CoAuthoredByRegex);

  for (const $match of matchs) {
    const { name = '', email = '' } = $match.groups || {};

    const author: GitCommitAuthor = {
      name: name.trim(),
      email: email.trim()
    };

    authors.push(author);
  }

  return {
    ...commit,
    authors,
    description,
    type,
    scope,
    references,
    isBreaking
  };
}

export function parseCommits(commits: RawGitCommit[], config: ChangelogConfig): GitCommit[] {
  return commits.map(commit => parseGitCommit(commit, config)).filter(notNullish);
}
