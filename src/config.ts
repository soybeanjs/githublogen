import { getCurrentGitBranch, getFirstGitCommit, getGitHubRepo, getLastGitTag, isPrerelease } from './git';
import type { ChangelogOptions, ResolvedChangelogOptions } from './types';

export function defineConfig(config: ChangelogOptions) {
  return config;
}

const defaultConfig: ChangelogOptions = {
  scopeMap: {},
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
  contributors: true,
  capitalize: true,
  group: true
};

export async function resolveConfig(options: ChangelogOptions) {
  const { loadConfig } = await import('c12');
  const config = await loadConfig<ChangelogOptions>({
    name: 'githublogen',
    defaults: defaultConfig,
    overrides: options
  }).then(r => r.config || defaultConfig);

  config.from = config.from || (await getLastGitTag());
  config.to = config.to || (await getCurrentGitBranch());
  config.github = config.github || (await getGitHubRepo());
  config.prerelease = config.prerelease ?? isPrerelease(config.to);

  if (config.to === config.from) {
    config.from = (await getLastGitTag(-1)) || (await getFirstGitCommit());
  }

  console.log('resolveConfig => config.token: ', config.token);

  return config as ResolvedChangelogOptions;
}
