import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line, ScatterChart, Scatter, ZAxis
} from "recharts";

/* ─── TOKENS ─── */
const SB_URL = import.meta.env.VITE_SB_URL;
const SB_KEY = import.meta.env.VITE_SB_KEY;
const MB_TOKEN = import.meta.env.VITE_MB_TOKEN;

const SBH = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const rpc = (fn, args = {}) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: SBH, body: JSON.stringify(args) }).then(r => r.json());
const q = path => fetch(`${SB_URL}/rest/v1/${path}`, { headers: SBH }).then(r => r.json());
const safe = (d, fb = []) => Array.isArray(d) ? d : fb;

/* ─── COLORS ─── */
const C = {
  bg: "#EDE8DC",
  surface: "#E5E0D4",
  card: "#DDD8CC",
  border: "#C8C2B4",
  ink: "#1A1A18",
  dim: "#3A3A36",
  muted: "#6B6860",
  faint: "#9A9488",
  green: "#2D4A35",
  greenMid: "#3D6048",
  greenLight: "#4A7A58",
  run: "#2D4A35",
  ride: "#8B4513",
  swim: "#2B5BA0",
  white: "#FFFFFF",
};

/* ─── FONTS ─── */
const F = {
  heading: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

/* ─── POLYLINE DECODER ─── */
function decodePoly(str) {
  if (!str) return [];
  let i = 0, lat = 0, lng = 0, coords = [];
  while (i < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

/* ─── MAPBOX LOADER ─── */
let mbReady = false, mbCbs = [];
function loadMapbox(cb) {
  if (window.mapboxgl) { window.mapboxgl.accessToken = MB_TOKEN; cb(); return; }
  if (mbReady) { mbCbs.push(cb); return; }
  mbReady = true;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"; document.head.appendChild(l);
  const s = document.createElement("script"); s.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  s.onload = () => { window.mapboxgl.accessToken = MB_TOKEN; cb(); mbCbs.forEach(f => f()); mbCbs = []; };
  document.head.appendChild(s);
}

/* ─── HOOKS ─── */
function useCountUp(target, duration = 2000) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!target || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const fn = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return [active, setActive];
}

/* ─── ACTIVITY MAP ─── */
function ActivityMap({ polyline, type, height = 300 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const color = type === "Swim" ? "#4A8FD4" : type === "Ride" || type === "VirtualRide" ? "#C06030" : "#4A7A58";

  useEffect(() => {
    if (!polyline) { setReady(true); return; }
    loadMapbox(() => {
      if (!ref.current || mapRef.current) return;
      const coords = decodePoly(polyline);
      if (!coords.length) { setReady(true); return; }
      const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      const map = new window.mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        fitBoundsOptions: { padding: 40 },
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("r", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({ id: "r", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 3, "line-opacity": 0.95 } });
        setReady(true);
      });
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [polyline]);

  return (
    <div style={{ position: "relative", height, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontFamily: F.mono, fontSize: "0.7rem" }}>
          {polyline ? "loading..." : "no route data"}
        </div>
      )}
      {ready && <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: F.mono, fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>mapbox</div>}
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */
const Divider = ({ my = "2.5rem" }) => <div style={{ borderTop: `1px solid ${C.border}`, margin: `${my} 0` }} />;

const Label = ({ children, color }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: color || C.muted, marginBottom: "0.4rem" }}>
    {children}
  </div>
);

const SectionNum = ({ n }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.muted, marginBottom: "0.5rem" }}>0{n}</div>
);

const SportTab = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase",
    padding: "5px 14px", border: `1px solid ${active ? color : C.border}`, borderRadius: 2,
    background: "transparent", color: active ? color : C.muted, cursor: "pointer",
    transition: "all 0.15s",
  }}>{label}</button>
);

