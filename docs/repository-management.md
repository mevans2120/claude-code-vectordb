# Repository Management Guide

## Overview

This guide explains how to manage `claude-code-vectordb` as a shared resource across multiple projects while maintaining a single source of truth.

## Recommended: Symbolic Link Approach

This is the simplest and most flexible approach for local development.

### Setup

1. **Clone the vectordb to a central location:**

```bash
# Create a central directory for shared tools
mkdir -p ~/Development/shared-tools
cd ~/Development/shared-tools

# Clone the vectordb repository
git clone https://github.com/yourusername/claude-code-vectordb.git
```

2. **Create symlinks in projects that need it:**

```bash
# In your project directory
cd ~/Development/my-awesome-project

# Create a symbolic link
ln -s ~/Development/shared-tools/claude-code-vectordb ./vectordb

# Verify the link
ls -la vectordb
# Should show: vectordb -> /Users/you/Development/shared-tools/claude-code-vectordb
```

### Benefits of Symlinks

- ✅ **Instant updates** - Changes in the main repo apply everywhere
- ✅ **Single installation** - npm install only needed once
- ✅ **Git-friendly** - Add `vectordb` to .gitignore in each project
- ✅ **Easy maintenance** - Update once, affects all projects
- ✅ **IDE support** - Most IDEs follow symlinks transparently

### Using with Git

In each project's `.gitignore`:

```gitignore
# Ignore the symlinked vectordb
vectordb
```

### Updating the Vectordb

```bash
# Go to the central location
cd ~/Development/shared-tools/claude-code-vectordb

# Pull latest changes
git pull origin main

# All symlinked projects automatically get the updates!
```

## Alternative: Git Submodule

Better for team collaboration and CI/CD.

### Setup

```bash
# In your project
git submodule add https://github.com/yourusername/claude-code-vectordb.git vectordb
git commit -m "Add vectordb as submodule"
```

### Updating

```bash
# Update submodule
cd vectordb
git pull origin main
cd ..
git add vectordb
git commit -m "Update vectordb submodule"
```

### For team members

```bash
git clone --recursive your-project-url
# or if already cloned
git submodule update --init --recursive
```

## Alternative: NPM Package from GitHub

Best for production and CI/CD environments.

### In package.json:

```json
{
  "dependencies": {
    "claude-code-vectordb": "github:yourusername/claude-code-vectordb#main"
  }
}
```

### Install:

```bash
npm install
```

### Update:

```bash
npm update claude-code-vectordb
```

## Decision Matrix

| Approach | Best For | Pros | Cons |
|----------|----------|------|------|
| **Symlink** | Local dev | Instant updates, single install | Not portable, local only |
| **Submodule** | Teams | Version control, portable | More complex git workflow |
| **NPM GitHub** | Production | Standard npm workflow | Requires reinstall for updates |
| **NPM Link** | Testing | Quick setup | Can break, temporary |

## Practical Example: Multi-Project Setup

```bash
# Directory structure
~/Development/
├── shared-tools/
│   └── claude-code-vectordb/    # Main repo
├── project-a/
│   └── vectordb -> ../shared-tools/claude-code-vectordb
├── project-b/
│   └── vectordb -> ../shared-tools/claude-code-vectordb
└── project-c/
    └── vectordb -> ../shared-tools/claude-code-vectordb
```

### Agent Usage in Any Project:

```typescript
// In project-a, project-b, or project-c
import { ChromaClient } from 'chromadb';

// All projects connect to the same ChromaDB instance
const client = new ChromaClient({ path: 'http://localhost:8000' });
const collection = await client.getCollection({ name: 'project-docs' });
```

## Managing ChromaDB Data

### Option 1: Shared Database (Recommended)

All projects share one ChromaDB instance:

```bash
# Start once, use everywhere
cd ~/Development/shared-tools/claude-code-vectordb
npm run chromadb:start
```

### Option 2: Project-Specific Collections

```typescript
// Each project uses its own collection
const collection = await client.getOrCreateCollection({
  name: `project-${projectName}-docs`
});
```

### Option 3: Multiple ChromaDB Instances

```bash
# Project A on port 8000
CHROMA_PORT=8000 npm run chromadb:start

# Project B on port 8001
CHROMA_PORT=8001 npm run chromadb:start
```

## Backup Strategy

### Centralized Backups

```bash
# Create backup directory
mkdir -p ~/Development/shared-tools/vectordb-backups

# Backup script (run periodically)
cd ~/Development/shared-tools/claude-code-vectordb
tsx skills/backup-all.ts ~/Development/shared-tools/vectordb-backups
```

### Project-Specific Backups

```typescript
// Each project backs up its own data
await db.exportBackup(`./backups/${projectName}-${Date.now()}.jsonl`);
```

## Best Practices

1. **Use symlinks for local development** - Simple and effective
2. **Use submodules for team projects** - Better version control
3. **Keep ChromaDB running continuously** - Start on boot if possible
4. **Regular backups** - Automate with cron or similar
5. **Document your setup** - Add to project README

## Troubleshooting

### Symlink not working?

```bash
# Check if symlink exists
ls -la vectordb

# Recreate if broken
rm vectordb
ln -s ~/Development/shared-tools/claude-code-vectordb ./vectordb
```

### ChromaDB connection issues?

```bash
# Check if running
ps aux | grep chroma

# Restart
npm run chromadb:stop
npm run chromadb:start
```

### Updates not appearing?

```bash
# In the main repo
cd ~/Development/shared-tools/claude-code-vectordb
git status  # Check for uncommitted changes
git pull origin main
```

## Summary

For your use case, **symbolic links are perfect**:
- Easy to set up
- Updates apply instantly everywhere
- No complex git workflows
- Works seamlessly with AI agents

Just remember to:
1. Keep the main repo in a stable location
2. Add symlinks to .gitignore
3. Document the setup for your future self