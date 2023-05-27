#!/usr/bin/env node
import { existsSync, promises as fsp } from 'node:fs';
import { blue, bold, cyan, dim, red, yellow } from 'kolorist';
import { execa } from 'execa';
import cac from 'cac';
import { version } from '../package.json';
import { generate } from './generate';
import { hasTagOnGitHub, sendRelease } from './github';
import { isRepoShallow, getGitPushUrl, getGitMainBranchName } from './git';
import type { ChangelogOptions } from './types';

const cli = cac('githublogen');

cli
  .version(version)
  .option('-t, --token <path>', 'GitHub Token')
  .option('--from <ref>', 'From tag')
  .option('--to <ref>', 'To tag')
  .option('--github <path>', 'GitHub Repository, e.g. soybeanjs/githublogen')
  .option('--name <name>', 'Name of the release')
  .option('--contributors', 'Show contributors section')
  .option('--prerelease', 'Mark release as prerelease')
  .option('-d, --draft', 'Mark release as draft')
  .option('--output <path>', 'Output to file instead of sending to GitHub')
  .option('--capitalize', 'Should capitalize for each comment message')
  .option('--emoji', 'Use emojis in section titles', { default: true })
  .option('--group', 'Nest commit messages under their scopes')
  .option('--dry', 'Dry run')
  .help();

cli.command('').action(async (args: any) => {
  try {
    console.log();
    console.log(dim(`${bold('github')}logen `) + dim(`v${version}`));

    const cwd = process.cwd();

    const { config, md, changelog, commits } = await generate(cwd, args as unknown as ChangelogOptions);

    const markdown = md.replace(/&nbsp;/g, '');

    console.log(cyan(config.from) + dim(' -> ') + blue(config.to) + dim(` (${commits.length} commits)`));
    console.log(dim('--------------'));
    console.log();
    console.log(markdown);
    console.log();
    console.log(dim('--------------'));

    if (config.dry) {
      console.log(yellow('Dry run. Release skipped.'));
      return;
    }

    if (typeof config.output === 'string') {
      const pushUrl = getGitPushUrl(config.repo, config.tokens.github);

      if (!pushUrl) {
        return;
      }

      let changelogMD: string;
      const changelogPrefix = '# Changelog';
      if (existsSync(config.output)) {
        console.info(`Updating ${config.output}`);
        changelogMD = await fsp.readFile(config.output, 'utf8');
        if (!changelogMD.startsWith(changelogPrefix)) {
          changelogMD = `${changelogPrefix}\n\n${changelogMD}`;
        }
      } else {
        console.info(`Creating  ${config.output}`);
        changelogMD = `${changelogPrefix}\n\n`;
      }

      const lastEntry = changelogMD.match(/^###?\s+.*$/m);

      if (lastEntry) {
        changelogMD = `${changelogMD.slice(0, lastEntry.index) + changelog}\n\n${changelogMD.slice(lastEntry.index)}`;
      } else {
        changelogMD += `\n${changelog}\n\n`;
      }

      await fsp.writeFile(config.output, changelogMD);

      const { email = 'unknow@unknow.com', name = 'unknow' } = commits[0]?.author || {};

      const branchMain = await getGitMainBranchName();

      await execa('git', ['config', '--global', 'user.email', `"${email}"`]);

      await execa('git', ['config', '--global', 'user.name', `"${name}"`]);

      await execa('git', ['add', '.']);

      await execa('git', ['commit', '-m', '"docs(projects): CHANGELOG.md"'], { cwd });

      await execa('git', ['push', pushUrl, `HEAD:${branchMain}`], { cwd });
    }

    if (!(await hasTagOnGitHub(config.to, config))) {
      console.error(yellow(`Current ref "${bold(config.to)}" is not available as tags on GitHub. Release skipped.`));
      process.exitCode = 1;
      return;
    }

    if (!commits.length && (await isRepoShallow())) {
      console.error(
        yellow(
          'The repo seems to be clone shallowly, which make changelog failed to generate. You might want to specify `fetch-depth: 0` in your CI config.'
        )
      );
      process.exitCode = 1;
      return;
    }

    await sendRelease(config, md);
  } catch (e: any) {
    console.error(red(String(e)));
    if (e?.stack) {
      console.error(dim(e.stack?.split('\n').slice(1).join('\n')));
    }

    process.exit(1);
  }
});

cli.parse();
