import type { Metadata } from 'next';
import AdminPanelClient from './AdminPanelClient';

export const metadata: Metadata = {
  title: 'Parallax Admin',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanelClient />;
}
