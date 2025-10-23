# MaiChat v1.0.0 Publication Plan

## Overview

This document outlines the complete process of migrating MaiChat from GitHub Pages to Vercel, managing the custom domain (maichat.app), and ensuring a smooth v1.0.0 release.

---

## Current State (Before Migration)

### Hosting
- **GitHub Pages:** Active at `https://ebuyakin.github.io/maichat/`
- **Custom Domain:** `maichat.app` → Points to GitHub Pages
- **Claude Proxy:** Running on Vercel at `anthropic-proxy-phi.vercel.app`

### Code Status
- **Local:** v1.0.0 with all improvements (logo, optimizations, docs)
- **GitHub Remote:** Still on alpha version (needs update)
- **Production:** Alpha version live on GitHub Pages

---

## Migration Strategy

### Phase 1: Prepare & Push (Do First)

#### 1.1 Update README.md
- [x] Change references from "GitHub Pages" to "Vercel"
- [x] Update deployment instructions
- [ ] Verify all links point to correct locations

#### 1.2 Final Local Checks
```bash
# Check for uncommitted changes
git status

# Run tests
npm test

# Test production build locally
npm run build
npm run preview
# Visit http://localhost:4173 and test thoroughly
```

#### 1.3 Commit & Tag Release
```bash
# Commit any final changes
git add -A
git commit -m "chore: prepare v1.0.0 release"

# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0 - First public release"

# Push to GitHub
git push origin main
git push origin v1.0.0
```

---

### Phase 2: Deploy to Vercel (Parallel to GitHub Pages)

#### 2.1 Import Project to Vercel
1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Choose **`ebuyakin/maichat`** from GitHub
5. Configure build settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
6. Click **"Deploy"**
7. Wait for deployment (1-2 minutes)

#### 2.2 Note Vercel URLs
After deployment, you'll get:
- **Production URL:** `https://maichat-<random>.vercel.app` (or `maichat.vercel.app`)
- **Git Integration:** Every push to `main` auto-deploys

#### 2.3 Test Vercel Deployment
- [ ] Visit Vercel URL
- [ ] Test all features (send message, filter, topics, etc.)
- [ ] Check all 3 pages: index.html, app.html, tutorial.html
- [ ] Verify Claude proxy still works
- [ ] Test on mobile/different browsers

---

### Phase 3: Domain Management (maichat.app)

#### Current Domain Setup (GoDaddy → GitHub Pages)
Your GoDaddy DNS currently points to GitHub Pages:
- **A Record:** Points to GitHub's IP (likely `185.199.108.153` or similar)
- **CNAME (www):** May point to `ebuyakin.github.io`

#### Option A: Keep Both Active (Recommended First)

**Goal:** Test Vercel on a temporary subdomain while keeping main domain on GitHub Pages

**Setup:**
1. Keep `maichat.app` pointing to GitHub Pages (no changes)
2. Add temporary subdomain for Vercel testing:
   - In Vercel: Use default `maichat-xyz.vercel.app` URL
   - Test thoroughly for 1-2 days
3. Once confident, switch main domain to Vercel (Phase 4)

**Pros:**
- ✅ Zero downtime
- ✅ Can test Vercel without affecting users
- ✅ Easy rollback if issues found

**Cons:**
- ⚠️ Two versions live temporarily (may confuse users if they find both)

#### Option B: Switch Domain Immediately

**Goal:** Point maichat.app to Vercel right away

**Setup:**
1. Add `maichat.app` in Vercel dashboard
2. Update GoDaddy DNS immediately
3. GitHub Pages becomes inactive

**Pros:**
- ✅ Clean, single version
- ✅ Faster migration

**Cons:**
- ⚠️ Brief DNS propagation delay (5-60 minutes)
- ⚠️ No easy rollback

---

### Phase 4: Switch Custom Domain to Vercel (If Using Option A)

#### 4.1 Add Domain in Vercel
1. Go to Vercel → Your project → **Settings** → **Domains**
2. Click **"Add"**
3. Enter `maichat.app`
4. Also add `www.maichat.app` (optional)
5. Vercel will show DNS configuration instructions

#### 4.2 Update GoDaddy DNS

**Get Vercel's DNS settings from dashboard, typically:**

**For apex domain (maichat.app):**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 600
```

**For www subdomain (optional):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 600
```

**Steps in GoDaddy:**
1. Log in to GoDaddy
2. Go to **My Products** → **DNS**
3. Find existing **A Record** for `@` (apex)
4. Edit: Change value to Vercel's IP (from Vercel dashboard)
5. If exists, update **CNAME** for `www` to point to `cname.vercel-dns.com`
6. Save changes

#### 4.3 Wait for DNS Propagation
- **Time:** Usually 5-30 minutes, max 48 hours
- **Check:** Use `dig maichat.app` or https://dnschecker.org/
- **Vercel:** Will automatically issue SSL certificate once DNS resolves

