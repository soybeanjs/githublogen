import type { RawGitCommit } from './types';

export async function getGitHubRepo() {
  const url = await execCommand('git', ['config', '--get', 'remote.origin.url']);
  const match = url.match(/github\.com[\/:]([\w\d._-]+?)\/([\w\d._-]+?)(\.git)?$/i);
  if (!match) {
    throw new Error(`Can not parse GitHub repo from url ${url}`);
  }
  return `${match[1]}/${match[2]}`;
}

export async function getCurrentGitBranch() {
  const result1 = await execCommand('git', ['tag', '--points-at', 'HEAD']);
  const result2 = await execCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  return result1 || result2;
}

export async function isRepoShallow() {
  return (await execCommand('git', ['rev-parse', '--is-shallow-repository'])).trim() === 'true';
}

export async function getLastGitTag(delta = 0) {
  const tags = await execCommand('git', ['--no-pager', 'tag', '-l', '--sort=creatordate']).then(r => r.split('\n'));
  return tags[tags.length + delta - 1];
}

export async function isRefGitTag(to: string) {
  const { execa } = await import('execa');
  try {
    await execa('git', ['show-ref', '--verify', `refs/tags/${to}`], { reject: true });
    return true;
  } catch {
    return false;
  }
}

export function getFirstGitCommit() {
  return execCommand('git', ['rev-list', '--max-parents=0', 'HEAD']);
}

export function isPrerelease(version: string) {
  return !/^[^.]*[\d.]+$/.test(version);
}

async function execCommand(cmd: string, args: string[]) {
  const { execa } = await import('execa');
  const res = await execa(cmd, args);
  return res.stdout.trim();
}

export async function getGitDiff(from: string | undefined, to = 'HEAD'): Promise<RawGitCommit[]> {
  // https://git-scm.com/docs/pretty-formats
  const r = await execCommand('git', [
    '--no-pager',
    'log',
    `${from ? `${from}...` : ''}${to}`,
    '--pretty="----%n%s|%h|%an|%ae%n%b"',
    '--name-status'
  ]);
  return r
    .split('----\n')
    .splice(1)
    .map(line => {
      const [firstLine, ..._body] = line.split('\n');
      const [message, shortHash, authorName, authorEmail] = firstLine.split('|');
      const $r: RawGitCommit = {
        message,
        shortHash,
        author: { name: authorName, email: authorEmail },
        body: _body.join('\n')
      };
      return $r;
    });
}

export function getGitRemoteURL(cwd: string, remote = 'origin') {
  return execCommand('git', [`--work-tree=${cwd}`, 'remote', 'get-url', remote]);
}
