import { getGitDiff } from './git';
import { generateMarkdown, generateChangelog } from './markdown';
import { resolveAuthors } from './github';
import { resolveConfig } from './config';
import { parseCommits } from './parse';
import type { ChangelogOptions } from './types';

export async function generate(cwd: string, options: ChangelogOptions) {
  const resolved = await resolveConfig(cwd, options);

  const rawCommits = await getGitDiff(resolved.from, resolved.to);
  const commits = parseCommits(rawCommits, resolved);

  if (resolved.contributors) {
    await resolveAuthors(commits, resolved);
  }

  const md = generateMarkdown(commits, resolved);

  const changelog = await generateChangelog(commits, resolved);

  return { config: resolved, md, commits, changelog };
}
