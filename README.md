# Release

> 基于 Conventional Commits 的自动化发布管理工具

自动生成 changelog、升级版本号、创建发布 PR，并在合并后自动发布 GitHub Release。

## 使用

在你的仓库中创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: oljc/release@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

## 配置选项

### Inputs

| 参数 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `token` | GitHub token | - | ✅ |
| `version-file` | 版本文件路径 | `package.json` | ❌ |
| `changelog-file` | Changelog 文件路径 | `CHANGELOG.md` | ❌ |
| `branch` | 目标分支 | `main` | ❌ |
| `branch-prefix` | Release 分支前缀 | `release-` | ❌ |
| `version-bump` | 版本升级策略 | `auto` | ❌ |
| `channel` | 发布渠道 (alpha/beta/rc/latest) | `latest` | ❌ |
| `tag-prefix` | Tag 前缀 | `v` | ❌ |

### Outputs

| 参数 | 说明 |
|------|------|
| `pr` | PR 编号 |
| `version` | 版本号 |
| `published` | 是否已发布（true/false） |

## 高级用法

### 自定义版本文件

支持 `package.json` 或纯文本文件：

```yaml
- uses: oljc/release@v1
  with:
    version-file: version.txt
```

### 强制版本升级类型

```yaml
- uses: oljc/release@v1
  with:
    version-bump: minor  # major | minor | patch
```

### 发布渠道

```yaml
# 预发布版本
- uses: oljc/release@v1
  with:
    channel: beta  # alpha | beta | rc

# 稳定版本（默认）
- uses: oljc/release@v1
  with:
    channel: latest
```

### 自定义分支和前缀

```yaml
- uses: oljc/release@v1
  with:
    branch: develop
    branch-prefix: release/
    tag-prefix: v
```

## Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能 → **minor** 版本升级
- `fix:` 修复 bug → **patch** 版本升级
- `perf:` 性能优化 → **patch** 版本升级
- `BREAKING CHANGE` → **major** 版本升级

其他类型：`docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:`, `build:`

### 示例

```bash
# 新功能 (0.1.0 → 0.2.0)
git commit -m "feat: add user authentication"

# Bug 修复 (0.1.0 → 0.1.1)
git commit -m "fix: resolve login issue"

# Breaking change (0.1.0 → 1.0.0)
git commit -m "feat!: redesign API structure"
```

## 版本文件支持

### package.json

```json
{
  "version": "1.2.3"
}
```

### 纯文本文件

```
1.2.3
```

## 必要权限

确保 workflow 有以下权限：

```yaml
permissions:
  contents: write      # 创建 tag 和 release
  pull-requests: write # 创建和更新 PR
```

## License

MIT © [oljc](https://github.com/oljc)
