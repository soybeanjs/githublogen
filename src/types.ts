export type SemverBumpType = 'major' | 'premajor' | 'minor' | 'preminor' | 'patch' | 'prepatch' | 'prerelease';

export type RepoProvider = 'github' | 'gitlab' | 'bitbucket';

export type RepoConfig = {
  domain?: string;
  repo?: string;
  provider?: RepoProvider;
  token?: string;
};

export interface ChangelogConfig {
  cwd: string;
  types: Record<string, { title: string; semver?: SemverBumpType }>;
  scopeMap: Record<string, string>;
  repo: RepoConfig;
  tokens: Partial<Record<RepoProvider, string>>;
  from: string;
  to: string;
  newVersion?: string;
  output: string | boolean;
  gitMainBranch: string;
}

export interface GitCommitAuthor {
  name: string;
  email: string;
}

export interface RawGitCommit {
  message: string;
  body: string;
  shortHash: string;
  author: GitCommitAuthor;
}

export interface Reference {
  type: 'hash' | 'issue' | 'pull-request';
  value: string;
}

export interface GithubOptions {
  repo: string;
  token: string;
}

export interface GithubRelease {
  id?: string;
  tag_name: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface GitCommit extends RawGitCommit {
  description: string;
  type: string;
  scope: string;
  references: Reference[];
  authors: GitCommitAuthor[];
  isBreaking: boolean;
}

export interface AuthorInfo {
  commits: string[];
  login?: string;
  email: string;
  name: string;
}

export interface Commit extends GitCommit {
  resolvedAuthors?: AuthorInfo[];
}

export interface ChangelogOptions extends ChangelogConfig {
  /**
   * Dry run. Skip releasing to GitHub.
   */
  dry?: boolean;
  /**
   * Whether to include contributors in release notes.
   *
   * @default true
   */
  contributors?: boolean;
  /**
   * Name of the release
   */
  name?: string;
  /**
   * Mark the release as a draft
   */
  draft?: boolean;
  /**
   * Mark the release as prerelease
   */
  prerelease?: boolean;
  /**
   * Custom titles
   */
  titles?: {
    breakingChanges?: string;
  };
  /**
   * Capitalize commit messages
   * @default true
   */
  capitalize?: boolean;
  /**
   * Nest commit messages under their scopes
   * @default true
   */
  group?: boolean | 'multiple';
  /**
   * Use emojis in section titles
   * @default true
   */
  emoji?: boolean;
}

export type ResolvedChangelogOptions = Required<ChangelogOptions>;
