'use client';

import {
  BarChart3,
  Bus,
  ChartNoAxesCombined,
  ChartNoAxesGantt,
  Check,
  Map,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share,
  Share2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { type ReactNode, useCallback, useRef, useState } from 'react';

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

function DeadheadIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <Bus size={size} />
      <span className="absolute -bottom-1 -right-1.5 text-[7px] font-bold leading-none bg-cc-surface-1 text-cc-text-secondary rounded-sm px-0.5">
        (0)
      </span>
    </span>
  );
}

function SidebarTooltip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ top: number; left: number } | null>(null);
  const handleEnter = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setTooltip({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }, []);
  const handleLeave = useCallback(() => setTooltip(null), []);
  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {tooltip && (
        <span
          className="fixed -translate-y-1/2 px-2 py-1 rounded-md bg-cc-surface-1 border border-cc-border shadow-lg text-[11px] text-cc-text-secondary leading-snug whitespace-nowrap pointer-events-none"
          style={{ top: tooltip.top, left: tooltip.left, zIndex: 9999 }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

const ANALYZE_ITEMS: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'demand', label: 'Demand', icon: <BarChart3 size={16} /> },
  { key: 'performance', label: 'Performance', icon: <ChartNoAxesCombined size={16} /> },
  { key: 'map', label: 'Trip Map', icon: <Map size={16} /> },
  { key: 'deadhead', label: 'Deadhead', icon: <DeadheadIcon /> },
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
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [analyzeOpen, setAnalyzeOpen] = useState(hasTrips);
  const ShareIcon = detectedOS === 'apple' ? Share : Share2;

  const renderNavButton = (item: { key: TabKey; label: string; icon: ReactNode }) => {
    const isActive = activeTab === item.key;
    const isAnalyzeTab = ANALYZE_KEYS.has(item.key);
    const disabled = item.key === 'import' ? false : isAnalyzeTab ? !hasTrips : !hasData;
    const button = (
      <Button
        key={collapsed ? undefined : item.key}
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onTabChange(item.key)}
        className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} gap-2 mb-0.5 rounded-md ${
          isActive
            ? 'bg-cc-surface-3 text-cc-text font-semibold'
            : 'text-cc-text-secondary'
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && item.label}
      </Button>
    );
    if (collapsed) {
      return (
        <SidebarTooltip key={item.key} label={item.label}>
          {button}
        </SidebarTooltip>
      );
    }
    return button;
  };

  return (
    <>
      {/* Top: App logo */}
      <div className={`${collapsed ? 'px-2 pt-3 pb-2' : 'px-4 pt-4 pb-2'} border-b border-cc-border`}>
        {collapsed ? (
          <div className="flex justify-center">
            <ParallaxMark size="tiny" variant="color" />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Import (edit-only) */}
        {!readonlyView && renderNavButton(
          { key: 'import', label: 'Import', icon: <Upload size={16} /> },
        )}

        {/* Analyze group */}
        {collapsed ? (
          ANALYZE_ITEMS.map((item) => renderNavButton(item))
        ) : (
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
        )}

        {/* Routes and Bids (standalone) */}
        {renderNavButton(
          { key: 'runstructure', label: 'Routes and Bids', icon: <ChartNoAxesGantt size={16} /> },
        )}
      </nav>

      {/* Bottom: Share + Theme + Settings + Collapse toggle */}
      <div className="p-3 border-t border-cc-border flex items-center justify-center gap-1">
        {!collapsed && (
          <>
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
          </>
        )}

        {collapsed ? (
          <SidebarTooltip label="Expand sidebar">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </Button>
          </SidebarTooltip>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </Button>
        )}
      </div>
    </>
  );
}
