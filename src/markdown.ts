import { convert } from 'convert-gitmoji';
import { upperFirst, partition, groupBy, capitalize, join } from './shared';
import { $fetch } from 'ohmyfetch';
import { formatReference } from './repo';
import type { Reference, Commit, ResolvedChangelogOptions, RepoConfig, GitCommit, ChangelogConfig } from './types';

const emojisRE =
  /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;

function formatReferences(references: Reference[], github: string, type: 'issues' | 'hash'): string {
  const refs = references
    .filter(i => {
      if (type === 'issues') {
        return i.type === 'issue' || i.type === 'pull-request';
      }
      return i.type === 'hash';
    })
    .map(ref => {
      if (!github) {
        return ref.value;
      }
      if (ref.type === 'pull-request' || ref.type === 'issue') {
        return `https://github.com/${github}/issues/${ref.value.slice(1)}`;
      }
      return `[<samp>(${ref.value.slice(0, 5)})</samp>](https://github.com/${github}/commit/${ref.value})`;
    });

  const referencesString = join(refs).trim();

  if (type === 'issues') {
    return referencesString && `in ${referencesString}`;
  }
  return referencesString;
}

function formatLine(commit: Commit, options: ResolvedChangelogOptions) {
  const prRefs = formatReferences(commit.references, options.repo.repo || '', 'issues');
  const hashRefs = formatReferences(commit.references, options.repo.repo || '', 'hash');

  let authors = join([
    ...new Set(commit.resolvedAuthors?.map(i => (i.login ? `@${i.login}` : `**${i.name}**`)))
  ])?.trim();
  if (authors) {
    authors = `by ${authors}`;
  }

  let refs = [authors, prRefs, hashRefs].filter(i => i?.trim()).join(' ');

  if (refs) {
    refs = `&nbsp;-&nbsp; ${refs}`;
  }

  const description = options.capitalize ? capitalize(commit.description) : commit.description;

  return [description, refs].filter(i => i?.trim()).join(' ');
}

function formatTitle(name: string, options: ResolvedChangelogOptions) {
  let $name = name.trim();

  if (!options.emoji) {
    $name = name.replace(emojisRE, '').trim();
  }

  return `### &nbsp;&nbsp;&nbsp;${$name}`;
}

function formatSection(commits: Commit[], sectionName: string, options: ResolvedChangelogOptions) {
  if (!commits.length) {
    return [];
  }

  const lines: string[] = ['', formatTitle(sectionName, options), ''];

  const scopes = groupBy(commits, 'scope');
  let useScopeGroup = options.group;

  // group scopes only when one of the scope have multiple commits
  if (!Object.entries(scopes).some(([k, v]) => k && v.length > 1)) {
    useScopeGroup = false;
  }

  Object.keys(scopes)
    .sort()
    .forEach(scope => {
      let padding = '';
      let prefix = '';
      const scopeText = `**${options.scopeMap[scope] || scope}**`;
      if (scope && (useScopeGroup === true || (useScopeGroup === 'multiple' && scopes[scope].length > 1))) {
        lines.push(`- ${scopeText}:`);
        padding = '  ';
      } else if (scope) {
        prefix = `${scopeText}: `;
      }

      lines.push(...scopes[scope].reverse().map(commit => `${padding}- ${prefix}${formatLine(commit, options)}`));
    });

  return lines;
}

export function generateMarkdown(commits: Commit[], options: ResolvedChangelogOptions) {
  const lines: string[] = [];

  const [breaking, changes] = partition(commits, c => c.isBreaking);

  const group = groupBy(changes, 'type');

  lines.push(...formatSection(breaking, options.titles.breakingChanges!, options));

  for (const type of Object.keys(options.types)) {
    const items = group[type] || [];
    lines.push(...formatSection(items, options.types[type].title, options));
  }

  if (!lines.length) {
    lines.push('*No significant changes*');
  }

  const url = `https://github.com/${options.repo.repo!}/compare/${options.from}...${options.to}`;

  lines.push('', `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](${url})`);

  return convert(lines.join('\n').trim(), true);
}

