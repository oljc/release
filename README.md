# Release

> 基于 Conventional Commits 的自动化发布管理工具

自动生成 changelog、升级版本号、创建发布 PR，并在合并后自动发布 GitHub Release。

## ✨ 特性

- 🤖 **全自动化** - 从 commit 到 release 全流程自动化
- 📝 **智能 Changelog** - 基于 Conventional Commits 自动生成结构化变更日志
- 🔢 **语义化版本** - 自动检测版本升级类型（major/minor/patch）
- 🎯 **灵活配置** - 支持自定义版本文件、分支、tag 前缀等
- 🏷️ **预发布支持** - 支持 alpha、beta、rc 等预发布版本
- 📦 **零配置** - 开箱即用，默认配置适用大多数场景

## 快速开始

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

## 工作流程

1. **提交代码** - 使用 Conventional Commits 规范提交代码
2. **自动分析** - Action 分析 commits 并确定版本升级类型
3. **创建 PR** - 自动创建包含 changelog 和版本更新的 PR
4. **审核合并** - 审核 PR 内容并合并
5. **自动发布** - 合并后自动创建 tag 和 GitHub Release

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
| `prerelease` | 预发布标识符 | - | ❌ |
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

### 预发布版本

```yaml
- uses: oljc/release@v1
  with:
    prerelease: beta  # alpha | beta | rc
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
