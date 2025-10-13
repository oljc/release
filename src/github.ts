import { getInput } from '@actions/core';
import { context, getOctokit } from '@actions/github';

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
    login?: string;
    avatar?: string;
    html_url?: string;
  };
}

export class GitHubClient {
  private owner: string;
  private repo: string;
  private repos: any;
  private git: any;
  private pulls: any;
  private paginate: any;

  constructor() {
    const token = getInput('token', { required: true });
    const { owner, repo } = context.repo;
    const { rest, paginate } = getOctokit(token);
    const { repos, git, pulls } = rest;

    this.owner = owner;
    this.repo = repo;
    this.repos = repos;
    this.git = git;
    this.pulls = pulls;
    this.paginate = paginate;
  }

  async fetchLatestTag(sha: string, prefix: string) {
    try {
      const { data: tags } = await this.repos.listTags({
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      const filtered = tags.filter((t: any) => t?.name?.startsWith(prefix));
      if (!filtered.length) return null;

      for (const tag of filtered) {
        if (!tag.commit?.sha) continue;

        try {
          const { status } = await this.repos.compareCommits({
            owner: this.owner,
            repo: this.repo,
            base: tag.commit.sha,
            head: sha,
          });

          if (status === 200) {
            return { name: tag.name, sha: tag.commit.sha };
          }
        } catch {}
      }
      return null;
    } catch (err) {
      console.error('fetchLatestTag error:', err);
      return null;
    }
  }

  async fetchFile(path: string, ref: string) {
    const result = await this.repos
      .getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      })
      .catch(() => ({ data: {} as any }));
    return 'content' in result.data ? Buffer.from(result.data.content, 'base64').toString('utf8') : '';
  }

  async fetchCommits(head: string, tag: { name: string; sha: string } | null) {
    try {
      let commits: any[] = [];

      if (tag) {
        const { data } = await this.repos.compareCommits({
          owner: this.owner,
          repo: this.repo,
          base: tag.sha,
          head,
        });
        commits = data.commits || [];
      } else {
        commits = await this.paginate(this.repos.listCommits, {
          owner: this.owner,
          repo: this.repo,
          sha: head,
          per_page: 100,
        });
      }

      return commits
        .filter((c) => c?.commit?.message)
        .map(
          (c): Commit => ({
            sha: c.sha || '',
            message: c.commit.message || '',
            author: {
              name: c.commit.author?.name || '',
              email: c.commit.author?.email || '',
              date: c.commit.author?.date || '',
              login: c.author?.login || '',
              avatar: c.author?.avatar_url || '',
              html_url: c.author?.html_url || '',
            },
          }),
        )
        .filter((c) => !/^chore\(release\):\s*/.test(c.message));
    } catch (err) {
      console.error('fetch commits error:', err);
      return [];
    }
  }

  async ensureBranch(branch: string, base: string) {
    if (await exists(() => this.repos.getBranch({ owner: this.owner, repo: this.repo, branch }))) return;

    const { data } = await this.git.getRef({ owner: this.owner, repo: this.repo, ref: `heads/${base}` });
    await this.git.createRef({ owner: this.owner, repo: this.repo, ref: `refs/heads/${branch}`, sha: data.object.sha });
  }

  async commitFiles(branch: string, message: string, files: Array<{ path: string; content: string }>) {
    const { data: ref } = await this.git.getRef({ owner: this.owner, repo: this.repo, ref: `heads/${branch}` });
    const { data: commit } = await this.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: ref.object.sha,
    });

    const tree = await Promise.all(
      files.map(async (f) => {
        const { data: blob } = await this.git.createBlob({
          owner: this.owner,
          repo: this.repo,
          content: Buffer.from(f.content).toString('base64'),
          encoding: 'base64',
        });
        return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha };
      }),
    );

    const { data: newTree } = await this.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: commit.tree.sha,
      tree,
    });
    const { data: newCommit } = await this.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: newTree.sha,
      parents: [ref.object.sha],
    });

    await this.git.updateRef({ owner: this.owner, repo: this.repo, ref: `heads/${branch}`, sha: newCommit.sha });
  }

  async updatePR(branch: string, base: string, title: string, body: string) {
    const { data: existingPRs } = await this.pulls.list({
      owner: this.owner,
      repo: this.repo,
      head: `${this.owner}:${branch}`,
      base,
      state: 'open',
    });

    if (existingPRs.length) {
      await this.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: existingPRs[0].number,
        title,
        body,
      });
      return existingPRs[0].number;
    }

    const { data: pr } = await this.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      head: branch,
      base,
      body,
    });
    return pr.number;
  }

  async findMergedPR(sha: string) {
    const { data: prs } = await this.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'closed',
      per_page: 10,
      sort: 'updated',
      direction: 'desc',
    });

    for (const pr of prs) {
      if (pr.merged_at && pr.merge_commit_sha === sha) {
        return { number: pr.number, body: pr.body || '', title: pr.title };
      }
    }
    return null;
  }

  async createTag(tag: string, sha: string, message: string) {
    await this.git.createTag({
      owner: this.owner,
      repo: this.repo,
      tag,
      message,
      object: sha,
      type: 'commit',
    });

    await this.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/tags/${tag}`,
      sha,
    });
  }

  async createRelease(tag: string, name: string, body: string, prerelease: boolean = false, previousTag?: string) {
    const { data } = await this.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: tag,
      name,
      body,
      draft: false,
      prerelease,
      ...(previousTag && { previous_tag_name: previousTag }),
    });
    return data.id;
  }
}

const exists = (fn: () => Promise<any>) =>
  fn()
    .then(() => true)
    .catch(() => false);