export async function generateChangelog(commits: Commit[], config: ResolvedChangelogOptions) {
  const typeGroups = groupBy(commits, 'type');

  const markdown: string[] = [];
  const breakingChanges: string[] = [];

  // Version Title
  const v = config.newVersion && `v${config.newVersion}`;
  markdown.push('', `## ${v || `${config.from || ''}...${config.to}`}`, '');

  if (config.repo && config.from) {
    markdown.push(formatCompareChanges(v, config));
  }

  const typeKeys = Object.keys(config.types);
  typeKeys.forEach(typeKey => {
    const group = typeGroups[typeKey];

    if (group?.length) {
      markdown.push('', `### ${config.types[typeKey].title}`, '');
      for (const commit of group.reverse()) {
        const line = formatCommit(commit, config);
        markdown.push(line);
        if (commit.isBreaking) {
          breakingChanges.push(line);
        }
      }
    }
  });

  if (breakingChanges.length > 0) {
    markdown.push('', '#### ⚠️  Breaking Changes', '', ...breakingChanges);
  }

  const authorMap = new Map<string, { email: Set<string>; github?: string }>();

  commits.forEach(commit => {
    const name = formatName(commit.author?.name || '');

    if (name && !name.includes('[bot]')) {
      if (!authorMap.has(name)) {
        authorMap.set(name, { email: new Set([commit.author.email]) });
      } else {
        const entry = authorMap.get(name);
        entry?.email?.add(commit.author.email);
      }
    }
  });

  // Try to map authors to github usernames
  await Promise.all(
    [...authorMap.keys()].map(async authorName => {
      const meta = authorMap.get(authorName);
      if (meta) {
        for (const email of meta.email) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const { user } = await $fetch(`https://ungh.cc/users/find/${email}`);
            if (user) {
              meta.github = user.username;
              break;
            }
          } catch {}
        }
      }
    })
  );

  const authors = [...authorMap.entries()].map(e => ({ name: e[0], ...e[1] }));

  if (authors.length > 0) {
    markdown.push(
      '',
      '### ❤️ Contributors',
      '',
      ...authors.map(i => {
        const $email = [...i.email].find(e => !e.includes('noreply.github.com'));
        const email = $email ? `<${$email}>` : '';
        const github = i.github ? `([@${i.github}](http://github.com/${i.github}))` : '';
        return `- ${i.name} ${github || email}`;
      })
    );
  }

  return convert(markdown.join('\n').trim(), true);
}

function baseUrl(config: RepoConfig) {
  return `https://${config.domain}/${config.repo}`;
}

function formatCompareChanges(v: string, config: ResolvedChangelogOptions) {
  const part = config.repo.provider === 'bitbucket' ? 'branches/compare' : 'compare';
  return `[compare changes](${baseUrl(config.repo)}/${part}/${config.from}...${v || config.to})`;
}

function formatCommit(commit: GitCommit, config: ChangelogConfig) {
  return `- ${commit.scope ? `**${commit.scope.trim()}:** ` : ''}${commit.isBreaking ? '⚠️  ' : ''}${upperFirst(
    commit.description
  )}${formatMultiReference(commit.references, config)}`;
}

function formatName(name = '') {
  return name
    .split(' ')
    .map(p => upperFirst(p.trim()))
    .join(' ');
}

function formatMultiReference(references: Reference[], config: ChangelogConfig) {
  const pr = references.filter(ref => ref.type === 'pull-request');
  const issue = references.filter(ref => ref.type === 'issue');
  if (pr.length > 0 || issue.length > 0) {
    return ` (${[...pr, ...issue].map(ref => formatReference(ref, config.repo)).join(', ')})`;
  }
  if (references.length > 0) {
    return ` (${formatReference(references[0], config.repo)})`;
  }
  return '';
}
