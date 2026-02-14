import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// --- COLORS ---
const C = {
  bg: "#f5f5f6", surface: "#ffffff", surfaceAlt: "#f9f9fa", border: "#e2e3e5", borderLight: "#eff0f1",
  text: "#1a1a1a", textSec: "#5f6368", textMut: "#9aa0a6",
  accent: "#2563eb", accentLight: "#dbeafe", accentMut: "#93bbfc",
  green: "#16a34a", greenLight: "#dcfce7", amber: "#d97706", amberLight: "#fef3c7",
  red: "#dc2626", redLight: "#fee2e2", purple: "#7c3aed", purpleLight: "#ede9fe",
  teal: "#0d9488", tealLight: "#ccfbf1",
};
const font = "'DM Sans', sans-serif";
const serif = "'Source Serif 4', Georgia, serif";

// --- TIME UTILITIES ---
function buildTimeBlocks(startH, startM, endH, endM) {
  const blocks = [];
  for (let h = startH; h <= endH; h++) {
    for (let m = 0; m < 60; m += 15) {
      const total = h * 60 + m;
      if (total < startH * 60 + startM) continue;
      if (total > endH * 60 + endM) break;
      const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
      blocks.push({ hour: h, minute: m, label, totalMin: total });
    }
  }
  return blocks;
}

