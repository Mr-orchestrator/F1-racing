# GridBox Analytics - Deployment Guide

## GitHub Setup

```bash
# Create GitHub repository (if you haven't already)
gh repo create gridbox-analytics --public --source=. --push

# OR manually add remote
git remote add origin https://github.com/YOUR_USERNAME/gridbox-analytics.git
git branch -M main
git push -u origin main
```

## Vercel Deployment

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy to production
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository: `gridbox-analytics`
3. Configure project:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: `.`
   - **Install Command**: (leave empty)
4. Click "Deploy"

### Option 3: Connect GitHub to Vercel

1. Push code to GitHub first
2. Go to Vercel Dashboard
3. Click "Add New Project"
4. Import from GitHub
5. Select `gridbox-analytics` repository
6. Deploy with default settings

## What Gets Deployed

- Static HTML pages (index.html, teams.html, etc.)
- GridBox Analytics Layer (analytics.js)
- SPA Booking Flow (booking-spa.html)
- Test Suite (test-datalayer.html)
- All CSS and assets

## Post-Deployment

### Test URLs

Once deployed, test these pages:
- `/` - Home page
- `/teams.html` - Teams page
- `/merchandise.html` - Product listing  
- `/tickets.html` - Ticket booking (links to SPA)
- `/booking-spa.html` - SPA with manual page tracking
- `/test-datalayer.html` - DataLayer test suite

### Verify GridBox Layer

Open browser console and check:

```javascript
// Should show array of events
console.log(gridboxLayer);

// Should have tracking functions
console.log(gridbox.view);
console.log(gridbox.link);

// Test manual tracking
gridbox.link({
    event_category: 'test',
    event_action: 'click',
    event_label: 'deployment-test'
});
```

## Environment Variables

No environment variables required - this is a static site.

## Custom Domain (Optional)

In Vercel Dashboard:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed

## Current Deployment Status

- ✅ Git repository initialized
- ✅ All files committed
- ⏳ GitHub remote (needs setup)
- ⏳ Vercel deployment (needs setup)

## Files Changed

Latest commit removed digitalData and dataLayer:
- Only `gridboxLayer` is used universally
- No GTM/GA4 conflicts
- Simplified tracking architecture

---

**Ready to deploy!** Follow the steps above to push to GitHub and deploy to Vercel.