#### 4.4 Verify Domain Works
1. Visit `https://maichat.app` (should load Vercel version)
2. Check SSL certificate (should show Vercel/Let's Encrypt)
3. Test all functionality again

---

### Phase 5: Disable GitHub Pages

**Only after Vercel is fully working and DNS has switched!**

#### 5.1 Disable GitHub Pages Deployment
1. Go to GitHub repo: `ebuyakin/maichat`
2. **Settings** → **Pages**
3. Under "Source" → Select **"None"**
4. Click **"Save"**

#### 5.2 Optional: Remove GitHub Actions Workflow
If you have `.github/workflows/deploy.yml` for GitHub Pages:
```bash
git rm .github/workflows/deploy.yml
git commit -m "chore: remove GitHub Pages workflow"
git push
```

#### 5.3 Update Repository Settings
1. GitHub repo → **Settings** → **General**
2. Update **Website** field to `https://maichat.app`
3. Update **Description** if needed

---

## Post-Migration Tasks

### 1. Monitor & Verify

#### Vercel Analytics
- Go to Vercel dashboard → Your project → **Analytics**
- Monitor traffic, errors, performance
- Check for any deployment issues

#### Test Checklist
- [ ] Homepage loads correctly
- [ ] App.html works (send/receive messages)
- [ ] Tutorial.html displays properly
- [ ] All API providers work (OpenAI, Claude, Gemini)
- [ ] Claude proxy still functional
- [ ] Keyboard shortcuts work
- [ ] Context filtering works
- [ ] Topic tree operations work
- [ ] Settings persist
- [ ] Export/import works
- [ ] Mobile responsive

### 2. Update External References

#### Update README.md (if not done already)
- [x] Change hosting references to Vercel
- [x] Update deployment instructions
- [x] Add Vercel badge (optional)

#### Update Social Links (if applicable)
- [ ] Twitter/X bio
- [ ] LinkedIn
- [ ] Personal website
- [ ] Dev.to or Medium posts

### 3. Create GitHub Release

1. Go to GitHub repo → **Releases**
2. Click **"Create a new release"**
3. Select tag `v1.0.0`
4. Title: **"MaiChat v1.0.0 - First Public Release"**
5. Description: Copy from CHANGELOG.md
6. Attach build artifacts (optional): `npm run build` → zip `dist/`
7. Click **"Publish release"**

### 4. Announce Release (Optional)

Consider sharing on:
- [ ] GitHub Discussions
- [ ] Reddit (r/webdev, r/ChatGPT, r/ClaudeAI)
- [ ] Hacker News
- [ ] Twitter/X
- [ ] Personal blog/website

---

## Rollback Plan (If Issues Arise)

### If Vercel Has Problems

#### Quick Rollback to GitHub Pages
1. In GoDaddy DNS: Change A record back to GitHub's IP
2. Re-enable GitHub Pages in repo settings
3. Wait for DNS propagation (5-30 minutes)

#### Vercel-Specific Issues
- Check Vercel **Deployments** → **Logs** for errors
- Verify environment variables (if any)
- Check build logs for failures
- Redeploy from Vercel dashboard

---

## Timeline Estimate

**Minimum (everything goes smoothly):** 2-3 hours
**Realistic (with testing):** 1 day
**Conservative (with DNS propagation):** 2 days

### Suggested Schedule

**Day 1 Morning:**
- Push v1.0.0 to GitHub
- Deploy to Vercel
- Test Vercel deployment thoroughly

**Day 1 Afternoon:**
- If tests pass: Update DNS to point to Vercel
- Monitor for issues

**Day 2:**
- Verify DNS has propagated
- Disable GitHub Pages
- Create GitHub release
- Monitor analytics

---

## Contacts & Resources

### Vercel Support
- Dashboard: https://vercel.com/dashboard
- Docs: https://vercel.com/docs
- Status: https://www.vercel-status.com/

### GoDaddy DNS
- Dashboard: https://dcc.godaddy.com/
- DNS Management: My Products → Domain → DNS

### GitHub
- Repository: https://github.com/ebuyakin/maichat
- Pages Settings: Settings → Pages

---

## Checklist Summary

### Pre-Migration
- [ ] README.md updated for Vercel
- [ ] All changes committed and pushed
- [ ] v1.0.0 tag created
- [ ] Local build tested

### Migration
- [ ] Vercel project created and deployed
- [ ] Vercel deployment tested thoroughly
- [ ] Domain added in Vercel dashboard
- [ ] GoDaddy DNS updated
- [ ] DNS propagation verified
- [ ] SSL certificate issued by Vercel

### Post-Migration
- [ ] GitHub Pages disabled
- [ ] GitHub release created
- [ ] Vercel analytics monitored
- [ ] All features tested on live site
- [ ] External references updated

---

## Notes

- Keep GitHub Pages active for at least 24-48 hours during testing
- DNS propagation can take up to 48 hours (usually much faster)
- Vercel deployments are automatic after initial setup
- Claude proxy is unaffected by this migration (already on Vercel)
- All data is client-side, so hosting change doesn't affect user data

---

**Document Version:** 1.0  
**Created:** 2025-10-18  
**Last Updated:** 2025-10-18
