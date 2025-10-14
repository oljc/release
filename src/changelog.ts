// @ts-expect-error
import { sync } from 'conventional-commits-parser';
import { rcompare } from 'semver';
import type { Commit } from '@/github';

export interface ParsedCommit extends Omit<Commit, 'message'> {
  type: string;
  scope: string | null;
  subject: string;
  body: string | null;
  footer: string | null;
  breaking: Array<{ title: string; text: string }>;
}

export const parseCommits = (commits: Commit[]): ParsedCommit[] =>
  commits.reduce<ParsedCommit[]>((acc, c) => {
    if (!c.message) return acc;
    
    if (c.author.type === 'Bot') return acc;

    const r = sync(c.message, {
      mergePattern: /^Merge pull request #(\d+) from (.*)$/,
      mergeCorrespondence: ['id', 'source'],
    });

    if (!r.type) return acc;

    acc.push({
      type: r.type,
      scope: r.scope || null,
      subject: r.subject || c.message.split('\n')[0],
      body: r.body || null,
      footer: r.footer || null,
      breaking: (r.notes || []).filter((n: any) => n.title === 'BREAKING CHANGE'),
      sha: c.sha,
      author: c.author,
    });

    return acc;
  }, []);

const formatDate = () => new Date().toISOString().split('T')[0];
const formatSha = (sha: string) => sha.substring(0, 7);

const groupCommits = <T extends { type: string }>(commits: T[]) => {
  const groups: Record<string, T[]> = {
    feat: [],
    fix: [],
    docs: [],
    style: [],
    refactor: [],
    perf: [],
    test: [],
    chore: [],
    ci: [],
    build: [],
    revert: [],
    other: [],
  };
  for (const c of commits) {
    (groups[c.type] || groups.other).push(c);
  }
  return groups;
};

export const generateChangelog = (commits: ParsedCommit[], version: string, owner: string, repo: string) => {
  const url = `https://github.com/${owner}/${repo}`;
  const groups = groupCommits(commits);
  const breaking = commits.filter((c) => c.breaking.length);

  const formatCommit = (c: ParsedCommit, showType?: string) => {
    const parts = [];
    if (showType) parts.push(c.scope ? `**${showType}(${c.scope}):**` : `**${showType}:**`);

    const prMatch = c.subject.match(/\(#(\d+)\)$/);
    const subject = prMatch ? c.subject.replace(/\s*\(#\d+\)$/, '') : c.subject;
    parts.push(subject);

    if (c.author.login) parts.push(`@${c.author.login}`);
    if (prMatch) parts.push(`in [#${prMatch[1]}](${url}/pull/${prMatch[1]})`);
    parts.push(`([${formatSha(c.sha)}](${url}/commit/${c.sha}))`);

    return `* ${parts.join(' ')}`;
  };

  const sections: string[] = [`## ${version} (${formatDate()})`];

  if (breaking.length) {
    sections.push('### ⚠ BREAKING CHANGES');
    for (const c of breaking) {
      sections.push(formatCommit(c));
      for (const n of c.breaking) {
        sections.push(`  - ${n.text}`);
      }
    }
  }

  const mainSections = [
    { key: 'feat', title: '✨ Features' },
    { key: 'fix', title: '🐛 Bug Fixes' },
    { key: 'perf', title: '⚡ Performance' },
    { key: 'refactor', title: '♻️ Refactor' },
    { key: 'docs', title: '📝 Docs' },
  ];

  for (const { key, title } of mainSections) {
    if (groups[key].length) {
      sections.push(`### ${title}`);
      sections.push(...groups[key].map((c) => formatCommit(c)));
    }
  }

  const otherTypes = ['style', 'test', 'chore', 'ci', 'build', 'revert'];
  const otherCommits = otherTypes
    .flatMap((t) => groups[t].map((c) => formatCommit(c, t)))
    .concat(groups.other.map((c) => formatCommit(c)));

  if (otherCommits.length) {
    sections.push('### 🔧 Others');
    sections.push(...otherCommits);
  }

  return `${sections.join('\n\n')}\n`;
};

export const updateChangelog = (old: string, content: string) => {
  const header = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';

  if (!old?.trim()) return header + content;

  const newVer = content.match(/^##\s+([\w.-]+)/)?.[1];
  if (!newVer) return old;

  const [head, ...blocks] = old.split(/^##\s+/m);
  const versions = new Map<string, string>();

  blocks.forEach((block) => {
    const ver = block.match(/^([\w.-]+)/)?.[1];
    if (ver) versions.set(ver, block);
  });

  versions.set(newVer, content.replace(/^##\s*/, ''));

  const sorted = Array.from(versions.keys())
    .sort((a, b) => {
      try {
        return rcompare(a.split(' ')[0], b.split(' ')[0]);
      } catch {
        return b.localeCompare(a, undefined, { numeric: true });
      }
    })
    .map((v) => `## ${versions.get(v)}`);

  return `${head.trim()}\n\n${sorted.join('\n\n')}\n`;
};
