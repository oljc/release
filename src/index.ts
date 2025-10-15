import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { generateChangelog, parseCommits, updateChangelog } from '@/changelog';
import { GitHubClient } from '@/github';
import { bumpVersion, readVersion } from '@/version';
import { translate } from '@/translate';

const parseReleaseCommit = (msg: string) => {
  const match = msg.match(/^chore\(release\):\s*v?([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?)/);
  return match ? match[1] : null;
};

const updateVersionFile = (content: string | null, version: string, filePath: string) => {
  if (!filePath.endsWith('.json') || !content) return `${version}\n`;
  const json = JSON.parse(content);
  return `${JSON.stringify({ ...json, version }, null, 2)}\n`;
};

async function run() {
  try {
    const config = {
      versionFile: getInput('version-file') || 'package.json',
      changelogEn: getInput('changelog-en') || 'CHANGELOG.md',
      changelogZh: getInput('changelog-zh') || 'CHANGELOG.zh.md',
      locale: (getInput('locale') || 'en').trim().toLowerCase(),
      translate: getInput('translate') === 'true',
      branch: getInput('branch') || 'main',
      branchPrefix: getInput('branch-prefix') || 'release-',
      bump: getInput('bump') || 'auto',
      channel: (getInput('channel') || 'latest').trim().toLowerCase(),
      tagPrefix: getInput('tag-prefix') || 'v',
    };

    const github = new GitHubClient();
    const { sha, repo } = context;

    const commitVersion = parseReleaseCommit(context.payload.head_commit?.message || '');
    const pr = commitVersion ? await github.findMergedPR(sha) : null;
    const isRelease = pr && parseReleaseCommit(pr.title);

    const lastTag = await github.fetchLatestTag(sha, config.tagPrefix);
    const commits = await github.fetchCommits(sha, lastTag);
    if (!commits.length) return;

    const parsed = parseCommits(commits);
    const nowVersion = await readVersion(config.versionFile);
    const version = isRelease
      ? nowVersion
      : bumpVersion({
          current: nowVersion,
          commits: parsed,
          bump: config.bump,
          channel: config.channel,
        });

    info(`Version: ${version} (${parsed.length} commits)`);

    const isZh = config.locale === 'zh';
    const changelog = generateChangelog(parsed, version, repo.owner, repo.repo);
    const translated = config.translate ? await translate(changelog, isZh ? 'English' : 'Chinese') : '';

    const fullVersion = `${config.tagPrefix}${version}`;
    const title = `chore(release): ${fullVersion}`;

    if (isRelease) {
      info(`Creating tag ${fullVersion}`);
      await github.createTag(fullVersion, sha, `Release ${fullVersion}`);

      info('Creating release');
      const body = changelog.split('\n').slice(2).join('\n').trim();
      await github.createRelease(
        fullVersion,
        fullVersion,
        body,
        config.channel !== 'latest',
        lastTag?.name,
      );

      info('Release published');
      setOutput('pr', pr.number);
      setOutput('version', version);
      setOutput('published', true);
      return;
    }

    const branch = `${config.branchPrefix}${config.branch}-${config.channel}`;

    info(`Preparing branch ${branch}`);
    await github.ensureBranch(branch, config.branch);

    const primaryPath = isZh ? config.changelogZh : config.changelogEn;
    const secondaryPath = config.translate ? (isZh ? config.changelogEn : config.changelogZh) : null;
    
    const filePaths = [config.versionFile, primaryPath, secondaryPath].filter(Boolean) as string[];
    const fileContents = await Promise.all(filePaths.map(path => github.fetchFile(path, branch)));

    const filesToCommit = [
      { path: config.versionFile, content: updateVersionFile(fileContents[0], version, config.versionFile) },
      { path: primaryPath, content: updateChangelog(fileContents[1] || '', changelog) }
    ];

    if (config.translate && secondaryPath && translated) {
      filesToCommit.push({
        path: secondaryPath,
        content: updateChangelog(fileContents[2] || '', translated)
      });
    }

    await github.commitFiles(branch, title, filesToCommit);

    // 构建 PR body
    const prBody = [
      '# Changelog',
      '',
      `This bumps the version from \`${nowVersion}\` to \`${version}\`, including \`${parsed.length}\` commits.`,
      '',
      changelog,
      translated ? `\n------\n\n${translated}` : ''
    ].filter(Boolean).join('\n');

    const prNumber = await github.updatePR(branch, config.branch, title, prBody);

    info(`PR #${prNumber} ready`);
    setOutput('pr', prNumber);
    setOutput('version', version);
    setOutput('published', false);
  } catch (error: any) {
    setFailed(error.message);
  }
}

run();
