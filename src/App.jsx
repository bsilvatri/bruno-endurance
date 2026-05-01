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
  green: "#4A7A5A",
  greenMid: "#5C7A45",
  greenLight: "#5C7A45",
  run: "#5C7A45",
  ride: "#C4622D",
  swim: "#2E7DA6",
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
  const [sport, setSport] = useState("races");
  const [tab, setTab] = useState("pbs");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState([]);
  useEffect(() => {
    const ACT_MAP = {"400m":6796419022,"1/2 mile":12017370695,"1K":12017370695,"1 mile":10799004879,"2 mile":10799004879,"5K":10991460408,"10K":14300148280,"15K":14300148280,"10 mile":14300148280,"20K":14300148280,"Half-Marathon":14300148280,"30K":17985954019};
    q("best_efforts?select=distance_label,elapsed_time,sport&sport=eq.run&order=elapsed_time.asc")
      .then(async bes => {
        if (!Array.isArray(bes)) return;
        const relevant = bes.filter(b => ACT_MAP[b.distance_label]);
        const uniqueIds = [...new Set(relevant.map(b => ACT_MAP[b.distance_label]))];
        const actMap = {};
        await Promise.all(uniqueIds.map(id =>
          q(`activities?select=id,name,start_date_local,distance,total_elevation_gain,average_heartrate,map_summary_polyline&id=eq.${id}`)
            .then(rows => { if (Array.isArray(rows) && rows.length) actMap[id] = rows[0]; })
        ));
        setPrs(relevant.map(b => ({ _label:b.distance_label, _elapsed:b.elapsed_time, ...actMap[ACT_MAP[b.distance_label]] })));
      });
  }, []);
  const sportColor = sport === "run" ? C.run : sport === "ride" ? C.ride : C.swim;
  useEffect(() => {
    if (sport === "races") { setLoading(false); return; }
    setLoading(true); setSelected(0);
    let queryUrl = "";
    if (sport === "run" && tab === "pbs") { setLoading(false); return; }
    else if (tab === "longest") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":sport==="swim"?"type=eq.Swim":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&order=distance.desc&limit=10`; }
    else if (tab === "elevation") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&total_elevation_gain=gt.0&order=total_elevation_gain.desc&limit=10`; }
    if (!queryUrl) { setLoading(false); return; }
    q(queryUrl).then(data => { setRows(safe(data)); setLoading(false); }).catch(() => setLoading(false));
  }, [sport, tab]);
  useEffect(() => {
    if (sport === "races") return;
    if (sport === "ride" || sport === "swim") setTab("longest"); else setTab("pbs");
  }, [sport]);
  const cur = rows[selected];
  const fmtTime = s => { if (!s) return "—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
  const fmtPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/1609.34):t/(d/1000); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`; };
  const fmtSpeed = s => s?`${unitSystem==="imperial"?(s*2.237).toFixed(1):(s*3.6).toFixed(1)} ${unitSystem==="imperial"?"mi/h":"km/h"}`:"—";
  const fmtSwimPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/91.44):t/(d/100); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"100yd":"100m"}`; };
  const cols = tab==="pbs"?[{k:"#",l:"#",w:"40px"},{k:"dist",l:"Distance",w:"120px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]:tab==="elevation"?[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Dist",w:"80px"},{k:"elev",l:"Elevation",w:"1fr",accent:true}]:[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Distance",w:"1fr",accent:true}];
  const tableRows = rows.map(r => ({
    dist: sport==="swim"?(unitSystem==="imperial"?Math.round(r.distance*1.09361)+" yd":Math.round(r.distance)+" m"):(unitSystem==="imperial"?(r.distance/1609.34).toFixed(1)+" mi":(r.distance/1000).toFixed(1)+" km"),
    date: fmtDate(r.start_date_local), time: fmtTime(r.moving_time),
    elev: unitSystem==="imperial"?`${Math.round((r.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(r.total_elevation_gain||0)} m`,
    name: r.name,
  }));
  const RACES = [
    {race:"IM70.3 Cascais",date:"Oct '22",swim:"0:30:39",bike:"2:33:46",run:"1:35:13",finish:"4:48:04",s:"fin"},
    {race:"IM70.3 Florianópolis",date:"Apr '23",swim:"0:31:25",bike:"2:25:23",run:"1:36:15",finish:"4:39:27",s:"fin"},
    {race:"Challenge Geraardsbergen",date:"Jun '23",swim:"0:34:50",bike:"1:01:37",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Rio de Janeiro",date:"Jul '23",swim:"0:34:36",bike:"2:31:53",run:"1:40:41",finish:"4:55:39",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '23",swim:"0:32:15",bike:"2:24:13",run:"1:38:20",finish:"4:42:56",s:"fin"},
    {race:"IM70.3 Cascais",date:"Oct '23",swim:"0:28:29",bike:"2:32:53",run:"1:25:14",finish:"4:34:03",s:"fin"},
    {race:"IM70.3 Panama City",date:"Feb '24",swim:"0:23:27",bike:"2:26:08",run:"1:49:40",finish:"4:46:08",s:"fin"},
    {race:"IM70.3 Eagleman",date:"Jun '24",swim:"0:36:29",bike:"2:27:10",run:"1:42:01",finish:"4:52:26",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '24",swim:"—",bike:"—",run:"—",finish:"DNS",s:"dns"},
    {race:"IM70.3 Cascais",date:"Oct '24",swim:"0:31:06",bike:"2:24:08",run:"1:28:34",finish:"4:30:59",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '24",swim:"0:28:13",bike:"2:18:59",run:"1:26:56",finish:"4:21:47",s:"fin",pr:2},
    {race:"IM70.3 Punta del Este",date:"Mar '25",swim:"0:24:30",bike:"1:19:19",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Brasília",date:"Apr '25",swim:"0:28:28",bike:"2:16:45",run:"1:38:18",finish:"4:28:00",s:"fin",pr:3},
    {race:"Challenge Samorin",date:"May '25",swim:"0:10:48",bike:"2:27:18",run:"1:26:20",finish:"DNC",s:"dnc"},
    {race:"IM70.3 Marbella World Championship",date:"Nov '25",swim:"0:30:30",bike:"2:46:13",run:"1:26:48",finish:"4:52:24",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '25",swim:"0:27:45",bike:"2:18:45",run:"1:41:10",finish:"4:32:46",s:"fin"},
    {race:"IM70.3 Curitiba",date:"Mar '26",swim:"0:27:49",bike:"2:42:58",run:"1:33:08",finish:"4:48:41",s:"fin"},
    {race:"IM70.3 Brasília",date:"Apr '26",swim:"0:27:57",bike:"2:14:26",run:"1:30:46",finish:"4:18:09",s:"fin",pr:1},
  ];
  return (
    <section id="notable" style={{ scrollMarginTop:50, paddingBottom:"4rem" }}>
      <Divider />
      <SectionNum n={2} />
      <h2 style={{ fontFamily:F.heading, fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:800, color:C.ink, margin:"0 0 1.5rem", lineHeight:0.9, letterSpacing:"-1px" }}>
        NOTABLE <span style={{ color:sport==="races"?"#A63D2F":sportColor }}>{sport==="races"?"RACES":sport.toUpperCase()+"S"}</span>
      </h2>
      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
        <SportTab label="RACES" active={sport==="races"} onClick={()=>setSport("races")} color="#A63D2F" />
        <SportTab label="RUNS" active={sport==="run"} onClick={()=>setSport("run")} color={C.run} />
        <SportTab label="RIDES" active={sport==="ride"} onClick={()=>setSport("ride")} color={C.ride} />
        <SportTab label="SWIMS" active={sport==="swim"} onClick={()=>setSport("swim")} color={C.swim} />
      </div>
      {sport==="races" ? (
        <div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>PERSONAL RECORDS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"1px", background:C.border, border:"1px solid "+C.border, marginBottom:"1.5rem" }}>
            {[{l:"SWIM",v:"0:23:27",sub:"Panama '24",c:C.swim},{l:"BIKE",v:"2:14:26",sub:"Brasília '26",c:C.ride},{l:"RUN",v:"1:25:14",sub:"Cascais '23",c:C.run},{l:"FINISH",v:"4:18:09",sub:"Brasília '26",c:C.ink}].map((pr,i)=>(
              <div key={i} style={{ background:C.bg, padding:"0.65rem 0.75rem" }}>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:C.faint, marginBottom:"0.2rem" }}>{pr.l}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.82rem", fontWeight:700, color:pr.c }}>{pr.v}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", color:C.muted, marginTop:"0.15rem" }}>{pr.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>RACE HISTORY — 18 RACES · 15 FINISHES · 2 DNF · 1 DNS · 1 DNC</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 90px 80px 80px 80px 90px", gap:"1px", background:C.border, border:"1px solid "+C.border, minWidth:"520px" }}>
              {["RACE","DATE","SWIM","BIKE","RUN","FINISH"].map((h,i)=>(
                <div key={i} style={{ background:C.surface, padding:"0.4rem 0.5rem", fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:[C.faint,C.faint,C.swim,C.ride,C.run,C.ink][i], textAlign:i>1?"center":"left" }}>{h}</div>
              ))}
              {RACES.map((r,i)=>{
                const dnx=r.s!=="fin"; const bg=i%2===0?C.bg:C.surface;
                const fc=r.s==="dnf"?"#c04040":r.s==="dns"?"#888":r.s==="dnc"?"#7050b0":C.green;
                return [
                  <div key={"n"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ink,opacity:dnx?"0.5":"1",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    {r.race}{r.pr&&<span style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.08em",background:r.pr===1?"#D4AF37":r.pr===2?"#A8A9AD":"#CD7F32",color:"#fff",padding:"0.1rem 0.3rem",borderRadius:2,fontWeight:700,flexShrink:0}}>{r.pr===1?"PR #1":r.pr===2?"PR #2":"PR #3"}</span>}
                  </div>,
                  <div key={"d"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.muted,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.date}</div>,
                  <div key={"s"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.swim,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.swim}</div>,
                  <div key={"b"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ride,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.bike}</div>,
                  <div key={"r"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.run,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.run}</div>,
                  <div key={"f"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",fontWeight:dnx?400:700,color:fc,textAlign:"center"}}>{r.finish}</div>
                ];
              })}
            </div>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", color:C.faint, marginTop:"0.75rem", letterSpacing:"0.05em" }}>DNF — Did not finish | DNS — Did not start | DNC — Did not count</div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center", marginBottom:"0.5rem" }}>
            {sport==="run"&&<SubTab label="PERSONAL BESTS" active={tab==="pbs"} onClick={()=>setTab("pbs")} />}
            <SubTab label="LONGEST" active={tab==="longest"} onClick={()=>setTab("longest")} />
            {sport!=="swim"&&<SubTab label="ELEVATION GAIN" active={tab==="elevation"} onClick={()=>setTab("elevation")} />}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.62rem", color:C.faint, marginBottom:"1rem" }}>
            {tab==="pbs"?"fastest times across standard running distances":tab==="longest"?`my longest ${sport}s on record`:`the most vertical gain in a single ${sport}`}
          </div>
          {sport==="run"&&tab==="pbs" ? (
            prs.length===0 ? (<div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>) : (
              <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden", background:C.surface }}>
                <div style={{ borderRight:`1px solid ${C.border}` }}>
                  <NotableTable
                    rows={prs.map(r=>({ dist:r._label, date:fmtDate(r.start_date_local), time:fmtTime(r._elapsed), name:r.name }))}
                    cols={[{k:"#",l:"#",w:"40px"},{k:"dist",l:"Distance",w:"120px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]}
                    selected={selected} onSelect={setSelected} sportColor={sportColor}
                  />
                </div>
                <div><ActivityMap polyline={prs[selected]?.map_summary_polyline} type="Run" height={380} /></div>
                <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                  {prs[selected]&&(<>
                    <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(prs[selected].start_date_local)}</div>
                    <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{prs[selected].name}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                      {[
                        {l:"DISTANCE",v:prs[selected]._label},
                        {l:"TIME",v:fmtTime(prs[selected]._elapsed)},
                        {l:"AVG PACE",v:(()=>{const dm={"400m":400,"1/2 mile":804,"1K":1000,"1 mile":1609,"2 mile":3218,"5K":5000,"10K":10000,"15K":15000,"10 mile":16093,"20K":20000,"Half-Marathon":21097,"30K":30000};const d=dm[prs[selected]._label];if(!d)return"—";const s=prs[selected]._elapsed/d*(unitSystem==="imperial"?1609.34:1000);return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`;})()},
                        {l:"ELEVATION",v:unitSystem==="imperial"?`${Math.round((prs[selected].total_elevation_gain||0)*3.28084)} ft`:`${Math.round(prs[selected].total_elevation_gain||0)} m`},
                      ].map(({l,v})=>(<div key={l}><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div></div>))}
                    </div>
                    {prs[selected].average_heartrate&&(<div><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(prs[selected].average_heartrate)}</div></div>)}
                    <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                      <a href={`https://www.strava.com/activities/${prs[selected].id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>VIEW ON STRAVA →</a>
                    </div>
                  </>)}
                </div>
              </div>
            )
          ) : loading?(<div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>):(
            <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden", background:C.surface }}>
              <div style={{ borderRight:`1px solid ${C.border}` }}><NotableTable rows={tableRows} cols={cols} selected={selected} onSelect={setSelected} sportColor={sportColor} /></div>
              <div><ActivityMap polyline={cur?.map_summary_polyline} type={sport==="run"?"Run":sport==="ride"?"Ride":"Swim"} height={380} /></div>
              <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                {cur&&(<>
                  <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(cur.start_date_local)}</div>
                  <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{cur.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                    {[
                      {l:unitSystem==="imperial"?"MILES":"KILOMETERS",v:unitSystem==="imperial"?`${(cur.distance/1609.34).toFixed(1)} mi`:`${(cur.distance/1000).toFixed(1)} km`},
                      {l:"TIME",v:fmtTime(cur.moving_time)},
                      {l:sport==="ride"?"AVG SPEED":"AVG PACE",v:sport==="ride"?fmtSpeed(cur.average_speed):sport==="swim"?fmtSwimPace(cur.moving_time,cur.distance):fmtPace(cur.moving_time,cur.distance)},
                      {l:"ELEVATION",v:unitSystem==="imperial"?`${Math.round((cur.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(cur.total_elevation_gain||0)} m`},
                    ].map(({l,v})=>(<div key={l}><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div></div>))}
                  </div>
                  {cur.average_heartrate&&(<div><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(cur.average_heartrate)}</div></div>)}
                  <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                    <a href={`https://www.strava.com/activities/${cur.id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>VIEW ON STRAVA →</a>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </>
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

function StatsSection({ sportFilter, unitSystem="metric" }) {
  const isMetric = unitSystem === "metric";
  const distUnit = isMetric ? "km" : "mi";
  const toUnit = (km) => isMetric ? km : +(km * 0.621371).toFixed(1);
  const toUnitRound = (km) => Math.round(isMetric ? km : km * 0.621371);
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
    run:toUnitRound(y.run), ride:toUnitRound(y.ride), swim:toUnitRound(y.swim),
    km: toUnitRound(isAll ? y.run+y.ride+y.swim : sportFilter==='run'?y.run:sportFilter==='ride'?y.ride:y.swim),
  }));

  // ── Distance Distribution ──
  const [distTip, setDistTip] = useState(null);
  const mkB = (label,arr,lo,hi) => ({label, count:arr.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length});
  const runActs2 = acts.filter(a=>isRun(a.sport_type));
  const rideActs2 = acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide');
  const swimActs2 = acts.filter(a=>isSwim(a.sport_type));
  const runDist  = [mkB("0-5km",runActs2,0,5),mkB("5-10km",runActs2,5,10),mkB("10-15km",runActs2,10,15),mkB("15-21km",runActs2,15,21),mkB("21-30km",runActs2,21,30),mkB("30-42km",runActs2,30,42)];
  const rideDist = [mkB("0-20km",rideActs2,0,20),mkB("20-40km",rideActs2,20,40),mkB("40-60km",rideActs2,40,60),mkB("60-80km",rideActs2,60,80),mkB("80-100km",rideActs2,80,100),mkB("100-120km",rideActs2,100,120),mkB("120km+",rideActs2,120,999)];
  const swimDist = [mkB("0-500m",swimActs2,0,0.5),mkB("500m-1km",swimActs2,0.5,1),mkB("1-2km",swimActs2,1,2),mkB("2-3km",swimActs2,2,3),mkB("3-5km",swimActs2,3,5),mkB("5km+",swimActs2,5,999)];
  const _kmBuckets = sportFilter==='swim'?[[0,0.5],[0.5,1],[1,2],[2,3],[3,5],[5,999]]:sportFilter==='ride'?[[0,20],[20,40],[40,60],[60,80],[80,100],[100,120],[120,999]]:[[0,5],[5,10],[10,15],[15,21],[21,30],[30,42]];
  const distData = _kmBuckets.map(([lo,hi]) => {
    const label = hi===999?`${lo<1?lo*1000+"m":lo+"km"}+`:lo<1&&hi<=1?`${lo*1000}-${hi*1000}m`:`${lo<1?lo*1000+"m":lo+"km"}-${hi<1?hi*1000+"m":hi+"km"}`;
    return {label, count:filtered.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length};
  });

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

  // ── Activity breakdown (sport-aware) ──
  const ioData = sportFilter==="run" ? [
    {name:"Outdoor Run",value:acts.filter(a=>isRun(a.sport_type)&&!a.trainer).length,fill:C.run},
    {name:"Treadmill",value:acts.filter(a=>isRun(a.sport_type)&&a.trainer).length,fill:"#8a9a80"},
  ].filter(d=>d.value>0) : sportFilter==="ride" ? [
    {name:"Outdoor Ride",value:acts.filter(a=>a.sport_type==='Ride').length,fill:C.ride},
    {name:"Virtual Ride",value:acts.filter(a=>a.sport_type==='VirtualRide').length,fill:"#c0805a"},
  ].filter(d=>d.value>0) : sportFilter==="swim" ? [
    {name:"Open Water",value:acts.filter(a=>isSwim(a.sport_type)&&!a.trainer).length,fill:C.swim},
    {name:"Pool Swim",value:acts.filter(a=>isSwim(a.sport_type)&&a.trainer).length,fill:"#5a9ac0"},
  ].filter(d=>d.value>0) : [
    {name:"Runs",value:acts.filter(a=>isRun(a.sport_type)).length,fill:C.run},
    {name:"Rides",value:acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide').length,fill:C.ride},
    {name:"Swims",value:acts.filter(a=>isSwim(a.sport_type)).length,fill:C.swim},
    {name:"Other",value:acts.filter(a=>!isRun(a.sport_type)&&a.sport_type!=='Ride'&&a.sport_type!=='VirtualRide'&&!isSwim(a.sport_type)).length,fill:C.muted},
  ].filter(d=>d.value>0);
  const ioTitle = sportFilter==="run"?"Indoor vs Outdoor":sportFilter==="ride"?"Indoor vs Outdoor":sportFilter==="swim"?"Pool vs Open Water":"All-time Activities";
  const ioSubtitle = sportFilter==="run"?"road or treadmill":sportFilter==="ride"?"road or trainer":sportFilter==="swim"?"lane or open water":"by sport type";

  // ── Yearly Volume + Streaks ──
  const yearlyMap = {};
  acts.forEach(a => {
    if (!a.start_date_local) return;
    const yr = new Date(a.start_date_local).getFullYear();
    if (!yearlyMap[yr]) yearlyMap[yr] = { run:0, ride:0, swim:0 };
    const km = (+a.distance||0)/1000;
    if (isRun(a.sport_type)) yearlyMap[yr].run += km;
    else if (a.sport_type==='Ride'||a.sport_type==='VirtualRide') yearlyMap[yr].ride += km;
    else if (isSwim(a.sport_type)) yearlyMap[yr].swim += km;
  });
  const yearlyData = Object.entries(yearlyMap).sort(([a],[b])=>+a-+b).map(([yr,v])=>({year:yr,run:toUnitRound(v.run),ride:toUnitRound(v.ride),swim:toUnitRound(v.swim)}));
  const actDays2 = new Set(acts.filter(a=>a.start_date_local).map(a=>a.start_date_local.slice(0,10)));
  const sortedDays2 = [...actDays2].sort();
  let bestStreak=0,curStreak2=0;
  for(let i=0;i<sortedDays2.length;i++){
    if(i===0){curStreak2=1;}
    else{const diff=(new Date(sortedDays2[i])-new Date(sortedDays2[i-1]))/86400000;if(diff===1)curStreak2++;else curStreak2=1;}
    if(curStreak2>bestStreak)bestStreak=curStreak2;
  }
  const today2=new Date().toISOString().slice(0,10);
  const yesterday2=new Date(Date.now()-86400000).toISOString().slice(0,10);
  let liveStreak=0;
  for(let i=sortedDays2.length-1;i>=0;i--){
    if(i===sortedDays2.length-1){if(sortedDays2[i]!==today2&&sortedDays2[i]!==yesterday2)break;liveStreak=1;}
    else{const diff=(new Date(sortedDays2[i+1])-new Date(sortedDays2[i]))/86400000;if(diff===1)liveStreak++;else break;}
  }
  const totalDaysWithActivity=actDays2.size;

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
    return days.map(d=>({day:d, avg:cnt[d]>0?Math.round(toUnit(dist[d]/cnt[d])*10)/10:0}));
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
        <ChartBox title={`Annual Distance (${distUnit})`} subtitle={isAll?"all sports by year":sportFilter+" distance"} minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={annData} barSize={isAll?16:22}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} tickFormatter={v=>v>=1000?(Math.round(v/100)/10)+'k':v} />
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
                        <div style={{color:C.ink}}>Total: <strong>{Math.round(yearTotal).toLocaleString()}</strong> {distUnit}</div>
                      </>
                    )}
                  </div>
                );
              }} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              {isAll ? <>
                <Bar dataKey="swim" stackId="a" fill={C.swim} name="Swim" unit={" "+distUnit} />
                <Bar dataKey="ride" stackId="a" fill={C.ride} name="Ride" unit={" "+distUnit} />
                <Bar dataKey="run"  stackId="a" fill={C.run}  radius={[2,2,0,0]} name="Run"  unit={" "+distUnit} />
              </> : <Bar dataKey="km" fill={sColor} radius={[2,2,0,0]} name={sportFilter==="run"?"Run":sportFilter==="ride"?"Ride":"Swim"} unit={" "+distUnit} />}
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
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run"  unit={" "+distUnit} />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" unit={" "+distUnit} />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" unit={" "+distUnit} />
                </> : <Radar dataKey="avg" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="Avg" unit={" "+distUnit} />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ROW 1 — Distance Dist | Indoor/Outdoor | Pace Dist */}
      <div style={{...G, gridTemplateColumns:"1fr 1fr 1fr", borderTop:"none"}}>
        <ChartBox title="Distance Distribution" subtitle="activity counts by distance" minH={331}>
          {isAll ? (
            <div style={{paddingTop:"0.25rem",position:"relative"}} onMouseLeave={()=>setDistTip(null)}>
              {distTip&&<div style={{position:"fixed",pointerEvents:"none",zIndex:9999,background:C.surface,border:"1px solid "+C.border,borderRadius:4,padding:"6px 10px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,top:distTip.y-40,left:distTip.x+14,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",display:"flex",gap:"0.4rem",alignItems:"center"}}><span style={{color:distTip.color,fontWeight:700}}>{distTip.label}:</span><span>{distTip.count}</span></div>}
              {[{label:"RUNS",data:runDist,color:C.run},{label:"RIDES",data:rideDist,color:C.ride},{label:"SWIMS",data:swimDist,color:C.swim}].map(({label,data,color},si)=>(
                <div key={si} style={{marginBottom:si<2?"0.75rem":"0"}}>
                  <div style={{fontFamily:F.mono,fontSize:"0.48rem",letterSpacing:"0.1em",color,marginBottom:"0.3rem"}}>{label}</div>
                  {data.map((d,i)=>{
                    const max=Math.max(...data.map(x=>x.count),1);
                    return (
                      <div key={i} onMouseEnter={e=>setDistTip({label:d.label,count:d.count,color,x:e.clientX,y:e.clientY})} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.2rem",cursor:"default"}}>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.faint,width:60,flexShrink:0,textAlign:"right"}}>{d.label}</div>
                        <div style={{flex:1,background:C.border,borderRadius:2,height:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:color,borderRadius:2,width:d.count>0?Math.max(4,Math.round(d.count/max*100))+"%":"0%",transition:"width 0.3s"}} />
                        </div>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.muted,width:24,textAlign:"right"}}>{d.count}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} layout="vertical" barSize={14}>
                <CartesianGrid horizontal={false} stroke={C.border} />
                <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} hide />
                <YAxis type="category" dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
                <Bar dataKey="count" fill={sColor} radius={[0,2,2,0]} name="activities" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
        <ChartBox title={ioTitle} subtitle={ioSubtitle} minH={331}>
          {ioData.length>0 && (
            <div style={{height:220,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              <ResponsiveContainer width="100%" height={155}>
                <PieChart>
                  <Pie data={ioData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {ioData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip content={({active,payload})=>{
                    if(!active||!payload?.length) return null;
                    const p=payload[0]; const total=ioData.reduce((s,d)=>s+d.value,0);
                    const pct=total>0?Math.round(p.value/total*100):0;
                    return (<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,display:"flex",gap:"0.5rem",alignItems:"center"}}><span style={{color:p.payload.fill,fontWeight:700}}>{p.name}:</span><span>{p.value} · {pct}%</span></div>);
                  }} />
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
      </div>

      {!isAll && (
        <div style={{...G, gridTemplateColumns:"1fr", borderTop:"none"}}>
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
      )}

      {!isAll && (
        <div style={{...G, gridTemplateColumns:"1fr 1fr", borderTop:"none"}}>
          <ChartBox title="Yearly Volume" subtitle="km per sport per year" minH={310}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yearlyData} barSize={isAll?14:10}>
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
                {(isAll||sportFilter==="run")  && <Bar dataKey="run"  fill={C.run}  radius={[2,2,0,0]} name="Run"  stackId={isAll?"a":undefined} />}
                {(isAll||sportFilter==="ride") && <Bar dataKey="ride" fill={C.ride} radius={isAll?[0,0,0,0]:[2,2,0,0]} name="Ride" stackId={isAll?"a":undefined} />}
                {(isAll||sportFilter==="swim") && <Bar dataKey="swim" fill={C.swim} radius={isAll?[2,2,0,0]:[2,2,0,0]} name="Swim" stackId={isAll?"a":undefined} />}
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox title="Activity Streaks" subtitle="consecutive days" minH={310}>
            <div style={{display:"flex",flexDirection:"column",gap:"1rem",paddingTop:"0.5rem"}}>
              {[
                {label:"BEST STREAK",value:bestStreak+" days",color:C.run},
                {label:"CURRENT STREAK",value:liveStreak+" days",color:liveStreak>=bestStreak?C.run:liveStreak>0?C.ride:C.faint},
                {label:"ACTIVE DAYS",value:totalDaysWithActivity.toLocaleString(),color:C.ink},
              ].map(({label,value,color})=>(
                <div key={label} style={{borderLeft:"3px solid "+color,paddingLeft:"0.75rem"}}>
                  <div style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.12em",color:C.faint,marginBottom:"0.2rem"}}>{label}</div>
                  <div style={{fontFamily:F.mono,fontSize:"1.1rem",fontWeight:700,color}}>{value}</div>
                </div>
              ))}
            </div>
          </ChartBox>
        </div>
      )}

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


function RecentSection({ lang, unitSystem="metric" }) {
  const fmtDist = m => unitSystem==="imperial" ? `${(m/1609.34).toFixed(1)} mi` : `${(m/1000).toFixed(1)} km`;
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
                        {act.distance > 0 && <span style={{ fontFamily:F.body, fontSize:"0.85rem", fontWeight:500, color:C.ink, fontFamily:F.mono }}>{fmtDist(act.distance)}</span>}
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
                              act.distance>0 && { l:"Distance", v:fmtDist(act.distance) },
                              { l:"Time", v:fmtTime(act.moving_time) },
                              act.total_elevation_gain && { l:"Elevation", v:unitSystem==="imperial" ? `${Math.round((act.total_elevation_gain||0)*3.28084)} ft` : `${Math.round(act.total_elevation_gain||0)} m` },
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
                <span style={{ color:C.ink, fontWeight:600 }}>{unitSystem==="imperial" ? (totalDist*0.621371).toFixed(1) : totalDist.toFixed(1)} {unitSystem==="imperial"?"mi":"km"}</span>
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
                        <span style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, textAlign:"right" }}>{d.dist>0 ? unitSystem==="imperial" ? (d.dist/1609.34).toFixed(1)+'mi' : (d.dist/1000).toFixed(1)+'km' : '—'}</span>
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
  const [unitSystem, setUnitSystem] = useState("metric");
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
              { val: unitSystem==="imperial" ? Math.round(km*0.621371) : km, label: unitSystem==="imperial" ? "MILES" : "KILOMETERS", sub: hero ? `${(hero.total_km / 40075).toFixed(2)} laps around the Earth` : null },
              { val: hrs, label: "HOURS", sub: hero ? `${(hero.total_hours / 24).toFixed(0)} full days` : null },
              { val: unitSystem==="imperial" ? Math.round(elev*3.28084) : elev, label: unitSystem==="imperial" ? "FT CLIMBED" : "M CLIMBED", sub: hero ? `${(hero.total_elevation / 3500).toFixed(1)} Everests base camp to summit` : null, last: true },
            ].map(({ val, label, sub, last }) => (
              <div key={label} style={{ padding: "1.25rem 1rem", textAlign: "center", borderRight: last ? "none" : `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.mono, fontSize: "clamp(1.6rem,2.5vw,2.2rem)", fontWeight: 800, color: C.green, letterSpacing: "-1px", lineHeight: 1 }}>
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
                  <div style={{ fontFamily: F.mono, fontSize: "2rem", fontWeight: 800, color: C.ink }}>{(s.c || 0).toLocaleString()}</div>
                  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.faint }}>
                    {unitSystem==="imperial" ? Math.round((s.km||0)*0.621371).toLocaleString() : Math.round(s.km||0).toLocaleString()} {unitSystem==="imperial"?"mi":"km"} · {Math.round(s.h||0)}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* NOTABLE */}
        <NotableSection unitSystem={unitSystem} />

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
          
          <StatsSection sportFilter={statsTab} unitSystem={unitSystem} />
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
        <RecentSection unitSystem={unitSystem} />

        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "2rem 0", fontFamily: F.mono, fontSize: "0.55rem", color: C.faint, display: "flex", justifyContent: "space-between" }}>
          <span>Data synced live from Strava. Not affiliated with Strava, Inc.</span>
          <span>Built by Bruno Silva © 2026</span>
        </footer>
      </div>

      {/* Floating unit toggle */}
      <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:1000, display:"flex", gap:0, boxShadow:"0 2px 12px rgba(0,0,0,0.12)", borderRadius:4, overflow:"hidden", border:`1px solid ${C.border}` }}>
        {["metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnitSystem(u)} style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.1em", textTransform:"uppercase", padding:"6px 10px", background:unitSystem===u?C.ink:C.surface, color:unitSystem===u?"#fff":C.faint, border:"none", cursor:"pointer", transition:"all 0.15s" }}>{u==="metric"?"km":"mi"}</button>
        ))}
      </div>
    </div>
  );
}

// Thu Apr 23 11:48:56 -03 2026
// bust
