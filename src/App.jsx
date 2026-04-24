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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", marginBottom: "0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
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


const ChartBox = ({ title, subtitle, children, minH }) => (
  <div style={{ background:C.bg, padding:"1.25rem", display:"flex", flexDirection:"column", minHeight:minH||280 }}>
    <div style={{ textAlign:"center", marginBottom:"0.75rem" }}>
      <div style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.15em", textTransform:"uppercase", color:C.muted, fontWeight:500 }}>{title}</div>
      {subtitle && <div style={{ fontFamily:F.mono, fontSize:"0.5rem", color:C.faint, marginTop:2, fontStyle:"italic" }}>{subtitle}</div>}
    </div>
    <div style={{ flex:1 }}>{children}</div>
  </div>
);

function StatsSection({ sportFilter }) {
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all activities with all fields needed for charts
    async function fetchAll() {
      const map = [];
      let offset = 0;
      const pageSize = 1000;
      while(true) {
        const res = await fetch(
          `${SB_URL}/rest/v1/activities?select=sport_type,distance,moving_time,average_heartrate,average_speed,start_date_local,trainer&order=start_date_local.asc&limit=${pageSize}&offset=${offset}`,
          { headers: SBH }
        ).then(r=>r.json());
        if(!Array.isArray(res)||res.length===0) break;
        map.push(...res);
        if(res.length<pageSize) break;
        offset+=pageSize;
      }
      setActs(map);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Sport filter helpers
  const isRun  = t => t==='Run'||t==='TrailRun';
  const isRide = t => t==='Ride'||t==='VirtualRide';
  const isSwim = t => t==='Swim';
  const matchesSport = (a) => {
    if(sportFilter==='all') return isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type);
    if(sportFilter==='run')  return isRun(a.sport_type);
    if(sportFilter==='ride') return isRide(a.sport_type);
    if(sportFilter==='swim') return isSwim(a.sport_type);
    return true;
  };

  const filtered = acts.filter(matchesSport);
  const isAll = sportFilter==='all';
  const sColor = sportFilter==='run'?C.run:sportFilter==='ride'?C.ride:sportFilter==='swim'?C.swim:C.green;
  const hrColors = ["#2d8a7e","#4a7c59","#9a7e5a","#c47a2a","#b85a3a"];

  // ── Annual Distance ──
  const annMap = {};
  acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
    const yr = a.start_date_local?.slice(0,4);
    if(!yr||+yr<2019) return;
    if(!annMap[yr]) annMap[yr]={year:yr,run:0,ride:0,swim:0};
    const km = (+a.distance||0)/1000;
    if(isRun(a.sport_type))  annMap[yr].run  += km;
    if(isRide(a.sport_type)) annMap[yr].ride += km;
    if(isSwim(a.sport_type)) annMap[yr].swim += km;
  });
  const annData = Object.values(annMap).sort((a,b)=>a.year-b.year).map(y=>({
    ...y,
    run:Math.round(y.run), ride:Math.round(y.ride), swim:Math.round(y.swim),
    km: Math.round(isAll ? y.run+y.ride+y.swim : sportFilter==='run'?y.run:sportFilter==='ride'?y.ride:y.swim),
  }));

  // ── Distance Distribution ──
  const distBuckets = isAll
    ? [["0-5km",0,5],["5-10km",5,10],["10-21km",10,21],["21-42km",21,42],["42km+",42,999]]
    : sportFilter==='swim'
    ? [["<1km",0,1],["1-2km",1,2],["2-3km",2,3],["3-5km",3,5],["5km+",5,999]]
    : sportFilter==='ride'
    ? [["0-30km",0,30],["30-60km",30,60],["60-100km",60,100],["100-150km",100,150],["150km+",150,999]]
    : [["0-5km",0,5],["5-10km",5,10],["10-21km",10,21],["21-42km",21,42],["42km+",42,999]];
  const distData = distBuckets.map(([label,lo,hi]) => ({
    bucket: label,
    count: filtered.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&km<hi;}).length
  }));

  // ── Pace Distribution (run only, or all running for "all") ──
  const runActs = acts.filter(a=>isRun(a.sport_type));
  const paceActsToUse = isAll||sportFilter==='run' ? runActs : [];
  const paceBuckets = [
    {bucket:"<3:30",lo:0,hi:3.5},{bucket:"3:30-4:00",lo:3.5,hi:4},{bucket:"4:00-4:30",lo:4,hi:4.5},
    {bucket:"4:30-5:00",lo:4.5,hi:5},{bucket:"5:00-5:30",lo:5,hi:5.5},{bucket:"5:30+",lo:5.5,hi:999}
  ];
  const paceData = paceBuckets.map(b => ({
    bucket: b.bucket,
    count: paceActsToUse.filter(a=>{
      if(!a.average_speed||+a.average_speed===0) return false;
      const minKm = 1000/(+a.average_speed*60);
      return minKm>=b.lo&&minKm<b.hi;
    }).length
  }));

  // ── HR Zones ──
  const hrBounds = [[0,100],[100,120],[120,140],[140,160],[160,999]];
  const hrData = [
    {zone:"Recovery"},{zone:"Easy"},{zone:"Tempo"},{zone:"Threshold"},{zone:"Max"}
  ].map((z,i)=>({
    ...z,
    count: filtered.filter(a=>a.average_heartrate&&+a.average_heartrate>=hrBounds[i][0]&&+a.average_heartrate<hrBounds[i][1]).length
  }));

  // ── Indoor vs Outdoor ──
  const ioData = [
    {name:"Outdoor Run",  value:acts.filter(a=>isRun(a.sport_type)&&!a.trainer).length,  fill:C.run},
    {name:"Treadmill",    value:acts.filter(a=>isRun(a.sport_type)&&a.trainer).length,    fill:"#8a9a80"},
    {name:"Outdoor Ride", value:acts.filter(a=>a.sport_type==='Ride').length,             fill:C.ride},
    {name:"Virtual Ride", value:acts.filter(a=>a.sport_type==='VirtualRide').length,      fill:"#c0805a"},
    {name:"Open Water",   value:acts.filter(a=>isSwim(a.sport_type)&&!a.trainer).length,  fill:C.swim},
    {name:"Pool Swim",    value:acts.filter(a=>isSwim(a.sport_type)&&a.trainer).length,   fill:"#5a9ac0"},
  ].filter(d=>d.value>0);

  // ── Weekly Volume ──
  const wkMap = {};
  filtered.forEach(a => {
    if(!a.start_date_local) return;
    const d = new Date(a.start_date_local);
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate()-((day+6)%7));
    const wk = monday.toISOString().slice(0,10);
    if(!wkMap[wk]) wkMap[wk]=0;
    wkMap[wk] += (+a.distance||0)/1000;
  });
  const wvData = Object.entries(wkMap).sort(([a],[b])=>a.localeCompare(b)).map(([w,km])=>({week:w,km:Math.round(km)})).filter((_,i)=>i%2===0);

  // Time of day radar — 24 hours
  const buildTod = (subset) => {
    const m = {};
    for(let h=0;h<24;h++) m[h<10?'0'+h:String(h)] = 0;
    subset.forEach(a => { if(a.start_date_local) m[a.start_date_local.slice(11,13)] = (m[a.start_date_local.slice(11,13)]||0)+1; });
    return Object.entries(m).map(([hour,count])=>({hour,count}));
  };
  const todData = buildTod(filtered).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour));
  const todRun  = isAll ? buildTod(acts.filter(a=>isRun(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour))  : null;
  const todRide = isAll ? buildTod(acts.filter(a=>isRide(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todSwim = isAll ? buildTod(acts.filter(a=>isSwim(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todMerged = isAll ? todData.map((d,i)=>({hour:d.hour, run:todRun[i].count, ride:todRide[i].count, swim:todSwim[i].count})) : todData;

  // Day of week radar
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buildDow = (subset) => {
    const cnt = {}; const dist = {};
    days.forEach(d=>{cnt[d]=0;dist[d]=0;});
    subset.forEach(a => {
      if(!a.start_date_local) return;
      const [yr,mo,dy] = a.start_date_local.slice(0,10).split('-').map(Number);
      const d = new Date(yr,mo-1,dy);
      const day = days[(d.getDay()+6)%7];
      cnt[day]++;
      dist[day] += (+a.distance||0)/1000;
    });
    return days.map(d=>({day:d, avg:cnt[d]>0?Math.round(dist[d]/cnt[d]*10)/10:0}));
  };
  const dowData   = buildDow(filtered);
  const dowRun    = isAll ? buildDow(acts.filter(a=>isRun(a.sport_type)))  : null;
  const dowRide   = isAll ? buildDow(acts.filter(a=>isRide(a.sport_type))) : null;
  const dowSwim   = isAll ? buildDow(acts.filter(a=>isSwim(a.sport_type))) : null;
  const dowMerged = isAll ? days.map((d,i)=>({day:d, run:dowRun[i].avg, ride:dowRide[i].avg, swim:dowSwim[i].avg})) : dowData;

  // Activity Mix Over Time — % of hours per sport per year (ALL tab only)
  const actMixData = (() => {
    const yrMap = {};
    acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
      const yr = a.start_date_local?.slice(0,4);
      if(!yr||+yr<2019) return;
      if(!yrMap[yr]) yrMap[yr]={year:yr,run:0,ride:0,swim:0};
      const hrs = (+a.moving_time||0)/3600;
      if(isRun(a.sport_type))  yrMap[yr].run  += hrs;
      if(isRide(a.sport_type)) yrMap[yr].ride += hrs;
      if(isSwim(a.sport_type)) yrMap[yr].swim += hrs;
    });
    return Object.values(yrMap).sort((a,b)=>a.year-b.year).map(y => {
      const total = y.run+y.ride+y.swim||1;
      return {
        year: y.year,
        run:  +y.run.toFixed(1), ride: +y.ride.toFixed(1), swim: +y.swim.toFixed(1),
      };
    });
  })();

  const G = { display:"grid", gap:"1px", background:C.border, border:`1px solid ${C.border}` };
  const tickStyle = { fontFamily:F.mono, fontSize:9, fill:C.faint };

  if(loading) return <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"2rem 0" }}>loading stats...</div>;

  return (
    <div>
      {/* ROW 0 — Annual Distance | Time of Day + Avg Dist */}
      <div style={{ ...G, gridTemplateColumns:"1fr 2fr" }}>
        <ChartBox title="Annual Distance (km)" subtitle={isAll?"all sports by year":sportFilter+" distance"} minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={annData} barSize={isAll?16:22}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} tickFormatter={v=>v>=1000?Math.round(v/1000)+'k':v} />
              <Tooltip content={({ active, payload, label }) => {
                if(!active||!payload?.length) return null;
                const yearTotal = payload.reduce((s,p)=>s+(+p.value||0),0);
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink}}>
                    <div style={{color:C.faint,marginBottom:4}}>{label}</div>
                    {payload.map(p=>(
                      <div key={p.dataKey} style={{color:p.color||C.ink}}>
                        {p.name}: <strong>{Math.round(p.value).toLocaleString()}</strong>{p.unit||""}
                      </div>
                    ))}
                    {isAll && payload.length>1 && (
                      <>
                        <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}/>
                        <div style={{color:C.ink}}>Total: <strong>{Math.round(yearTotal).toLocaleString()}</strong> km</div>
                      </>
                    )}
                  </div>
                );
              }} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              {isAll ? <>
                <Bar dataKey="swim" stackId="a" fill={C.swim} name="Swim" unit=" km" />
                <Bar dataKey="ride" stackId="a" fill={C.ride} name="Ride" unit=" km" />
                <Bar dataKey="run"  stackId="a" fill={C.run}  radius={[2,2,0,0]} name="Run" unit=" km" />
              </> : <Bar dataKey="km" fill={sColor} radius={[2,2,0,0]} name={sportFilter==="run"?"Run":sportFilter==="ride"?"Ride":"Swim"} unit=" km" />}
            </BarChart>
          </ResponsiveContainer>
          {(() => {
            const totalKm = Math.round(annData.reduce((s,y)=>s+(isAll?y.run+y.ride+y.swim:y.km),0));
            return (
              <>
                {isAll && (
                  <div style={{display:"flex",gap:"0.75rem",justifyContent:"center",marginTop:"0.5rem"}}>
                    {[["Run",C.run],["Ride",C.ride],["Swim",C.swim]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>
                        <div style={{width:7,height:7,borderRadius:1,background:c}}/>{l}
                      </div>
                    ))}
                  </div>
                )}

              </>
            );
          })()}
        </ChartBox>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px",background:C.border}}>
          <ChartBox title="Activity by Time of Day" subtitle="peak: early morning" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?todMerged:todData} cx="50%" cy="50%">
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="hour" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run" />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" />
                </> : <Radar dataKey="count" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="activities" />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox title="Avg Distance by Day" subtitle="consistency, they call it" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?dowMerged:dowData}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="day" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run" unit=" km" />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" unit=" km" />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" unit=" km" />
                </> : <Radar dataKey="avg" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name={sportFilter==="all"?"Avg":"Avg"} unit=" km" />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ROW 1 — Distance Dist | Indoor/Outdoor | Pace Dist */}
      <div style={{...G, gridTemplateColumns:"1fr 1fr 1fr", borderTop:"none"}}>
        <ChartBox title="Distance Distribution" subtitle="activity counts by distance" minH={331}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} layout="vertical" barSize={14}>
              <CartesianGrid horizontal={false} stroke={C.border} />
              <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="bucket" tick={tickStyle} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              <Bar dataKey="count" fill={sColor} radius={[0,2,2,0]} name="activities" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Indoor vs Outdoor" subtitle="rain or shine" minH={331}>
          {ioData.length>0 && (
            <div style={{height:220,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              <ResponsiveContainer width="100%" height={155}>
                <PieChart>
                  <Pie data={ioData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {ioData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.2rem 0.5rem"}}>
                {ioData.map(d=>(
                  <div key={d.name} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:1,background:d.fill,flexShrink:0}}/>
                    <span style={{fontFamily:F.mono,fontSize:"0.45rem",color:C.faint}}>{d.name}</span>
                    <span style={{fontFamily:F.mono,fontSize:"0.45rem",color:C.muted,marginLeft:"auto"}}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartBox>
        <ChartBox title="Pace Distribution (min/km)" subtitle="running pace buckets" minH={331}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={paceData}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="bucket" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<Tip />} cursor={{stroke:C.border}} />
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.run} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.run} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke={C.run} strokeWidth={1.5} fill="url(#pg)" name="runs" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ROW 2 — HR Zones | Weekly Volume */}
      <div style={{...G, gridTemplateColumns:"1fr 1fr", borderTop:"none"}}>
        <ChartBox title="Heart Rate Zones" subtitle="~50% easy, the rest is pain" minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hrData} barSize={32}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="zone" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              <Bar dataKey="count" radius={[2,2,0,0]} name="activities">
                {hrData.map((_,i)=><Cell key={i} fill={hrColors[i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginTop:"0.5rem"}}>
            {["Recovery","Easy","Tempo","Threshold","Max"].map((l,i)=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.mono,fontSize:"0.48rem",color:C.faint}}>
                <div style={{width:6,height:6,borderRadius:1,background:hrColors[i]}}/>{l}
              </div>
            ))}
          </div>
        </ChartBox>
        <ChartBox title="Weekly Volume (km)" subtitle="km per week over time" minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={wvData}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="week" tick={false} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<Tip />} cursor={{stroke:C.border}} />
              <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={sColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={sColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="km" stroke={sColor} strokeWidth={1.5} fill="url(#wg)" name="km/week" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ROW 3 — Activity Mix Over Time (ALL tab only) */}
      {isAll && (
        <div style={{...G, gridTemplateColumns:"1fr", borderTop:"none"}}>
          <ChartBox title="Activity Mix Over Time" subtitle="% of training hours per sport per year" minH={280}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={actMixData} stackOffset="expand">
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36}
                  ticks={[0,0.25,0.5,0.75,1]}
                  tickFormatter={v=>Math.round(v*100)+'%'} />
                <Tooltip content={({ active, payload, label }) => {
                  if(!active||!payload?.length) return null;
                  const row = actMixData.find(d=>d.year===label)||{};
                  const total = (row.run||0)+(row.ride||0)+(row.swim||0)||1;
                  return (
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink}}>
                      <div style={{color:C.faint,marginBottom:4}}>{label}</div>
                      {[["Run",C.run,row.run],["Ride",C.ride,row.ride],["Swim",C.swim,row.swim]].map(([name,color,hrs])=>(
                        <div key={name} style={{color:color}}>
                          {name}: <strong>{(hrs||0).toFixed(1)}h</strong>
                        </div>
                      ))}
                      <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4,color:C.ink}}>
                        Total: <strong>{total.toFixed(1)}h</strong>
                      </div>
                    </div>
                  );
                }} cursor={{stroke:C.border}} />
                <Area type="monotone" dataKey="swim" stackId="1" stroke={C.swim} fill={C.swim} fillOpacity={0.85} name="Swim" dot={false} />
                <Area type="monotone" dataKey="ride" stackId="1" stroke={C.ride} fill={C.ride} fillOpacity={0.85} name="Ride" dot={false} />
                <Area type="monotone" dataKey="run"  stackId="1" stroke={C.run}  fill={C.run}  fillOpacity={0.85} name="Run"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:"0.75rem",justifyContent:"center",marginTop:"0.5rem"}}>
              {[["Run",C.run],["Ride",C.ride],["Swim",C.swim]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>
                  <div style={{width:7,height:7,borderRadius:1,background:c}}/>{l}
                </div>
              ))}
            </div>
          </ChartBox>
        </div>
      )}
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
    if (loaded || !containerRef.current || !Object.keys(geoCounts).length) return;
    loadMapbox(() => {
      if (mapRef.current) return;
      const map = new window.mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-20, 10], zoom: 1.2, attributionControl: false
      });
      mapRef.current = map;

      map.on("load", () => {
        const geojson = {
          type: "FeatureCollection",
          features: cities.map(loc => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
            properties: { city: loc.city, country: loc.country, key: loc.key, count: geoCounts[loc.key] || 0 }
          }))
        };

        map.addSource("cities", { type: "geojson", data: geojson });

        // Outer glow
        map.addLayer({ id: "city-glow", type: "circle", source: "cities", paint: {
          "circle-radius": 14, "circle-color": C.green, "circle-opacity": 0.15, "circle-blur": 1
        }});

        // Main dot
        map.addLayer({ id: "city-dots", type: "circle", source: "cities", paint: {
          "circle-radius": ["interpolate",["linear"],["get","count"],0,4,100,6,500,9,1000,12],
          "circle-color": C.green, "circle-opacity": 0.9,
          "circle-stroke-width": 1.5, "circle-stroke-color": "rgba(255,255,255,0.6)"
        }});

        // Hover state
        map.on("mouseenter", "city-dots", e => {
          map.getCanvas().style.cursor = "pointer";
          const props = e.features[0].properties;
          setTip({ city: props.city, country: props.country, acts: props.count });
        });
        map.on("mouseleave", "city-dots", () => {
          map.getCanvas().style.cursor = "";
          setTip(null);
        });

        // Click to fly
        map.on("click", "city-dots", e => {
          const [lng, lat] = e.features[0].geometry.coordinates;
          map.flyTo({ center: [lng, lat], zoom: 8, duration: 1200 });
        });

        setLoaded(true);
      });
    });
  }, [geoCounts]);

  const sorted = cities.filter(l => (geoCounts[l.key]||0) > 0).sort((a,b) => (geoCounts[b.key]||0)-(geoCounts[a.key]||0));
  const uniqueCountries = new Set(sorted.map(l=>l.country)).size;

  return (
    <div>
      <div style={{ position:"relative", border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div ref={containerRef} style={{ height:"clamp(300px,50vw,480px)", background:C.surface }} />
        {!loaded && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F.mono, fontSize:"0.7rem", color:C.faint }}>loading map...</div>}
        {tip && (
          <div style={{ position:"absolute", top:12, left:12, background:"rgba(20,20,20,0.92)", color:"#fff", padding:"6px 12px", fontFamily:F.mono, fontSize:"0.62rem", pointerEvents:"none", border:"1px solid rgba(255,255,255,0.1)" }}>
            <span style={{color:C.green,fontWeight:600}}>{(tip.acts||0).toLocaleString()}</span> · {tip.city}, {tip.country}
          </div>
        )}
      </div>

      <div style={{ border:`1px solid ${C.border}`, borderTop:"none", background:C.surface, padding:"1rem 1.25rem" }}>
        <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.2em", textTransform:"uppercase", color:C.faint, marginBottom:"0.5rem" }}>Top places</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"0 1.5rem", marginBottom:"1rem", justifyContent:"center" }}>
          {sorted.slice(0,5).map(l => (
            <span key={l.city} onClick={() => mapRef.current?.flyTo({center:[l.lng,l.lat],zoom:8,duration:1200})} style={{ fontFamily:F.mono, fontSize:"0.65rem", color:C.muted, cursor:"pointer" }}>
              <span style={{color:C.green,fontWeight:600}}>{(geoCounts[l.key]||0).toLocaleString()}</span> in {l.city}, {l.country}
            </span>
          ))}
        </div>
        <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.2em", textTransform:"uppercase", color:C.faint, marginBottom:"0.5rem" }}>Facts</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"0 1.5rem", justifyContent:"center" }}>
          {[
            { val: sorted.length, label: "locations" },
            { val: uniqueCountries, label: "countries" },
            { val: 3, label: "continents" },
          ].map(f => (
            <span key={f.label} style={{ fontFamily:F.mono, fontSize:"0.65rem", color:C.muted }}>
              <span style={{color:C.green,fontWeight:600}}>{f.val}</span> {f.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop:"1rem", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1px", background:C.border }}>
        {sorted.map((l, i) => (
          <div key={l.city}
            onClick={() => mapRef.current?.flyTo({center:[l.lng,l.lat],zoom:8,duration:1200})}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.5rem 0.75rem", background:C.bg, cursor:"pointer", gap:"0.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", minWidth:0 }}>
<span style={{ fontFamily:F.mono, fontSize:"0.6rem", color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.city}</span>
            </div>
            <span style={{ fontFamily:F.mono, fontSize:"0.6rem", color:C.green, fontWeight:600, flexShrink:0 }}>{(geoCounts[l.key]||0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ─── RECENT ─── */
function DonutChart({ data, size = 180 }) {
  const [tooltip, setTooltip] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size/2, cy = size/2, outerR = size*0.42, innerR = size*0.25;
  const GAP = 0.03;
  let cum = -Math.PI/2;
  const slices = data.map(d => {
    const angle = (d.value/total)*2*Math.PI;
    const start = cum + GAP/2;
    const end = cum + angle - GAP/2;
    cum += angle;
    const mid = (start+end)/2;
    const x1=cx+outerR*Math.cos(start), y1=cy+outerR*Math.sin(start);
    const x2=cx+outerR*Math.cos(end), y2=cy+outerR*Math.sin(end);
    const xi1=cx+innerR*Math.cos(end), yi1=cy+innerR*Math.sin(end);
    const xi2=cx+innerR*Math.cos(start), yi2=cy+innerR*Math.sin(start);
    const li=angle>Math.PI?1:0;
    const path=`M ${x1} ${y1} A ${outerR} ${outerR} 0 ${li} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${li} 0 ${xi2} ${yi2} Z`;
    const labelR = (outerR+innerR)/2;
    const lx = cx+labelR*Math.cos(mid);
    const ly = cy+labelR*Math.sin(mid);
    const pct = (d.value/total*100).toFixed(1);
    return {...d, path, lx, ly, pct, angle};
  });
  return (
    <div style={{position:"relative", display:"inline-block"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block",margin:"0 auto"}}>
        {slices.map(s=>(
          <g key={s.label}
            onMouseEnter={()=>setTooltip(s.label)}
            onMouseLeave={()=>setTooltip(null)}
            style={{cursor:"default"}}
          >
            <path d={s.path} fill={s.color} opacity={tooltip===s.label ? 1 : 0.85} />
            {s.angle > 0.35 && (
              <text
                x={s.lx} y={s.ly}
                textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:"monospace", fontSize:size*0.043, fontWeight:400, fill:"#fff", pointerEvents:"none"}}
              >{s.pct}%</text>
            )}
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR-2} fill={C.bg} />
      </svg>
      {tooltip && (
        <div style={{position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          fontFamily:F.mono, fontSize:"0.55rem", color:C.ink, letterSpacing:"0.05em",
          textAlign:"center", pointerEvents:"none", lineHeight:1.4}}>
          {tooltip}
        </div>
      )}
    </div>
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
                        <div style={{ fontFamily:F.body, fontSize:"0.85rem", fontWeight:400, color:C.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{act.name}</div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.6rem", color:C.faint }}>{fmtDate(act.start_date_local)}</div>
                      </div>
                      <div style={{ display:"flex", gap:"1rem", alignItems:"center", flexShrink:0 }}>
                        {act.distance > 0 && <span style={{ fontFamily:F.body, fontSize:"0.85rem", fontWeight:400, color:C.ink }}>{(act.distance/1000).toFixed(1)} km</span>}
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
  const YEARS = ["All time","Last 365","2026","2025","2024","2023","2022","2021","2020","2019"];
  const [period, setPeriod] = useState("Last 365");
  const [actDays, setActDays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    async function fetchAll() {
      const map = {};
      let offset = 0;
      const pageSize = 1000;
      while(true) {
        const res = await fetch(
          `${SB_URL}/rest/v1/activities?select=start_date_local,moving_time&order=start_date_local.asc&limit=${pageSize}&offset=${offset}`,
          { headers: SBH }
        ).then(r => r.json());
        if(!Array.isArray(res) || res.length === 0) break;
        res.forEach(a => {
          const utcDate = new Date(a.start_date_local);
          const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
          const day = localDate.toISOString().slice(0, 10);
          if(!map[day]) map[day] = 0;
          map[day] += a.moving_time || 0;
        });
        if(res.length < pageSize) break;
        offset += pageSize;
      }
      setActDays(map);
      setLoading(false);
    }
    fetchAll();
  }, []);

  const ALL_YEARS = ["2026","2025","2024","2023","2022","2021","2020","2019"];

  const getRange = (yr) => {
    const today = new Date();
    if(yr === "Last 365") {
      const s = new Date(today); s.setDate(s.getDate() - 364);
      return { start: s, end: today };
    }
    const y = parseInt(yr);
    return { start: new Date(y, 0, 1), end: y === today.getFullYear() ? today : new Date(y, 11, 31) };
  };

  const buildWeeks = (rangeStart, rangeEnd) => {
    const startMonday = new Date(rangeStart);
    startMonday.setDate(startMonday.getDate() - ((startMonday.getDay()+6)%7));
    const weeks = [];
    let cur = new Date(startMonday);
    while(cur <= rangeEnd) {
      const week = [];
      for(let i=0;i<7;i++) {
        const d = new Date(cur);
        const str = d.toISOString().slice(0,10);
        const inRange = d >= rangeStart && d <= rangeEnd;
        week.push({ date: str, mins: inRange ? Math.round((actDays[str]||0)/60) : -1 });
        cur.setDate(cur.getDate()+1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const getColor = (mins, maxMins) => {
    if(mins < 0) return 'transparent';
    if(mins === 0) return C.border;
    const m = maxMins || 150;
    if(mins < m * 0.25) return '#c6dfc9';
    if(mins < m * 0.5) return '#8cbf92';
    if(mins < m * 0.75) return '#4a9a5c';
    return C.green;
  };

  // Global max for All time view
  const globalMax = period === "All time"
    ? Math.max(...Object.values(actDays).map(s => Math.round(s/60)), 1)
    : 150;

  const getStats = (rangeStart, rangeEnd) => {
    const s = rangeStart.toISOString().slice(0,10);
    const e = rangeEnd.toISOString().slice(0,10);
    const totalDays = Math.round((rangeEnd - rangeStart) / 86400000) + 1;
    const activeDays = Object.keys(actDays).filter(d => d >= s && d <= e).length;
    const restDays = totalDays - activeDays;
    const pct = Math.round(activeDays / totalDays * 100);
    return { totalDays, activeDays, restDays, pct };
  };

  const Heatmap = ({ rangeStart, rangeEnd, label, maxMins }) => {
    const weeks = buildWeeks(rangeStart, rangeEnd);
    const { totalDays, activeDays, restDays, pct } = getStats(rangeStart, rangeEnd);
    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = new Date(week[0].date).getMonth();
      if(m !== lastMonth) { monthLabels[wi] = new Date(week[0].date).toLocaleString('en',{month:'short'}); lastMonth = m; }
      else monthLabels[wi] = '';
    });
    return (
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem" }}>
          {/* Heatmap */}
          <div style={{ overflowX:"auto", flex:1 }}>
            <div style={{ display:"inline-flex", flexDirection:"column" }}>
              <div style={{ display:"flex", gap:3, marginBottom:4, marginLeft:18 }}>
                {weeks.map((_, wi) => (
                  <div key={wi} style={{ width:9, flexShrink:0, fontFamily:F.mono, fontSize:"0.38rem", color:C.faint, textTransform:"uppercase", overflow:"hidden" }}>
                    {monthLabels[wi]||''}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:3 }}>
                <div style={{ display:"grid", gridTemplateRows:"repeat(7,9px)", gap:1, marginRight:2 }}>
                  {['M','','W','','F','',''].map((lbl,i) => (
                    <div key={i} style={{ height:9, fontFamily:F.mono, fontSize:"0.38rem", color:C.faint, display:"flex", alignItems:"center" }}>{lbl}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display:"grid", gridTemplateRows:"repeat(7,9px)", gap:1 }}>
                    {week.map((day, di) => (
                      <div key={di}
                        onMouseEnter={e => { if(day.mins>=0) { const r=e.target.getBoundingClientRect(); document.getElementById('heat-tip').style.display='block'; document.getElementById('heat-tip').style.left=(r.left+16)+'px'; document.getElementById('heat-tip').style.top=(r.top-28)+'px'; document.getElementById('heat-tip').textContent=day.mins>0?`${day.date}: ${String(Math.floor(day.mins/60)).padStart(2,"0")}:${String(day.mins%60).padStart(2,"0")}`:`${day.date}: rest`; }}}
                        onMouseLeave={() => { document.getElementById('heat-tip').style.display='none'; }}
                        style={{ width:9, height:9, borderRadius:1, background:getColor(day.mins, maxMins), cursor:day.mins>0?'pointer':'default' }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Stats */}
          <div style={{ flexShrink:0, textAlign:"right", paddingTop:"1rem" }}>
            <div style={{ fontFamily:F.mono, fontSize:"0.85rem", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, color:C.green, lineHeight:1 }}>{pct}%</div>
            <div style={{ fontFamily:F.mono, fontSize:"0.55rem", color:C.faint, marginTop:"0.2rem" }}>{activeDays}/{totalDays}</div>
            <div style={{ fontFamily:F.mono, fontSize:"0.55rem", color:C.faint }}>{restDays} rest</div>
          </div>
        </div>
        
      </div>
    );
  };

  const singleYears = period !== "All time" ? [period === "Last 365" ? "Last 365" : period] : null;
  const yearsToShow = period === "All time" ? ALL_YEARS : [period];

  return (
    <section id="progression" style={{ scrollMarginTop: 50, paddingBottom: "4rem" }}>
      <Divider />
      <SectionNum n={4} />
      <h2 style={{ fontFamily:F.heading, fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:800, color:C.ink, margin:"0 0 0.5rem", lineHeight:0.9, letterSpacing:"-1px" }}>
        PROGRESSION
      </h2>
      <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"1.5rem" }}>i take rest days, but not by choice.</div>
      <div style={{ display:"flex", gap:"0.4rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
        {YEARS.map(y => <SubTab key={y} label={y} active={period===y} onClick={()=>setPeriod(y)} />)}
      </div>
      <div id="heat-tip" style={{ position:"fixed", display:"none", background:"rgba(20,20,20,0.92)", color:"#fff", padding:"4px 10px", fontFamily:"monospace", fontSize:"0.62rem", borderRadius:3, pointerEvents:"none", zIndex:9999, border:"1px solid rgba(255,255,255,0.15)" }} />
      {loading ? (
        <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint }}>loading...</div>
      ) : (
        <div>
          {yearsToShow.map(yr => {
            const { start, end } = getRange(yr);
            return (
              <div key={yr} style={{ display:"flex", alignItems:"flex-start", gap:"0.75rem" }}>
                {period === "All time" && (
                  <div style={{ fontFamily:F.mono, fontSize:"0.85rem", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, color:C.ink, width:44, textAlign:"right", flexShrink:0, alignSelf:"center" }}>{yr}</div>
                )}
                <div style={{ flex:1 }}>
                  <Heatmap rangeStart={start} rangeEnd={end} label={yr} maxMins={globalMax} />
                </div>
              </div>
            );
          })}
          {period !== "All time" && (() => {
            const { start, end } = getRange(period);
            const { totalDays, activeDays, restDays } = getStats(start, end);
            return (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"0.75rem" }}>
                <div style={{ fontFamily:F.mono, fontSize:"0.65rem", color:C.muted }}>
                  <span style={{ fontFamily:F.mono, fontSize:"0.85rem", letterSpacing:"0.1em", fontWeight:600, color:C.ink, textTransform:"uppercase" }}>{restDays}</span>
                  {' '}<span style={{ color:C.faint }}>rest days / {totalDays} total</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4, fontFamily:F.mono, fontSize:"0.52rem", color:C.faint }}>
                  <span>Less</span>
                  {[C.border,'#c6dfc9','#8cbf92','#4a9a5c',C.green].map((c,i)=>(
                    <div key={i} style={{ width:13, height:13, borderRadius:2, background:c }} />
                  ))}
                  <span>More</span>
                </div>
              </div>
            );
          })()}
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

// Thu Apr 23 11:48:56 -03 2026
// bust
