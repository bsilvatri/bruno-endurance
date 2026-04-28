import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

/* ─── TOKENS ─── */
const SB_URL = import.meta.env.VITE_SB_URL;
const _BUILD=Date.now();const SB_KEY = import.meta.env.VITE_SB_KEY;
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", fontFamily: F.mono, fontSize: "0.65rem", color: C.ink }}>
      {label && <div style={{ color: C.faint, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || C.white }}>
          {p.name || p.dataKey}: <strong>{typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value.toLocaleString() : p.value.toFixed(1)) : p.value}</strong>{p.unit||""}
        </div>
      ))}
    </div>
  );
};



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
            <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.82rem", color: c.accent ? sportColor : C.ink, fontWeight: c.bold ? 600 : 400 }}>
              {c.k === "#" ? `#${i + 1}` : r[c.k]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── NOTABLE SECTION ─── */
function NotableSection({ unitSystem="metric" }) {
  const [sport, setSport] = useState("run");
  const [tab, setTab] = useState("pbs");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState([]);
  useEffect(() => {
    q("best_efforts?select=sport,distance_label,elapsed_time&order=elapsed_time.asc")
      .then(data => setPrs(Array.isArray(data) ? data : []));
  }, []);

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
    if (sport === "swim") setTab("longest");
    else setTab("pbs");
  }, [sport]);

  const cur = rows[selected];
  const fmtTime = s => { if (!s) return "—"; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const fmtPace = (t, d) => { if (!t || !d) return "—"; const s = unitSystem==="imperial" ? t / (d / 1609.34) : t / (d / 1000); return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/${unitSystem==="imperial"?"mi":"km"}`; };
  const fmtSpeed = s => s ? `${unitSystem==="imperial" ? (s*2.237).toFixed(1) : (s*3.6).toFixed(1)} ${unitSystem==="imperial"?"mi/h":"km/h"}` : "—";
  const fmtSwimPace = (t, d) => { if (!t || !d) return "—"; const s = unitSystem==="imperial" ? t / (d / 91.44) : t / (d / 100); return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}/${unitSystem==="imperial"?"100yd":"100m"}`; };

  const cols = tab === "pbs"
    ? [{ k: "#", l: "#", w: "40px" }, { k: "date", l: "Date", w: "110px" }, { k: "dist", l: "Distance", w: "100px" }, { k: "time", l: "Time", w: "1fr", mono: true, accent: true }]
    : tab === "elevation"
    ? [{ k: "#", l: "#", w: "40px" }, { k: "date", l: "Date", w: "110px" }, { k: "dist", l: "Dist", w: "80px" }, { k: "elev", l: "Elevation", w: "1fr", accent: true }]
    : [{ k: "#", l: "#", w: "40px" }, { k: "date", l: "Date", w: "110px" }, { k: "dist", l: "Distance", w: "1fr", accent: true }];

  const tableRows = rows.map(r => ({
    dist: sport === "swim"
      ? (unitSystem === "imperial" ? Math.round(r.distance * 1.09361) + " yd" : Math.round(r.distance) + " m")
      : (unitSystem === "imperial" ? (r.distance / 1609.34).toFixed(1) + " mi" : (r.distance / 1000).toFixed(1) + " km"),
    date: fmtDate(r.start_date_local),
    time: fmtTime(r.moving_time),
    elev: unitSystem==="imperial" ? `${Math.round((r.total_elevation_gain||0)*3.28084)} ft` : `${Math.round(r.total_elevation_gain||0)} m`,
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
{tab === "pbs" ? (
            <div style={{ padding:"1.25rem" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"1px", background:C.border, border:`1px solid ${C.border}` }}>
                <div style={{ background:C.surface, padding:"0.5rem 1rem", fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint }}>DISTANCE</div>
                <div style={{ background:C.surface, padding:"0.5rem 1rem", fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, textAlign:"right" }}>TIME</div>
                {prs.filter(p => p.sport === sport).map((pr, i) => {
                  const s = pr.elapsed_time;
                  const h = Math.floor(s/3600);
                  const m = Math.floor((s%3600)/60);
                  const sec = String(s%60).padStart(2,'0');
                  const time = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${sec}` : `${m}:${sec}`;
                  return (<>
                    <div key={"d"+i} style={{ background:i%2===0?C.bg:C.surface, padding:"0.6rem 1rem", fontFamily:F.mono, fontSize:"0.65rem", color:C.muted }}>{pr.distance_label}</div>
                    <div key={"t"+i} style={{ background:i%2===0?C.bg:C.surface, padding:"0.6rem 1rem", fontFamily:F.mono, fontSize:"0.75rem", fontWeight:700, color:sportColor, textAlign:"right" }}>{time}</div>
                  </>);
                })}
              </div>
            </div>
          ) : (
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", marginBottom: "0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                {[
                  { l: unitSystem==="imperial" ? "MILES" : "KILOMETERS", v: unitSystem==="imperial" ? `${(cur.distance/1609.34).toFixed(1)} mi` : `${(cur.distance/1000).toFixed(1)} km` },
                  { l: "TIME", v: fmtTime(cur.moving_time) },
                  { l: sport === "ride" ? "AVG SPEED" : sport === "swim" ? "AVG PACE" : "AVG PACE", v: sport === "ride" ? fmtSpeed(cur.average_speed) : sport === "swim" ? fmtSwimPace(cur.moving_time, cur.distance) : fmtPace(cur.moving_time, cur.distance) },
                  { l: "ELEVATION", v: unitSystem==="imperial" ? `${Math.round((cur.total_elevation_gain||0)*3.28084)} ft` : `${Math.round(cur.total_elevation_gain||0)} m` },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.12em", color: C.faint, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontFamily: F.mono, fontSize: "0.85rem", fontWeight: 700, color: C.ink }}>{v}</div>
                  </div>
                ))}
              </div>
              {cur.average_heartrate && (
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.5rem", letterSpacing: "0.12em", color: C.faint, marginBottom: 2 }}>AVG HR (BPM)</div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.85rem", fontWeight: 700, color: C.ink }}>{Math.round(cur.average_heartrate)}</div>
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
      )}
    </section>