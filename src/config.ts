import { getCurrentGitBranch, getFirstGitCommit, getLastGitTag, isPrerelease } from './git';
import { resolveRepoConfig } from './repo';
import type { ChangelogOptions, ResolvedChangelogOptions } from './types';

const defaultConfig: ChangelogOptions = {
  cwd: process.cwd(),
  from: '',
  to: '',
  gitMainBranch: 'main',
  scopeMap: {},
  repo: {},
  types: {
    feat: { title: '🚀 Features' },
    fix: { title: '🐞 Bug Fixes' },
    perf: { title: '🔥 Performance' },
    refactor: { title: '💅 Refactors' },
    docs: { title: '📖 Documentation' },
    build: { title: '📦 Build' },
    types: { title: '🌊 Types' },
    chore: { title: '🏡 Chore' },
    examples: { title: '🏀 Examples' },
    test: { title: '✅ Tests' },
    style: { title: '🎨 Styles' },
    ci: { title: '🤖 CI' }
  },
  titles: {
    breakingChanges: '🚨 Breaking Changes'
  },
  tokens: {
    github: process.env.CHANGELOGEN_TOKENS_GITHUB || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  },
  output: 'CHANGELOG.md',
  contributors: true,
  capitalize: true,
  group: true
};

export async function resolveConfig(cwd: string, options: ChangelogOptions) {
  const { loadConfig } = await import('c12');
  const config = await loadConfig<ChangelogOptions>({
    name: 'githublogen',
    defaults: defaultConfig,
    overrides: options
  }).then(r => r.config || defaultConfig);

  config.from = config.from || (await getLastGitTag());
  config.to = config.to || (await getCurrentGitBranch());
  config.repo = await resolveRepoConfig(cwd);
  config.prerelease = config.prerelease ?? isPrerelease(config.to);

  if (config.to === config.from) {
    config.from = (await getLastGitTag(-1)) || (await getFirstGitCommit());
  }

  return config as ResolvedChangelogOptions;
}