const SubTab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
    padding: "5px 16px", border: `1px solid ${active ? C.ink : C.border}`, borderRadius: 2,
    background: active ? C.ink : "transparent", color: active ? C.white : C.muted,
    cursor: "pointer", transition: "all 0.15s",
  }}>{label}</button>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.ink, border: "none", borderRadius: 4, padding: "8px 12px", fontFamily: F.mono, fontSize: "0.65rem", color: C.white }}>
      {label && <div style={{ color: C.faint, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || C.white }}>
          {p.name || p.dataKey}: <strong>{typeof p.value === "number" ? Math.round(p.value).toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const ChartBox = ({ title, subtitle, children }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1.25rem" }}>
    <div style={{ fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: C.muted, marginBottom: "0.15rem" }}>{title}</div>
    {subtitle && <div style={{ fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, marginBottom: "1rem" }}>{subtitle}</div>}
    {children}
  </div>
);

/* ─── NOTABLE TABLE ─── */
function NotableTable({ rows, cols, selected, onSelect, sportColor }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.4rem 0.75rem", borderBottom: `1px solid ${C.border}` }}>
        {cols.map(c => <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint }}>{c.l}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} onClick={() => onSelect(i)}
          style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.7rem 0.75rem", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected === i ? C.card : "transparent", transition: "background 0.12s" }}>
          {cols.map(c => (
            <div key={c.k} style={{ fontFamily: c.mono ? F.mono : F.body, fontSize: "0.82rem", color: c.accent ? sportColor : C.ink, fontWeight: c.bold ? 600 : 400 }}>
              {c.k === "#" ? (selected === i ? <span style={{ color: sportColor }}>|</span> : null) : null}
              {c.k === "#" ? `#${i + 1}` : r[c.k]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── NOTABLE SECTION ─── */
function NotableSection() {
  const [sport, setSport] = useState("run");
  const [tab, setTab] = useState("pbs");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);

  const sportColor = sport === "run" ? C.run : sport === "ride" ? C.ride : C.swim;
  const sportType = sport === "run" ? "Run" : sport === "ride" ? "Ride,VirtualRide" : "Swim";

  useEffect(() => {
    setLoading(true);
    setSelected(0);
    let queryUrl = "";
    if (sport === "run" && tab === "pbs") {
      queryUrl = `activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,map_summary_polyline&type=eq.Run&distance=gt.1000&order=moving_time.asc&limit=10`;
    } else if (tab === "longest") {
      const typeFilter = sport === "ride" ? "type=in.(Ride,VirtualRide)" : sport === "swim" ? "type=eq.Swim" : "type=eq.Run";
      queryUrl = `activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${typeFilter}&order=distance.desc&limit=10`;
    } else if (tab === "elevation") {
      const typeFilter = sport === "ride" ? "type=in.(Ride,VirtualRide)" : "type=eq.Run";
      queryUrl = `activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${typeFilter}&total_elevation_gain=gt.0&order=total_elevation_gain.desc&limit=10`;
    }
    if (!queryUrl) { setLoading(false); return; }
    q(queryUrl).then(data => {
      setRows(safe(data));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sport, tab]);

  useEffect(() => {
    if (sport === "ride" || sport === "swim") setTab("longest");
    else setTab("pbs");
  }, [sport]);

  const cur = rows[selected];
  const fmtTime = s => { if (!s) return "—"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const fmtDist = m => `${(m / 1000).toFixed(1)} km`;
  const fmtPace = (t, d) => { if (!t || !d) return "—"; const s = t / (d / 1000); return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/km`; };
  const fmtSpeed = s => s ? `${(s * 3.6).toFixed(1)} km/h` : "—";
  const fmtSwimPace = (t, d) => { if (!t || !d) return "—"; const s = t / (d / 100); return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/100m`; };

  const cols = tab === "pbs"
    ? [{ k: "#", l: "#", w: "40px" }, { k: "dist", l: "Distance", w: "100px" }, { k: "date", l: "Date", w: "110px" }, { k: "time", l: "Time", w: "1fr", mono: true, accent: true }]
    : tab === "elevation"
    ? [{ k: "#", l: "#", w: "40px" }, { k: "date", l: "Date", w: "110px" }, { k: "dist", l: "Dist", w: "80px" }, { k: "elev", l: "Elevation", w: "1fr", accent: true }]
    : [{ k: "#", l: "#", w: "40px" }, { k: "date", l: "Date", w: "110px" }, { k: "dist", l: "Distance", w: "1fr", accent: true }];

  const tableRows = rows.map(r => ({
    dist: fmtDist(r.distance),
    date: fmtDate(r.start_date_local),
    time: fmtTime(r.moving_time),
    elev: `${Math.round(r.total_elevation_gain || 0)} m`,
    name: r.name,
  }));

  const distBuckets = ["1 km","2 km","3 km","4 km","5 km","10 km","15 km","20 km","Half (21k)","30 km","Marathon","50 km","100 km"];

  return (
    <section id="notable" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
      <Divider />
      <SectionNum n={2} />
      <h2 style={{ fontFamily: F.heading, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: C.ink, margin: "0 0 1.5rem", lineHeight: 0.9, letterSpacing: "-1px" }}>
        NOTABLE <span style={{ color: sportColor }}>{sport.toUpperCase()}S</span>
      </h2>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <SportTab label="RUNS" active={sport === "run"} onClick={() => setSport("run")} color={C.run} />
        <SportTab label="RIDES" active={sport === "ride"} onClick={() => setSport("ride")} color={C.ride} />
        <SportTab label="SWIMS" active={sport === "swim"} onClick={() => setSport("swim")} color={C.swim} />
      </div>

      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "0.5rem" }}>
        {sport === "run" && <SubTab label="PERSONAL BESTS" active={tab === "pbs"} onClick={() => setTab("pbs")} />}
        <SubTab label="LONGEST" active={tab === "longest"} onClick={() => setTab("longest")} />
        {sport !== "swim" && <SubTab label="ELEVATION GAIN" active={tab === "elevation"} onClick={() => setTab("elevation")} />}
      </div>

      <div style={{ fontFamily: F.mono, fontSize: "0.62rem", color: C.faint, marginBottom: "1rem" }}>
        {tab === "pbs" ? "fastest times across standard running distances" : tab === "longest" ? `my longest ${sport}s on record` : `the most vertical gain in a single ${sport}`}
      </div>

      {loading ? <div style={{ fontFamily: F.mono, fontSize: "0.7rem", color: C.faint, padding: "3rem 0" }}>loading...</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 280px", gap: "0", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden", background: C.surface }}>
          <div style={{ borderRight: `1px solid ${C.border}` }}>
            <NotableTable rows={tableRows} cols={cols} selected={selected} onSelect={setSelected} sportColor={sportColor} />
          </div>
          <div>
            <ActivityMap polyline={cur?.map_summary_polyline} type={sport === "run" ? "Run" : sport === "ride" ? "Ride" : "Swim"} height={380} />
          </div>
          <div style={{ padding: "1.25rem", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
            {cur && (<>
              <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.faint, marginBottom: "0.5rem" }}>{fmtDate(cur.start_date_local)}</div>
              <div style={{ fontFamily: F.heading, fontSize: "1.1rem", fontWeight: 700, color: C.ink, marginBottom: "1rem", lineHeight: 1.2 }}>{cur.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                {[
                  { l: "KILOMETERS", v: `${(cur.distance / 1000).toFixed(1)} km` },
                  { l: "TIME", v: fmtTime(cur.moving_time) },
                  { l: sport === "ride" ? "AVG SPEED" : sport === "swim" ? "AVG PACE" : "AVG PACE", v: sport === "ride" ? fmtSpeed(cur.average_speed) : sport === "swim" ? fmtSwimPace(cur.moving_time, cur.distance) : fmtPace(cur.moving_time, cur.distance) },
                  { l: "ELEVATION", v: `${Math.round(cur.total_elevation_gain || 0)} m` },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.12em", color: C.faint, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontFamily: F.heading, fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>{v}</div>
                  </div>
                ))}
              </div>
              {cur.average_heartrate && (
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.12em", color: C.faint, marginBottom: 2 }}>AVG HR (BPM)</div>
                  <div style={{ fontFamily: F.heading, fontSize: "1.3rem", fontWeight: 700, color: C.ink }}>{Math.round(cur.average_heartrate)}</div>
                </div>
              )}
              <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: `1px solid ${C.border}` }}>
                <a href={`https://www.strava.com/activities/${cur.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: F.mono, fontSize: "0.58rem", letterSpacing: "0.1em", color: C.muted, textDecoration: "none" }}>
                  VIEW ON STRAVA →
                </a>
              </div>
            </>)}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── STATS SECTION ─── */
function StatsSection({ sportFilter }) {
  const [annual, setAnnual] = useState([]);
  const [hrZones, setHrZones] = useState(null);
  const [paceDist, setPaceDist] = useState([]);
  const [runDist, setRunDist] = useState([]);
  const [indoorOutdoor, setIndoorOutdoor] = useState(null);
  const [weeklyVol, setWeeklyVol] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      rpc("get_annual_stats"),
      rpc("get_hr_zones"),
      rpc("get_pace_dist"),
      rpc("get_run_dist_buckets"),
      rpc("get_indoor_outdoor"),
      rpc("get_weekly_volume"),
    ]).then(([ann, hrz, pd, rd, io, wv]) => {
      setAnnual(safe(ann));
      setHrZones(hrz && !hrz.code ? hrz : null);
      setPaceDist(safe(pd));
      setRunDist(safe(rd));
      setIndoorOutdoor(io && !io.code ? io : null);
      setWeeklyVol(safe(wv).map(r => ({ week: r.week_start?.slice(0, 7), km: +r.total_km || 0 })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sportLabel = sportFilter === "all" ? "All" : sportFilter === "run" ? "Run" : sportFilter === "ride" ? "Ride" : "Swim";
  const sportColor = sportFilter === "run" ? C.run : sportFilter === "ride" ? C.ride : sportFilter === "swim" ? C.swim : C.green;

  const annData = annual.filter(y => +y.year >= 2019).map(y => ({
    year: String(y.year),
    km: sportFilter === "all" ? +y.total_km || 0 : sportFilter === "swim" ? +y.swim_km || 0 : sportFilter === "ride" ? +y.ride_km || 0 : +y.run_km || 0,
    run: +y.run_km || 0, ride: +y.ride_km || 0, swim: +y.swim_km || 0,
  }));

  const hrZoneData = hrZones ? [
    { zone: "Recovery", count: hrZones.recovery || 0 },
    { zone: "Easy", count: hrZones.easy || 0 },
    { zone: "Tempo", count: hrZones.tempo || 0 },
    { zone: "Threshold", count: hrZones.threshold || 0 },
    { zone: "Max", count: hrZones.max || 0 },
  ] : [];

  const hrColors = ["#5BA888", "#4A8F6A", "#C8A84B", "#C07840", "#C05040"];

  if (loading) return <div style={{ fontFamily: F.mono, fontSize: "0.7rem", color: C.faint, padding: "3rem 0" }}>loading stats...</div>;

  return (
    <div>
      {/* Annual distance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <ChartBox title="Annual Distance (km)" subtitle="the full picture">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annData} barSize={20}>
                <XAxis dataKey="year" tick={{ fontFamily: F.mono, fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip content={<Tip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                {sportFilter === "all" ? <>
                  <Bar dataKey="swim" stackId="a" fill={C.swim} name="Swim" />
                  <Bar dataKey="ride" stackId="a" fill={C.ride} name="Ride" />
                  <Bar dataKey="run" stackId="a" fill={C.run} radius={[2, 2, 0, 0]} name="Run" />
                </> : <Bar dataKey="km" fill={sportColor} radius={[2, 2, 0, 0]} name="km" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {sportFilter === "all" && (
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              {[["Run", C.run], ["Ride", C.ride], ["Swim", C.swim]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: F.mono, fontSize: "0.55rem", color: C.faint }}>
                  <div style={{ width: 8, height: 8, borderRadius: 1, background: c }} />{l}
                </div>
              ))}
            </div>
          )}
        </ChartBox>

        <ChartBox title="Activity by Time of Day" subtitle="not very meaningful lol">
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.faint }}>polar chart</div>
          </div>
        </ChartBox>

        <ChartBox title="Avg Dist by Day" subtitle="so f*ckin consistent">
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.faint }}>radar chart</div>
          </div>
        </ChartBox>
      </div>

      {/* Second row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <ChartBox title="Activity Mix Over Time" subtitle="time spent per sport (hours)">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyVol.filter((_, i) => i % 4 === 0)}>
                <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<Tip />} />
                <defs>
                  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.run} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.run} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="km" stroke={C.run} strokeWidth={1.5} fill="url(#vg)" name="km/week" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartBox>

        <ChartBox title="All-Time Activities" subtitle="i love running">
          {indoorOutdoor && (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: "Run", value: (indoorOutdoor.outdoor_run || 0) + (indoorOutdoor.indoor_run || 0), fill: C.run },
                    { name: "Ride", value: (indoorOutdoor.outdoor_ride || 0) + (indoorOutdoor.virtual_ride || 0), fill: C.ride },
                    { name: "Swim", value: (indoorOutdoor.outdoor_swim || 0) + (indoorOutdoor.indoor_swim || 0), fill: C.swim },
                  ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" strokeWidth={0} />
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartBox>
      </div>

      {/* Third row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <ChartBox title="Distance Distribution (km)" subtitle="you can tell what my least favorite sport is">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runDist} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="bucket" tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" fill={C.run} radius={[0, 2, 2, 0]} name="runs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBox>

        <ChartBox title="Heart Rate Zones" subtitle="the full <3 picture">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hrZoneData} barSize={24}>
                <XAxis dataKey="zone" tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {hrZoneData.map((_, i) => <Cell key={i} fill={hrColors[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            {["Recovery","Easy","Tempo","Threshold","Max"].map((l, i) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: F.mono, fontSize: "0.5rem", color: C.faint }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: hrColors[i] }} />
                {l} &lt; {[120, 140, 160, 180, 999][i]}
              </div>
            ))}
          </div>
        </ChartBox>
      </div>

      {/* Fourth row - pace dist */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <ChartBox title="Pace Distribution (min/km)" subtitle="a near-perfect bell curve">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paceDist} barSize={22}>
                <XAxis dataKey="bucket" tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" fill={C.run} radius={[2, 2, 0, 0]} name="runs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBox>

        <ChartBox title="Indoor vs Outdoor" subtitle="rain or shine">
          {indoorOutdoor && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", paddingTop: "0.5rem" }}>
              {[
                { l: "Outdoor Run", v: indoorOutdoor.outdoor_run || 0, c: C.run },
                { l: "Treadmill", v: indoorOutdoor.indoor_run || 0, c: C.muted },
                { l: "Outdoor Ride", v: indoorOutdoor.outdoor_ride || 0, c: C.ride },
                { l: "Virtual Ride", v: indoorOutdoor.virtual_ride || 0, c: "#8B6030" },
                { l: "Open Water", v: indoorOutdoor.outdoor_swim || 0, c: C.swim },
                { l: "Pool Swim", v: indoorOutdoor.indoor_swim || 0, c: "#4A80C0" },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: F.mono, fontSize: "0.5rem", color: C.faint, marginBottom: 2 }}>{s.l}</div>
                  <div style={{ fontFamily: F.heading, fontSize: "1.4rem", fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          )}
        </ChartBox>
      </div>
    </div>
  );
}

/* ─── GEOGRAPHY ─── */
function GeoSection() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [tip, setTip] = useState(null);
  const [geoCounts, setGeoCounts] = useState({});

  const cities = [
    { city: "Rio de Janeiro", key: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
    { city: "Cascais", key: "Cascais", country: "Portugal", lat: 38.6979, lng: -9.4215 },
    { city: "Florianópolis", key: "Florianopolis", country: "Brazil", lat: -27.5969, lng: -48.5495 },
    { city: "São Paulo", key: "Sao Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
    { city: "Brasília", key: "Brasilia", country: "Brazil", lat: -15.7942, lng: -47.8822 },
    { city: "Panama City", key: "Panama City", country: "Panama", lat: 8.9824, lng: -79.5199 },
    { city: "Eagleman MD", key: "Eagleman MD", country: "USA", lat: 38.5157, lng: -76.0788 },
    { city: "Marbella", key: "Marbella", country: "Spain", lat: 36.5100, lng: -4.8860 },
    { city: "Curitiba", key: "Curitiba", country: "Brazil", lat: -25.4284, lng: -49.2733 },
  ];

  useEffect(() => {
    rpc("get_geo_counts").then(d => { if (d && !d.code) setGeoCounts(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded || !containerRef.current) return;
    loadMapbox(() => {
      if (mapRef.current) return;
      const map = new window.mapboxgl.Map({ container: containerRef.current, style: "mapbox://styles/mapbox/light-v11", center: [-20, 10], zoom: 1.2, attributionControl: false });
      mapRef.current = map;
      map.addControl(new window.mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => {
        cities.forEach(loc => {
          const acts = geoCounts[loc.key] || 0;
          const sz = acts > 500 ? 38 : acts > 50 ? 26 : acts > 5 ? 18 : 12;
          const el = document.createElement("div");
          el.style.cssText = `width:${sz}px;height:${sz}px;background:${C.green};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${sz > 20 ? "9px" : "0"};font-weight:700;color:#fff;cursor:pointer;border:2px solid rgba(255,255,255,0.6);box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
          if (sz > 20) el.textContent = acts > 999 ? `${Math.round(acts / 100) / 10}k` : acts;
          el.addEventListener("mouseenter", () => setTip({ ...loc, acts }));
          el.addEventListener("mouseleave", () => setTip(null));
          el.addEventListener("click", () => map.flyTo({ center: [loc.lng, loc.lat], zoom: 8, duration: 1200 }));
          new window.mapboxgl.Marker(el).setLngLat([loc.lng, loc.lat]).addTo(map);
        });
        setLoaded(true);
      });
    });
  }, [geoCounts]);

  return (
    <div>
      <div style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div ref={containerRef} style={{ height: 420, background: C.surface }} />
        {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: "0.7rem", color: C.faint }}>loading map...</div>}
        {tip && <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(26,26,24,0.9)", color: "#fff", padding: "6px 14px", borderRadius: 4, fontFamily: F.mono, fontSize: "0.65rem", pointerEvents: "none" }}>{tip.city}, {tip.country} · {(geoCounts[tip.key] || 0).toLocaleString()} activities</div>}
        <div style={{ position: "absolute", bottom: 10, left: 12, fontFamily: F.mono, fontSize: "0.55rem", color: C.faint }}>click a dot to zoom in</div>
      </div>
      <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
        {cities.filter(l => (geoCounts[l.key] || 0) > 0).sort((a, b) => (geoCounts[b.key] || 0) - (geoCounts[a.key] || 0)).map(l => (
          <div key={l.city} onClick={() => mapRef.current?.flyTo({ center: [l.lng, l.lat], zoom: 8, duration: 1200 })} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: F.body, fontSize: "0.78rem", fontWeight: 600, color: C.ink }}>{l.city}</div>
              <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.muted }}>{(geoCounts[l.key] || 0).toLocaleString()} activities</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── RECENT ─── */
function DonutChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size/2, cy = size/2, outerR = size*0.42, innerR = size*0.25;
  const GAP = 0.03; // radians gap between slices
  let cum = -Math.PI/2;
  const slices = data.map(d => {
    const angle = (d.value/total)*2*Math.PI;
    const start = cum + GAP/2;
    const end = cum + angle - GAP/2;
    cum += angle;
    const mid = (start+end)/2;
    // outer arc points
    const x1=cx+outerR*Math.cos(start), y1=cy+outerR*Math.sin(start);
    const x2=cx+outerR*Math.cos(end), y2=cy+outerR*Math.sin(end);
    // inner arc points
    const xi1=cx+innerR*Math.cos(end), yi1=cy+innerR*Math.sin(end);
    const xi2=cx+innerR*Math.cos(start), yi2=cy+innerR*Math.sin(start);
    const li=angle>Math.PI?1:0;
    const path=`M ${x1} ${y1} A ${outerR} ${outerR} 0 ${li} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${li} 0 ${xi2} ${yi2} Z`;
    // label position — midpoint between inner and outer radius
    const labelR = (outerR+innerR)/2;
    const lx = cx+labelR*Math.cos(mid);
    const ly = cy+labelR*Math.sin(mid);
    const pct = Math.round(d.value/total*100);
    return {...d, path, lx, ly, pct, angle};
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block",margin:"0 auto"}}>
      {slices.map(s=>(
        <g key={s.label}>
          <path d={s.path} fill={s.color} opacity={0.85} />
          {s.angle > 0.35 && (
            <text
              x={s.lx} y={s.ly}
              textAnchor="middle" dominantBaseline="central"
              style={{fontFamily:"monospace", fontSize:size*0.055, fontWeight:400, fill:"#fff", pointerEvents:"none"}}
            >{(s.value/total*100).toFixed(1)}%</text>
          )}
        </g>
      ))}
      <circle cx={cx} cy={cy} r={innerR-2} fill={C.bg} />
    </svg>
  );
}


