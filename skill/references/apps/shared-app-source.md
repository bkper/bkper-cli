# Shared App Source

Bkper-managed app source gives your team and coding agents one shared private codebase for a Bkper app. Authorized app developers can clone the same repository, improve it locally, and continue from one shared history without setting up a separate Git host.

Every app sync and deployment requires clean, committed source stored in a durable Git remote. Bkper-managed source is the recommended default for development collaboration. It does not automatically build or deploy your app.

## Who can access the source

The app owner and users matched by the `developers` field in `bkper.yaml` can read and update managed source. This includes configured domain patterns such as `*@example.com`.

App users and Book collaborators do not receive source access unless they also match the app's developer policy.

## Start a shared codebase

A standalone app becomes eligible for Bkper-managed source when:

- `bkper.yaml` is at the root of its Git repository.
- The current branch is `main` for the first managed sync.
- The working tree is clean and has at least one commit.
- No Git remote is configured.

If the app source already exists but is not yet versioned, do not run `bkper app init` again. From the directory containing `bkper.yaml`, initialize it and review the files before committing. Update `.gitignore` first so local secrets, dependencies, and build output are not staged.

```bash
git init -b main

# Review files and update .gitignore before staging
git status --short

git add .

# Verify exactly what will be committed
git status --short
git commit -m "Initial app"
bkper app sync
```

For a new app, `bkper app init` initializes Git on `main`, but it does not create the first commit. Review and commit the app before its first sync:

```bash
bkper app init my-app
cd my-app

# Review the generated app, then commit it
git add .
git commit -m "Initial app"

bkper app sync
```

For an eligible new or existing app, `bkper app sync` creates its private Bkper-managed source and configures it as `origin`. The same command also syncs app metadata from `bkper.yaml`.

## Clone and continue together

Any authorized app developer can start from the shared codebase:

```bash
bkper app clone <appId>
cd <appId>
npm install
```

`bkper app clone` copies the repository but does not install dependencies or run repository scripts. A teammate or coding agent can then work in the local clone, run the project's checks, commit changes, and push them back to the shared repository. Another authorized developer can pull or clone that history and continue the work.

Keep agent instructions such as `AGENTS.md` in the repository so every teammate and coding agent starts with the same project context and safety rules.

## Source synchronization is not deployment

Source storage and app deployment are separate operations. Apps without a Git repository cannot sync or deploy; the CLI provides the initialization and managed-sync steps needed to establish source safely.

| Action             | What it does with source                                                       | Does it deploy? |
| ------------------ | ------------------------------------------------------------------------------ | --------------- |
| `git push`         | Stores committed source in the managed repository.                             | No              |
| `bkper app sync`   | Safely pushes managed source, then syncs app metadata from `bkper.yaml`.       | No              |
| `npm run build`    | Creates local build output in `dist/`.                                         | No              |
| `bkper app deploy` | Pushes and verifies the managed commit, then uploads the existing local build. | Yes             |

An ordinary Git push never deploys. `bkper app deploy` also does not run a build, so build locally before deploying the result you intend to release. The CLI verifies the stored source commit but does not prove that the local `dist/` output was built from it.

Managed sync and deploy require a clean, committed working tree and use fast-forward safety checks. External sync and deploy require the current branch to track an upstream containing the current clean commit. The CLI does not automatically commit, merge, rebase, force-push, reset, discard files, choose an external remote, or push to an external provider.

## External Git and monorepos

Bkper-managed source is optional. Existing workflows remain external when:

- the app already has a GitHub, GitLab, or other provider remote; or
- `bkper.yaml` is inside a monorepo rather than at the repository root.

The current branch must have a configured upstream containing the commit being synced or deployed. If no upstream is configured, choose the intended provider remote and store the branch explicitly:

```bash
git push --set-upstream <remote> <branch>
```

The CLI fetches and verifies the upstream without pushing or changing the working tree. Clone external apps from their provider. `bkper app clone` is for Bkper-managed source only.

Moving an existing standalone app from an external provider is intentional: the CLI never removes or renames an existing remote. Before changing remotes, make sure every branch and tag you want to preserve is available locally and the current `main` branch is clean and committed. Removing all external remotes and running `bkper app sync` then activates managed source for an eligible app.

The `repoUrl` field in `bkper.yaml` is app-listing metadata. It does not select managed or external source mode.

## Next steps

- [Your First App](https://bkper.com/docs/platform/apps/first-app.md) — Scaffold an app and establish its shared source
- [Building & Deploying](https://bkper.com/docs/platform/apps/deploying.md) — Build, sync, preview, and deploy explicitly
- [CLI](https://bkper.com/docs/platform/tools/cli.md) — Install the CLI and review its app-development workflows
- [Coding Agents](https://bkper.com/docs/ai/coding-agents.md) — Give coding agents the Bkper and project context they need
