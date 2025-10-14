import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { generateChangelog, parseCommits, updateChangelog } from '@/changelog';
import { GitHubClient } from '@/github';
import { bumpVersion, readVersion } from '@/version';

const parseReleaseCommit = (msg: string) => {
  const match = msg.match(/^chore\(release\):\s*v?([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?)/);
  return match ? match[1] : null;
};

async function run() {
  try {
    const config = {
      versionFile: getInput('version-file') || 'package.json',
      changelogFile: getInput('changelog-file') || 'CHANGELOG.md',
      branch: getInput('branch') || 'main',
      branchPrefix: getInput('branch-prefix') || 'release-',
      versionBump: getInput('version-bump') || 'auto',
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
          bump: config.versionBump,
          channel: config.channel,
        });

    info(`Version: ${version} (${parsed.length} commits)`);

    const changelog = generateChangelog(parsed, version, repo.owner, repo.repo);
    const fullVersion = `${config.tagPrefix}${version}`;
    const title = `chore(release): ${fullVersion}`;

    if (isRelease) {
      info(`Creating tag ${fullVersion}`);
      await github.createTag(fullVersion, sha, `Release ${fullVersion}`);

      info('Creating release');
      await github.createRelease(
        fullVersion,
        fullVersion,
        changelog.split('\n').slice(2).join('\n').trim(),
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

    const [oldChangelog, versionContent] = await Promise.all([
      github.fetchFile(config.changelogFile, branch),
      github.fetchFile(config.versionFile, branch),
    ]);

    const updatedVersion =
      config.versionFile.endsWith('.json') && versionContent
        ? `${JSON.stringify({ ...JSON.parse(versionContent), version }, null, 2)}\n`
        : `${version}\n`;

    await github.commitFiles(branch, title, [
      { path: config.versionFile, content: updatedVersion },
      { path: config.changelogFile, content: updateChangelog(oldChangelog, changelog) },
    ]);

    const body = `# Changelog\n\nThis bumps the version from \`${nowVersion}\` to \`${version}\`, including \`${parsed.length}\` commits.\n\n${changelog}`;
    const prNumber = await github.updatePR(branch, config.branch, title, body);

    info(`PR #${prNumber} ready`);
    setOutput('pr', prNumber);
    setOutput('version', version);
    setOutput('published', false);
  } catch (error: any) {
    setFailed(error.message);
  }
}

run();