function fmtTime(h, m) {
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// --- SEEDED RANDOM ---
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// --- DEMO DATA ---
function generateData(dayType, blocks) {
  const seed = dayType === "weekday" ? 42 : dayType === "saturday" ? 77 : 113;
  const rand = seededRand(seed);
  const scale = dayType === "weekday" ? 1 : dayType === "saturday" ? 0.65 : 0.45;

  const pickups = blocks.map(({ hour, minute }) => {
    const t = hour + minute / 60;
    let base = 0;
    if (t < 4.5) base = 0;
    else if (t < 6) base = 2 + (t - 4.5) * 8;
    else if (t < 7.5) base = 14 + (t - 6) * 10;
    else if (t < 9.5) base = 28 + Math.sin((t - 7.5) * 1.2) * 6;
    else if (t < 11) base = 22 - (t - 9.5) * 4;
    else if (t < 13.5) base = 18 + (t - 11) * 5;
    else if (t < 15) base = 30 + Math.sin((t - 13.5) * 2) * 5;
    else if (t < 17) base = 28 - (t - 15) * 3;
    else if (t < 18.5) base = 22 + (t - 17) * 4;
    else if (t < 20) base = 28 - (t - 18.5) * 12;
    else base = Math.max(0, 10 - (t - 20) * 8);
    return Math.max(0, Math.round((base + (rand() - 0.5) * 4) * scale));
  });

  const onBoard = pickups.map((_, i) => {
    let total = pickups[i];
    for (let j = 1; j <= 2; j++) if (i - j >= 0) total += pickups[i - j];
    return total;
  });

  const vehicles = blocks.map(({ hour, minute }) => {
    const t = hour + minute / 60;
    let v = 0;
    if (t < 4.5) v = 0;
    else if (t < 5.5) v = 2 + (t - 4.5) * 8;
    else if (t < 7) v = 10 + (t - 5.5) * 8;
    else if (t < 9) v = 22 + Math.sin((t - 7) * 1.5) * 2;
    else if (t < 11) v = 20 - (t - 9) * 2;
    else if (t < 14) v = 16 + (t - 11) * 2;
    else if (t < 16.5) v = 22 + Math.sin((t - 14) * 1.2) * 2;
    else if (t < 18) v = 20 - (t - 16.5) * 3;
    else if (t < 19.5) v = 14 - (t - 18) * 4;
    else v = Math.max(0, 8 - (t - 19.5) * 6);
    return Math.max(0, Math.round((v + (rand() - 0.5) * 2) * scale));
  });

  const deadhead = blocks.map(({ hour, minute }) => {
    const t = hour + minute / 60;
    if (t < 4.5 || t > 20.5) return 0;
    if (t < 6) return Math.round(12 + rand() * 8);
    if (t > 19) return Math.round(10 + rand() * 10);
    return Math.round(3 + rand() * 6);
  });

  const otp = blocks.map(({ hour, minute }) => {
    const t = hour + minute / 60;
    if (t < 4.5 || t > 20.5) return null;
    if (t < 6) return 88 + rand() * 8;
    if (t < 8) return 82 + rand() * 10;
    if (t < 10) return 78 + rand() * 12;
    if (t < 14) return 85 + rand() * 8;
    if (t < 17) return 80 + rand() * 10;
    if (t < 19) return 76 + rand() * 14;
    return 86 + rand() * 10;
  });

  const productivity = blocks.map(({ hour, minute }) => {
    const t = hour + minute / 60;
    if (t < 4.5 || t > 20.5) return null;
    if (t < 6) return 0.8 + rand() * 0.5;
    if (t < 8) return 1.8 + rand() * 0.6;
    if (t < 10) return 2.2 + rand() * 0.5;
    if (t < 14) return 1.6 + rand() * 0.6;
    if (t < 17) return 2.0 + rand() * 0.5;
    if (t < 19) return 1.4 + rand() * 0.6;
    return 0.9 + rand() * 0.4;
  });

  const totalTrips = Math.round(847 * scale);
  const routes = Math.round(32 * scale);

  const highDeadhead = {
    morning: [
      { id: "T-1024", route: "R-12", miles: 18.4, deadhead: 14.2, pickup: "4:32 AM", area: "North Industrial" },
      { id: "T-1031", route: "R-08", miles: 22.1, deadhead: 16.8, pickup: "4:45 AM", area: "West Ridge" },
      { id: "T-1038", route: "R-15", miles: 15.7, deadhead: 12.1, pickup: "5:00 AM", area: "South Creek" },
      { id: "T-1042", route: "R-03", miles: 19.8, deadhead: 13.5, pickup: "5:15 AM", area: "East Valley" },
      { id: "T-1055", route: "R-21", miles: 24.3, deadhead: 18.9, pickup: "5:30 AM", area: "Airport Corridor" },
    ],
    evening: [
      { id: "T-4812", route: "R-07", miles: 20.3, deadhead: 15.7, pickup: "7:45 PM", area: "Downtown Core" },
      { id: "T-4825", route: "R-19", miles: 17.6, deadhead: 13.4, pickup: "8:00 PM", area: "University District" },
      { id: "T-4831", route: "R-11", miles: 23.8, deadhead: 17.2, pickup: "8:15 PM", area: "North Industrial" },
      { id: "T-4840", route: "R-05", miles: 16.9, deadhead: 12.8, pickup: "8:30 PM", area: "West Ridge" },
      { id: "T-4852", route: "R-14", miles: 21.5, deadhead: 16.1, pickup: "8:45 PM", area: "South Creek" },
    ],
  };

  const imported = {
    serviceHours: Math.round(312.5 * scale * 10) / 10,
    revenueHours: Math.round(278.4 * scale * 10) / 10,
    avgTripMiles: 8.7,
    avgDeadheadMilesStart: 11.3,
    avgDeadheadMilesEnd: 9.8,
  };

  return { pickups, onBoard, vehicles, deadhead, otp, productivity, totalTrips, routes, highDeadhead, imported };
}

// --- RUN STRUCTURE DATA ---
function generateRuns(dayType, blocks) {
  const rand = seededRand(dayType === "weekday" ? 200 : dayType === "saturday" ? 300 : 400);
  const count = dayType === "weekday" ? 24 : dayType === "saturday" ? 16 : 11;
  const serviceStart = blocks[0]?.totalMin || 240;
  const serviceEnd = blocks[blocks.length - 1]?.totalMin || 1260;

  const current = [];
  const optimized = [];

  for (let i = 0; i < count; i++) {
    const isFull = rand() > 0.35;
    const startOffset = Math.round(rand() * 120);
    const runStart = serviceStart + startOffset;
    const duration = isFull ? Math.round(480 + rand() * 180) : Math.round(240 + rand() * 180);
    const runEnd = Math.min(serviceEnd, runStart + duration);
    const type = isFull ? "Full" : "Split";

    current.push({
      id: `R-${String(i + 1).padStart(2, "0")}`,
      type,
      startMin: runStart,
      endMin: runEnd,
      vehicle: `V-${String(i + 1).padStart(3, "0")}`,
      trips: Math.round(20 + rand() * 25),
    });

    const optStart = runStart + Math.round((rand() - 0.3) * 30);
    const optEnd = runEnd + Math.round((rand() - 0.6) * 45);
    optimized.push({
      id: `R-${String(i + 1).padStart(2, "0")}`,
      type: rand() > 0.4 ? "Full" : "Split",
      startMin: Math.max(serviceStart, optStart),
      endMin: Math.min(serviceEnd, Math.max(optStart + 120, optEnd)),
      vehicle: `V-${String(i + 1).padStart(3, "0")}`,
      trips: Math.round(22 + rand() * 28),
    });
  }

  current.sort((a, b) => a.startMin - b.startMin);
  optimized.sort((a, b) => a.startMin - b.startMin);
  return { current, optimized };
}

// --- MAP TRIP DATA ---
function generateMapTrips(dayType) {
  const rand = seededRand(dayType === "weekday" ? 500 : dayType === "saturday" ? 600 : 700);
  const centerLat = 39.7392;
  const centerLng = -104.9903;
  const trips = [];
  const count = dayType === "weekday" ? 847 : dayType === "saturday" ? 550 : 380;

  for (let i = 0; i < count; i++) {
    const hour = Math.floor(4.5 + rand() * 16.5);
    const minute = Math.floor(rand() * 4) * 15;
    const t = hour + minute / 60;
    let weight = 0.3;
    if (t > 6 && t < 9) weight = 0.8 + rand() * 0.2;
    else if (t > 11 && t < 14) weight = 0.6 + rand() * 0.2;
    else if (t > 15 && t < 18) weight = 0.7 + rand() * 0.2;

    const angle = rand() * Math.PI * 2;
    const dist = rand() * 0.15 + (rand() > 0.7 ? rand() * 0.12 : 0);
    const clusterAngle = Math.floor(rand() * 5) * (Math.PI * 2 / 5);
    const clusterDist = 0.04 + rand() * 0.03;

    trips.push({
      lat: centerLat + Math.sin(angle) * dist + Math.sin(clusterAngle) * clusterDist,
      lng: centerLng + Math.cos(angle) * dist * 1.3 + Math.cos(clusterAngle) * clusterDist * 1.3,
      hour, minute, weight,
    });
  }
  return trips;
}

// --- COMPONENTS ---
function Card({ children, style }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, ...style }}>{children}</div>;
}

function MetricCard({ label, value, unit, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: C.textSec, marginBottom: 5, fontFamily: font, letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || C.text, fontFamily: serif, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 400, color: C.textSec, marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: C.textMut, marginTop: 3, fontFamily: font }}>{sub}</div>}
    </div>
  );
}

