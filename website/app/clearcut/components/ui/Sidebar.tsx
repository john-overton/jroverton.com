'use client';

import { Activity, BarChart3, GitBranch, Map, Palette, Route, Settings, Upload } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/app/clearcut/components/shadcn/badge';
import { Button } from '@/app/clearcut/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/clearcut/components/shadcn/dropdown-menu';
import { palettes, type PaletteId } from '@/app/clearcut/theme/palettes';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runstructure' | 'deadhead';

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: ReactNode; editOnly?: boolean }> = [
  { key: 'import', label: 'Import', icon: <Upload size={16} />, editOnly: true },
  { key: 'demand', label: 'Demand', icon: <BarChart3 size={16} /> },
  { key: 'performance', label: 'Performance', icon: <Activity size={16} /> },
  { key: 'map', label: 'Trip Map', icon: <Map size={16} /> },
  { key: 'runstructure', label: 'Route Structure', icon: <GitBranch size={16} /> },
  { key: 'deadhead', label: 'Deadhead', icon: <Route size={16} /> },
];

interface SidebarProps {
  sessionName: string;
  dataSummary: string;
  readonlyView: boolean;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  hasData: boolean;
  paletteId: PaletteId;
  onPaletteChange: (id: PaletteId) => void;
  onRename: () => void;
  onClone: () => void;
  onDelete: () => void;
  onSetPassword: () => void;
  onRemovePassword: () => void;
  onLogout: () => void;
  hasPassword: boolean;
}

export default function Sidebar({
  sessionName,
  dataSummary,
  readonlyView,
  activeTab,
  onTabChange,
  hasData,
  paletteId,
  onPaletteChange,
  onRename,
  onClone,
  onDelete,
  onSetPassword,
  onRemovePassword,
  onLogout,
  hasPassword,
}: SidebarProps) {
  return (
    <>
      {/* Top: Session info */}
      <div className="p-4 border-b border-cc-border">
        <h1 className="text-lg font-semibold truncate" title={sessionName}>
          {sessionName}
        </h1>
        {readonlyView && (
          <Badge variant="secondary" className="mt-1">Read-only</Badge>
        )}
        <div className="text-xs text-cc-text-muted mt-1.5">{dataSummary}</div>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_ITEMS.map((item) => {
          if (item.editOnly && readonlyView) return null;
          const isActive = activeTab === item.key;
          const disabled = item.key !== 'import' && !hasData;
          return (
            <Button
              key={item.key}
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onTabChange(item.key)}
              className={`w-full justify-start gap-2 mb-0.5 rounded-md ${
                isActive
                  ? 'bg-cc-surface-3 text-cc-text font-semibold'
                  : 'text-cc-text-secondary'
              }`}
            >
              {item.icon}
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Bottom: Theme + Settings */}
      <div className="p-3 border-t border-cc-border flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Theme">
              <Palette size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuLabel>Light</DropdownMenuLabel>
            {palettes
              .filter((p) => p.mode === 'light')
              .map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => onPaletteChange(p.id as PaletteId)}>
                  {paletteId === p.id ? `\u2713 ${p.name}` : `  ${p.name}`}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Dark</DropdownMenuLabel>
            {palettes
              .filter((p) => p.mode === 'dark')
              .map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => onPaletteChange(p.id as PaletteId)}>
                  {paletteId === p.id ? `\u2713 ${p.name}` : `  ${p.name}`}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {!readonlyView && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Session options">
                <Settings size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={onSetPassword}>Set Password</DropdownMenuItem>
              {hasPassword && (
                <>
                  <DropdownMenuItem onClick={onRemovePassword}>Remove Password</DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClone}>Save As New</DropdownMenuItem>
              <DropdownMenuItem className="text-cc-danger" onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}
