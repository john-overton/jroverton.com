import { Breadcrumb as BSBreadcrumb } from 'react-bootstrap';

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <BSBreadcrumb className="mb-3">
      {items.map((item, index) => (
        <BSBreadcrumb.Item 
          key={index}
          href={item.href}
          active={item.active || index === items.length - 1}
        >
          {item.label}
        </BSBreadcrumb.Item>
      ))}
    </BSBreadcrumb>
  );
}

