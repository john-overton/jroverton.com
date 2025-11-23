# Component Documentation

## Component Library Reference

This document provides detailed information about each component in the UI library.

## Layout Components

### Header

**Location**: `app/components/Header.tsx`

**Purpose**: Main navigation header with responsive menu

**Props**: None (self-contained)

**Features**:
- Responsive navigation bar
- Mobile hamburger menu
- Logo placeholder
- Navigation links: Home, About, Projects, Contact

**Usage**:
```tsx
import Header from '@/app/components/Header';

<Header />
```

**Customization**:
- Update logo in `Navbar.Brand`
- Modify navigation links in `Nav` component
- Adjust styling via Bootstrap classes or custom CSS

---

### Footer

**Location**: `app/components/Footer.tsx`

**Purpose**: Site footer with links and copyright

**Props**: None (self-contained)

**Features**:
- Two-column layout
- Quick Links section
- Social/Connect links section
- Copyright notice with current year

**Usage**:
```tsx
import Footer from '@/app/components/Footer';

<Footer />
```

**Customization**:
- Update links in the `Col` components
- Modify social links
- Adjust copyright text

---

## UI Components

### Button

**Location**: `app/components/ui/Button.tsx`

**Purpose**: Custom styled button component

**Props**:
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline-primary' | 'outline-secondary';
  size?: 'sm' | 'lg';
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  // ... all standard button props
}
```

**Usage**:
```tsx
import { Button } from '@/app/components/ui';

<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>
```

**Variants**:
- `primary` - Cobalt Sky color
- `secondary` - Prussian Blue color
- `success` - Cobalt Sky color
- `warning` - Golden Hour color
- `danger` - Copper Penny color
- `outline-primary` - Outlined primary
- `outline-secondary` - Outlined secondary

---

### Dropdown

**Location**: `app/components/ui/Dropdown.tsx`

**Purpose**: Dropdown menu component

**Props**:
```typescript
interface DropdownProps {
  title: string;
  children: ReactNode; // DropdownItem components
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}
```

**Usage**:
```tsx
import { Dropdown } from '@/app/components/ui';
import { DropdownItem } from 'react-bootstrap';

<Dropdown title="Menu" variant="primary">
  <DropdownItem href="#action1">Action 1</DropdownItem>
  <DropdownItem href="#action2">Action 2</DropdownItem>
</Dropdown>
```

---

### Modal

**Location**: `app/components/ui/Modal.tsx`

**Purpose**: Modal dialog component

**Props**:
```typescript
interface ModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode; // Optional footer content
}
```

**Usage**:
```tsx
import { Modal, Button } from '@/app/components/ui';
import { useState } from 'react';

const [show, setShow] = useState(false);

<Modal
  show={show}
  onHide={() => setShow(false)}
  title="Modal Title"
  footer={
    <>
      <Button variant="secondary" onClick={() => setShow(false)}>
        Close
      </Button>
      <Button variant="primary" onClick={handleSave}>
        Save
      </Button>
    </>
  }
>
  Modal content here
</Modal>
```

---

### Input Components

**Location**: `app/components/ui/Input.tsx`

**Purpose**: Form input components

#### Input

**Props**:
```typescript
interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
}
```

**Usage**:
```tsx
import { Input } from '@/app/components/ui';

<Input 
  label="Name"
  type="text"
  placeholder="Enter your name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

#### Select

**Props**:
```typescript
interface SelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  label?: string;
}
```

**Usage**:
```tsx
import { Select } from '@/app/components/ui';

<Select
  label="Choose Option"
  options={[
    { value: '', label: 'Select...' },
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' }
  ]}
  value={selected}
  onChange={(e) => setSelected(e.target.value)}
/>
```

#### TextField

**Props**:
```typescript
interface TextFieldProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  className?: string;
  label?: string;
}
```

**Usage**:
```tsx
import { TextField } from '@/app/components/ui';

<TextField
  label="Message"
  placeholder="Enter your message"
  rows={4}
  value={message}
  onChange={(e) => setMessage(e.target.value)}
/>
```

---

### Badge

**Location**: `app/components/ui/Badge.tsx`

**Purpose**: Badge/tag component

**Props**:
```typescript
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}
```

**Usage**:
```tsx
import { Badge } from '@/app/components/ui';

<Badge variant="primary">New</Badge>
<Badge variant="success">Active</Badge>
```

---

### Banner

**Location**: `app/components/ui/Banner.tsx`

**Purpose**: Alert/banner component

**Props**:
```typescript
interface BannerProps {
  variant?: 'success' | 'info' | 'warning' | 'danger';
  children: ReactNode;
  dismissible?: boolean;
  onClose?: () => void;
  className?: string;
}
```

**Usage**:
```tsx
import { Banner } from '@/app/components/ui';
import { useState } from 'react';

const [show, setShow] = useState(true);

{show && (
  <Banner 
    variant="info" 
    dismissible 
    onClose={() => setShow(false)}
  >
    <strong>Notice:</strong> This is an important message.
  </Banner>
)}
```

---

### Breadcrumb

**Location**: `app/components/ui/Breadcrumb.tsx`

**Purpose**: Breadcrumb navigation component

**Props**:
```typescript
interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}
```

**Usage**:
```tsx
import { Breadcrumb } from '@/app/components/ui';

<Breadcrumb 
  items={[
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Current Page', active: true }
  ]} 
/>
```

---

## Component Patterns

### Controlled Components

Form components use controlled component pattern:

```tsx
const [value, setValue] = useState('');

<Input
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### State Management

Components manage their own state or receive state via props:

```tsx
// Internal state
const [show, setShow] = useState(false);

// Props-based state
<Modal show={showModal} onHide={() => setShowModal(false)} />
```

### Composition

Components are composable and can be combined:

```tsx
<Card className="card-custom">
  <Card.Body>
    <Card.Title>Title</Card.Title>
    <Card.Text>Content</Card.Text>
    <Button variant="primary">Action</Button>
  </Card.Body>
</Card>
```

## Styling Components

### Custom Classes

Components use custom CSS classes defined in `globals.css`:
- `.btn-custom` - Button styling
- `.card-custom` - Card styling
- `.form-control-custom` - Input styling
- `.badge-custom` - Badge styling
- `.alert-custom` - Banner styling

### Bootstrap Classes

Components also accept standard Bootstrap classes:
- Spacing: `mb-3`, `mt-4`, `p-3`
- Display: `d-flex`, `d-none`, `d-md-block`
- Flexbox: `justify-content-center`, `align-items-center`
- Grid: `col-md-6`, `row`

## Best Practices

1. **Import from index**: Use barrel exports from `@/app/components/ui`
2. **Type Safety**: Always use TypeScript interfaces
3. **Accessibility**: Include proper ARIA labels
4. **Responsive**: Test on multiple screen sizes
5. **Performance**: Use React.memo for expensive components if needed

## Extending Components

To create a new component:

1. Create file in `app/components/ui/`
2. Export from `app/components/ui/index.ts`
3. Follow existing patterns
4. Add TypeScript interfaces
5. Use custom CSS classes
6. Document in this file


