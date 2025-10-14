import { readFile, writeFile } from 'node:fs/promises';
import { clean, inc, prerelease, type ReleaseType, valid } from 'semver';
import type { ParsedCommit } from '@/changelog';

export const readVersion = async (file: string): Promise<string> => {
  try {
    const content = await readFile(file, 'utf8');
    const raw = file.endsWith('.json') ? JSON.parse(content).version : content.trim().split('\n')[0];
    const ver = clean(raw || '0.0.0');

    if (!ver || !valid(ver)) throw new Error(`Invalid version: ${raw}`);
    return ver;
  } catch (err: any) {
    if (err.code === 'ENOENT') return '0.0.0';
    throw err;
  }
};

export const writeVersion = async (file: string, ver: string): Promise<void> => {
  if (file.endsWith('.json')) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    data.version = ver;
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  } else {
    await writeFile(file, `${ver}\n`);
  }
};

export const bumpVersion = ({
  current,
  commits,
  bump = 'auto',
  channel = 'latest',
}: {
  current: string;
  commits: ParsedCommit[];
  bump?: string;
  channel?: string;
}): string => {
  const ver = clean(current) || '0.0.0';
  if (!valid(ver)) throw new Error(`Invalid version: ${current}`);

  // 标准化并验证 channel 类型
  const validChannels = ['alpha', 'beta', 'rc', 'latest'] as const;
  const normalizedChannel = (channel || 'latest').trim().toLowerCase();
  
  if (!validChannels.includes(normalizedChannel as any)) {
    throw new Error(`Invalid channel: "${channel}". Must be one of: ${validChannels.join(', ')}`);
  }

  // 如果是 latest，自动计算稳定版本
  if (normalizedChannel === 'latest') {
    const type = bump === 'auto' ? determineBump(commits) : (bump as ReleaseType);
    const result = inc(ver, type);
    if (!result) throw new Error(`Failed to bump ${ver} with ${type}`);
    return result;
  }

  // 处理 alpha、beta、rc 预发布版本
  const curr = prerelease(ver);
  const type =
    curr && curr[0] === normalizedChannel ? 'prerelease' : (`pre${bump === 'auto' ? determineBump(commits) : bump}` as ReleaseType);
  const result = inc(ver, type, normalizedChannel);
  if (!result) throw new Error(`Failed to bump ${ver} with ${type}`);
  return result;
};

const determineBump = (commits: ParsedCommit[]): ReleaseType => {
  if (commits.some((c) => c.breaking.length > 0)) return 'major';
  if (commits.some((c) => c.type === 'feat')) return 'minor';
  if (commits.some((c) => ['fix', 'perf'].includes(c.type))) return 'patch';
  return 'patch';
};