function ActivityIcon({ type, color }) {
  const s = { width:20, height:20, display:"block", flexShrink:0 };
  const p = { fill:"none", stroke:color||"currentColor", strokeWidth:1.8, strokeLinecap:"round", strokeLinejoin:"round" };
  // Swim — lucide waves (exact from therealroach)
  if (type === "Swim" || type === "OpenWaterSwim") return (
    <svg viewBox="0 0 24 24" style={s}><path {...p} d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path {...p} d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path {...p} d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>
  );
  // Run — lucide footprints (exact from therealroach)
  if (type === "Run") return (
    <svg viewBox="0 0 24 24" style={s}><path {...p} d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path {...p} d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path {...p} d="M16 17h4"/><path {...p} d="M4 13h4"/></svg>
  );
  // Ride — lucide bike (exact from therealroach)
  if (type === "Ride" || type === "VirtualRide" || type === "GravelRide" || type === "MountainBikeRide" || type === "EMountainBikeRide") return (
    <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="18.5" cy="17.5" r="3.5"/><circle {...p} cx="5.5" cy="17.5" r="3.5"/><circle {...p} cx="15" cy="5" r="1"/><path {...p} d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
  );
  // Workout / Weights — lucide dumbbell
  if (type === "Workout" || type === "WeightTraining" || type === "Crossfit") return (
    <svg viewBox="0 0 24 24" style={s}><path {...p} d="M14.4 14.4 9.6 9.6"/><path {...p} d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path {...p} d="m21.5 21.5-1.4-1.4"/><path {...p} d="M3.9 3.9 2.5 2.5"/><path {...p} d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></svg>
  );
  // Ski — lucide mountain-snow
  if (type === "AlpineSki" || type === "BackcountrySki" || type === "NordicSki" || type === "Snowboard") return (
    <svg viewBox="0 0 24 24" style={s}><path {...p} d="m8 3 4 8 5-5 5 15H2L8 3z"/><path {...p} d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></svg>
  );
  // Walk / Hike — lucide person-walking  
  if (type === "Walk" || type === "Hike") return (
    <svg viewBox="0 0 24 24" style={s}><circle {...p} cx="13" cy="4" r="1"/><path {...p} d="M7 21l3-6"/><path {...p} d="M13 21v-4l-3-3 4-6"/><path {...p} d="M11.7 10.4 9 12H6"/><path {...p} d="m15 15 2 6"/></svg>
  );
  // Default — activity pulse
  return (
    <svg viewBox="0 0 24 24" style={s}><path {...p} d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}


function RecentSection({ lang }) {
  const [period, setPeriod] = useState("thisweek");
  const [acts, setActs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const getRange = (p) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === "thisweek") {
      const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay()+6)%7));
      return { since: mon, until: null };
    }
    if (p === "lastweek") {
      const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay()+6)%7) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 7);
      return { since: mon, until: sun };
    }
    if (p === "thismonth") {
      return { since: new Date(today.getFullYear(), today.getMonth(), 1), until: null };
    }
    if (p === "last60") {
      const d = new Date(today); d.setDate(d.getDate() - 60);
      return { since: d, until: null };
    }
    if (p === "ytd") {
      return { since: new Date(today.getFullYear(), 0, 1), until: null };
    }
    return { since: new Date(today), until: null };
  };

  useEffect(() => {
    setLoading(true); setShowAll(false); setExpanded(null);
    const { since, until } = getRange(period);
    let url = `activities?select=id,name,type,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,average_watts,map_summary_polyline&start_date_local=gte.${since.toISOString().slice(0,10)}&order=start_date_local.desc&limit=200`;
    if (until) url += `&start_date_local=lt.${until.toISOString().slice(0,10)}`;
    q(url).then(d => { setActs(safe(d)); setLoading(false); });
  }, [period]);

  const fmtTime = s => { if (!s) return "0m"; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "";
  const typeColor = { Swim: "#3a7ca8", Ride: "#b85a3a", VirtualRide: "#b85a3a", Run: C.green, Workout: "#9a8070", WeightTraining: "#b85a7a", AlpineSki: "#6ab" };
  const typeIcon = { Swim: "~", Ride: "⊙", VirtualRide: "⊙", Run: "↗", Workout: "◈", WeightTraining: "◈", AlpineSki: "❄" };
  const typeLabel = { Swim:"Swim", Ride:"Ride", VirtualRide:"Virtual Ride", Run:"Run", Workout:"Workout", WeightTraining:"Weights", AlpineSki:"Ski" };

  const totalTime = acts.reduce((s,a) => s+(a.moving_time||0), 0);
  const totalDist = acts.reduce((s,a) => s+(a.distance||0), 0) / 1000;

  // Build donut data grouped by sport category
  const byType = {};
  acts.forEach(a => {
    const t = a.type || "Other";
    if(!byType[t]) byType[t] = { time:0, dist:0, count:0 };
    byType[t].time += a.moving_time||0;
    byType[t].dist += a.distance||0;
    byType[t].count++;
  });
  const donutData = Object.entries(byType)
    .map(([type, v]) => ({ label: typeLabel[type]||type, value: v.time, dist: v.dist, count: v.count, color: typeColor[type]||C.faint }))
    .sort((a,b) => b.value - a.value);

  const shown = showAll ? acts : acts.slice(0, 8);
  const periodLabels = { thisweek:"THIS WEEK", lastweek:"LAST WEEK", thismonth:"THIS MONTH", last60:"LAST 60 DAYS", ytd:"YEAR TO DATE" };

  return (
    <section id="recent" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
      <Divider />
      <SectionNum n={6} />
      <h2 style={{ fontFamily: F.heading, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: C.ink, margin: "0 0 1.5rem", lineHeight: 0.9, letterSpacing: "-1px" }}>RECENT ACTIVITIES</h2>
      <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.faint, marginBottom: "1.5rem" }}>stalk me if you must.</div>

      <div style={{ display:"flex", gap:"0.4rem", marginBottom:"1.5rem", flexWrap:"wrap", alignItems:"center" }}>
        {Object.entries(periodLabels).map(([key,lbl]) => (
          <SubTab key={key} label={lbl} active={period===key} onClick={()=>setPeriod(key)} />
        ))}
        {!loading && <span style={{ fontFamily:F.mono, fontSize:"0.6rem", color:C.faint, marginLeft:"0.5rem" }}>{acts.length} activities</span>}
      </div>

      {loading ? <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint }}>loading...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 220px", gap:"2rem", alignItems:"start" }}>
          <div>
            <div style={{ borderTop:`1px solid ${C.border}` }}>
              {shown.map(act => {
                const isExp = expanded === act.id;
                const tc = typeColor[act.type] || C.muted;
                const ic = typeIcon[act.type] || "·";
                return (
                  <div key={act.id}>
                    <div onClick={()=>setExpanded(isExp?null:act.id)} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.8rem 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
                      <ActivityIcon type={act.type} color={tc} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:F.body, fontSize:"0.85rem", fontWeight:600, color:C.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{act.name}</div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.6rem", color:C.faint }}>{fmtDate(act.start_date_local)}</div>
                      </div>
                      <div style={{ display:"flex", gap:"1rem", alignItems:"center", flexShrink:0 }}>
                        {act.distance > 0 && <span style={{ fontFamily:F.heading, fontSize:"0.9rem", fontWeight:700, color:C.ink }}>{(act.distance/1000).toFixed(1)} km</span>}
                        <span style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.muted }}>{fmtTime(act.moving_time)}</span>
                        <span style={{ fontFamily:F.mono, fontSize:"0.65rem", color:isExp?C.green:C.faint }}>{isExp?"▲":"▼"}</span>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderBottom:`1px solid ${C.border}`, background:C.surface, padding:"1rem" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
                          <ActivityMap polyline={act.map_summary_polyline} type={act.type} height={200} />
                          <div>
                            <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.75rem" }}>{fmtDate(act.start_date_local)}</div>
                            {[
                              act.distance>0 && { l:"Distance", v:`${(act.distance/1000).toFixed(1)} km` },
                              { l:"Time", v:fmtTime(act.moving_time) },
                              act.total_elevation_gain && { l:"Elevation", v:`${Math.round(act.total_elevation_gain)} m` },
                              act.average_heartrate && { l:"Avg HR", v:`${Math.round(act.average_heartrate)} bpm` },
                              act.average_watts && { l:"Avg Power", v:`${Math.round(act.average_watts)} W` },
                            ].filter(Boolean).map(({l,v}) => (
                              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"0.35rem 0", borderBottom:`1px solid ${C.border}`, fontFamily:F.mono, fontSize:"0.72rem" }}>
                                <span style={{ color:C.faint }}>{l}</span><span style={{ color:C.ink, fontWeight:600 }}>{v}</span>
                              </div>
                            ))}
                            <a href={`https://www.strava.com/activities/${act.id}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", marginTop:"0.75rem", fontFamily:F.mono, fontSize:"0.58rem", color:C.green, textDecoration:"none", letterSpacing:"0.08em" }}>VIEW ON STRAVA →</a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {acts.length > 8 && (
              <button onClick={()=>setShowAll(v=>!v)} style={{ width:"100%", marginTop:"0.5rem", padding:"0.75rem", background:"transparent", border:`1px solid ${C.border}`, borderRadius:2, cursor:"pointer", fontFamily:F.mono, fontSize:"0.6rem", letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted }}>
                {showAll ? "SHOW LESS ▲" : `SHOW ALL ${acts.length} ACTIVITIES ▼`}
              </button>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div style={{ position:"sticky", top:65 }}>
            <div style={{ marginBottom:"1rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:F.mono, fontSize:"0.6rem", marginBottom:"0.3rem" }}>
                <span style={{ color:C.faint, textTransform:"uppercase", letterSpacing:"0.1em" }}>Total Time</span>
                <span style={{ color:C.ink, fontWeight:600 }}>{fmtTime(totalTime)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:F.mono, fontSize:"0.6rem" }}>
                <span style={{ color:C.faint, textTransform:"uppercase", letterSpacing:"0.1em" }}>Total Distance</span>
                <span style={{ color:C.ink, fontWeight:600 }}>{totalDist.toFixed(1)} km</span>
              </div>
            </div>

            {donutData.length > 0 && (
              <>
                <div style={{ fontFamily:F.mono, fontSize:"0.55rem", letterSpacing:"0.12em", textTransform:"uppercase", color:C.faint, marginBottom:"0.75rem" }}>Time Breakdown</div>
                <DonutChart data={donutData} size={180} />
                <div style={{ marginTop:"1rem" }}>
                  {donutData.map(d => {
                    const pct = totalTime ? Math.round(d.value/totalTime*100) : 0;
                    return (
                      <div key={d.label} style={{ display:"grid", gridTemplateColumns:"8px 1fr 30px 52px 42px", alignItems:"center", gap:"0.4rem", marginBottom:"0.4rem" }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background:d.color, opacity:0.75 }} />
                        <span style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.label}</span>
                        <span style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.ink, textAlign:"right" }}>{pct}%</span>
                        <span style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, textAlign:"right" }}>{fmtTime(d.value)}</span>
                        <span style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, textAlign:"right" }}>{d.dist>0 ? (d.dist/1000).toFixed(1)+'km' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


/* ─── PROGRESSION ─── */
function ProgressionSection() {
  const [year, setYear] = useState("2025");
  const REST = { "All time": 114, "Last 365": 66, "2026": 3, "2025": 37, "2024": 29, "2023": 22, "2022": 18 };
  const [weeklyVol, setWeeklyVol] = useState([]);

  useEffect(() => {
    rpc("get_weekly_volume").then(d => setWeeklyVol(safe(d).map(r => ({ week: r.week_start?.slice(0, 7), km: +r.total_km || 0 }))));
  }, []);

  const DPM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mCount = year === "2026" ? 4 : 12;
  const rng = s => { s = Math.sin(s) * 43758.5453; return s - Math.floor(s); };
  const restCount = REST[year] || 37;
  const total = mCount === 4 ? 111 : 365;
  const rs = new Set(); let att = 0;
  while (rs.size < Math.min(restCount, total - 5) && att < 10000) rs.add(Math.floor(rng(att++ * restCount + 7.3) * total));
  const cells = []; let idx = 0;
  for (let m = 0; m < mCount; m++) {
    const dm = year === "2026" && m === 3 ? 20 : DPM[m];
    for (let d = 0; d < dm; d++) {
      const isR = rs.has(idx);
      cells.push({ month: m, day: d, active: !isR, mins: isR ? 0 : Math.floor(rng(idx * 3.1) * 120) + 60 });
      idx++;
    }
  }

  return (
    <section id="progression" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
      <Divider />
      <SectionNum n={4} />
      <h2 style={{ fontFamily: F.heading, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: C.ink, margin: "0 0 0.5rem", lineHeight: 0.9, letterSpacing: "-1px" }}>
        PROGRESSION
      </h2>
      <div style={{ fontFamily: F.mono, fontSize: "0.85rem", color: C.green, marginBottom: "1.5rem" }}>
        <strong>{restCount}</strong> <span style={{ color: C.muted }}>rest days</span>
      </div>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {Object.keys(REST).map(y => <SubTab key={y} label={y} active={year === y} onClick={() => setYear(y)} />)}
      </div>

      {/* Heatmap */}
      <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
        {Array.from({ length: mCount }, (_, mi) => {
          const dm = year === "2026" && mi === 3 ? 20 : DPM[mi];
          const mCells = cells.filter(c => c.month === mi);
          return (
            <div key={mi} style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: "0.52rem", color: C.faint, marginBottom: 4, textAlign: "center" }}>{MONTHS[mi].slice(0, 1)}</div>
              <div style={{ display: "grid", gridTemplateRows: "repeat(7, 10px)", gridAutoFlow: "column", gap: 2 }}>
                {mCells.map((cell, di) => (
                  <div key={di} style={{ width: 10, height: 10, borderRadius: 2, background: !cell.active ? C.border : cell.mins > 180 ? C.green : cell.mins > 90 ? C.greenMid : "#A0C0A8" }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2.5rem", fontFamily: F.mono, fontSize: "0.55rem", color: C.faint }}>
        <span>Less</span>
        {[C.border, "#A0C0A8", C.greenMid, C.green].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>More</span>
      </div>

      {/* Weekly volume bar chart */}
      {weeklyVol.length > 0 && (
        <div>
          <Label>Weekly Training Volume</Label>
          <div style={{ fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, marginBottom: "0.75rem" }}>km/week since 2022</div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVol.filter((_, i) => i % 2 === 0)} barSize={3}>
                <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: F.mono, fontSize: 9, fill: C.faint }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="km" fill={C.green} radius={[1, 1, 0, 0]} name="km/week" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── ACTIVITY INFO ICON ─── */
function ActivityInfoIcon() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (!open || counts) return;
    const H = {apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json', 'Prefer':'count=exact'};
    const types = ['Run','Ride','VirtualRide','Swim','Workout','WeightTraining','AlpineSki','Walk','Hike','Yoga'];
    Promise.all(types.map(t =>
      fetch(`${SB_URL}/rest/v1/activities?select=count&type=eq.${t}`, {headers:H})
      .then(r=>({type:t, count:parseInt(r.headers.get('content-range')?.split('/')[1]||'0')}))
    )).then(results => setCounts(results.filter(r=>r.count>0).sort((a,b)=>b.count-a.count)));
  }, [open]);
  const typeLabel = {Run:'Run',Ride:'Ride',VirtualRide:'Virtual Ride',Swim:'Swim',Workout:'Workout',WeightTraining:'Weights',AlpineSki:'Alpine Ski',Walk:'Walk',Hike:'Hike',Yoga:'Yoga'};
  return (
    <div style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <span onClick={e=>{e.stopPropagation();setOpen(v=>!v);}} style={{cursor:"pointer",color:C.faint,fontSize:"0.65rem",lineHeight:1,userSelect:"none",marginLeft:2}}>ⓘ</span>
      {open && <>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:99}} />
        <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",zIndex:100,background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,padding:"10px 14px",minWidth:180,boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
          <div style={{fontFamily:F.mono,fontSize:"0.48rem",letterSpacing:"0.15em",color:C.faint,marginBottom:"6px",textTransform:"uppercase"}}>By activity type</div>
          {counts ? counts.map(({type,count})=>(
            <div key={type} style={{display:"flex",justifyContent:"space-between",gap:"2rem",fontFamily:F.mono,fontSize:"0.6rem",padding:"2px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.muted}}>{typeLabel[type]||type}</span>
              <span style={{fontWeight:600,color:C.ink}}>{count.toLocaleString()}</span>
            </div>
          )) : <div style={{fontFamily:F.mono,fontSize:"0.6rem",color:C.faint}}>loading...</div>}
        </div>
      </>}
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function App() {
  const [hero, setHero] = useState(null);
  const [sports, setSports] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [restDays, setRestDays] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");
  const [statsTab, setStatsTab] = useState("all");
  const NAV_IDS = ["about", "notable", "stats", "progression", "geography", "recent"];
  const [active, setActive] = useScrollSpy(NAV_IDS);

  const acts = useCountUp(hero?.total_activities || 0);
  const km = useCountUp(hero?.total_km || 0);
  const hrs = useCountUp(hero?.total_hours || 0);
  const elev = useCountUp(hero?.total_elevation || 0);

  useEffect(() => {
    setMounted(true);
    Promise.all([rpc("get_hero_stats"), rpc("get_sport_totals")]).then(([h, s]) => {
      setHero(h); setSports(s);
    });
    fetch(`${SB_URL}/rest/v1/activities?select=start_date_local&order=start_date_local.desc&limit=1`, { headers: SBH })
      .then(r => r.json()).then(d => { if (d[0]?.start_date_local) setLastSync(new Date(d[0].start_date_local)); });
    // Calculate rest days for current year
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10);
    const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1).toISOString().slice(0,10);
    fetch(`${SB_URL}/rest/v1/activities?select=start_date_local&start_date_local=gte.${yearStart}&start_date_local=lt.${yearEnd}`, { headers: SBH })
      .then(r => r.json()).then(acts => {
        const activeDays = new Set(acts.map(a => a.start_date_local?.slice(0,10))).size;
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) + 1;
        setRestDays(dayOfYear - activeDays);
      });
  }, []);

  const fmtSync = d => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const goto = id => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setActive(id); };

  const statColors = { all: C.green, run: C.run, ride: C.ride, swim: C.swim };

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: F.body, fontSize: 14, minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(237,232,220,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", height: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontFamily: F.heading, fontSize: "0.9rem", fontWeight: 800, color: C.green, letterSpacing: "0.02em" }}>BRUNO S.</span>
          {lastSync && <span style={{ fontFamily: F.mono, fontSize: "0.55rem", color: C.faint }}>· synced {fmtSync(lastSync)}</span>}
        </div>
        <div style={{ display: "flex", gap: "2rem" }}>
          {NAV_IDS.map(id => (
            <button key={id} onClick={() => goto(id)} style={{ background: "none", border: "none", borderBottom: `1.5px solid ${active === id ? C.green : "transparent"}`, padding: "4px 0", cursor: "pointer", fontFamily: F.mono, fontSize: "0.58rem", letterSpacing: "0.15em", textTransform: "uppercase", color: active === id ? C.green : C.muted, transition: "all 0.15s" }}>
              {id.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 2rem" }}>

        {/* HERO */}
        <section style={{ padding: "5rem 0 3rem", textAlign: "center" }}>
          <h1 style={{ fontFamily: F.heading, fontSize: "clamp(5rem,15vw,10rem)", fontWeight: 800, color: C.green, lineHeight: 1, letterSpacing: "0", margin: "0 0 1rem" }}>
            修行
          </h1>
          <div style={{ fontFamily: F.body, fontSize: "0.9rem", color: C.muted, lineHeight: 1.8, marginBottom: "2.5rem", maxWidth: "520px", margin: "0 auto 2.5rem", textAlign: "center", fontStyle: "italic" }}>
            <em>Shugyō</em> — the quiet discipline of giving yourself to the process so completely that repetition becomes transformation
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${C.border}` }}>
            {[
              { val: acts, label: "ACTIVITIES", sub: restDays !== null ? `${restDays} rest day${restDays !== 1 ? 's' : ''} in ${new Date().getFullYear()}` : null, showInfo: true },
              { val: km, label: "KILOMETERS", sub: hero ? `${(hero.total_km / 40075).toFixed(2)} laps around the Earth` : null },
              { val: hrs, label: "HOURS", sub: hero ? `${(hero.total_hours / 24).toFixed(0)} full days` : null },
              { val: elev, label: "M CLIMBED", sub: hero ? `${(hero.total_elevation / 3500).toFixed(1)} Everests base camp to summit` : null, last: true },
            ].map(({ val, label, sub, last }) => (
              <div key={label} style={{ padding: "1.25rem 1rem", textAlign: "center", borderRight: last ? "none" : `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.heading, fontSize: "clamp(1.6rem,2.5vw,2.2rem)", fontWeight: 800, color: C.green, letterSpacing: "-1px", lineHeight: 1 }}>
                  {val.toLocaleString()}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.15em", color: C.muted, margin: "0.35rem 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                    {label}
                    {label === "ACTIVITIES" && <ActivityInfoIcon />}
                  </div>
                {sub && <div style={{ fontFamily: F.body, fontSize: "0.65rem", color: C.faint, lineHeight: 1.4 }}>{sub}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* FOREWORD */}
        <section id="about" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
          <Divider />
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h2 style={{ fontFamily: F.heading, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.2em", color: C.green, margin: 0 }}>FOREWORD</h2>
          </div>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            {[
              "Like many, endurance sports entered my life when I hit rock bottom. I was depressed, drinking, partying, and had just walked away from the most toxic relationship I'd ever been in. What started as a personal challenge quickly became a lifestyle — one that has reshaped my life, inside and out.",
              "Triathlon brought discipline, self-discovery, self-respect, and a clear mind. It gave me consistency, and an unshakable, insatiable desire to evolve — in sport and in life.",
              "I'm a numbers guy, always have been. I like keeping track of my accomplishments as a daily reminder of where I came from, where I am, and what I'm still capable of.",
            ].map((p, i) => (
              <p key={i} style={{ fontFamily: F.body, fontSize: "0.9rem", lineHeight: 1.8, color: C.dim, marginBottom: "1.2rem", fontWeight: 400 }}>{p}</p>
            ))}
            <p style={{ fontFamily: F.body, fontSize: "0.875rem", lineHeight: 1.8, color: C.green, fontStyle: "italic", marginBottom: "2rem", fontWeight: 500 }}>
              This is the never-ending search for my own limits.
            </p>
          </div>
          <Divider />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: F.heading, fontSize: "1.1rem", fontWeight: 700, color: C.ink, marginBottom: "0.3rem" }}>Bruno Silva</div>
              <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.faint, letterSpacing: "0.12em" }}>From Tokyo — and all over the world — to Rio de Janeiro</div>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: "0.7rem", color: C.faint }}>2026</div>
          </div>
          {sports && (
            <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
              {[
                { l: "SWIM", c: sports.swim?.count, km: sports.swim?.km, h: sports.swim?.hours, col: C.swim },
                { l: "RIDE", c: sports.ride?.count, km: sports.ride?.km, h: sports.ride?.hours, col: C.ride },
                { l: "RUN", c: sports.run?.count, km: sports.run?.km, h: sports.run?.hours, col: C.run },
              ].map(s => (
                <div key={s.l} style={{ borderTop: `2px solid ${s.col}`, paddingTop: "0.75rem" }}>
                  <div style={{ fontFamily: F.mono, fontSize: "0.55rem", letterSpacing: "0.15em", color: s.col, marginBottom: "0.3rem" }}>{s.l}</div>
                  <div style={{ fontFamily: F.heading, fontSize: "2rem", fontWeight: 800, color: C.ink, letterSpacing: "-1px" }}>{(s.c || 0).toLocaleString()}</div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.faint }}>
                    {Math.round(s.km || 0).toLocaleString()} km · {Math.round(s.h || 0)}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* NOTABLE */}
        <NotableSection />

        {/* STATS */}
        <section id="stats" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
          <Divider />
          <SectionNum n={3} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
            <h2 style={{ fontFamily: F.heading, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: C.ink, margin: 0, lineHeight: 0.9, letterSpacing: "-1px" }}>
              Statistics <span style={{ color: statColors[statsTab] }}>{statsTab.charAt(0).toUpperCase() + statsTab.slice(1)}</span>
            </h2>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {["all", "run", "ride", "swim"].map(s => (
                <SubTab key={s} label={s.toUpperCase()} active={statsTab === s} onClick={() => setStatsTab(s)} />
              ))}
            </div>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.faint, marginBottom: "1.5rem" }}>measured, not guessed.</div>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <span style={{ fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface }}>METRIC</span>
            <span style={{ fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, padding: "4px 8px" }}>IMPERIAL</span>
          </div>
          <StatsSection sportFilter={statsTab} />
        </section>

        {/* PROGRESSION */}
        <ProgressionSection />

        {/* GEOGRAPHY */}
        <section id="geography" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
          <Divider />
          <SectionNum n={5} />
          <h2 style={{ fontFamily: F.heading, fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: C.ink, margin: "0 0 0.5rem", lineHeight: 0.9, letterSpacing: "-1px" }}>
            GEOGRAPHY
          </h2>
          <div style={{ fontFamily: F.mono, fontSize: "0.58rem", color: C.faint, marginBottom: "1.5rem" }}>i get around.</div>
          <GeoSection />
        </section>

        {/* RECENT */}
        <RecentSection />

        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "2rem 0", fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, display: "flex", justifyContent: "space-between" }}>
          <span>Data synced live from Strava. Not affiliated with Strava, Inc.</span>
          <span>Built by Bruno Silva © 2026</span>
        </footer>
      </div>
    </div>
  );
}