function SliderControl({ label, value, min, max, step, onChange, unit, desc }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: C.text, fontFamily: font, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.accent, fontFamily: serif }}>{value}{unit}</span>
      </div>
      {desc && <div style={{ fontSize: 10, color: C.textMut, marginBottom: 5, fontFamily: font }}>{desc}</div>}
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: C.borderLight, borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 4, background: C.accent, borderRadius: 2 }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 20, opacity: 0, cursor: "pointer", zIndex: 2 }} />
        <div style={{
          position: "absolute", left: `${pct}%`, transform: "translateX(-50%)",
          width: 14, height: 14, borderRadius: "50%", background: C.accent, border: "2px solid #fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

// --- DEMAND CHART WITH VEHICLE LINE ---
function DemandChart({ pickups, onBoard, vehicles, blocks, height = 170 }) {
  const [hovered, setHovered] = useState(null);
  const maxDemand = Math.max(...onBoard, 1);
  const maxVeh = Math.max(...vehicles, 1);
  const chartMax = Math.max(maxDemand, maxVeh) * 1.1;

  const vehPoints = vehicles.map((v, i) => {
    const x = (i / (vehicles.length - 1)) * 100;
    const y = height - (v / chartMax) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ position: "relative", width: "100%", height: height + 40 }}>
      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height, pointerEvents: "none", overflow: "visible" }}>
        <polyline points={vehPoints} fill="none" stroke={C.teal} strokeWidth="2" strokeLinejoin="round" strokeDasharray="6,3" opacity="0.8" />
        {vehicles.map((v, i) => {
          const x = (i / (vehicles.length - 1)) * 100;
          const y = height - (v / chartMax) * height;
          return <circle key={i} cx={`${x}%`} cy={y} r={hovered === i ? 4 : 0} fill={C.teal} />;
        })}
      </svg>
      <div style={{ display: "flex", alignItems: "flex-end", height, gap: 1, padding: "0 2px", position: "relative" }}>
        {pickups.map((val, i) => {
          const h = (val / chartMax) * height;
          const obH = (onBoard[i] / chartMax) * height;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", cursor: "default" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={{ width: "70%", height: obH, background: C.accentMut, borderRadius: "2px 2px 0 0", opacity: 0.35, position: "absolute", bottom: 0 }} />
              <div style={{ width: "70%", height: h, background: C.accent, borderRadius: "2px 2px 0 0", position: "relative", zIndex: 1, opacity: hovered === i ? 0.75 : 1, transition: "opacity 0.12s" }} />
              {hovered === i && (
                <div style={{
                  position: "absolute", bottom: Math.max(h, obH) + 10, left: "50%", transform: "translateX(-50%)",
                  background: C.text, color: "#fff", padding: "5px 10px", borderRadius: 4,
                  fontSize: 11, whiteSpace: "nowrap", zIndex: 20, fontFamily: font, lineHeight: 1.5,
                }}>
                  <div>{blocks[i]?.label}</div>
                  <div>{val} pickups / ~{onBoard[i]} on board</div>
                  <div style={{ color: C.tealLight }}>{vehicles[i]} vehicles</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4, padding: "0 2px" }}>
        {blocks.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textMut, fontFamily: font }}>
            {i % 4 === 0 ? b.label.replace(/:00\s/, " ") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatBar({ data, blocks, height = 32 }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.filter(Boolean), 1);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", height, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.borderLight}` }}>
        {data.map((val, i) => {
          const intensity = val / max;
          const r = Math.round(225 - intensity * 185);
          const g = Math.round(232 - intensity * 145);
          const b = Math.round(242 - intensity * 42);
          return (
            <div key={i} style={{ flex: 1, background: val === 0 ? C.surfaceAlt : `rgb(${r},${g},${b})`, cursor: "default", opacity: hovered === i ? 0.7 : 1, transition: "opacity 0.1s" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
          );
        })}
      </div>
      {hovered !== null && (
        <div style={{ position: "absolute", top: -28, left: `${(hovered / data.length) * 100}%`, transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 10, fontFamily: font }}>
          {blocks[hovered]?.label}: {data[hovered]}% deadhead
        </div>
      )}
      <div style={{ display: "flex", marginTop: 4 }}>
        {blocks.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textMut, fontFamily: font }}>{i % 4 === 0 ? b.label.replace(/:00\s/, " ") : ""}</div>
        ))}
      </div>
    </div>
  );
}

