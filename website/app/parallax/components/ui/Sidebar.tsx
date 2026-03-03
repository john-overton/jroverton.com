'use client';

import {
  BarChart3,
  Check,
  GitBranch,
  Map,
  Palette,
  Percent,
  Route,
  Settings,
  Share,
  Share2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Badge } from '@/app/parallax/components/shadcn/badge';
import { Button } from '@/app/parallax/components/shadcn/button';
import ParallaxMark from './ParallaxMark';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/parallax/components/shadcn/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/parallax/components/shadcn/dropdown-menu';
import { palettes, type PaletteId } from '@/app/parallax/theme/palettes';

type TabKey = 'import' | 'demand' | 'performance' | 'map' | 'runstructure' | 'deadhead';

const ANALYZE_ITEMS: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'demand', label: 'Demand', icon: <BarChart3 size={16} /> },
  { key: 'performance', label: 'Performance', icon: <Percent size={16} /> },
  { key: 'map', label: 'Trip Map', icon: <Map size={16} /> },
  { key: 'deadhead', label: 'Deadhead', icon: <Route size={16} /> },
];

const ANALYZE_KEYS = new Set<TabKey>(ANALYZE_ITEMS.map((i) => i.key));

interface SidebarProps {
  sessionName: string;
  dataSummary: string;
  readonlyView: boolean;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  hasData: boolean;
  hasTrips: boolean;
  paletteId: PaletteId;
  onPaletteChange: (id: PaletteId) => void;
  onRename: () => void;
  onClone: () => void;
  onDelete: () => void;
  onSetPassword: () => void;
  onRemovePassword: () => void;
  onLogout: () => void;
  hasPassword: boolean;
  onCopyReadonlyLink: () => void;
  onCopyEditLink: () => void;
  copiedLink: 'readonly' | 'edit' | null;
  detectedOS: string;
}

export default function Sidebar({
  sessionName,
  dataSummary,
  readonlyView,
  activeTab,
  onTabChange,
  hasData,
  hasTrips,
  paletteId,
  onPaletteChange,
  onRename,
  onClone,
  onDelete,
  onSetPassword,
  onRemovePassword,
  onLogout,
  hasPassword,
  onCopyReadonlyLink,
  onCopyEditLink,
  copiedLink,
  detectedOS,
}: SidebarProps) {
  const [analyzeOpen, setAnalyzeOpen] = useState(hasTrips);
  const ShareIcon = detectedOS === 'apple' ? Share : Share2;

  const renderNavButton = (item: { key: TabKey; label: string; icon: ReactNode }) => {
    const isActive = activeTab === item.key;
    const isAnalyzeTab = ANALYZE_KEYS.has(item.key);
    const disabled = item.key === 'import' ? false : isAnalyzeTab ? !hasTrips : !hasData;
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
  };

  return (
    <>
      {/* Top: App logo */}
      <div className="px-4 pt-4 pb-2 border-b border-cc-border">
        <div className="flex items-center gap-3 mb-3">
          <ParallaxMark size="tiny" variant="color" />
          <span
            className="font-semibold text-sm tracking-[3px] uppercase"
            style={{ fontFamily: "'Outfit', var(--font-outfit), sans-serif" }}
          >
            Parallax
          </span>
        </div>
        <h1 className="text-lg font-semibold truncate" title={sessionName}>
          {sessionName}
        </h1>
        {readonlyView && (
          <Badge variant="secondary" className="mt-1">Read-only</Badge>
        )}
        <div className="text-xs text-cc-text-secondary font-medium mt-2">Imported Data</div>
        <div className="text-xs text-cc-text-muted mt-0.5">{dataSummary}</div>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Import (edit-only) */}
        {!readonlyView && renderNavButton(
          { key: 'import', label: 'Import', icon: <Upload size={16} /> },
        )}

        {/* Analyze group */}
        <Collapsible open={analyzeOpen} onOpenChange={setAnalyzeOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasTrips}
              className={`w-full justify-start gap-2 mb-0.5 rounded-md ${
                ANALYZE_KEYS.has(activeTab) && !analyzeOpen
                  ? 'text-cc-text font-semibold'
                  : 'text-cc-text-secondary'
              }`}
            >
              <TrendingUp size={16} className="shrink-0" />
              Analyze
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4">
              {ANALYZE_ITEMS.map((item) => renderNavButton(item))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Routes and Bids (standalone) */}
        {renderNavButton(
          { key: 'runstructure', label: 'Routes and Bids', icon: <GitBranch size={16} /> },
        )}
      </nav>

      {/* Bottom: Share + Theme + Settings */}
      <div className="p-3 border-t border-cc-border flex items-center justify-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Share">
              <ShareIcon size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuLabel>Share</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              onClick={onCopyReadonlyLink}
            >
              {copiedLink === 'readonly' ? (
                <span className="flex items-center gap-1.5 text-cc-success">
                  <Check size={14} /> Copied!
                </span>
              ) : (
                'Copy read-only link'
              )}
            </DropdownMenuItem>
            {!readonlyView && (
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={onCopyEditLink}
              >
                {copiedLink === 'edit' ? (
                  <span className="flex items-center gap-1.5 text-cc-success">
                    <Check size={14} /> Copied!
                  </span>
                ) : (
                  'Copy edit link'
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
