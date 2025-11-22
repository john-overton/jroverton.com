# jroverton.com Website Documentation

## Overview

This is a personal website built with Next.js 16, React 19, TypeScript, and Bootstrap 5. The site features a clean, minimalist design with a custom color palette and a comprehensive component library.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI Library**: React Bootstrap 5
- **Styling**: Bootstrap 5 + Custom CSS Variables
- **Package Manager**: npm

## Project Structure

```
website/
├── app/
│   ├── components/
│   │   ├── Header.tsx          # Main navigation header
│   │   ├── Footer.tsx           # Footer with links and copyright
│   │   └── ui/                  # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Dropdown.tsx
│   │       ├── Modal.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx
│   │       ├── Banner.tsx
│   │       ├── Breadcrumb.tsx
│   │       └── index.ts
│   ├── globals.css              # Global styles and Bootstrap theme
│   ├── layout.tsx               # Root layout component
│   └── page.tsx                 # Landing page
├── scripts/
│   ├── setup.sh                 # Initial setup script
│   ├── dev.sh                   # Development server script
│   ├── build.sh                 # Production build script
│   └── clean.sh                 # Clean build artifacts
├── documents/                   # Documentation (this folder)
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

### Initial Setup

1. Navigate to the website directory:
   ```bash
   cd website
   ```

2. Run the setup script:
   ```bash
   ../scripts/setup.sh
   ```
   Or manually install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
# or
../scripts/dev.sh
```

The site will be available at `http://localhost:3000`

### Building for Production

Build the production bundle:
```bash
npm run build
# or
../scripts/build.sh
```

Start the production server:
```bash
npm start
```

## Color Palette

The site uses a custom color palette defined in `app/globals.css`:

### Accent Colors
- **Cobalt Sky**: `#34D399` (Primary)
- **Prussian Blue**: `#059669` (Secondary)
- **Golden Hour**: `#F59E0B` (Warning)
- **Copper Penny**: `#EA580C` (Danger)
- **Dark Amber**: `#92400E`

### Base Colors
- **Background Primary**: `#FAFAF8`
- **Background Secondary**: `#F5F5F3`
- **Text Primary**: `#2C2C2C`
- **Text Secondary**: `#6B6B6B`
- **Border Light**: `#E5E5E3`

These colors are available as CSS variables and Bootstrap theme variables throughout the application.

## Components

### Layout Components

#### Header (`app/components/Header.tsx`)
- Responsive navigation bar
- Logo placeholder (currently shows "JO")
- Mobile-friendly hamburger menu
- Navigation links: Home, About, Projects, Contact

#### Footer (`app/components/Footer.tsx`)
- Two-column layout
- Left column: Quick Links
- Right column: Social/Connect links
- Copyright notice at bottom
- Responsive design

### UI Components

All UI components are located in `app/components/ui/` and exported via `index.ts`.

#### Button
```tsx
import { Button } from '@/app/components/ui';

<Button variant="primary">Click Me</Button>
```
Variants: `primary`, `secondary`, `success`, `warning`, `danger`, `outline-primary`, `outline-secondary`

#### Dropdown
```tsx
import { Dropdown } from '@/app/components/ui';
import { DropdownItem } from 'react-bootstrap';

<Dropdown title="Menu" variant="primary">
  <DropdownItem href="#action1">Action 1</DropdownItem>
  <DropdownItem href="#action2">Action 2</DropdownItem>
</Dropdown>
```

#### Modal
```tsx
import { Modal } from '@/app/components/ui';

<Modal
  show={showModal}
  onHide={() => setShowModal(false)}
  title="Modal Title"
  footer={<Button onClick={handleClose}>Close</Button>}
>
  Modal content here
</Modal>
```

#### Input Components
```tsx
import { Input, Select, TextField } from '@/app/components/ui';

<Input label="Name" placeholder="Enter your name" />
<Select label="Options" options={[...]} />
<TextField label="Message" rows={4} />
```

#### Badge
```tsx
import { Badge } from '@/app/components/ui';

<Badge variant="primary">New</Badge>
```