function OTPChart({ data, blocks, height = 120 }) {
  const [hovered, setHovered] = useState(null);
  const min = 70, max = 100;
  return (
    <div style={{ position: "relative", width: "100%", height: height + 40 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height }}>
        {[90, 85, 80].map((line) => (
          <div key={line} style={{ position: "absolute", left: 0, right: 0, top: `${((max - line) / (max - min)) * 100}%`, borderTop: `1px ${line === 85 ? "solid" : "dashed"} ${line === 85 ? C.amber : C.borderLight}` }}>
            <span style={{ position: "absolute", right: 0, top: -13, fontSize: 9, color: line === 85 ? C.amber : C.textMut, fontFamily: font }}>{line}%{line === 85 ? " target" : ""}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", height, gap: 1, padding: "0 2px", position: "relative" }}>
        {data.map((val, i) => {
          if (val == null) return <div key={i} style={{ flex: 1 }} />;
          const clamped = Math.max(min, Math.min(max, val));
          const h = ((clamped - min) / (max - min)) * height;
          const c = val >= 90 ? C.green : val >= 85 ? C.amber : C.red;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", cursor: "default" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={{ width: "60%", height: h, background: c, borderRadius: "2px 2px 0 0", opacity: hovered === i ? 0.65 : 0.85, transition: "opacity 0.12s" }} />
              {hovered === i && (
                <div style={{ position: "absolute", bottom: h + 8, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 10, fontFamily: font }}>
                  {blocks[i]?.label}: {val.toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4, padding: "0 2px" }}>
        {blocks.map((b, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textMut, fontFamily: font }}>{i % 4 === 0 ? b.label.replace(/:00\s/, " ") : ""}</div>)}
      </div>
    </div>
  );
}

function BarChartSimple({ data, blocks, maxVal, color, height = 120, tooltip }) {
  const [hovered, setHovered] = useState(null);
  const max = maxVal || Math.max(...data.filter(Boolean), 1);
  return (
    <div style={{ position: "relative", width: "100%", height: height + 40 }}>
      <div style={{ display: "flex", alignItems: "flex-end", height, gap: 1, padding: "0 2px" }}>
        {data.map((val, i) => {
          const h = val != null ? (val / max) * height : 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", cursor: "default" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={{ width: "70%", height: h, background: color || C.accent, borderRadius: "2px 2px 0 0", opacity: hovered === i ? 0.7 : 1, transition: "opacity 0.12s" }} />
              {hovered === i && (
                <div style={{ position: "absolute", bottom: h + 8, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 10, fontFamily: font }}>
                  {tooltip ? tooltip(i, val) : `${blocks[i]?.label}: ${val != null ? (Number.isInteger(val) ? val : val.toFixed(1)) : "—"}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4, padding: "0 2px" }}>
        {blocks.map((b, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.textMut, fontFamily: font }}>{i % 4 === 0 ? b.label.replace(/:00\s/, " ") : ""}</div>)}
      </div>
    </div>
  );
}

function DeadheadTable({ trips, title }) {
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8, fontFamily: serif }}>{title}</div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", background: C.surfaceAlt, padding: "7px 12px", gap: 8 }}>
          {["Trip", "Route", "Trip mi", "DH mi", "Area"].map((h) => (
            <div key={h} style={{ fontSize: 10, color: C.textSec, fontFamily: font, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {trips.map((t) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", padding: "7px 12px", gap: 8, borderTop: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 12, color: C.text, fontFamily: font }}>{t.id}</div>
            <div style={{ fontSize: 12, color: C.textSec, fontFamily: font }}>{t.route}</div>
            <div style={{ fontSize: 12, color: C.textSec, fontFamily: font }}>{t.miles}</div>
            <div style={{ fontSize: 12, color: C.red, fontFamily: font, fontWeight: 500 }}>{t.deadhead}</div>
            <div style={{ fontSize: 12, color: C.textSec, fontFamily: font }}>{t.area}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MAP HEATMAP ---
function TripHeatmap({ trips, selectedBlock, blocks }) {
  const canvasRef = useRef(null);
  const block = blocks[selectedBlock];
  const blockH = block?.hour || 8;
  const blockM = block?.minute || 0;

  const filtered = useMemo(() => {
    return trips.filter((t) => t.hour === blockH && t.minute === blockM);
  }, [trips, blockH, blockM]);

  const nearby = useMemo(() => {
    return trips.filter((t) => {
      const diff = Math.abs((t.hour * 60 + t.minute) - (blockH * 60 + blockM));
      return diff <= 30 && diff > 0;
    });
  }, [trips, blockH, blockM]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "#eef0f4";
    ctx.fillRect(0, 0, W, H);

    const centerLat = 39.7392, centerLng = -104.9903;
    const latRange = 0.38, lngRange = 0.48;

    const gridLines = 8;
    ctx.strokeStyle = "#dde0e4";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridLines; i++) {
      const x = (i / gridLines) * W;
      const y = (i / gridLines) * H;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const toXY = (lat, lng) => ({
      x: ((lng - (centerLng - lngRange / 2)) / lngRange) * W,
      y: ((centerLat + latRange / 2 - lat) / latRange) * H,
    });

    nearby.forEach((t) => {
      const { x, y } = toXY(t.lat, t.lng);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 12);
      grad.addColorStop(0, "rgba(37, 99, 235, 0.06)");
      grad.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 12, y - 12, 24, 24);
    });

    filtered.forEach((t) => {
      const { x, y } = toXY(t.lat, t.lng);
      const radius = 6 + t.weight * 14;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(220, 38, 38, ${0.3 + t.weight * 0.35})`);
      grad.addColorStop(0.5, `rgba(220, 38, 38, ${0.1 + t.weight * 0.15})`);
      grad.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    filtered.forEach((t) => {
      const { x, y } = toXY(t.lat, t.lng);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.5 + t.weight * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = C.textMut;
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillText("N", W / 2 - 3, 14);
    ctx.fillText("S", W / 2 - 3, H - 6);
    ctx.fillText("W", 6, H / 2 + 3);
    ctx.fillText("E", W - 14, H / 2 + 3);

  }, [filtered, nearby]);

  return (
    <canvas ref={canvasRef} width={580} height={420}
      style={{ width: "100%", maxWidth: 580, height: "auto", aspectRatio: "580/420", borderRadius: 6, border: `1px solid ${C.border}` }} />
  );
}

// --- RUN STRUCTURE GANTT ---
function RunGantt({ runs, blocks, label, color }) {
  const serviceStart = blocks[0]?.totalMin || 240;
  const serviceEnd = blocks[blocks.length - 1]?.totalMin || 1260;
  const range = serviceEnd - serviceStart;
  const [hovered, setHovered] = useState(null);

  const hourMarks = [];
  for (let h = Math.ceil(serviceStart / 60); h <= Math.floor(serviceEnd / 60); h++) {
    hourMarks.push({ min: h * 60, label: fmtTime(h, 0) });
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontFamily: serif, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ position: "relative", paddingLeft: 54, minHeight: runs.length * 26 + 30 }}>
        <div style={{ position: "absolute", left: 54, right: 0, top: 0, bottom: 0 }}>
          {hourMarks.filter((_, i) => i % 2 === 0).map((m) => {
            const pct = ((m.min - serviceStart) / range) * 100;
            return (
              <div key={m.min} style={{ position: "absolute", left: `${pct}%`, top: 0, bottom: 20, borderLeft: `1px solid ${C.borderLight}` }}>
                <span style={{ position: "absolute", bottom: -18, left: -12, fontSize: 9, color: C.textMut, fontFamily: font, whiteSpace: "nowrap" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        {runs.map((r, i) => {
          const left = ((r.startMin - serviceStart) / range) * 100;
          const width = ((r.endMin - r.startMin) / range) * 100;
          const startH = Math.floor(r.startMin / 60);
          const startM = r.startMin % 60;
          const endH = Math.floor(r.endMin / 60);
          const endM = r.endMin % 60;
          return (
            <div key={r.id} style={{ position: "relative", height: 22, marginBottom: 4 }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={{ position: "absolute", left: 0, width: 50, top: 2, fontSize: 11, color: C.textSec, fontFamily: font, textAlign: "right", paddingRight: 8 }}>
                {r.id}
              </div>
              <div style={{ position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`, top: 2, height: 18, background: color, borderRadius: 3, opacity: r.type === "Split" ? 0.6 : 0.85, transition: "opacity 0.12s", ...(hovered === i ? { opacity: 1 } : {}) }} />
              {hovered === i && (
                <div style={{ position: "absolute", left: `${left + width / 2}%`, top: -30, transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 10, fontFamily: font }}>
                  {r.id} ({r.type}) — {fmtTime(startH, startM)} to {fmtTime(endH, endM)} — {r.trips} trips
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- TABS ---
const TABS = [
  { key: "import", label: "Import" },
  { key: "demand", label: "Demand" },
  { key: "performance", label: "Performance" },
  { key: "map", label: "Trip Map" },
  { key: "runs", label: "Run Structure" },
  { key: "optimize", label: "Optimize" },
  { key: "deadhead", label: "Deadhead" },
];

// --- MAIN ---
export default function RunCutTool() {
  const [tab, setTab] = useState("import");
  const [imported, setImported] = useState(false);
  const [dayType, setDayType] = useState("weekday");
  const [timeStart, setTimeStart] = useState(16);
  const [timeEnd, setTimeEnd] = useState(84);
  const [targetProd, setTargetProd] = useState(2.0);
  const [targetOTP, setTargetOTP] = useState(85);
  const [maxSpread, setMaxSpread] = useState(12);
  const [peakVehicles, setPeakVehicles] = useState(24);
  const [mapSlider, setMapSlider] = useState(10);

  const allBlocks = useMemo(() => buildTimeBlocks(4, 0, 21, 0), []);

  const blocks = useMemo(() => {
    return allBlocks.slice(timeStart, timeEnd + 1);
  }, [allBlocks, timeStart, timeEnd]);

  const data = useMemo(() => generateData(dayType, blocks), [dayType, blocks]);
  const runs = useMemo(() => generateRuns(dayType, blocks), [dayType, blocks]);
  const mapTrips = useMemo(() => generateMapTrips(dayType), [dayType]);

  const mapBlocks = allBlocks;
  const clampedMapSlider = Math.min(mapSlider, mapBlocks.length - 1);

  const optimized = useMemo(() => {
    const factor = targetProd / 1.8;
    const otpShift = (targetOTP - 85) * 0.4;
    const vehicleAdj = (24 - peakVehicles) / 24;
    const spreadAdj = (12 - maxSpread) / 12;
    return {
      serviceHours: Math.round((data.imported.serviceHours * (1 - vehicleAdj * 0.3) * (1 + spreadAdj * 0.1)) * 10) / 10,
      revenueHours: Math.round((data.imported.revenueHours * factor * 0.92 * (1 - vehicleAdj * 0.2)) * 10) / 10,
      estOTP: Math.min(98, Math.max(72, 84 + otpShift - (factor - 1) * 8 + vehicleAdj * 3)),
      estDeadhead: Math.max(2, Math.round((6.2 - (factor - 1) * 2 + vehicleAdj * 4 + spreadAdj * 1.5) * 10) / 10),
      estProductivity: Math.round(targetProd * 10) / 10,
      vehicles: peakVehicles,
    };
  }, [targetProd, targetOTP, maxSpread, peakVehicles, data.imported]);

  const handleImport = useCallback(() => {
    setImported(true);
    setTimeout(() => setTab("demand"), 500);
  }, []);

  const timeRangeLabel = `${allBlocks[timeStart]?.label || ""} — ${allBlocks[timeEnd]?.label || ""}`;

  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: serif, letterSpacing: "-0.02em" }}>RunCut</span>
          <span style={{ fontSize: 12, color: C.textMut }}>Run Cutting & Optimization Tool</span>
        </div>
        {imported && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
            <span style={{ fontSize: 12, color: C.textSec }}>{data.totalTrips} trips, {data.routes} routes loaded</span>
          </div>
        )}
      </div>

      {/* System Settings Bar */}
      {imported && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Day Selection</span>
            {["weekday", "saturday", "sunday"].map((d) => (
              <button key={d} onClick={() => setDayType(d)}
                style={{
                  padding: "4px 12px", borderRadius: 4, border: `1px solid ${dayType === d ? C.accent : C.border}`,
                  background: dayType === d ? C.accentLight : "transparent", color: dayType === d ? C.accent : C.textSec,
                  fontSize: 12, fontFamily: font, fontWeight: dayType === d ? 600 : 400, cursor: "pointer", transition: "all 0.12s",
                  textTransform: "capitalize",
                }}>
                {d}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500, whiteSpace: "nowrap" }}>Time Range</span>
            <div style={{ position: "relative", flex: 1, height: 28, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: C.borderLight, borderRadius: 2 }} />
              <div style={{
                position: "absolute",
                left: `${(timeStart / (allBlocks.length - 1)) * 100}%`,
                width: `${((timeEnd - timeStart) / (allBlocks.length - 1)) * 100}%`,
                height: 4, background: C.accent, borderRadius: 2,
              }} />
              <input type="range" min={0} max={allBlocks.length - 1} value={timeStart}
                onChange={(e) => { const v = Number(e.target.value); if (v < timeEnd - 3) setTimeStart(v); }}
                style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 28, opacity: 0, cursor: "pointer", zIndex: 3 }} />
              <input type="range" min={0} max={allBlocks.length - 1} value={timeEnd}
                onChange={(e) => { const v = Number(e.target.value); if (v > timeStart + 3) setTimeEnd(v); }}
                style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 28, opacity: 0, cursor: "pointer", zIndex: 4 }} />
              <div style={{
                position: "absolute", left: `${(timeStart / (allBlocks.length - 1)) * 100}%`, transform: "translateX(-50%)",
                width: 12, height: 12, borderRadius: "50%", background: C.accent, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute", left: `${(timeEnd / (allBlocks.length - 1)) * 100}%`, transform: "translateX(-50%)",
                width: 12, height: 12, borderRadius: "50%", background: C.accent, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none",
              }} />
            </div>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 500, whiteSpace: "nowrap", minWidth: 130, textAlign: "right" }}>{timeRangeLabel}</span>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", gap: 0 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const disabled = !imported && t.key !== "import";
          return (
            <button key={t.key} onClick={() => !disabled && setTab(t.key)}
              style={{
                padding: "11px 16px", border: "none", background: "none", cursor: disabled ? "default" : "pointer",
                fontSize: 13, fontFamily: font, fontWeight: active ? 600 : 400,
                color: disabled ? C.textMut : active ? C.accent : C.textSec,
                borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
                opacity: disabled ? 0.45 : 1, transition: "all 0.12s",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {/* IMPORT */}
        {tab === "import" && (
          <div style={{ maxWidth: 540, margin: "50px auto", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontFamily: serif, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>Import Service Data</div>
            <div style={{ fontSize: 14, color: C.textSec, marginBottom: 28, lineHeight: 1.6 }}>
              Upload your trip manifest and route schedule to generate demand analysis, performance metrics, and an optimized run cut.
            </div>
            <Card style={{ padding: 28, textAlign: "left" }}>
              {[{ title: "Trip Data", hint: "trip_id, pickup_time, dropoff_time, route_id, miles, status" }, { title: "Route Schedule", hint: "route_id, start_time, end_time, vehicle_id, service_hours" }].map((f) => (
                <div key={f.title} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{f.title}</div>
                  <div style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: "22px 16px", textAlign: "center", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, color: C.textSec }}>Drop CSV or XLSX file here, or click to browse</div>
                    <div style={{ fontSize: 10, color: C.textMut, marginTop: 3 }}>Expected: {f.hint}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleImport}
                  style={{ flex: 1, padding: "10px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                  {imported ? "Data Loaded" : "Load Demo Dataset"}
                </button>
                <button style={{ padding: "10px 20px", background: "none", color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: font }}>
                  Settings
                </button>
              </div>
            </Card>
            <div style={{ marginTop: 16, fontSize: 11, color: C.textMut, lineHeight: 1.5 }}>
              Demo dataset: 847 weekday trips across 32 routes (4:00 AM — 9:00 PM). Average ride time: 28 minutes.
            </div>
          </div>
        )}

        {/* DEMAND */}
        {tab === "demand" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Demand Analysis</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>
              15-minute demand with 28-min carry-forward. Active vehicles shown as a dashed line.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <MetricCard label="Peak Pickups" value={Math.max(...data.pickups)} unit=" trips" />
              <MetricCard label="Peak On-Board" value={Math.max(...data.onBoard)} unit=" pax" />
              <MetricCard label="Peak Vehicles" value={Math.max(...data.vehicles)} unit="" color={C.teal} />
              <MetricCard label="Total Trips" value={data.totalTrips} />
            </div>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600 }}>Demand and Active Vehicles</div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.textSec }}>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: C.accent, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Pickups</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: C.accentMut, borderRadius: 2, marginRight: 4, verticalAlign: "middle", opacity: 0.4 }} />On Board</span>
                  <span><span style={{ display: "inline-block", width: 16, height: 0, borderTop: `2px dashed ${C.teal}`, marginRight: 4, verticalAlign: "middle" }} />Vehicles</span>
                </div>
              </div>
              <DemandChart pickups={data.pickups} onBoard={data.onBoard} vehicles={data.vehicles} blocks={blocks} height={170} />
            </Card>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600 }}>Deadhead Intensity</div>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.textSec, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ display: "inline-block", width: 16, height: 8, background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, borderRadius: 2 }} />Low</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ display: "inline-block", width: 16, height: 8, background: "rgb(120,140,200)", borderRadius: 2 }} />Med</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ display: "inline-block", width: 16, height: 8, background: "rgb(40,90,200)", borderRadius: 2 }} />High</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>Hover to see deadhead % per block. High values at bookend hours indicate trimming opportunities.</div>
              <HeatBar data={data.deadhead} blocks={blocks} height={34} />
            </Card>
          </div>
        )}

        {/* PERFORMANCE */}
        {tab === "performance" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Performance Metrics</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>OTP and productivity by 15-minute block.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <MetricCard label="Avg OTP" value={(data.otp.filter(Boolean).reduce((a, b) => a + b, 0) / data.otp.filter(Boolean).length).toFixed(1)} unit="%" color={C.green} />
              <MetricCard label="Below 85% OTP" value={data.otp.filter((v) => v != null && v < 85).length} unit=" blocks" color={C.red} />
              <MetricCard label="Avg Productivity" value={(data.productivity.filter(Boolean).reduce((a, b) => a + b, 0) / data.productivity.filter(Boolean).length).toFixed(1)} unit=" trips/hr" />
              <MetricCard label="Peak Productivity" value={Math.max(...data.productivity.filter(Boolean)).toFixed(1)} unit=" trips/hr" />
            </div>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 3 }}>On-Time Performance</div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>Green 90%+, amber 85–90%, red below 85%. Target at 85%.</div>
              <OTPChart data={data.otp} blocks={blocks} height={125} />
            </Card>
            <Card>
              <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 3 }}>Productivity (trips per revenue hour)</div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>Low productivity at service edges suggests over-allocation.</div>
              <BarChartSimple data={data.productivity.map((v) => v != null ? Math.round(v * 10) / 10 : 0)} blocks={blocks} maxVal={3.5} color={C.purple} height={115}
                tooltip={(i, val) => `${blocks[i]?.label}: ${val > 0 ? val.toFixed(1) : "—"} trips/hr`} />
            </Card>
          </div>
        )}

        {/* TRIP MAP */}
        {tab === "map" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Trip Density Map</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>
              Heatmap of trip pickups by 15-minute block. Drag the slider to see how demand shifts through the day.
            </div>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600 }}>
                  Pickup Density — {mapBlocks[clampedMapSlider]?.label}
                </div>
                <div style={{ fontSize: 12, color: C.textSec }}>
                  {mapTrips.filter((t) => t.hour === mapBlocks[clampedMapSlider]?.hour && t.minute === mapBlocks[clampedMapSlider]?.minute).length} trips in block
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 560px" }}>
                  <TripHeatmap trips={mapTrips} selectedBlock={clampedMapSlider} blocks={mapBlocks} />
                </div>
                <div style={{ flex: "0 0 200px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Legend</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: C.textSec }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(220,38,38,0.7)" }} /> High density
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(220,38,38,0.3)" }} /> Medium density
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(37,99,235,0.12)" }} /> Adjacent blocks
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: C.textMut, lineHeight: 1.5 }}>
                    Brighter red areas indicate higher trip concentration. Blue halos show activity in adjacent 30-minute windows for context.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: C.textSec, whiteSpace: "nowrap" }}>Time of Day</span>
                <div style={{ position: "relative", flex: 1, height: 28, display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: C.borderLight, borderRadius: 2 }} />
                  <div style={{ position: "absolute", left: 0, width: `${(clampedMapSlider / (mapBlocks.length - 1)) * 100}%`, height: 4, background: C.accent, borderRadius: 2 }} />
                  <input type="range" min={0} max={mapBlocks.length - 1} value={clampedMapSlider}
                    onChange={(e) => setMapSlider(Number(e.target.value))}
                    style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 28, opacity: 0, cursor: "pointer", zIndex: 2 }} />
                  <div style={{
                    position: "absolute", left: `${(clampedMapSlider / (mapBlocks.length - 1)) * 100}%`, transform: "translateX(-50%)",
                    width: 14, height: 14, borderRadius: "50%", background: C.accent, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", pointerEvents: "none",
                  }} />
                </div>
                <span style={{ fontSize: 13, color: C.accent, fontWeight: 600, fontFamily: serif, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" }}>
                  {mapBlocks[clampedMapSlider]?.label}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: C.textMut }}>4:00 AM</span>
                <span style={{ fontSize: 9, color: C.textMut }}>9:00 PM</span>
              </div>
            </Card>
          </div>
        )}

        {/* RUN STRUCTURE */}
        {tab === "runs" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Run Structure</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>
              Current run assignments compared with the optimized recommendation. Each bar represents a single run with its start and end time.
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <MetricCard label="Current Runs" value={runs.current.length} unit="" />
              <MetricCard label="Optimized Runs" value={runs.optimized.length} unit="" color={C.accent} />
              <MetricCard label="Imported Service Hrs" value={data.imported.serviceHours} unit=" hrs" />
              <MetricCard label="Optimized Service Hrs" value={optimized.serviceHours} unit=" hrs" color={C.green} />
            </div>

            <Card style={{ marginBottom: 14 }}>
              <RunGantt runs={runs.current} blocks={blocks} label="Current Run Structure" color={C.textSec} />
            </Card>
            <Card>
              <RunGantt runs={runs.optimized} blocks={blocks} label="Optimized Run Structure" color={C.accent} />
            </Card>

            <Card style={{ marginTop: 14 }}>
              <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 12 }}>Run Detail Comparison</div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "80px 60px 100px 100px 70px 20px 60px 100px 100px 70px", gap: 0, minWidth: 700 }}>
                  <div style={{ gridColumn: "1 / 2", padding: "6px 8px", background: C.surfaceAlt, fontSize: 10, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}` }}>Run</div>
                  <div style={{ gridColumn: "2 / 5", padding: "6px 8px", background: C.surfaceAlt, fontSize: 10, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>Current</div>
                  <div style={{ background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }} />
                  <div style={{ gridColumn: "6 / 10", padding: "6px 8px", background: C.accentLight, fontSize: 10, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>Optimized</div>
                  <div style={{ padding: "6px 8px", background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }} />

                  {runs.current.slice(0, 12).map((r, i) => {
                    const o = runs.optimized[i];
                    const cStart = fmtTime(Math.floor(r.startMin / 60), r.startMin % 60);
                    const cEnd = fmtTime(Math.floor(r.endMin / 60), r.endMin % 60);
                    const oStart = o ? fmtTime(Math.floor(o.startMin / 60), o.startMin % 60) : "—";
                    const oEnd = o ? fmtTime(Math.floor(o.endMin / 60), o.endMin % 60) : "—";
                    return [
                      <div key={`id-${i}`} style={{ padding: "5px 8px", fontSize: 12, fontWeight: 500, borderBottom: `1px solid ${C.borderLight}` }}>{r.id}</div>,
                      <div key={`ct-${i}`} style={{ padding: "5px 8px", fontSize: 11, color: C.textSec, borderBottom: `1px solid ${C.borderLight}` }}>{r.type}</div>,
                      <div key={`cs-${i}`} style={{ padding: "5px 8px", fontSize: 12, borderBottom: `1px solid ${C.borderLight}` }}>{cStart}</div>,
                      <div key={`ce-${i}`} style={{ padding: "5px 8px", fontSize: 12, borderBottom: `1px solid ${C.borderLight}` }}>{cEnd}</div>,
                      <div key={`ctr-${i}`} style={{ padding: "5px 8px", fontSize: 12, color: C.textSec, borderBottom: `1px solid ${C.borderLight}` }}>{r.trips} trips</div>,
                      <div key={`sp-${i}`} style={{ borderBottom: `1px solid ${C.borderLight}` }} />,
                      <div key={`ot-${i}`} style={{ padding: "5px 8px", fontSize: 11, color: C.accent, borderBottom: `1px solid ${C.borderLight}` }}>{o?.type || "—"}</div>,
                      <div key={`os-${i}`} style={{ padding: "5px 8px", fontSize: 12, color: C.accent, fontWeight: 500, borderBottom: `1px solid ${C.borderLight}` }}>{oStart}</div>,
                      <div key={`oe-${i}`} style={{ padding: "5px 8px", fontSize: 12, color: C.accent, fontWeight: 500, borderBottom: `1px solid ${C.borderLight}` }}>{oEnd}</div>,
                      <div key={`otr-${i}`} style={{ padding: "5px 8px", fontSize: 12, color: C.accent, borderBottom: `1px solid ${C.borderLight}` }}>{o?.trips || "—"} trips</div>,
                    ];
                  })}
                </div>
              </div>
              {runs.current.length > 12 && (
                <div style={{ fontSize: 11, color: C.textMut, marginTop: 8, textAlign: "center" }}>Showing 12 of {runs.current.length} runs</div>
              )}
            </Card>
          </div>
        )}

        {/* OPTIMIZE */}
        {tab === "optimize" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Optimize Run Cut</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>Adjust parameters — estimated outcomes update live.</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <Card style={{ flex: "1 1 300px", minWidth: 280 }}>
                <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 14 }}>Optimization Parameters</div>
                <SliderControl label="Target Productivity" value={targetProd} min={1.0} max={3.5} step={0.1} onChange={setTargetProd} unit=" trips/hr" desc="Higher productivity reduces vehicles but may impact OTP" />
                <SliderControl label="Minimum OTP Target" value={targetOTP} min={75} max={98} step={1} onChange={setTargetOTP} unit="%" desc="Above 90% may require additional service hours" />
                <SliderControl label="Max Driver Spread" value={maxSpread} min={8} max={14} step={0.5} onChange={setMaxSpread} unit=" hrs" desc="Max time between first pull-out and last pull-in" />
                <SliderControl label="Peak Vehicles" value={peakVehicles} min={12} max={36} step={1} onChange={setPeakVehicles} unit="" desc="Max vehicles in revenue service during peak" />
              </Card>
              <div style={{ flex: "1 1 400px", minWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
                <Card style={{ background: C.accentLight, borderColor: C.accentMut }}>
                  <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 12, color: C.accent }}>Optimized Run Cut Estimate</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { l: "Est. Service Hours", v: optimized.serviceHours },
                      { l: "Est. Revenue Hours", v: optimized.revenueHours },
                      { l: "Est. OTP", v: `${optimized.estOTP.toFixed(1)}%`, c: optimized.estOTP >= 85 ? C.green : C.red },
                      { l: "Est. Deadhead", v: `${optimized.estDeadhead}%` },
                      { l: "Est. Productivity", v: optimized.estProductivity, c: C.purple },
                      { l: "Peak Vehicles", v: optimized.vehicles },
                    ].map(({ l, v, c }) => (
                      <div key={l}>
                        <div style={{ fontSize: 11, color: C.textSec, marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, fontFamily: serif, color: c || C.text }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 10 }}>Imported vs. Optimized</div>
                  {[
                    { l: "Service Hours", f: data.imported.serviceHours, t: optimized.serviceHours, u: " hrs" },
                    { l: "Revenue Hours", f: data.imported.revenueHours, t: optimized.revenueHours, u: " hrs" },
                    { l: "Avg Trip Miles", f: data.imported.avgTripMiles, t: (data.imported.avgTripMiles * 0.95).toFixed(1), u: " mi" },
                  ].map(({ l, f, t, u }) => {
                    const delta = t - f;
                    const pct = ((delta / f) * 100).toFixed(1);
                    const good = delta <= 0;
                    return (
                      <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: C.surfaceAlt, borderRadius: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: C.textSec }}>{l}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, color: C.textMut }}>{f}{u}</span>
                          <span style={{ fontSize: 11, color: C.textMut }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{t}{u}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: good ? C.green : C.red, background: good ? C.greenLight : C.redLight, padding: "2px 6px", borderRadius: 4 }}>
                            {delta > 0 ? "+" : ""}{pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* DEADHEAD */}
        {tab === "deadhead" && (
          <div>
            <div style={{ fontSize: 22, fontFamily: serif, fontWeight: 700, marginBottom: 3 }}>Deadhead Review</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 18 }}>High-deadhead trips at service bookends with mileage breakdowns.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <MetricCard label="Avg Trip Miles" value={data.imported.avgTripMiles} unit=" mi" />
              <MetricCard label="Avg DH Miles (Start)" value={data.imported.avgDeadheadMilesStart} unit=" mi" color={C.red} sub="First 2 hours" />
              <MetricCard label="Avg DH Miles (End)" value={data.imported.avgDeadheadMilesEnd} unit=" mi" color={C.amber} sub="Last 2 hours" />
            </div>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 8 }}>Deadhead Ratio by Block</div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>Percentage of total miles from deadhead. Bookend hours show highest ratios.</div>
              <HeatBar data={data.deadhead} blocks={blocks} height={34} />
            </Card>
            <Card>
              <div style={{ fontSize: 15, fontFamily: serif, fontWeight: 600, marginBottom: 12 }}>High Deadhead Trips</div>
              <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>Trips where deadhead exceeds 60% of total trip miles during the first and last 2 hours.</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <DeadheadTable trips={data.highDeadhead.morning} title="Start of Service (4:00 – 6:00 AM)" />
                <DeadheadTable trips={data.highDeadhead.evening} title="End of Service (7:30 – 9:00 PM)" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
