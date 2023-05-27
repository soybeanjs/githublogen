import { getGitDiff } from './git';
import { generateMarkdown } from './markdown';
import { resolveAuthors } from './github';
import { resolveConfig } from './config';
import { parseCommits } from './parse';
import type { ChangelogOptions } from './types';

export async function generate(options: ChangelogOptions) {
  const resolved = await resolveConfig(options);

  const rawCommits = await getGitDiff(resolved.from, resolved.to);
  const commits = parseCommits(rawCommits, resolved);

  if (resolved.contributors) {
    const authorInfo = await resolveAuthors(commits, resolved);
    Object.assign(resolved, authorInfo);
  }

  const md = generateMarkdown(commits, resolved);

  return { config: resolved, md, commits };
}
