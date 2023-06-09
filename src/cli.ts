#!/usr/bin/env node
import { blue, bold, cyan, dim, red, yellow } from 'kolorist';
import cac from 'cac';
import { version } from '../package.json';
import { generate } from './generate';
import { hasTagOnGitHub, sendRelease } from './github';
import { isRepoShallow } from './git';
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

    const { config, md, commits } = await generate(cwd, args as unknown as ChangelogOptions);

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
