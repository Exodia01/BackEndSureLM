# SureLM Backup Instructions

**Backup Date:** 2026-07-27  
**Purpose:** Pre-refactoring state snapshot  
**Location:** GitHub repository + local `backup/` folder

---

## 📋 Backup Contents

| Component | Size | Location |
|-----------|------|----------|
| Source code (lib, app/api, config) | ~15 MB | Git branch + ZIP |
| Prisma schema | ~20 KB | Git commit |
| Configuration files | <1 MB | Git commit |

---

## 🔄 Recovery Commands

### Option 1: From Git Branch
```bash
# Switch to backup branch
git checkout backup/pre-refactor-2026-07-27

# Or reset current branch to backup state
git reset --hard origin/backup/pre-refactor-2026-07-27
```

### Option 2: From Git TAG
```bash
# Verify tag exists
git fetch --tags
git log backup/pre-refactor-2026-07-27 --oneline

# Checkout at tag (read-only)
git checkout backup/pre-refactor-2026-07-27
```

### Option 3: From Local ZIP Archive
```powershell
# Extract to new location
Expand-Archive -Path "S:\BackEndSureLM\backup\pre-refactor-2026-07-27.zip" `
  -DestinationPath "C:\restore\surelm-backup-2026-07-27"
```

---

## ✅ Verification Steps

### Git Status Check
```bash
# Confirm backup branch exists
git ls-remote origin | grep backup/pre-refactor-2026-07-27

# Verify tag points to correct commit
git show backup/pre-refactor-2026-07-27 --stat
```

### Disk Space Check (Required)
```bash
# Minimum required: 500 MB free space
df -h .  # Linux/Mac
Get-PSDrive | Where-Object { $_.Name -eq "S" } | Select-Object Free
```

---

## 📊 Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| npm/pnpm | Latest stable |
| Docker | 24+ (for PostgreSQL + Qdrant) |

---

## ⚠️ Post-Recovery Actions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

3. **Restore environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   npm run dev
   ```

---

## 🗑️ Archival Retention Policy

**Keep backup until:** 2 weeks after successful refactoring  
**Delete when:** Production deployment verified with new code

---

## 📞 Support

For issues, contact: development team