#### Banner (Alert)
```tsx
import { Banner } from '@/app/components/ui';

<Banner variant="info" dismissible onClose={handleClose}>
  Message here
</Banner>
```

#### Breadcrumb
```tsx
import { Breadcrumb } from '@/app/components/ui';

<Breadcrumb 
  items={[
    { label: 'Home', href: '/' },
    { label: 'Current', active: true }
  ]} 
/>
```

## Styling

### Custom CSS Classes

The following custom utility classes are available:

- `.btn-custom` - Custom button styling
- `.card-custom` - Custom card styling with hover effects
- `.form-control-custom` - Custom form input styling
- `.form-select-custom` - Custom select dropdown styling
- `.badge-custom` - Custom badge styling
- `.alert-custom` - Custom alert/banner styling
- `.text-primary-custom` - Primary text color
- `.text-secondary-custom` - Secondary text color
- `.bg-primary-custom` - Primary background color
- `.bg-secondary-custom` - Secondary background color

### Bootstrap Integration

Bootstrap 5 is fully integrated and customized via CSS variables. All Bootstrap components work out of the box, with custom styling applied through the theme variables defined in `globals.css`.

## Adding New Pages

1. Create a new file in `app/` directory:
   ```
   app/about/page.tsx
   ```

2. Use the layout components:
   ```tsx
   import Header from '@/app/components/Header';
   import Footer from '@/app/components/Footer';

   export default function About() {
     return (
       <div className="d-flex flex-column min-vh-100">
         <Header />
         <main className="flex-grow-1">
           {/* Your content */}
         </main>
         <Footer />
       </div>
     );
   }
   ```

## Customization

### Changing Colors

Edit `app/globals.css` and modify the CSS variables in the `:root` selector. The Bootstrap theme variables will automatically update.

### Adding Components

1. Create component file in `app/components/ui/`
2. Export from `app/components/ui/index.ts`
3. Use throughout the application

### Updating Logo

Replace the logo placeholder in `app/components/Header.tsx`:
```tsx
<Navbar.Brand href="/">
  <img src="/logo.png" alt="Logo" height="40" />
</Navbar.Brand>
```

## Scripts Reference

### Setup Script (`scripts/setup.sh`)
- Checks Node.js version
- Installs dependencies
- Verifies installation

### Development Script (`scripts/dev.sh`)
- Starts Next.js development server
- Hot reload enabled

### Build Script (`scripts/build.sh`)
- Builds production bundle
- Optimizes assets
- Generates static pages where possible

### Clean Script (`scripts/clean.sh`)
- Removes `.next` build directory
- Optionally removes `node_modules` (commented out)

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Vercel will automatically detect Next.js and configure build settings

### Other Platforms

1. Run `npm run build`
2. Start server with `npm start`
3. Configure environment variables as needed

## Troubleshooting

### Bootstrap JavaScript Not Working

Ensure Bootstrap JS is loaded in `app/layout.tsx`. The Script component should be included.

### Styles Not Applying

1. Check that `globals.css` is imported in `layout.tsx`
2. Verify Bootstrap CSS is imported
3. Clear `.next` cache: `npm run clean` or `../scripts/clean.sh`

### TypeScript Errors

Run type checking:
```bash
npx tsc --noEmit
```

### Build Errors

1. Clear build cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check Node.js version (requires 18+)

## Best Practices

1. **Component Organization**: Keep components in appropriate directories
2. **Type Safety**: Use TypeScript interfaces for all props
3. **Responsive Design**: Test on mobile, tablet, and desktop
4. **Accessibility**: Use semantic HTML and ARIA labels
5. **Performance**: Use Next.js Image component for images
6. **Code Style**: Follow existing patterns and conventions

## Future Enhancements

Potential improvements:
- Add dark mode support
- Implement blog functionality
- Add contact form with validation
- Integrate analytics
- Add SEO optimization
- Create admin dashboard
- Add search functionality

## Support

For issues or questions:
1. Check this documentation
2. Review Next.js documentation: https://nextjs.org/docs
3. Review Bootstrap documentation: https://getbootstrap.com/docs
4. Review React Bootstrap documentation: https://react-bootstrap.github.io/

