# Troubleshooting Guide

## Rails/Puma Conflict Issue

### Problem
If you see an error like:
```
Puma caught this error: Cannot load database configuration:
Could not load database configuration. No such file - ["config/database.yml"]
```

This means Rails/Puma is trying to run instead of Next.js.

### Solution

1. **Kill any running Rails/Puma processes:**
   ```bash
   # Find processes on port 3000
   lsof -ti:3000
   
   # Kill them
   kill $(lsof -ti:3000)
   ```

2. **Clean up Rails cache files:**
   ```bash
   rm -rf tmp/cache
   ```

3. **Make sure you're running Next.js, not Rails:**
   ```bash
   cd website
   npm run dev
   ```

4. **If Rails keeps starting automatically:**
   - Check for a `Procfile` or `.foreman` file
   - Check if you have any Rails-related scripts running
   - Make sure you're in the `website` directory, not the root

### Verify Next.js is Running

When Next.js starts correctly, you should see:
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
```

Not:
```
Puma starting in single mode...
```

## Port Already in Use

If port 3000 is already in use:

1. **Find what's using it:**
   ```bash
   lsof -i :3000
   ```

2. **Kill the process:**
   ```bash
   kill <PID>
   ```

3. **Or use a different port:**
   ```bash
   PORT=3001 npm run dev
   ```

## Common Issues

### Bootstrap Styles Not Loading

1. Check that `globals.css` imports Bootstrap:
   ```css
   @import 'bootstrap/dist/css/bootstrap.min.css';
   ```

2. Verify Bootstrap is installed:
   ```bash
   npm list bootstrap
   ```

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run dev
   ```

### Components Not Rendering

1. Check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

2. Check browser console for errors

3. Verify imports are correct:
   ```tsx
   import Header from '@/app/components/Header';
   ```

### Build Errors

1. Clear build cache:
   ```bash
   rm -rf .next
   npm run build
   ```

2. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Getting Help

1. Check the main README.md
2. Review component documentation in COMPONENTS.md
3. Check Next.js documentation: https://nextjs.org/docs
4. Check Bootstrap documentation: https://getbootstrap.com/docs


