import { useState } from "react";

const palettes = [
  {
    name: "Revenue Run",
    tag: "High-contrast wayfinding",
    mode: "light",
    description: "Bold primaries guide the eye like transit signage. Red/amber/green carry instant meaning — ops teams already think in these colors. The indigo accent anchors navigation and actions without competing with status colors.",
    tokens: {
      background: "#F4F6FA",
      "surface-1": "#FFFFFF",
      "surface-2": "#EDF0F7",
      "surface-3": "#E0E4EF",
      border: "#CDD3E0",
      "border-hover": "#A8B1C4",
      "text-primary": "#141B2D",
      "text-secondary": "#4A5468",
      "text-muted": "#7C8598",
      accent: "#4F46E5",
      "accent-hover": "#4338CA",
      "accent-muted": "rgba(79,70,229,0.08)",
      "accent-foreground": "#FFFFFF",
      success: "#059669",
      "success-light": "#D1FAE5",
      warning: "#D97706",
      "warning-light": "#FEF3C7",
      danger: "#DC2626",
      "danger-light": "#FEE2E2",
      info: "#0284C7",
      "info-light": "#E0F2FE",
      "chart-1": "#4F46E5",
      "chart-2": "#059669",
      "chart-3": "#DC2626",
      "chart-4": "#D97706",
      "chart-5": "#0284C7",
      "chart-6": "#7C3AED",
    },
    chartColors: ["#4F46E5", "#059669", "#DC2626", "#D97706", "#0284C7", "#7C3AED"],
  },
  {
    name: "Peak Hour",
    tag: "Data-forward & vivid",
    mode: "light",
    description: "Maximum color confidence on a crisp surface. An electric blue primary with fully saturated chart colors designed for instant differentiation. Every data series pops — no squinting at legends. Built for dense dashboards where 6+ categories coexist.",
    tokens: {
      background: "#F0F4F8",
      "surface-1": "#FFFFFF",
      "surface-2": "#E8EDF4",
      "surface-3": "#DAE1EC",
      border: "#C5CEDB",
      "border-hover": "#9DAAB8",
      "text-primary": "#0F172A",
      "text-secondary": "#3E4C63",
      "text-muted": "#728096",
      accent: "#2563EB",
      "accent-hover": "#1D4FD8",
      "accent-muted": "rgba(37,99,235,0.08)",
      "accent-foreground": "#FFFFFF",
      success: "#10B981",
      "success-light": "#D1FAE5",
      warning: "#F59E0B",
      "warning-light": "#FEF9C3",
      danger: "#EF4444",
      "danger-light": "#FEE2E2",
      info: "#06B6D4",
      "info-light": "#CFFAFE",
      "chart-1": "#2563EB",
      "chart-2": "#F43F5E",
      "chart-3": "#10B981",
      "chart-4": "#F59E0B",
      "chart-5": "#8B5CF6",
      "chart-6": "#06B6D4",
    },
    chartColors: ["#2563EB", "#F43F5E", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4"],
  },
  {
    name: "Evening Rush",
    tag: "Cool dark + electric color",
    mode: "dark",
    description: "Navy-black depth with a cyan primary that cuts like a laser. Cool and precise — feels like a control room for modern transit. Chart colors are neon-grade but balanced: each occupies its own hue lane so nothing bleeds together on dense screens.",
    tokens: {
      background: "#0B0E14",
      "surface-1": "#111620",
      "surface-2": "#19202E",
      "surface-3": "#212A3A",
      border: "#2A3448",
      "border-hover": "#3B4A64",
      "text-primary": "#E8ECF4",
      "text-secondary": "#8D99B0",
      "text-muted": "#5A6680",
      accent: "#06B6D4",
      "accent-hover": "#22D3EE",
      "accent-muted": "rgba(6,182,212,0.10)",
      "accent-foreground": "#0B0E14",
      success: "#4ADE80",
      "success-light": "rgba(74,222,128,0.12)",
      warning: "#FACC15",
      "warning-light": "rgba(250,204,21,0.10)",
      danger: "#F87171",
      "danger-light": "rgba(248,113,113,0.12)",
      info: "#818CF8",
      "info-light": "rgba(129,140,248,0.10)",
      "chart-1": "#06B6D4",
      "chart-2": "#F87171",
      "chart-3": "#4ADE80",
      "chart-4": "#FACC15",
      "chart-5": "#F472B6",
      "chart-6": "#818CF8",
    },
    chartColors: ["#06B6D4", "#F87171", "#4ADE80", "#FACC15", "#F472B6", "#818CF8"],
  },
  {
    name: "Night Owl",
    tag: "Warm dark + vivid accents",
    mode: "dark",
    description: "Deep charcoal canvas with warm undertones and high-saturation accents that glow. An amber-orange primary feels urgent and actionable — like a dispatch console at night. Status colors are cranked bright against the dark surface for maximum pop.",
    tokens: {
      background: "#111015",
      "surface-1": "#1A181F",
      "surface-2": "#23212A",
      "surface-3": "#2E2B36",
      border: "#3A3644",
      "border-hover": "#504B5C",
      "text-primary": "#F0ECF4",
      "text-secondary": "#A49EB2",
      "text-muted": "#6E6880",
      accent: "#F97316",
      "accent-hover": "#FB923C",
      "accent-muted": "rgba(249,115,22,0.12)",
      "accent-foreground": "#FFFFFF",
      success: "#34D399",
      "success-light": "rgba(52,211,153,0.12)",
      warning: "#FBBF24",
      "warning-light": "rgba(251,191,36,0.12)",
      danger: "#FB7185",
      "danger-light": "rgba(251,113,133,0.12)",
      info: "#38BDF8",
      "info-light": "rgba(56,189,248,0.12)",
      "chart-1": "#F97316",
      "chart-2": "#34D399",
      "chart-3": "#FB7185",
      "chart-4": "#FBBF24",
      "chart-5": "#A78BFA",
      "chart-6": "#38BDF8",
    },
    chartColors: ["#F97316", "#34D399", "#FB7185", "#FBBF24", "#A78BFA", "#38BDF8"],
  },
];

const runs = [
  { id: "R-101", driver: "M. Torres", trips: 14, hours: 7.2, status: "complete", efficiency: 92 },
  { id: "R-102", driver: "K. Pham", trips: 11, hours: 6.8, status: "active", efficiency: 87 },
  { id: "R-103", driver: "J. Davis", trips: 8, hours: 5.1, status: "gap", efficiency: 68 },
  { id: "R-104", driver: "A. Singh", trips: 16, hours: 8.0, status: "complete", efficiency: 95 },
  { id: "R-105", driver: "L. Chen", trips: 6, hours: 3.2, status: "danger", efficiency: 52 },
];

const MiniAreaChart = ({ colors, t }) => {
  const data = [18, 32, 28, 45, 38, 52, 44, 62, 55, 70, 64, 58];
  const w = 320, h = 72, max = 78;
  const pts = data.map((d, i) => [i * (w / (data.length - 1)), h - (d / max) * h]);
  const line = pts.map(p => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`area-${colors[0].slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors[0]} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#area-${colors[0].slice(1)})`} />
      <polyline points={line} fill="none" stroke={colors[0]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={colors[0]} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="8" fill={colors[0]} opacity="0.18" />
    </svg>
  );
};

const MiniDonut = ({ colors, t }) => {
  const data = [35, 25, 20, 12, 8];
  const total = data.reduce((a, b) => a + b, 0);
  const r = 30, cx = 40, cy = 40, sw = 10;
  let cumulative = 0;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {data.map((d, i) => {
        const pct = d / total;
        const dashArray = 2 * Math.PI * r;
        const dashOffset = dashArray * (1 - pct);
        const rotation = cumulative * 360 - 90;
        cumulative += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={colors[i % colors.length]}
            strokeWidth={sw} strokeDasharray={dashArray} strokeDashoffset={dashOffset}
            transform={`rotate(${rotation} ${cx} ${cy})`} strokeLinecap="round" />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={t["text-primary"]} fontSize="14" fontWeight="700" fontFamily="'JetBrains Mono', monospace">142</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={t["text-muted"]} fontSize="8" fontFamily="'Inter', system-ui">trips</text>
    </svg>
  );
};

const BarGroup = ({ colors, t }) => {
  const data = [
    { label: "Mon", vals: [42, 38] }, { label: "Tue", vals: [55, 48] },
    { label: "Wed", vals: [38, 44] }, { label: "Thu", vals: [62, 52] }, { label: "Fri", vals: [48, 40] },
  ];
  const max = 68, w = 200, h = 64, barW = 10;
  const groupW = w / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 14}`} style={{ display: "block" }}>
      {data.map((g, gi) => {
        const gx = gi * groupW + groupW / 2;
        return (
          <g key={gi}>
            {g.vals.map((v, vi) => {
              const bh = (v / max) * h;
              return <rect key={vi} x={gx - barW - 1 + vi * (barW + 2)} y={h - bh} width={barW} height={bh} rx="3" fill={colors[vi]} opacity={vi === 0 ? 0.9 : 0.4} />;
            })}
            <text x={gx} y={h + 12} textAnchor="middle" fill={t["text-muted"]} fontSize="8" fontFamily="'Inter', system-ui">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const StatusPill = ({ status, t }) => {
  const map = {
    complete: { color: t.success, bg: t["success-light"], label: "Complete" },
    active: { color: t.info, bg: t["info-light"], label: "Active" },
    gap: { color: t.warning, bg: t["warning-light"], label: "Gap" },
    danger: { color: t.danger, bg: t["danger-light"], label: "Under" },
  };
  const s = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: 600,
      background: s.bg, color: s.color, letterSpacing: "0.01em", fontFamily: "'Inter', system-ui",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
};

const EfficiencyBar = ({ value, t }) => {
  const color = value >= 85 ? t.success : value >= 65 ? t.warning : t.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "6px", background: t["surface-3"], borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: "3px" }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color, fontFamily: "'JetBrains Mono', monospace", minWidth: "30px", textAlign: "right" }}>
        {value}%
      </span>
    </div>
  );
};

const KpiCard = ({ label, value, change, changeDir, t }) => (
  <div style={{
    background: t["surface-1"], borderRadius: "10px", padding: "14px 16px",
    border: `1px solid ${t.border}`, flex: "1 1 0",
  }}>
    <div style={{ fontSize: "11px", color: t["text-muted"], marginBottom: "4px", fontFamily: "'Inter', system-ui", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontSize: "22px", fontWeight: 700, color: t["text-primary"], fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
        {value}
      </span>
      <span style={{
        fontSize: "11px", fontWeight: 600,
        color: changeDir === "up" ? t.success : changeDir === "down" ? t.danger : t["text-muted"],
        fontFamily: "'Inter', system-ui",
      }}>
        {changeDir === "up" ? "↑" : changeDir === "down" ? "↓" : ""} {change}
      </span>
    </div>
  </div>
);

const MapPlaceholder = ({ t }) => (
  <div style={{
    background: t.mode === "dark"
      ? `linear-gradient(135deg, ${t["surface-2"]} 0%, ${t.background} 100%)`
      : `linear-gradient(135deg, ${t["surface-2"]} 0%, ${t["surface-3"]} 100%)`,
    borderRadius: "8px", height: "100%", minHeight: "140px",
    position: "relative", overflow: "hidden", border: `1px solid ${t.border}`,
  }}>
    <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, opacity: t.mode === "dark" ? 0.15 : 0.3 }}>
      {[...Array(12)].map((_, i) => <line key={`h${i}`} x1="0" y1={i * 20} x2="100%" y2={i * 20} stroke={t.border} strokeWidth="0.5" />)}
      {[...Array(20)].map((_, i) => <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="100%" stroke={t.border} strokeWidth="0.5" />)}
    </svg>
    <svg width="100%" height="100%" viewBox="0 0 300 160" style={{ position: "absolute" }}>
      <path d="M 30 120 Q 80 40 150 80 T 270 50" fill="none" stroke={t.accent} strokeWidth="3" strokeLinecap="round" opacity="0.8" strokeDasharray="8,4" />
      <path d="M 50 140 Q 120 90 180 110 T 280 70" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" opacity="0.65" strokeDasharray="8,4" />
      <path d="M 20 90 Q 100 130 200 60 T 290 100" fill="none" stroke={t.warning} strokeWidth="2" strokeLinecap="round" opacity="0.55" strokeDasharray="8,4" />
      {[[150, 80, t.accent], [80, 100, t.success], [220, 58, t.warning], [120, 110, t.accent], [250, 72, t.success]].map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill={c} />
          <circle cx={x} cy={y} r="10" fill={c} opacity="0.2" />
        </g>
      ))}
    </svg>
    <div style={{
      position: "absolute", bottom: "8px", right: "8px",
      background: t["surface-1"], borderRadius: "6px", padding: "3px 8px",
      fontSize: "9px", color: t["text-muted"], fontFamily: "'Inter', system-ui",
      border: `1px solid ${t.border}`, opacity: 0.8,
    }}>Mapbox GL</div>
  </div>
);

const ThemeIcon = ({ mode, size = 16 }) => {
  if (mode === "light") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3.5" stroke="#D97706" strokeWidth="1.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 8 + Math.cos(rad) * 5.5;
          const y1 = 8 + Math.sin(rad) * 5.5;
          const x2 = 8 + Math.cos(rad) * 7;
          const y2 = 8 + Math.sin(rad) * 7;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />;
        })}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M13.5 9.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const DashboardPreview = ({ palette }) => {
  const t = { ...palette.tokens, mode: palette.mode };
  const colors = palette.chartColors;

  return (
    <div style={{ background: t.background, borderRadius: "12px", padding: "20px", border: `1px solid ${t.border}` }}>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "12px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="7" height="7" rx="2" fill={t.accent} opacity="0.9" />
              <rect x="10" y="1" width="7" height="7" rx="2" fill={t.accent} opacity="0.5" />
              <rect x="1" y="10" width="7" height="7" rx="2" fill={t.accent} opacity="0.5" />
              <rect x="10" y="10" width="7" height="7" rx="2" fill={t.accent} opacity="0.25" />
            </svg>
            <span style={{ fontSize: "15px", fontWeight: 700, color: t["text-primary"], fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>ClearCut</span>
          </div>
          {["Runs", "Schedule", "Map", "Analytics"].map((tab, i) => (
            <span key={tab} style={{
              fontSize: "12px", fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? t.accent : t["text-secondary"],
              fontFamily: "'Inter', system-ui", padding: "2px 0",
              borderBottom: i === 0 ? `2px solid ${t.accent}` : "2px solid transparent",
            }}>{tab}</span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
            background: t["accent-muted"], color: t.accent,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em",
          }}>{palette.name}</span>
          <span style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: t.accent, color: t["accent-foreground"], fontFamily: "'Inter', system-ui" }}>Optimize</span>
          <span style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, background: t["surface-2"], color: t["text-secondary"], border: `1px solid ${t.border}`, fontFamily: "'Inter', system-ui" }}>Export</span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        <KpiCard label="Total Trips" value="142" change="+12%" changeDir="up" t={t} />
        <KpiCard label="Active Runs" value="18" change="−1" changeDir="down" t={t} />
        <KpiCard label="Revenue Hrs" value="86.4" change="+3.2" changeDir="up" t={t} />
        <KpiCard label="Deadhead %" value="14.2" change="−2.1%" changeDir="up" t={t} />
      </div>

      {/* Charts + Map */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <div style={{ background: t["surface-1"], borderRadius: "10px", padding: "14px", border: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: t["text-primary"], fontFamily: "'Inter', system-ui" }}>Trips / Hour</span>
            <div style={{ display: "flex", gap: "10px" }}>
              {["Actual", "Target"].map((l, i) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: t["text-muted"], fontFamily: "'Inter', system-ui" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "2px", background: colors[i], opacity: i === 0 ? 0.9 : 0.4 }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <BarGroup colors={colors} t={t} />
        </div>
        <MapPlaceholder t={t} />
      </div>

      {/* Donut + Table */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "12px" }}>
        <div style={{ background: t["surface-1"], borderRadius: "10px", padding: "14px", border: `1px solid ${t.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: t["text-primary"], fontFamily: "'Inter', system-ui", alignSelf: "flex-start" }}>Distribution</span>
          <MiniDonut colors={colors} t={t} />
          <div style={{ width: "100%" }}><MiniAreaChart colors={colors} t={t} /></div>
        </div>

        <div style={{ background: t["surface-1"], borderRadius: "10px", border: `1px solid ${t.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: t["text-primary"], fontFamily: "'Inter', system-ui" }}>Run Overview</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "'Inter', system-ui" }}>
            <thead>
              <tr style={{ background: t["surface-2"] }}>
                {["Run", "Driver", "Trips", "Hours", "Efficiency", "Status"].map(h => (
                  <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: t["text-muted"], fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${t.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < runs.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{r.id}</td>
                  <td style={{ padding: "8px 12px", color: t["text-primary"] }}>{r.driver}</td>
                  <td style={{ padding: "8px 12px", color: t["text-primary"], fontFamily: "'JetBrains Mono', monospace" }}>{r.trips}</td>
                  <td style={{ padding: "8px 12px", color: t["text-secondary"], fontFamily: "'JetBrains Mono', monospace" }}>{r.hours}</td>
                  <td style={{ padding: "8px 12px", width: "120px" }}><EfficiencyBar value={r.efficiency} t={t} /></td>
                  <td style={{ padding: "8px 12px" }}><StatusPill status={r.status} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function ClearCutDesignSystem() {
  const [selected, setSelected] = useState(0);
  const current = palettes[selected];

  return (
    <div style={{ minHeight: "100vh", background: "#0B0D11", padding: "36px 20px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="11" height="11" rx="3" fill="#4F46E5" />
              <rect x="15" y="2" width="11" height="11" rx="3" fill="#06B6D4" />
              <rect x="2" y="15" width="11" height="11" rx="3" fill="#F97316" />
              <rect x="15" y="15" width="11" height="11" rx="3" fill="#2563EB" />
            </svg>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#E8EAF0", margin: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em" }}>ClearCut</h1>
            <span style={{ fontSize: "13px", color: "#5C6278", fontFamily: "'JetBrains Mono', monospace" }}>/ design system</span>
          </div>
          <p style={{ fontSize: "13px", color: "#8B91A5", margin: 0, lineHeight: 1.5, marginLeft: "38px" }}>
            Four themed palettes for paratransit run cutting & route design. Click to preview.
          </p>
        </div>

        {/* Palette Selector — grouped by mode */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {[
            { mode: "light", label: "Light Mode" },
            { mode: "dark", label: "Dark Mode" },
          ].map(({ mode, label }) => (
            <div key={mode}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <ThemeIcon mode={mode} size={14} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B7084", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {palettes.filter(p => p.mode === mode).map((p) => {
                  const i = palettes.indexOf(p);
                  const isActive = selected === i;
                  return (
                    <button key={i} onClick={() => setSelected(i)} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: isActive ? "11px 15px" : "12px 16px", borderRadius: "10px", cursor: "pointer",
                      background: isActive ? p.tokens["surface-1"] : "#131620",
                      border: isActive ? `2px solid ${p.tokens.accent}` : "1px solid #232836",
                      transition: "all 0.2s ease", flex: "1 1 220px",
                    }}>
                      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                        {p.chartColors.slice(0, 5).map((c, ci) => (
                          <div key={ci} style={{ width: 8, height: 28, borderRadius: "3px", background: c, transition: "all 0.2s ease" }} />
                        ))}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: isActive ? p.tokens["text-primary"] : "#E8EAF0", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.01em" }}>{p.name}</div>
                        <div style={{ fontSize: "11px", color: isActive ? p.tokens["text-muted"] : "#5C6278", marginTop: "1px" }}>{p.tag}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Description bar */}
        <div style={{
          background: "#131620", borderRadius: "10px", padding: "14px 18px",
          marginBottom: "20px", border: "1px solid #232836",
          display: "flex", alignItems: "flex-start", gap: "12px",
        }}>
          <div style={{
            padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em",
            background: current.mode === "dark" ? "rgba(129,140,248,0.08)" : "rgba(217,119,6,0.08)",
            color: current.mode === "dark" ? "#818CF8" : "#D97706",
            whiteSpace: "nowrap", marginTop: "2px",
          }}>
            {current.mode}
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8EAF0", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>{current.name}</div>
            <p style={{ fontSize: "13px", color: "#8B91A5", margin: 0, lineHeight: 1.6 }}>{current.description}</p>
          </div>
        </div>

        {/* Dashboard Preview */}
        <DashboardPreview palette={current} />

        {/* Token Reference */}
        <div style={{
          marginTop: "20px", background: current.tokens["surface-1"],
          borderRadius: "10px", padding: "16px", border: `1px solid ${current.tokens.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: current.tokens["text-primary"], fontFamily: "'JetBrains Mono', monospace" }}>
              CSS Variables — {current.name}
            </h3>
            <span style={{ fontSize: "11px", color: current.tokens["text-muted"], fontFamily: "'JetBrains Mono', monospace" }}>
              {Object.keys(current.tokens).length} tokens
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "4px" }}>
            {Object.entries(current.tokens).map(([key, val]) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "5px 8px", borderRadius: "5px", background: current.tokens["surface-2"],
              }}>
                <div style={{ width: 16, height: 16, borderRadius: "3px", background: val, flexShrink: 0, border: `1px solid ${current.tokens.border}` }} />
                <span style={{ fontSize: "10px", color: current.tokens["text-muted"], fontFamily: "'JetBrains Mono', monospace" }}>--{key}</span>
                <span style={{ fontSize: "10px", color: current.tokens["text-secondary"], fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
