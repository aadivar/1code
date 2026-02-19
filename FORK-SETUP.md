# Fork Auto-Update Setup

This guide explains how to set up your own fork with automatic builds and auto-updates.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Upstream Repo  │────>│   Your Fork     │────>│  GitHub Release │
│ (21st-dev/1code)│     │  (auto-synced)  │     │  (with builds)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │   every 6 hours       │   on push             │
        └───────────────────────┴───────────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Your Local App │
                                               │  (auto-updates) │
                                               └─────────────────┘
```

## Step 1: Fork the Repository

1. Go to https://github.com/21st-dev/1code
2. Click "Fork" in the top right
3. Create the fork under your account

## Step 2: Enable GitHub Actions

After forking:

1. Go to your fork's Settings → Actions → General
2. Under "Actions permissions", select "Allow all actions"
3. Under "Workflow permissions", select "Read and write permissions"
4. Click Save
5. If your `main` branch is protected, allow GitHub Actions to bypass it or disable "Require a pull request before merging" (auto-sync pushes directly to `main`)

## Step 3: Initial Build

Trigger the first build manually:

1. Go to Actions tab in your fork
2. Select "Build and Release" workflow
3. Click "Run workflow" → "Run workflow"

This will:
- Build the app for macOS (unsigned)
- Create a GitHub Release with the build artifacts

## Step 4: Configure Your Local App

After the first release is created, configure your local app to use your fork:

### Option A: Run the setup script

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/1code.git
cd 1code

# Install dependencies
bun install

# Configure updates from your fork
bun run setup:fork YOUR_USERNAME

# Build and run the app
bun run dev
```

### Option B: Manual configuration

Create/edit `~/Library/Application Support/1Code/update-config.json`:

```json
{
  "source": "github",
  "githubRepo": "YOUR_USERNAME/1code"
}
```

## Step 5: Build Your First Package

```bash
# Build the app (unsigned, for local use)
bun run build
bun run package:mac -- --config.mac.identity=null --config.mac.notarize=null
```

Install the app from `release/1Code-*.dmg`.

## How Auto-Sync Works

The `sync-fork.yml` workflow:

1. **Runs every 6 hours** (configurable in cron)
2. Fetches upstream `main` branch
3. Merges changes into your fork
4. If changes detected → triggers build workflow

### Manual Sync

You can also manually trigger a sync:
1. Go to Actions → "Sync Fork with Upstream Main"
2. Click "Run workflow"
3. Optionally check "Force build" to rebuild even without changes

## How Auto-Update Works

The app checks for updates:
- When the app starts (after 5 second delay)
- When the app window gains focus
- Minimum 1 minute between checks

When an update is found:
1. Shows "Update available" banner
2. User clicks "Update" to download
3. After download, user clicks "Restart Now"
4. App installs update and restarts

## Customization

### Change Sync Frequency

Edit `.github/workflows/sync-fork.yml`:

```yaml
schedule:
  # Every hour
  - cron: "0 * * * *"
  # Every 6 hours
  - cron: "0 */6 * * *"
  # Once a day at midnight
  - cron: "0 0 * * *"
```

### Enable Windows/Linux Builds

Edit `.github/workflows/build-release.yml`:

```yaml
build-windows:
  if: true  # Change from false to true

build-linux:
  if: true  # Change from false to true
```

### Revert to Official Updates

To switch back to official 21st.dev CDN updates:

```bash
bun run setup:fork --cdn
```

Or delete the config file:
```bash
rm ~/Library/Application\ Support/1Code/update-config.json
```

## Troubleshooting

### Build fails: "Claude Code download failed"

The Claude Code binary download may require authentication. The workflow has `continue-on-error: true` for this step, but you may need to:

1. Download binaries manually from the official release
2. Add them to your fork's `resources/bin/` directory
3. Commit and push

### App doesn't detect updates

1. Check the update config:
   ```bash
   cat ~/Library/Application\ Support/1Code/update-config.json
   ```

2. Verify your fork has releases:
   ```
   https://github.com/YOUR_USERNAME/1code/releases
   ```

3. Check app logs:
   ```bash
   cat ~/Library/Logs/1Code/main.log | grep AutoUpdater
   ```

### Merge conflicts on sync

If the sync workflow fails due to merge conflicts:

1. Clone your fork locally
2. Resolve conflicts manually:
   ```bash
   git fetch upstream
   git merge upstream/main
   # Resolve conflicts
   git push
   ```

## Security Notes

- **Unsigned builds**: These builds are not code-signed or notarized
- macOS may show warnings when opening the app
- Right-click → Open to bypass Gatekeeper on first launch
- This is fine for personal use; for distribution, set up proper signing

## Architecture

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `sync-fork.yml` | Cron (every 6 hours), manual | Sync with upstream |
| `build-release.yml` | Push to main, manual, after sync | Build and release |

| Config File | Location | Purpose |
|-------------|----------|---------|
| `update-config.json` | `~/Library/Application Support/1Code/` | Update source config |
