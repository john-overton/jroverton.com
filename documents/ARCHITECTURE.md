# Architecture Documentation

## System Architecture

### High-Level Overview

The website is built using Next.js 16 with the App Router architecture, providing server-side rendering, static site generation, and client-side interactivity.

```
┌─────────────────────────────────────┐
│         Next.js App Router          │
├─────────────────────────────────────┤
│  ┌──────────┐      ┌──────────┐    │
│  │  Pages   │      │ Components│   │
│  │  (App)   │──────│  (React) │    │
│  └──────────┘      └──────────┘    │
│         │                 │         │
│         ▼                 ▼         │
│  ┌──────────────────────────────┐  │
│  │      Bootstrap 5 + CSS        │  │
│  │    (Custom Theme Variables)  │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Component Hierarchy

```
RootLayout (layout.tsx)
├── Header (components/Header.tsx)
│   └── Navigation Menu
├── Main Content (page.tsx)
│   ├── Hero Section
│   ├── Component Showcase
│   └── Various UI Components
└── Footer (components/Footer.tsx)
    ├── Quick Links Column
    └── Connect Links Column
```

## Data Flow

### Client-Side Components

Components marked with `'use client'` handle interactivity:
- Header (mobile menu toggle)
- Modal (show/hide state)
- Banner (dismissible state)
- Form inputs (controlled components)

### Server Components

Default components are server-rendered:
- Footer (static content)
- Layout (metadata, structure)
- Static content sections

## Styling Architecture

### CSS Variables System

```css
:root {
  /* Custom Colors */
  --cobalt-sky: #34D399;
  /* ... */
  
  /* Bootstrap Overrides */
  --bs-primary: var(--cobalt-sky);
  /* ... */
}
```

### Bootstrap Integration

1. Bootstrap CSS imported globally
2. Custom CSS variables override Bootstrap defaults
3. Custom utility classes extend Bootstrap
4. Component-specific styles in component files

## File Organization

### Component Structure

```
components/
├── Header.tsx          # Layout component
├── Footer.tsx          # Layout component
└── ui/                 # Reusable UI components
    ├── Button.tsx
    ├── Dropdown.tsx
    ├── Modal.tsx
    ├── Input.tsx
    ├── Badge.tsx
    ├── Banner.tsx
    ├── Breadcrumb.tsx
    └── index.ts        # Barrel export
```

### Routing Structure

Next.js App Router uses file-based routing:

```
app/
├── layout.tsx          # Root layout
├── page.tsx            # Home page (/)
├── about/
│   └── page.tsx        # About page (/about)
└── [dynamic]/
    └── page.tsx        # Dynamic routes
```

## State Management

Currently using React's built-in state management:
- `useState` for component-level state
- Props for parent-child communication
- No global state management library (can be added if needed)

## Performance Considerations

1. **Code Splitting**: Automatic with Next.js App Router
2. **Image Optimization**: Use Next.js Image component
3. **CSS**: Bootstrap loaded globally, custom CSS minimal
4. **JavaScript**: Bootstrap JS loaded via CDN (can be bundled)
5. **Static Generation**: Pages can be statically generated

## Security Considerations

1. **XSS Protection**: React automatically escapes content
2. **CSRF**: Next.js provides built-in protection
3. **Dependencies**: Regular security audits recommended
4. **Environment Variables**: Use `.env.local` for secrets

## Build Process

1. **Development**: `npm run dev`
   - Fast refresh enabled
   - Source maps included
   - Development optimizations

2. **Production Build**: `npm run build`
   - Code minification
   - Tree shaking
   - Static optimization
   - Image optimization

3. **Production Server**: `npm start`
   - Optimized server
   - Production mode

## Deployment Architecture

### Recommended: Vercel

```
GitHub Repository
    │
    ▼
Vercel Platform
    │
    ├── Build Process
    │   └── npm run build
    │
    └── Edge Network
        └── Global CDN
```

### Alternative: Self-Hosted

```
Server
├── Node.js Runtime
├── Next.js Application
└── Reverse Proxy (nginx)
    └── SSL/TLS
```

## Scalability

### Current Architecture

- Suitable for personal website
- Can handle moderate traffic
- Static pages for better performance

### Future Scaling Options

1. **CDN**: Already optimized for CDN delivery
2. **Caching**: Implement ISR (Incremental Static Regeneration)
3. **Database**: Add database for dynamic content
4. **API Routes**: Create API endpoints in `app/api/`
5. **Microservices**: Split into separate services if needed

## Monitoring & Analytics

### Recommended Tools

1. **Vercel Analytics**: Built-in with Vercel
2. **Google Analytics**: Add via Script component
3. **Error Tracking**: Sentry integration
4. **Performance**: Web Vitals monitoring

## Maintenance

### Regular Tasks

1. Update dependencies monthly
2. Review security advisories
3. Update content as needed
4. Monitor performance metrics
5. Backup data (if using database)

### Update Process

1. Test changes locally
2. Create feature branch
3. Test thoroughly
4. Merge to main
5. Deploy automatically (if CI/CD configured)

