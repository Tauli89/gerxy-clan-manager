import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ═══════════════════════════════════════════════════════════
//  🔥 FIREBASE CONFIG — Hier deine Werte eintragen!
//  (Anleitung in der SETUP.md Datei)
// ═══════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyC-xmgkfbcrjK9ENTEnGBLbBralF8BeZCw",
  authDomain: "gerxy-clan.firebaseapp.com",
  databaseURL: "https://gerxy-clan-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gerxy-clan",
  storageBucket: "gerxy-clan.firebasestorage.app",
  messagingSenderId: "312086208111",
  appId: "1:312086208111:web:2e9acdae2a471809a5779a",
  measurementId: "G-ZMK0XJ4J45"
};
// ═══════════════════════════════════════════════════════════

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── Konstanten ───────────────────────────────────────────────
const ADMIN_ROLES = ["Anführer", "Kommandant", "Hauptmann"];
const ALL_RANKS = ["Anführer", "Kommandant", "Hauptmann", "R1", "R2", "R3", "R4", "R5"];
const RANK_LIMITS = { R1: 3, R2: 5, R3: 7, R4: 10 };
const RANK_COLORS = {
  "Anführer":   "#f59e0b",
  "Kommandant": "#ef4444",
  "Hauptmann":  "#3b82f6",
  "R1": "#a855f7",
  "R2": "#22c55e",
  "R3": "#06b6d4",
  "R4": "#f97316",
  "R5": "#9ca3af",
};
const RANK_ICONS = {
  "Anführer":"👑","Kommandant":"⚔️","Hauptmann":"🛡️",
  "R1":"💎","R2":"🔥","R3":"⚡","R4":"🌙","R5":"⚒️"
};
const WAR_DAYS = [
  { day:"Dienstag", color:"#22c55e", actions:[
    "Primitiv/Mittelalter/Fruehmodern: 1 Pkt",
    "Modern/Weltraum/Interstellar: 2 Pkt",
    "Multiversum/Quanten/Unterwelt/Goettlich: 3 Pkt",
    "Skill beschwören (125–250 Pkt)",
    "Skill upgraden (125–250 Pkt)",
    "Tech Tree I: 1.000 | II: 10.000 | III: 30.000 | IV: 50.000 | V: 100.000 Pkt",
  ]},
  { day:"Mittwoch", color:"#3b82f6", actions:[
    "1.000 Münzen für Schmiede: 27 Pkt",
    "1 Edelstein für Schmiede: 50 Pkt",
    "Dungeon-Schlüssel nutzen: 3.000 Pkt",
    "Gewöhnliches Ei: 200 | Selten: 800 | Episch: 1.600 Pkt",
    "Legendär Ei: 3.200 | Ultimate: 6.400 | Mythisch: 12.800 Pkt",
    "Haustiere zusammenführen: 50–3.200 Pkt",
  ]},
  { day:"Donnerstag", color:"#a855f7", actions:[
    "Primitiv/Mittelalter/Fruehmodern: 1 Pkt",
    "Modern/Weltraum/Interstellar: 2 Pkt",
    "Multiversum/Quanten/Unterwelt/Goettlich: 3 Pkt",
    "Skill beschwören (125–250 Pkt)",
    "Skill upgraden (125–250 Pkt)",
    "Reittier beschwören: 50–2.500 Pkt",
    "Reittier zusammenführen: 50–2.500 Pkt",
  ]},
  { day:"Freitag", color:"#f59e0b", actions:[
    "1.000 Münzen für Schmiede: 27 Pkt",
    "1 Edelstein für Schmiede: 50 Pkt",
    "Tech Tree I: 1.000 | II: 10.000 | III: 30.000 | IV: 50.000 | V: 100.000 Pkt",
    "Gewöhnliches Ei: 200 | Selten: 800 | Episch: 1.600 Pkt",
    "Legendär Ei: 3.200 | Ultimate: 6.400 | Mythisch: 12.800 Pkt",
    "Haustiere zusammenführen: 50–3.200 Pkt",
  ]},
  { day:"Samstag", color:"#ef4444", actions:[
    "Primitiv/Mittelalter/Fruehmodern: 1 Pkt",
    "Modern/Weltraum/Interstellar: 2 Pkt",
    "Multiversum/Quanten/Unterwelt/Goettlich: 3 Pkt",
    "Dungeon-Schlüssel nutzen: 3.000 Pkt",
    "Reittier beschwören: 50–2.500 Pkt",
    "Reittier zusammenführen: 50–2.500 Pkt",
  ]},
  { day:"Sonntag", color:"#ec4899", actions:[
    "Rivalen-Clan-Mitglied besiegen: 1–50 Pkt",
    "All-Out Brawl gewinnen: 1.000 Pkt",
    "5 Tickets zu Beginn, Reset nach allen Niederlagen",
  ]},
];

// SHA-256 Hash via Web Crypto API — Passwort wird NIE im Klartext gespeichert
async function hashPw(pw) {
  const encoded = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getWarStatus() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=So,1=Mo,2=Di,...,6=Sa
  // War: Di(2) bis So(0) = days 2,3,4,5,6,0
  const warDays = [2,3,4,5,6,0];
  const isActive = warDays.includes(day);
  // Next Tuesday
  const next = new Date(now);
  const daysUntilTue = (2 - day + 7) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + (isActive ? 0 : daysUntilTue));
  next.setUTCHours(0,0,0,0);
  const msLeft = isActive
    ? (() => { const end = new Date(now); const daysToMon = (1 - day + 7) % 7 || 7; end.setUTCDate(now.getUTCDate() + daysToMon); end.setUTCHours(0,0,0,0); return end - now; })()
    : next - now;
  const warDayIndex = isActive ? [2,3,4,5,6,0].indexOf(day) : -1;
  const todayInfo = isActive ? WAR_DAYS[warDayIndex] : null;
  return { isActive, msLeft, todayInfo, warDayIndex };
}

function fmtCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}T ${String(h%24).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return `${String(h).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function fmt(n) {
  n = Number(n)||0;
  return n>=1e9?(n/1e9).toFixed(2)+"B":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(0)+"K":String(n);
}

// ── CSS ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0600; --bg2:#120b00; --bg3:#1e1200; --bg4:#2a1800;
    --border:#4a2e00; --border2:#6b4200;
    --gold:#c8850a; --gold2:#f59e0b; --gold3:#fcd34d;
    --red:#dc2626; --blue:#2563eb; --green:#16a34a;
    --text:#f0e0c0; --text2:#c8a870; --text3:#8a6840;
    --shadow:0 4px 24px #00000080;
  }
  body{background:var(--bg);color:var(--text);font-family:'Crimson Pro',Georgia,serif;min-height:100vh}
  @keyframes flicker{0%,100%{opacity:1}45%{opacity:.9}47%{opacity:.7}49%{opacity:.95}93%{opacity:.85}95%{opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes warPulse{0%,100%{box-shadow:0 0 10px #c8850a40}50%{box-shadow:0 0 30px #c8850a90,0 0 60px #c8850a30}}
  
  .app{min-height:100vh;background:linear-gradient(160deg,#0a0600 0%,#120900 40%,#0e0800 100%)}
  
  /* NAV */
  .nav{background:linear-gradient(90deg,#0e0800,#1a1000,#0e0800);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;backdrop-filter:blur(8px)}
  .nav-inner{max-width:1200px;margin:0 auto;padding:0 16px}
  .nav-top{display:flex;align-items:center;justify-content:space-between;padding:12px 0 8px}
  .clan-logo{display:flex;align-items:center;gap:12px}
  .clan-name{font-family:'Cinzel',serif;font-size:clamp(16px,4vw,22px);font-weight:900;color:var(--gold2);letter-spacing:2px;animation:flicker 8s infinite}
  .clan-sub{font-size:11px;color:var(--text3);letter-spacing:3px;text-transform:uppercase}
  .nav-badges{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;border:1px solid;font-family:'Crimson Pro',serif}
  .tabs{display:flex;gap:2px;overflow-x:auto;padding-bottom:1px;scrollbar-width:none}
  .tabs::-webkit-scrollbar{display:none}
  .tab{background:none;border:none;cursor:pointer;padding:8px 14px;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:var(--text3);border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap}
  .tab:hover{color:var(--gold)}
  .tab.active{color:var(--gold2);border-bottom-color:var(--gold2)}
  
  /* CARDS */
  .card{background:linear-gradient(135deg,var(--bg3),var(--bg4));border:1px solid var(--border);border-radius:12px;padding:20px;position:relative;overflow:hidden;animation:slideUp .3s ease}
  .card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#c8850a08,transparent 60%);pointer-events:none}
  .card-title{font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:var(--gold2);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  
  /* BUTTONS */
  .btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-family:'Cinzel',serif;font-size:12px;letter-spacing:1px;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .btn-gold{background:linear-gradient(135deg,var(--gold),#8a5c00);color:#000;font-weight:700}
  .btn-gold:hover{background:linear-gradient(135deg,var(--gold2),var(--gold));transform:translateY(-1px);box-shadow:0 4px 12px #c8850a40}
  .btn-ghost{background:transparent;border:1px solid var(--border2);color:var(--text2)}
  .btn-ghost:hover{border-color:var(--gold);color:var(--gold)}
  .btn-red{background:linear-gradient(135deg,#7f1d1d,#991b1b);color:#fca5a5}
  .btn-red:hover{background:#b91c1c}
  .btn-sm{padding:4px 10px;font-size:11px}
  
  /* INPUTS */
  .inp{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:9px 13px;color:var(--text);font-family:'Crimson Pro',serif;font-size:15px;width:100%}
  .inp:focus{outline:none;border-color:var(--gold);box-shadow:0 0 10px #c8850a25}
  .inp option{background:var(--bg2)}
  textarea.inp{resize:vertical;min-height:80px;line-height:1.5}
  label.lbl{display:block;font-size:11px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px}
  
  /* MODAL */
  .overlay{position:fixed;inset:0;background:#000000b0;backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:linear-gradient(135deg,var(--bg3),var(--bg4));border:1px solid var(--gold)30;border-radius:16px;padding:28px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;animation:slideUp .2s ease}
  .modal-title{font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--gold2);margin-bottom:20px;display:flex;align-items:center;gap:10px}
  
  /* WAR TIMER */
  .war-banner{background:linear-gradient(135deg,#1a0800,#2a1000);border:1px solid var(--gold)50;border-radius:14px;padding:20px 24px;animation:warPulse 3s infinite;margin-bottom:20px}
  .war-time{font-family:'Cinzel',serif;font-size:clamp(28px,8vw,48px);font-weight:900;color:var(--gold2);letter-spacing:4px;text-shadow:0 0 30px #c8850a60}
  
  /* MEMBER TABLE */
  .member-table{width:100%;border-collapse:collapse}
  .member-table th{font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;color:var(--text3);text-transform:uppercase;padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
  .member-table td{padding:10px 12px;border-bottom:1px solid #2a180060;font-size:14px}
  .member-table tr:hover td{background:#2a180040}
  
  /* PROGRESS */
  .pbar{height:6px;border-radius:3px;background:var(--bg);overflow:hidden}
  .pfill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .6s}
  
  /* RANK BADGE */
  .rank-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:11px;font-family:'Cinzel',serif;font-weight:600;border:1px solid}
  
  /* RESPONSIVE */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  @media(max-width:768px){
    .grid-2,.grid-3,.grid-4{grid-template-columns:1fr}
    .war-time{font-size:32px}
    .member-table .hide-mobile{display:none}
    .nav-top{flex-wrap:wrap;gap:8px}
    .modal{padding:20px}
  }
  @media(max-width:480px){
    .grid-2{grid-template-columns:1fr}
    .tab{padding:8px 10px;font-size:10px}
  }
  
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:var(--bg)}
  ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
  
  .stat-num{font-family:'Cinzel',serif;font-size:clamp(20px,5vw,28px);font-weight:700}
  .divider{border:none;border-top:1px solid var(--border);margin:16px 0}
  .note-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
  .war-day-card{padding:12px 16px;border-radius:10px;border:1px solid;margin-bottom:8px;transition:all .2s}
  .upload-zone{border:2px dashed var(--border2);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s}
  .upload-zone:hover,.upload-zone.drag{border-color:var(--gold);background:#c8850a10}
  .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--gold2);border-radius:50%;animation:spin 1s linear infinite}
  .live-dot{width:8px;height:8px;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite}
  .section-gap{margin-bottom:20px}
  .flex{display:flex;align-items:center}
  .flex-between{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .gap-8{gap:8px}
  .gap-12{gap:12px}
  .mt-12{margin-top:12px}
  .mt-16{margin-top:16px}
  .mt-20{margin-top:20px}
  .mb-8{margin-bottom:8px}
  .mb-12{margin-bottom:12px}
  .mb-16{margin-bottom:16px}
  .text-gold{color:var(--gold2)}
  .text-muted{color:var(--text3)}
  .text-sm{font-size:13px}
  .text-xs{font-size:11px}
  .w100{width:100%}
  .calc-result{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:12px}
  .calc-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px}
  .calc-row:last-child{border:none;font-weight:600;color:var(--gold2)}
  
  /* Login */
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#1a0a00 0%,#050200 100%);padding:20px}
  .login-box{background:linear-gradient(135deg,#1e1200,#2a1800);border:1px solid var(--gold)40;border-radius:20px;padding:clamp(24px,5vw,44px);width:100%;max-width:400px;box-shadow:0 24px 64px #00000090}
  .login-icon{font-size:56px;text-align:center;animation:flicker 4s infinite;margin-bottom:8px}
  .login-title{font-family:'Cinzel',serif;font-size:clamp(18px,5vw,24px);font-weight:900;color:var(--gold2);text-align:center;letter-spacing:3px}
  .login-sub{font-size:12px;color:var(--text3);text-align:center;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px}
  
  .shimmer{background:linear-gradient(90deg,var(--gold)40,var(--gold3)80,var(--gold)40);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite}
`;

// ═══════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════
export default function GerxyApp() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [members, setMembers] = useState({});
  const [accounts, setAccounts] = useState({});
  const [wars, setWars] = useState({});
  const [notes, setNotes] = useState({});
  const [settings, setSettings] = useState({ clanName:"GERXY", announcement:"" });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState({});

  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    const saved = sessionStorage.getItem("gerxy_user");
    if (saved) try { setUser(JSON.parse(saved)); } catch(e){}
    const subs = [
      onValue(ref(db,".info/connected"), s => setConnected(s.val()===true)),
      onValue(ref(db,"members"), s => { setMembers(s.val()||{}); setLoading(false); }),
      onValue(ref(db,"accounts"), s => setAccounts(s.val()||{})),
      onValue(ref(db,"wars"), s => setWars(s.val()||{})),
      onValue(ref(db,"notes"), s => setNotes(s.val()||{})),
      onValue(ref(db,"settings"), s => { if(s.val()) setSettings(s.val()); }),
      onValue(ref(db,"messages"), s => setMessages(s.val()||{})),
    ];
    return () => subs.forEach(u=>u());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTimer(t => t+1), 1000);
    return () => clearInterval(id);
  }, []);

  async function login(username, password) {
    const accList = Object.entries(accounts).map(([id,a])=>({id,...a}));
    const hashed = await hashPw(password);
    // Benutzername-Vergleich ignoriert Groß/Kleinschreibung
    const found = accList.find(a => a.username.toLowerCase()===username.toLowerCase() && a.passwordHash===hashed);
    if (found) {
      const u = { id:found.id, username:found.username, role:found.role };
      setUser(u); sessionStorage.setItem("gerxy_user", JSON.stringify(u));
      return true;
    }
    return false;
  }

  async function register(username, password) {
    const hashed = await hashPw(password);
    await push(ref(db,"accounts"), {
      username,
      passwordHash: hashed,
      role: "R5"
    });
  }

  function logout() { setUser(null); sessionStorage.removeItem("gerxy_user"); setTab("dashboard"); }

  if (!user) return <><style>{CSS}</style><LoginScreen onLogin={login} onRegister={register} onGuest={()=>{ const g={id:"guest",username:"Gast",role:"Gast",isGuest:true}; setUser(g); sessionStorage.setItem("gerxy_user",JSON.stringify(g)); }} accounts={accounts} loading={loading}/></>;

  const memberList = Object.entries(members).map(([id,m])=>({id,...m}));
  const warList = Object.entries(wars).map(([id,w])=>({id,...w})).sort((a,b)=>b.dateFrom?.localeCompare(a.dateFrom));
  const noteList = Object.entries(notes).map(([id,n])=>({id,...n})).sort((a,b)=>b.createdAt-a.createdAt);

  // Ungelesene Nachrichten zählen
  const unreadCount = Object.values(messages).filter(m =>
    m.to === user.username && !m.read
  ).length;

  const tabs = [
    {id:"dashboard",label:"⚔️ Dashboard"},
    {id:"members",label:"👥 Mitglieder"},
    {id:"war",label:"🏆 Clan War"},
    ...(user.isGuest ? [] : [{id:"mypage",label:"📊 Meine Seite"}]),
    {id:"notes",label:"📋 Notizen"},
    ...(user.isGuest ? [] : [{id:"messages",label:`💬 Nachrichten${unreadCount>0?` (${unreadCount})`:""}`}]),
    {id:"spielinfo",label:"📖 Spielinfo"},
    ...(isAdmin ? [{id:"admin",label:"⚙️ Admin"}] : []),
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <nav className="nav">
          <div className="nav-inner">
            <div className="nav-top">
              <div className="clan-logo">
                <div style={{fontSize:28}}>🔥</div>
                <div>
                  <div className="clan-name">{settings.clanName}</div>
                  <div className="clan-sub">Forge Master · Clan Manager</div>
                </div>
              </div>
              <div className="nav-badges">
                <span className="badge" style={{color:RANK_COLORS[user.role]||"#c88500",borderColor:`${RANK_COLORS[user.role]||"#c88500"}40`,background:`${RANK_COLORS[user.role]||"#c88500"}10`}}>
                  {RANK_ICONS[user.role]} {user.username}
                </span>
                <span className="badge" style={{color:connected?"#22c55e":"#ef4444",borderColor:connected?"#22c55e40":"#ef444440",background:connected?"#22c55e10":"#ef444410"}}>
                  <span className="live-dot" style={{background:connected?"#22c55e":"#ef4444"}}/>
                  {connected?"Live":"Offline"}
                </span>
                {user.isGuest && <span className="badge" style={{color:"#9ca3af",borderColor:"#9ca3af40",background:"#9ca3af10",fontSize:11}}>👁️ Gast</span>}
              <button className="btn btn-ghost btn-sm" onClick={logout}>{user.isGuest?"✕ Verlassen":"🚪"}</button>
              </div>
            </div>
            <div className="tabs">
              {tabs.map(t=>(
                <button key={t.id} className={`tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
        </nav>

        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:16}}>
            <div className="spinner"/>
            <div className="text-muted text-sm">Verbinde mit Firebase…</div>
          </div>
        ) : (
          <div style={{maxWidth:1200,margin:"0 auto",padding:"20px 16px"}}>
            {tab==="dashboard" && <Dashboard memberList={memberList} warList={warList} settings={settings} isAdmin={isAdmin} db={db} timer={timer}/>}
            {tab==="members" && <Members accountList={Object.entries(accounts).map(([id,a])=>({id,...a}))} isAdmin={isAdmin} db={db} currentUser={user}/>}
            {tab==="war" && <WarTab warList={warList} accountList={Object.entries(accounts).map(([id,a])=>({id,...a}))} isAdmin={isAdmin} db={db} timer={timer}/>}
            {tab==="mypage" && !user.isGuest && <MyPage user={user} memberList={memberList} warList={warList} accountList={Object.entries(accounts).map(([id,a])=>({id,...a}))} db={db}/>}
            {tab==="notes" && <Notes noteList={noteList} isAdmin={isAdmin} db={db} user={user}/>}
            {tab==="messages" && !user.isGuest && <Messages messages={messages} currentUser={user} accountList={Object.entries(accounts).map(([id,a])=>({id,...a}))} db={db}/>}
            {tab==="spielinfo" && <Spielinfo/>}
            {tab==="admin" && isAdmin && <Admin accounts={accounts} memberList={memberList} db={db} currentUser={user} members={members} wars={wars}/>}
          </div>
        )}
      </div>
    </>
  );
}

// ── LOGIN ────────────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister, onGuest, accounts, loading }) {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [show, setShow] = useState(false);
  const accList = Object.entries(accounts).map(([id,a])=>({id,...a}));

  async function doLogin() {
    setErr("");
    if (!user || !pass) { setErr("Bitte Benutzername und Passwort eingeben."); return; }
    const ok = await onLogin(user, pass);
    if (!ok) setErr("Benutzername oder Passwort falsch.");
  }

  async function doRegister() {
    setErr(""); setSuccess("");
    if (!user || !pass) { setErr("Bitte alle Felder ausfüllen."); return; }
    if (pass !== pass2) { setErr("Passwörter stimmen nicht überein."); return; }
    if (pass.length < 4) { setErr("Passwort muss mindestens 4 Zeichen lang sein."); return; }
    // Duplikat-Check ignoriert Groß/Kleinschreibung
    if (accList.find(a => a.username.toLowerCase() === user.toLowerCase())) {
      setErr("Dieser Benutzername ist bereits vergeben (auch mit anderer Schreibweise)."); return;
    }
    await onRegister(user, pass);
    setSuccess("Account erstellt! Du kannst dich jetzt einloggen.");
    setMode("login");
    setPass(""); setPass2("");
  }

  const tabStyle = (active) => ({
    flex:1, padding:"8px", borderRadius:7, border:"none", cursor:"pointer",
    fontFamily:"'Cinzel',serif", fontSize:12, letterSpacing:1, transition:"all .2s",
    background: active ? "linear-gradient(135deg,var(--gold),#8a5c00)" : "transparent",
    color: active ? "#000" : "var(--text3)", fontWeight: active ? "700" : "400"
  });

  return (
    <>
      <style>{CSS}</style>
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-icon">🔥</div>
          <div className="login-title shimmer">GERXY</div>
          <div className="login-sub">Forge Master · Clan Manager</div>

          <div style={{display:"flex",gap:4,marginBottom:24,background:"#1a0f00",borderRadius:10,padding:4}}>
            <button style={tabStyle(mode==="login")} onClick={()=>{setMode("login");setErr("");setSuccess("");}}>Einloggen</button>
            <button style={tabStyle(mode==="register")} onClick={()=>{setMode("register");setErr("");setSuccess("");}}>Registrieren</button>
          </div>

          {mode==="login" && (<>
            <div className="mb-16">
              <label className="lbl">Benutzername</label>
              <input className="inp" placeholder="Dein Benutzername" value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <div className="mb-16" style={{position:"relative"}}>
              <label className="lbl">Passwort</label>
              <input className="inp" type={show?"text":"password"} placeholder="Passwort" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingRight:44}}/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:32,background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:16}}>{show?"🙈":"👁️"}</button>
            </div>
            {err && <div style={{padding:"8px 12px",background:"#7f1d1d40",border:"1px solid #ef444440",borderRadius:8,color:"#fca5a5",fontSize:13,marginBottom:14}}>⚠️ {err}</div>}
            {success && <div style={{padding:"8px 12px",background:"#14390060",border:"1px solid #22c55e40",borderRadius:8,color:"#22c55e",fontSize:13,marginBottom:14}}>✅ {success}</div>}
            <button className="btn btn-gold w100" style={{justifyContent:"center",padding:"12px",fontSize:14}} onClick={doLogin}>⚔️ Einloggen</button>
            <button onClick={onGuest} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:1,color:"var(--text3)",transition:"all .2s"}}
              onMouseEnter={e=>e.target.style.color="var(--gold)"}
              onMouseLeave={e=>e.target.style.color="var(--text3)"}>
              👁️ Als Gast fortfahren
            </button>
            <div style={{marginTop:8,fontSize:11,color:"var(--text3)",textAlign:"center",lineHeight:1.5}}>
              Gäste können das Tool lesen aber nichts bearbeiten.<br/>Meine Seite und Nachrichten sind nicht verfügbar.
            </div>
          </>)}

          {mode==="register" && (<>
            <div style={{padding:"10px 14px",background:"#2a180060",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text3)",marginBottom:16,lineHeight:1.5}}>
              📋 Erstelle deinen Account mit deinem In-Game Namen. Du bekommst automatisch Rang <strong style={{color:"var(--text2)"}}>R5</strong> — der Anführer vergibt danach deinen richtigen Rang.
            </div>
            <div className="mb-16">
              <label className="lbl">Benutzername (dein In-Game Name)</label>
              <input className="inp" placeholder="Dein Spielername" value={user} onChange={e=>setUser(e.target.value)}/>
            </div>
            <div className="mb-16" style={{position:"relative"}}>
              <label className="lbl">Passwort (min. 4 Zeichen)</label>
              <input className="inp" type={show?"text":"password"} placeholder="Passwort wählen" value={pass} onChange={e=>setPass(e.target.value)} style={{paddingRight:44}}/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:32,background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:16}}>{show?"🙈":"👁️"}</button>
            </div>
            <div className="mb-16">
              <label className="lbl">Passwort wiederholen</label>
              <input className="inp" type={show?"text":"password"} placeholder="Passwort bestätigen" value={pass2} onChange={e=>setPass2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doRegister()}/>
            </div>
            {err && <div style={{padding:"8px 12px",background:"#7f1d1d40",border:"1px solid #ef444440",borderRadius:8,color:"#fca5a5",fontSize:13,marginBottom:14}}>⚠️ {err}</div>}
            <button className="btn btn-gold w100" style={{justifyContent:"center",padding:"12px",fontSize:14}} onClick={doRegister}>⚒️ Account erstellen</button>
            <button onClick={onGuest} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:1,color:"var(--text3)",transition:"all .2s"}}
              onMouseEnter={e=>e.target.style.color="var(--gold)"}
              onMouseLeave={e=>e.target.style.color="var(--text3)"}>
              👁️ Als Gast fortfahren
            </button>
            <div style={{marginTop:12,fontSize:12,color:"var(--text3)",textAlign:"center"}}>Nur für Clan-Mitglieder von GERXY</div>
          </>)}

          {loading && <div className="text-muted text-sm text-center mt-12">Lade Daten…</div>}
        </div>
      </div>
    </>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ memberList, warList, settings, isAdmin, db, timer }) {
  const warStatus = getWarStatus();
  const [ms, setMs] = useState(warStatus.msLeft);
  useEffect(() => { setMs(prev => prev - 1000); }, [timer]);

  const totalPoints = memberList.reduce((s,m) => s+(Number(m.weeklyPoints)||0), 0);
  const wins = warList.filter(w=>w.result==="Sieg").length;
  const activeMembers = memberList.filter(m=>m.active!==false).length;

  // Gesamtpunkte aus allen Wars — Groß/Kleinschreibung ignorieren
  const totalPerMember = {};
  warList.forEach(w => {
    if (w.memberPoints) {
      Object.entries(w.memberPoints).forEach(([name, pts]) => {
        const key = name.toLowerCase();
        if (!totalPerMember[key]) totalPerMember[key] = { displayName: name, pts: 0 };
        totalPerMember[key].pts += Number(pts)||0;
      });
    }
  });
  const topWarRanking = Object.values(totalPerMember)
    .sort((a,b) => b.pts - a.pts)
    .slice(0, 8);
  const maxWarPts = topWarRanking[0]?.pts || 1;

  return (
    <div>
      {/* Announcement */}
      {settings.announcement && (
        <div style={{padding:"12px 18px",background:"#2a180090",border:"1px solid var(--gold)30",borderRadius:10,marginBottom:20,display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:18,flexShrink:0}}>📢</span>
          <span style={{fontSize:15,lineHeight:1.5}}>{settings.announcement}</span>
        </div>
      )}

      {/* War Timer */}
      <div className="war-banner">
        <div className="flex-between mb-8">
          <div>
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"var(--text3)"}}>Clan War</div>
            <div style={{fontSize:13,color:warStatus.isActive?"#22c55e":"var(--text2)"}}>
              {warStatus.isActive ? `🔥 AKTIV — ${warStatus.todayInfo?.day}` : "⏳ Nächster War startet in"}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="war-time">{fmtCountdown(Math.max(0,ms))}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>bis {warStatus.isActive?"Kriegsende":"Kriegsbeginn (Dienstag UTC)"}</div>
          </div>
        </div>
        {warStatus.isActive && warStatus.todayInfo && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>
              Heutige Aktionen — {warStatus.todayInfo.day}:
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:4}}>
              {warStatus.todayInfo.actions.map((a,i) => (
                <div key={i} style={{fontSize:12,padding:"5px 10px",background:`${warStatus.todayInfo.color||"#c8850a"}15`,border:`1px solid ${warStatus.todayInfo.color||"#c8850a"}30`,borderRadius:6,color:"var(--text2)",lineHeight:1.4}}>{a}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid-4 section-gap">
        {[
          {label:"Mitglieder",value:`${memberList.length}/50`,icon:"👥",color:"#3b82f6"},
          {label:"Aktiv",value:activeMembers,icon:"✅",color:"#22c55e"},
          {label:"War-Siege",value:`${wins}/${warList.length}`,icon:"🏆",color:"#f59e0b"},
          {label:"Wochenpunkte Ø",value:fmt(memberList.length?Math.round(totalPoints/memberList.length):0),icon:"⚡",color:"#a855f7"},
        ].map(s=>(
          <div key={s.label} className="card" style={{textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:8}}>{s.icon}</div>
            <div className="stat-num" style={{color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:4,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top Performers + War Days */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">🥇 Top War-Gesamtpunkte</div>
          {topWarRanking.map((m,i)=>(
            <div key={m.displayName} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{fontSize:16,width:24,textAlign:"center",flexShrink:0}}>{["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"][i]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.displayName}</span>
                  <span style={{color:"var(--gold2)",fontSize:13,flexShrink:0,marginLeft:8}}>{fmt(m.pts)}</span>
                </div>
                <div className="pbar"><div className="pfill" style={{width:`${(m.pts/maxWarPts)*100}%`}}/></div>
              </div>
            </div>
          ))}
          {topWarRanking.length===0 && <div className="text-muted text-sm">Noch keine War-Punkte eingetragen</div>}
        </div>
        <div className="card">
          <div className="card-title">📅 War-Tagesplan</div>
          {WAR_DAYS.map((wd,i)=>{
            const isToday = warStatus.isActive && warStatus.warDayIndex===i;
            return (
              <div key={i} className="war-day-card" style={{borderColor:isToday?"var(--gold)":"var(--border)",background:isToday?"#c8850a15":"var(--bg2)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontFamily:"'Cinzel',serif",color:isToday?"var(--gold2)":"var(--text2)"}}>{isToday?"🔥 ":""}{wd.day}</span>
                  <span style={{padding:"2px 8px",borderRadius:12,background:`${wd.color||"#c8850a"}20`,color:wd.color||"var(--gold)",fontSize:11,border:`1px solid ${wd.color||"#c8850a"}40`,borderRadius:10}}>Tag {i+1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MEMBERS ──────────────────────────────────────────────────
// ── MEMBERS (zeigt registrierte Accounts) ───────────────────
function Members({ accountList, isAdmin, db, currentUser }) {
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("Alle");
  const [editAcc, setEditAcc] = useState(null);

  const filtered = accountList
    .filter(a => a.username?.toLowerCase().includes(search.toLowerCase()))
    .filter(a => filterRank==="Alle" || a.role===filterRank)
    .sort((a,b) => {
      const ro = ALL_RANKS.indexOf(a.role)-ALL_RANKS.indexOf(b.role);
      return ro !== 0 ? ro : a.username?.localeCompare(b.username);
    });

  async function saveRole() {
    await update(ref(db,`accounts/${editAcc.id}`), { role: editAcc.role });
    setEditAcc(null);
  }

  async function deleteAcc(id) {
    if (id === currentUser.id) { alert("Du kannst deinen eigenen Account nicht löschen!"); return; }
    await remove(ref(db,`accounts/${id}`));
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div style={{display:"flex",gap:8,flexWrap:"wrap",flex:1}}>
          <input className="inp" placeholder="🔍 Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:220}}/>
          <select className="inp" value={filterRank} onChange={e=>setFilterRank(e.target.value)} style={{maxWidth:130}}>
            <option>Alle</option>
            {ALL_RANKS.map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{fontSize:13,color:"var(--text3)"}}>{accountList.length} Mitglieder registriert</div>
      </div>

      {/* Rang Übersicht */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {ALL_RANKS.map(r=>{
          const cnt = accountList.filter(a=>a.role===r).length;
          const limit = RANK_LIMITS[r];
          return cnt>0 ? (
            <span key={r} style={{padding:"3px 10px",borderRadius:20,fontSize:12,background:`${RANK_COLORS[r]}15`,border:`1px solid ${RANK_COLORS[r]}40`,color:RANK_COLORS[r]}}>
              {RANK_ICONS[r]} {r}: {cnt}{limit?`/${limit}`:""}
            </span>
          ) : null;
        })}
      </div>

      {/* Tabelle */}
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table className="member-table">
            <thead>
              <tr>
                <th>Mitglied</th>
                <th>Rang</th>
                <th className="hide-mobile">Account-ID</th>
                {isAdmin && <th>Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a=>(
                <tr key={a.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:`${RANK_COLORS[a.role]||"#5a3a00"}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:`1.5px solid ${RANK_COLORS[a.role]||"#5a3a00"}50`,flexShrink:0}}>
                        {RANK_ICONS[a.role]||"⚒️"}
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:14}}>
                          {a.username}
                          {a.id===currentUser.id && <span style={{fontSize:11,color:"#22c55e",marginLeft:6}}>(Du)</span>}
                        </div>
                        <span className="rank-badge" style={{color:RANK_COLORS[a.role]||"#c88500",borderColor:`${RANK_COLORS[a.role]||"#c88500"}40`,background:`${RANK_COLORS[a.role]||"#c88500"}10`}}>
                          {a.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{color:RANK_COLORS[a.role]||"var(--gold2)",fontWeight:600}}>{RANK_ICONS[a.role]} {a.role}</span>
                  </td>
                  <td className="hide-mobile" style={{color:"var(--text3)",fontSize:12,fontFamily:"var(--font-mono)"}}>{a.id?.slice(0,12)}…</td>
                  {isAdmin && (
                    <td>
                      <div style={{display:"flex",gap:4}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditAcc({...a})}>🔑 Rang</button>
                        {a.id!==currentUser.id && <button className="btn btn-red btn-sm" onClick={()=>deleteAcc(a.id)}>🗑️</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <div style={{padding:40,textAlign:"center",color:"var(--text3)"}}>Keine Mitglieder gefunden</div>}
      </div>

      {/* Edit Rang Modal */}
      {editAcc && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setEditAcc(null)}>
          <div className="modal">
            <div className="modal-title">🔑 Rang ändern — {editAcc.username}</div>
            <div className="mb-16">
              <label className="lbl">Rang</label>
              <select className="inp" value={editAcc.role} onChange={e=>setEditAcc(p=>({...p,role:e.target.value}))}>
                {ALL_RANKS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{padding:"10px 14px",background:"var(--bg2)",borderRadius:8,marginBottom:16}}>
              <div style={{fontSize:12,color:"var(--text3)",marginBottom:4}}>Rechte für <strong style={{color:RANK_COLORS[editAcc.role]||"var(--gold2)"}}>{editAcc.role}</strong>:</div>
              <div style={{fontSize:13,color:"var(--text2)"}}>
                {ADMIN_ROLES.includes(editAcc.role) ? "✅ Vollzugriff — kann alles verwalten" : "👁️ Lesezugriff — kann nur lesen & Nachrichten schreiben"}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setEditAcc(null)}>Abbrechen</button>
              <button className="btn btn-gold" onClick={saveRole}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IMPORT MODAL ─────────────────────────────────────────────
function ImportModal({ db, memberList, onClose }) {
  const [mode, setMode] = useState("screenshot"); // screenshot | csv
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  async function analyzeScreenshot() {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const base64 = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:[
              {type:"image",source:{type:"base64",media_type:file.type||"image/png",data:base64}},
              {type:"text",text:`Analysiere diesen Screenshot aus dem Spiel Forge Master. 
Extrahiere alle sichtbaren Spielernamen und ihre Punkte (War Points, Weekly Points oder ähnliche Punktzahlen).
Antworte NUR mit einem JSON-Array ohne Markdown-Formatierung:
[{"name":"Spielername","points":12345},...]
Falls keine Daten erkennbar sind, antworte mit: []`}
            ]
          }]
        })
      });
      const data = await resp.json();
      const text = data.content?.map(c=>c.text||"").join("");
      const cleaned = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(cleaned);
      setResult(parsed);
    } catch(e) {
      setResult({error:"Fehler bei der Analyse: "+e.message});
    }
    setLoading(false);
  }

  async function applyResults(items) {
    for (const item of items) {
      const existing = memberList.find(m => m.name?.toLowerCase()===item.name?.toLowerCase());
      if (existing) {
        await update(ref(db,`members/${existing.id}`), { weeklyPoints: Number(item.points)||0 });
      } else {
        await push(ref(db,"members"), { name:item.name, rank:"R5", weeklyPoints:Number(item.points)||0, totalPoints:0, active:true, note:"Via Screenshot Import" });
      }
    }
    onClose();
  }

  function parseCSV() {
    const lines = csvText.trim().split("\n").filter(l=>l.trim());
    const items = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p=>p.trim().replace(/^"|"$/g,""));
      if (parts.length>=2 && parts[0] && !isNaN(parts[1].replace(/[.,]/g,""))) {
        items.push({ name:parts[0], points:Number(parts[1].replace(/\./g,"").replace(",",".")) });
      } else if (parts.length>=2 && parts[1] && !isNaN(parts[0].replace(/[.,]/g,""))) {
        items.push({ name:parts[1], points:Number(parts[0].replace(/\./g,"").replace(",",".")) });
      }
    }
    setResult(items.length>0 ? items : {error:"Keine gültigen Daten gefunden. Format: Name,Punkte"});
  }

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:560}}>
        <div className="modal-title">📥 Daten importieren</div>
        
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["screenshot","csv"].map(m=>(
            <button key={m} className={`btn ${mode===m?"btn-gold":"btn-ghost"}`} onClick={()=>{setMode(m);setResult(null);setFile(null);setPreview(null);}}>
              {m==="screenshot"?"📸 Screenshot":"📋 CSV/Tabelle"}
            </button>
          ))}
        </div>

        {mode==="screenshot" && (
          <div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:12}}>
              Lade einen Screenshot hoch, auf dem Spielernamen und Punkte sichtbar sind. Die KI erkennt automatisch die Daten.
            </div>
            <div className={`upload-zone${drag?" drag":""}`}
              onDragOver={e=>{e.preventDefault();setDrag(true)}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));setResult(null);}}}
              onClick={()=>fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));setResult(null);}}}/>
              {preview ? (
                <img src={preview} alt="Preview" style={{maxWidth:"100%",maxHeight:200,borderRadius:8}}/>
              ) : (
                <div>
                  <div style={{fontSize:40,marginBottom:8}}>📸</div>
                  <div style={{color:"var(--text2)",fontSize:14}}>Screenshot hier ablegen oder klicken</div>
                  <div className="text-muted text-sm mt-12">Unterstützt: PNG, JPG, WEBP</div>
                </div>
              )}
            </div>
            {file && !loading && !result && (
              <button className="btn btn-gold w100 mt-12" style={{justifyContent:"center"}} onClick={analyzeScreenshot}>🔍 KI-Analyse starten</button>
            )}
          </div>
        )}

        {mode==="csv" && (
          <div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:8}}>
              Kopiere Daten aus Google Sheets oder Excel (Format: <strong>Name, Punkte</strong> — eine Zeile pro Mitglied).
            </div>
            <textarea className="inp" rows={8} value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder={"ThunderForge, 340000\nIronKnight99, 270000\nQuantumSmith, 195000"}/>
            <button className="btn btn-gold mt-12" onClick={parseCSV}>📊 Analysieren</button>
          </div>
        )}

        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:24}}>
            <div className="spinner"/>
            <div className="text-muted text-sm">KI analysiert Screenshot…</div>
          </div>
        )}

        {result && !result.error && Array.isArray(result) && result.length>0 && (
          <div style={{marginTop:16}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:"var(--gold2)",letterSpacing:1,marginBottom:8}}>✅ {result.length} EINTRÄGE ERKANNT:</div>
            <div style={{maxHeight:200,overflowY:"auto",background:"var(--bg2)",borderRadius:8,border:"1px solid var(--border)"}}>
              {result.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <span>{r.name}</span>
                  <span style={{color:"var(--gold2)"}}>{fmt(r.points)}</span>
                </div>
              ))}
            </div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:8}}>Bereits vorhandene Mitglieder werden aktualisiert. Neue werden als R5 angelegt.</div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button className="btn btn-ghost" onClick={()=>setResult(null)}>Verwerfen</button>
              <button className="btn btn-gold" onClick={()=>applyResults(result)}>✅ Übernehmen</button>
            </div>
          </div>
        )}

        {result?.error && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#7f1d1d40",border:"1px solid #ef444440",borderRadius:8,color:"#fca5a5",fontSize:13}}>
            ⚠️ {result.error}
          </div>
        )}

        {result && Array.isArray(result) && result.length===0 && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#2a180060",border:"1px solid var(--border)",borderRadius:8,fontSize:13,color:"var(--text3)"}}>
            Keine Daten erkannt. Bitte prüfe ob der Screenshot Spielernamen und Punkte enthält.
          </div>
        )}
      </div>
    </div>
  );
}

// ── WAR TAB ──────────────────────────────────────────────────
function WarTab({ warList, accountList, isAdmin, db, timer }) {
  const today = new Date().toISOString().split("T")[0];
  const [showAdd, setShowAdd] = useState(false);
  const [selectedWar, setSelectedWar] = useState(null);
  const [editingPoints, setEditingPoints] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState(null);
  const [form, setForm] = useState({opponent:"",result:"Sieg",theirPoints:"",dateFrom:today,dateTo:today,note:""});
  const warStatus = getWarStatus();
  const [ms, setMs] = useState(warStatus.msLeft);
  useEffect(() => { setMs(prev => prev-1000); }, [timer]);

  const wins = warList.filter(w=>w.result==="Sieg").length;
  const winrate = warList.length ? Math.round((wins/warList.length)*100) : 0;

  const totalPerMember = {};
  warList.forEach(w => {
    if (w.memberPoints) {
      Object.entries(w.memberPoints).forEach(([name, pts]) => {
        totalPerMember[name] = (totalPerMember[name]||0) + Number(pts);
      });
    }
  });
  const totalRanking = Object.entries(totalPerMember)
    .map(([name,pts])=>({name,pts}))
    .sort((a,b)=>b.pts-a.pts);
  const maxTotal = totalRanking[0]?.pts || 1;

  async function addWar() {
    if (!form.opponent) return;
    const memberPoints = {};
    accountList.forEach(a => { memberPoints[a.username] = 0; });
    await push(ref(db,"wars"), {
      ...form, theirPoints:Number(form.theirPoints)||0,
      memberPoints, ourPoints:0,
    });
    setForm({opponent:"",result:"Sieg",theirPoints:"",dateFrom:today,dateTo:today,note:""});
    setShowAdd(false);
  }

  async function deleteWar(id) {
    await remove(ref(db,`wars/${id}`));
    if (selectedWar?.id===id) setSelectedWar(null);
  }

  async function savePoints(warId, pts) {
    const war = warList.find(w=>w.id===warId);
    const merged = {...(war?.memberPoints||{}), ...pts};
    Object.keys(merged).forEach(k => merged[k]=Number(merged[k])||0);
    const ourTotal = Object.values(merged).reduce((s,v)=>s+Number(v),0);
    await update(ref(db,`wars/${warId}`), {memberPoints:merged, ourPoints:ourTotal});
    setEditingPoints(null);
  }

  function parseCSV(text) {
    const lines = text.trim().split("\n").filter(l=>l.trim());
    const items = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p=>p.trim().replace(/^"|"$/g,""));
      if (parts.length>=3 && !isNaN(parts[0]) && !isNaN(parts[2].replace(/\./g,""))) {
        items.push({name:parts[1], points:Number(parts[2].replace(/\./g,"").replace(",","."))});
      } else if (parts.length>=2) {
        const nameIdx = isNaN(parts[0]) ? 0 : 1;
        const ptsIdx = nameIdx===0 ? 1 : 0;
        if (parts[nameIdx] && !isNaN(parts[ptsIdx].replace(/\./g,""))) {
          items.push({name:parts[nameIdx], points:Number(parts[ptsIdx].replace(/\./g,"").replace(",","."))});
        }
      }
    }
    return items;
  }

  async function applyCSV(warId) {
    if (!csvPreview||!csvPreview.length) return;
    const pts = {};
    csvPreview.forEach(item => { pts[item.name]=item.points; });
    await savePoints(warId, pts);
    setShowImport(false); setCsvText(""); setCsvPreview(null);
  }

  // War-Detailansicht
  if (selectedWar) {
    const war = warList.find(w=>w.id===selectedWar.id)||selectedWar;
    const pts = editingPoints||war.memberPoints||{};
    // Nur Mitglieder anzeigen die tatsächlich Punkte haben (aus CSV importiert)
    // Plus editierbare Felder für alle Accounts wenn im Bearbeitungsmodus
    const participantNames = editingPoints
      ? [...new Set([...accountList.map(a=>a.username),...Object.keys(war.memberPoints||{})])]
      : Object.keys(war.memberPoints||{}).filter(n => Number(war.memberPoints[n])>0);
    const allNames = [...new Set(participantNames)];
    const sorted = [...allNames].sort((a,b)=>(Number(pts[b]||0))-(Number(pts[a]||0)));
    const maxP = Math.max(...sorted.map(n=>Number(pts[n]||0)),1);

    return (
      <div>
        <div className="flex mb-16 gap-8">
          <button className="btn btn-ghost" onClick={()=>{setSelectedWar(null);setEditingPoints(null);setShowImport(false);}}>← Zurück</button>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"var(--gold2)",display:"flex",alignItems:"center",gap:8}}>
            {war.result==="Sieg"?"🏆":"💀"} vs. {war.opponent}
          </div>
        </div>

        <div className="card mb-16" style={{borderColor:war.result==="Sieg"?"#22c55e30":"#ef444430"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:16}}>
            {[
              ["📅 Zeitraum",`${war.dateFrom}${war.dateTo&&war.dateTo!==war.dateFrom?` → ${war.dateTo}`:""}`],
              ["⚡ Unsere Punkte",fmt(war.ourPoints||0)],
              ["💀 Gegner Punkte",fmt(war.theirPoints||0)],
              ["🏆 Ergebnis",war.result],
            ].map(([label,val])=>(
              <div key={label} style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1,marginBottom:4}}>{label}</div>
                <div style={{fontWeight:600,color:"var(--gold2)",fontSize:15}}>{val}</div>
              </div>
            ))}
          </div>
          {war.note&&<div style={{marginTop:12,fontSize:13,color:"var(--text2)",borderTop:"1px solid var(--border)",paddingTop:10}}>📝 {war.note}</div>}
        </div>

        <div className="card">
          <div className="flex-between mb-16">
            <div className="card-title" style={{marginBottom:0}}>⚔️ Punkte aller Mitglieder</div>
            {isAdmin&&(
              <div style={{display:"flex",gap:6}}>
                {!editingPoints&&!showImport&&<>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setShowImport(true);setCsvText("");setCsvPreview(null);}}>📥 CSV Import</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditingPoints({...pts})}>✏️ Bearbeiten</button>
                </>}
                {editingPoints&&<>
                  <button className="btn btn-gold btn-sm" onClick={()=>savePoints(war.id,editingPoints)}>💾 Speichern</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditingPoints(null)}>✕</button>
                </>}
                {!editingPoints&&<button className="btn btn-red btn-sm" onClick={()=>deleteWar(war.id)}>🗑️</button>}
              </div>
            )}
          </div>

          {showImport&&(
            <div style={{marginBottom:20,padding:16,background:"var(--bg2)",borderRadius:10,border:"1px solid var(--border)"}}>
              <div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>
                Format: <code style={{color:"var(--gold2)"}}>Name, Punkte</code> oder <code style={{color:"var(--gold2)"}}>Rang, Name, Punkte</code> — eine Zeile pro Mitglied
              </div>
              <textarea className="inp" rows={8} value={csvText}
                onChange={e=>{setCsvText(e.target.value);setCsvPreview(null);}}
                placeholder={"RAF904, 2429349\nAlphA15518, 847523\nTauli, 829173\n\noder:\n1, RAF904, 2429349\n2, AlphA15518, 847523"}/>
              <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
                {!csvPreview&&<button className="btn btn-gold btn-sm" onClick={()=>{const p=parseCSV(csvText);setCsvPreview(p);}}>🔍 Analysieren</button>}
                {csvPreview&&csvPreview.length===0&&<span style={{fontSize:13,color:"#fca5a5"}}>⚠️ Keine Daten erkannt</span>}
                {csvPreview&&csvPreview.length>0&&<>
                  <span style={{fontSize:13,color:"#22c55e"}}>✅ {csvPreview.length} Einträge erkannt</span>
                  <button className="btn btn-gold btn-sm" onClick={()=>applyCSV(war.id)}>✅ Übernehmen</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setCsvPreview(null)}>↩ Nochmal</button>
                </>}
                <button className="btn btn-ghost btn-sm" onClick={()=>{setShowImport(false);setCsvText("");setCsvPreview(null);}}>✕ Schließen</button>
              </div>
              {csvPreview&&csvPreview.length>0&&(
                <div style={{marginTop:10,maxHeight:150,overflowY:"auto",background:"var(--bg3)",borderRadius:8,border:"1px solid var(--border)"}}>
                  {csvPreview.map((r,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 12px",borderBottom:"1px solid var(--border)",fontSize:13}}>
                      <span>{r.name}</span><span style={{color:"var(--gold2)",fontWeight:600}}>{fmt(r.points)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{overflowX:"auto"}}>
            <table className="member-table" style={{width:"100%"}}>
              <thead>
                <tr>
                  <th style={{width:32}}>#</th>
                  <th>Mitglied</th>
                  <th>Punkte</th>
                  <th className="hide-mobile">Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((name,i)=>{
                  const role = accountList.find(a=>a.username===name)?.role;
                  const p = editingPoints?(editingPoints[name]??""):(Number(pts[name])||0);
                  return (
                    <tr key={name}>
                      <td style={{color:i<3?"var(--gold2)":"var(--text3)",fontFamily:"'Cinzel',serif",fontSize:12}}>{i+1}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:16}}>{RANK_ICONS[role]||"⚒️"}</span>
                          <div>
                            <div style={{fontWeight:600,fontSize:14}}>{name}</div>
                            {role&&<span style={{fontSize:11,color:RANK_COLORS[role]||"var(--text3)"}}>{role}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {editingPoints?(
                          <input className="inp" type="number" value={editingPoints[name]??""} placeholder="0"
                            onChange={e=>setEditingPoints(prev=>({...prev,[name]:e.target.value}))}
                            style={{maxWidth:120,padding:"4px 8px",fontSize:13}}/>
                        ):(
                          <span style={{color:"var(--gold2)",fontWeight:600,fontSize:15}}>{fmt(Number(p)||0)}</span>
                        )}
                      </td>
                      <td className="hide-mobile">
                        {!editingPoints&&(
                          <div className="pbar" style={{minWidth:80}}>
                            <div className="pfill" style={{width:`${(Number(p)||0)/maxP*100}%`}}/>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:14,padding:"10px 16px",background:"var(--bg2)",borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:14,borderTop:"2px solid var(--border)"}}>
            <span style={{color:"var(--text3)"}}>Gesamt unsere Punkte</span>
            <span style={{color:"var(--gold2)",fontWeight:700,fontFamily:"'Cinzel',serif"}}>{fmt(war.ourPoints||0)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Übersichts-Ansicht
  return (
    <div>
      <div className="war-banner section-gap">
        <div className="flex-between">
          <div>
            <div style={{fontSize:11,letterSpacing:3,color:"var(--text3)",textTransform:"uppercase"}}>Clan War Status</div>
            <div style={{color:warStatus.isActive?"#22c55e":"var(--text2)",marginTop:4}}>
              {warStatus.isActive?"🔥 War läuft (Dienstag → Sonntag UTC)":"⏳ Nächster War startet Dienstag UTC"}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="war-time">{fmtCountdown(Math.max(0,ms))}</div>
          </div>
        </div>
      </div>

      <div className="grid-3 section-gap">
        {[
          {label:"Siege",value:wins,color:"#22c55e",icon:"🏆"},
          {label:"Niederlagen",value:warList.length-wins,color:"#ef4444",icon:"💀"},
          {label:"Winrate",value:`${winrate}%`,color:"#f59e0b",icon:"📈"},
        ].map(s=>(
          <div key={s.label} className="card" style={{textAlign:"center"}}>
            <div style={{fontSize:24}}>{s.icon}</div>
            <div className="stat-num" style={{color:s.color,marginTop:4}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 section-gap">
        <div>
          <div className="flex-between mb-12">
            <div className="card-title" style={{marginBottom:0}}>⚔️ War-Historie</div>
            {isAdmin&&<button className="btn btn-gold btn-sm" onClick={()=>setShowAdd(true)}>+ War</button>}
          </div>
          {warList.length===0&&<div className="card"><div className="text-muted text-sm">Noch keine Wars eingetragen</div></div>}
          {warList.map(w=>(
            <div key={w.id} onClick={()=>setSelectedWar(w)}
              style={{padding:"14px 16px",background:"var(--bg3)",border:`1px solid ${w.result==="Sieg"?"#22c55e30":"#ef444430"}`,borderRadius:12,marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=w.result==="Sieg"?"#22c55e70":"#ef444470"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=w.result==="Sieg"?"#22c55e30":"#ef444430"}>
              <div style={{fontSize:26,flexShrink:0}}>{w.result==="Sieg"?"🏆":"💀"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:15}}>vs. {w.opponent}</div>
                <div style={{fontSize:12,color:"var(--text3)"}}>
                  {w.dateFrom}{w.dateTo&&w.dateTo!==w.dateFrom?` → ${w.dateTo}`:""}
                  {" · "}{Object.values(w.memberPoints||{}).filter(v=>Number(v)>0).length} mit Punkten
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color:"var(--gold2)",fontWeight:700,fontSize:16}}>{fmt(w.ourPoints||0)}</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>vs {fmt(w.theirPoints||0)}</div>
              </div>
              <span style={{padding:"4px 10px",borderRadius:16,fontSize:12,background:w.result==="Sieg"?"#22c55e20":"#ef444420",color:w.result==="Sieg"?"#22c55e":"#ef4444",border:`1px solid ${w.result==="Sieg"?"#22c55e":"#ef4444"}`,flexShrink:0}}>
                {w.result==="Sieg"?"SIEG":"NIE."}
              </span>
              <span style={{color:"var(--text3)",fontSize:18,flexShrink:0}}>›</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">🏅 Gesamtranking (alle Wars)</div>
          {totalRanking.length===0&&<div className="text-muted text-sm">Noch keine Punkte eingetragen</div>}
          {totalRanking.map((m,i)=>(
            <div key={m.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:22,color:i<3?"var(--gold2)":"var(--text3)",fontFamily:"'Cinzel',serif",fontSize:13,textAlign:"center",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                  <span style={{color:"#a855f7",fontSize:13,flexShrink:0,marginLeft:8}}>{fmt(m.pts)}</span>
                </div>
                <div className="pbar"><div className="pfill" style={{width:`${(m.pts/maxTotal)*100}%`,background:"linear-gradient(90deg,#7c3aed,#a855f7)"}}/></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">⚔️ Neuer Clan War</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Gegner-Clan *</label><input className="inp" value={form.opponent} onChange={e=>setForm(p=>({...p,opponent:e.target.value}))} placeholder="Clan-Name"/></div>
              <div className="grid-2">
                <div><label className="lbl">Von</label><input className="inp" type="date" value={form.dateFrom} onChange={e=>setForm(p=>({...p,dateFrom:e.target.value}))}/></div>
                <div><label className="lbl">Bis</label><input className="inp" type="date" value={form.dateTo} onChange={e=>setForm(p=>({...p,dateTo:e.target.value}))}/></div>
              </div>
              <div><label className="lbl">Gegner-Gesamtpunkte</label><input className="inp" type="number" value={form.theirPoints} onChange={e=>setForm(p=>({...p,theirPoints:e.target.value}))} placeholder="0"/></div>
              <div><label className="lbl">Ergebnis</label>
                <select className="inp" value={form.result} onChange={e=>setForm(p=>({...p,result:e.target.value}))}>
                  <option>Sieg</option><option>Niederlage</option>
                </select>
              </div>
              <div><label className="lbl">Notiz</label><textarea className="inp" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={{minHeight:50}}/></div>
              <div style={{padding:"10px 14px",background:"var(--bg2)",borderRadius:8,fontSize:12,color:"var(--text3)"}}>
                💡 Nach dem Erstellen auf den War klicken → CSV importieren oder Punkte manuell eintragen.
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Abbrechen</button>
              <button className="btn btn-gold" onClick={addWar}>Erstellen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MY PAGE ──────────────────────────────────────────────────
function MyPage({ user, memberList, warList, accountList, db }) {
  // Rang aus Account-System holen (korrekt), nicht aus members
  const myAccount = accountList?.find(a => a.username?.toLowerCase()===user.username?.toLowerCase()) || {};
  const myRank = myAccount.role || user.role;
  const myData = memberList.find(m => m.name?.toLowerCase()===user.username?.toLowerCase()) || {};
  // Gesamtpunkte aus allen Wars berechnen
  const myTotalWarPts = (warList||[]).reduce((sum, w) => {
    if (!w.memberPoints) return sum;
    const entry = Object.entries(w.memberPoints).find(([name]) => name.toLowerCase()===user.username?.toLowerCase());
    return sum + (entry ? Number(entry[1])||0 : 0);
  }, 0);
  const [activeCalc, setActiveCalc] = useState("forge");
  const [forgeLevel, setForgeLevel] = useState(10);
  const [freeForge, setFreeForge] = useState(0);
  const [hammers, setHammers] = useState(100);
  const [calcResult, setCalcResult] = useState(null);
  const [myNote, setMyNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [eggTimerLevel, setEggTimerLevel] = useState(0);
  const [eggRarity, setEggRarity] = useState("Gewoehnlich");
  const [offlineTechLevel, setOfflineTechLevel] = useState(0);
  const [summonType, setSummonType] = useState("Haustier");
  const [summonLevel, setSummonLevel] = useState(1);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Profil aus Firebase laden beim ersten Render
  useEffect(() => {
    const profileRef = ref(db, `profiles/${user.username}`);
    const unsub = onValue(profileRef, snap => {
      if (snap.val() && !profileLoaded) {
        const p = snap.val();
        if (p.forgeLevel) setForgeLevel(p.forgeLevel);
        if (p.freeForge !== undefined) setFreeForge(p.freeForge);
        if (p.eggTimerLevel !== undefined) setEggTimerLevel(p.eggTimerLevel);
        if (p.offlineTechLevel !== undefined) setOfflineTechLevel(p.offlineTechLevel);
        if (p.summonType) setSummonType(p.summonType);
        if (p.summonLevel) setSummonLevel(p.summonLevel);
        if (p.myNote !== undefined) setMyNote(p.myNote);
        setProfileLoaded(true);
      } else if (!snap.val()) {
        setProfileLoaded(true);
      }
    });
    return () => unsub();
  }, [user.username]);

  // Profil in Firebase speichern
  async function saveProfile() {
    await update(ref(db, `profiles/${user.username}`), {
      forgeLevel, freeForge, eggTimerLevel, offlineTechLevel,
      summonType, summonLevel, myNote,
      lastUpdated: Date.now(),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  const FORGE_DATA = [
    [1,null,null,"N/A","N/A",100,0,0,0,0,0,0,0,0,0],
    [2,400,400,1,"5m",99,1,0,0,0,0,0,0,0,0],
    [3,700,700,1,"15m",98,2,0,0,0,0,0,0,0,0],
    [4,1500,1500,1,"30m",96,4,0,0,0,0,0,0,0,0],
    [5,3500,3500,1,"1h",91.5,8,0.5,0,0,0,0,0,0,0],
    [6,10000,10000,1,"2h",82,16,2,0,0,0,0,0,0,0],
    [7,25000,25000,1,"7h 33m",64,32,4,0,0,0,0,0,0,0],
    [8,50000,50000,1,"13h 6m",27.8,64,8,0.2,0,0,0,0,0,0],
    [9,99000,99000,3,"18h 39m",13,70,16,1,0,0,0,0,0,0],
    [10,150000,150000,3,"24h 13m",6,60,32,2,0,0,0,0,0,0],
    [11,249900,249900,3,"1d 5h",0,31.9,64,4,0.1,0,0,0,0,0],
    [12,348000,348000,3,"1d 11h",0,27.5,64,8,0.5,0,0,0,0,0],
    [13,448000,448000,4,"1d 16h",0,8,75,16,1,0,0,0,0,0],
    [14,600000,600000,4,"1d 22h",0,0,66,32,2,0.05,0,0,0,0],
    [15,800000,800000,5,"2d 4h",0,0,31.7,64,4,0.25,0,0,0,0],
    [16,910000,910000,5,"2d 9h",0,0,21.5,70,8,0.5,0,0,0,0],
    [17,1020000,1020000,6,"2d 15h",0,0,0,82.9,16,1,0.05,0,0,0],
    [18,1130000,1130000,7,"2d 20h",0,0,0,65.7,32,2,0.25,0,0,0],
    [19,1240000,1240000,8,"3d 5h",0,0,0,31.5,64,4,0.5,0,0,0],
    [20,1350000,1350000,9,"3d 13h",0,0,0,0,91,8,1,0.05,0,0],
    [21,1460000,1460000,10,"3d 21h",0,0,0,0,81.7,16,2,0.25,0,0],
    [22,1570000,1570000,10,"4d 5h",0,0,0,0,63.5,32,4,0.5,0,0],
    [23,1680000,1680000,10,"4d 14h",0,0,0,0,27,64,8,1,0,0],
    [24,1790000,1790000,10,"4d 22h",0,0,0,0,0,82,16,2,0.02,0],
    [25,1900000,1900000,10,"5d 7h",0,0,0,0,0,64,32,4,0.05,0],
    [26,2010000,2010000,10,"5d 15h",0,0,0,0,0,43.8,50,6,0.25,0],
    [27,2120000,2120000,10,"5d 23h",0,0,0,0,0,31.5,60,8,0.5,0],
    [28,2230000,2230000,10,"6d 8h",0,0,0,0,0,21,65,13,1,0],
    [29,2340000,2340000,10,"6d 16h",0,0,0,0,0,6.99,68,23,2,0.02],
    [30,2450000,2450000,10,"7d 40m",0,0,0,0,0,0,60,36,4,0.05],
    [31,2560000,2560000,10,"7d 8h",0,0,0,0,0,0,50.8,43,6,0.25],
    [32,2670000,2670000,10,"7d 17h",0,0,0,0,0,0,41.5,50,8,0.5],
    [33,2780000,2780000,10,"8d 1h",0,0,0,0,0,0,28,58,13,1],
    [34,2890000,2890000,10,"8d 10h",0,0,0,0,0,0,11,64,23,2],
    [35,3000000,3000000,10,"8d 18h",0,0,0,0,0,0,0,60,36,4],
  ];
  const ZEITALTER = ["Primitiv","Mittelalter","Fruehmodern","Modern","Weltraum","Interstellar","Multiversum","Quanten","Unterwelt","Goettlich"];

  const OFFLINE_DATA = [
    [null,0,"4h"],[1,16,"4h 38m"],[2,32,"5h 17m"],[3,48,"5h 55m"],[4,64,"6h 34m"],
    [5,80,"7h 12m"],[6,96,"7h 50m"],[7,112,"8h 29m"],[8,128,"9h 7m"],[9,144,"9h 46m"],
    [10,160,"10h 24m"],[11,176,"11h 2m"],[12,192,"11h 41m"],[13,208,"12h 19m"],[14,224,"12h 58m"],
    [15,240,"13h 36m"],[16,256,"14h 14m"],[17,272,"14h 53m"],[18,288,"15h 31m"],[19,304,"16h 10m"],
    [20,320,"16h 48m"],[21,336,"17h 26m"],[22,352,"18h 5m"],[23,368,"18h 43m"],[24,384,"19h 22m"],
    [25,400,"20h"],
  ];

  const EGG_TIMES = {
    "Gewoehnlich": ["30m","27m 16s","25m","23m 5s","21m 26s","20m","18m 45s","17m 39s","16m 40s","15m 47s","15m","14m 17s","13m 38s","13m 3s","12m 30s","12m","11m 32s","11m 7s","10m 43s","10m 21s","10m","9m 41s","9m 23s","9m 5s","8m 49s","8m 34s"],
    "Selten": ["2h","1h 49m","1h 40m","1h 32m","1h 26m","1h 20m","1h 15m","1h 11m","1h 7m","1h 3m","1h","57m 9s","54m 33s","52m 10s","50m","48m","46m 9s","44m 27s","42m 51s","41m 23s","40m","38m 43s","37m 30s","36m 22s","35m 18s","34m 17s"],
    "Episch": ["4h","3h 38m","3h 20m","3h 5m","2h 51m","2h 40m","2h 30m","2h 21m","2h 13m","2h 6m","2h","1h 54m","1h 49m","1h 44m","1h 40m","1h 36m","1h 32m","1h 29m","1h 26m","1h 23m","1h 20m","1h 17m","1h 15m","1h 13m","1h 11m","1h 9m"],
    "Legendaer": ["8h","7h 16m","6h 40m","6h 9m","5h 43m","5h 20m","5h","4h 42m","4h 27m","4h 13m","4h","3h 49m","3h 38m","3h 29m","3h 20m","3h 12m","3h 5m","2h 58m","2h 51m","2h 46m","2h 40m","2h 35m","2h 30m","2h 25m","2h 21m","2h 17m"],
    "Ultimate": ["16h","14h 33m","13h 20m","12h 18m","11h 26m","10h 40m","10h","9h 24m","8h 53m","8h 25m","8h","7h 37m","7h 16m","6h 57m","6h 40m","6h 24m","6h 9m","5h 56m","5h 43m","5h 31m","5h 20m","5h 10m","5h","4h 51m","4h 42m","4h 34m"],
    "Mythisch": ["32h","29h 5m","26h 40m","24h 37m","22h 51m","21h 20m","20h","18h 49m","17h 47m","16h 51m","16h","15h 14m","14h 33m","13h 55m","13h 20m","12h 48m","12h 18m","11h 51m","11h 26m","11h 2m","10h 40m","10h 19m","10h","9h 42m","9h 25m","9h 9m"],
  };
  const EGG_RARITY_LABELS = ["Gewoehnlich","Selten","Episch","Legendaer","Ultimate","Mythisch"];
  const EGG_RARITY_DISPLAY = ["Gewoehnlich","Selten","Episch","Legendaer","Ultimate","Mythisch"];

  const PET_PROBS = {1:[99,1,0,0,0,0],10:[77.21,21.95,0.84,0,0,0],20:[17.5,74.19,8.31,0,0,0],
    25:[17.5,68.66,13.82,0.02,0,0],40:[17.5,16.5,65.99,0.01,0,0],50:[17.5,16.5,48.3,17.39,0.31,0],
    69:[17.5,16.5,16.5,37.67,11.78,0.05],82:[17.5,16.5,16.5,16.5,28,5],100:[17.5,16.5,16.5,16.5,16.5,16.5]};
  const MOUNT_PROBS = {1:[100,0,0,0,0,0],24:[17.5,82.49,0.01,0,0,0],33:[17.5,77.5,5,0,0,0],
    40:[17.5,16.5,65.99,0.01,0,0],57:[17.5,16.5,44.49,21.5,0.01,0],
    67:[17.5,16.5,16.5,43.75,5.75,0],80:[17.5,16.5,16.5,16.5,31.75,1.25],100:[17.5,16.5,16.5,16.5,16.5,16.5]};
  const SKILL_PROBS = {1:[99.5,0.5,0,0,0,0],10:[77.88,21.95,0.17,0,0,0],20:[17.5,80.86,1.47,0.17,0,0],
    40:[17.5,15.31,62.89,4.18,0.12,0],67:[17.5,16.5,16.5,42.1,7.4,0],82:[17.5,16.5,16.5,16.5,30.79,2.21],100:[17.5,16.5,16.5,16.5,16.5,16.5]};

  const WAR_PTS = [1,1,1,2,2,2,3,3,3,3];
  const RARITY_COLORS_ARR = ["#9ca3af","#22c55e","#a855f7","#f59e0b","#ef4444","#ec4899"];
  const RARITY_NAMES = ["Gewoehnlich","Selten","Episch","Legendaer","Ultimate","Mythisch"];

  function calcWarPoints() {
    const row = FORGE_DATA[forgeLevel-1];
    if(!row) return;
    const probs = row.slice(5);
    const avgPts = probs.reduce((s,p,i) => s+(p/100)*WAR_PTS[i], 0);
    const eff = hammers*(1+freeForge/100);
    const exp = Math.round(eff*avgPts);
    const topIdx = probs.indexOf(Math.max(...probs));
    setCalcResult({expected:exp,low:Math.round(exp*0.75),high:Math.round(exp*1.25),eff:Math.round(eff),topZ:ZEITALTER[topIdx],topC:probs[topIdx]?.toFixed(1)});
  }

  async function saveNote() {
    await saveProfile();
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const offlineRow = OFFLINE_DATA[offlineTechLevel]||OFFLINE_DATA[0];
  const forgeRow = FORGE_DATA[forgeLevel-1]||FORGE_DATA[0];
  const eggTime = EGG_TIMES[eggRarity]?.[eggTimerLevel]||"?";
  const probData = summonType==="Haustier"?PET_PROBS:summonType==="Reittier"?MOUNT_PROBS:SKILL_PROBS;
  const nearestLvl = Object.keys(probData).map(Number).reduce((a,b)=>Math.abs(b-summonLevel)<Math.abs(a-summonLevel)?b:a);
  const curProbs = probData[nearestLvl];

  return (
    <div>
      <div style={{marginBottom:20,padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:`${RANK_COLORS[myRank]||"#5a3a00"}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`2px solid ${RANK_COLORS[myRank]||"#5a3a00"}50`}}>
          {RANK_ICONS[myRank]||"⚒️"}
        </div>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"var(--gold2)"}}>{user.username}</div>
          <span className="rank-badge" style={{color:RANK_COLORS[myRank]||"#c88500",borderColor:`${RANK_COLORS[myRank]||"#c88500"}40`,background:`${RANK_COLORS[myRank]||"#c88500"}10`}}>{myRank}</span>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          {myTotalWarPts>0 && <><div style={{color:"var(--gold2)",fontSize:18,fontWeight:700,fontFamily:"'Cinzel',serif"}}>{fmt(myTotalWarPts)}</div><div style={{fontSize:11,color:"var(--text3)"}}>War-Gesamtpunkte</div></>}
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["forge",".. Schmiede"],["egg",".. Eier"],["offline",".. Offline"],["summon",".. Beschwoerunq"]].map(([id,label])=>(
          <button key={id} className={`btn ${activeCalc===id?"btn-gold":"btn-ghost"}`} style={{fontSize:12}} onClick={()=>setActiveCalc(id)}>{label.replace("..","")}</button>
        ))}
      </div>

      {activeCalc==="forge" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">War-Punkte Kalkulator</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Schmied-Level: {forgeLevel}</label>
                <input type="range" min={1} max={35} value={forgeLevel} onChange={e=>{const v=Number(e.target.value);setForgeLevel(v);setCalcResult(null);update(ref(db,`profiles/${user.username}`),{forgeLevel:v});}} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              </div>
              <div><label className="lbl">Gratis-Schmiede: {freeForge}%</label>
                <input type="range" min={0} max={50} value={freeForge} onChange={e=>{const v=Number(e.target.value);setFreeForge(v);update(ref(db,`profiles/${user.username}`),{freeForge:v});}} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              </div>
              <div><label className="lbl">Hämmer</label><input className="inp" type="number" value={hammers} onChange={e=>setHammers(Number(e.target.value))}/></div>
              <button className="btn btn-gold" onClick={calcWarPoints} style={{justifyContent:"center"}}>Berechnen</button>
            </div>
            {calcResult && (
              <div className="calc-result" style={{marginTop:12}}>
                <div className="calc-row"><span>Effektive Hämmer</span><span>{calcResult.eff}</span></div>
                <div className="calc-row"><span>Bestes Zeitalter</span><span style={{color:"var(--gold2)"}}>{calcResult.topZ} ({calcResult.topC}%)</span></div>
                <div className="calc-row"><span>Erwartete Punkte</span><span style={{color:"var(--gold2)",fontWeight:600,fontSize:16}}>{fmt(calcResult.expected)}</span></div>
                <div className="calc-row"><span>Spanne</span><span>{fmt(calcResult.low)} - {fmt(calcResult.high)}</span></div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-title">Schmied Lvl {forgeLevel} - Wahrscheinlichkeiten</div>
            {ZEITALTER.map((z,i)=>{const p=forgeRow[5+i]||0;return p>0?(
              <div key={z} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <div style={{width:90,fontSize:12,color:"var(--text2)",flexShrink:0}}>{z}</div>
                <div style={{flex:1,height:14,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"linear-gradient(90deg,var(--gold),var(--gold2))",width:`${Math.min(p,100)}%`,borderRadius:3}}/>
                </div>
                <div style={{width:44,fontSize:12,color:"var(--gold2)",textAlign:"right"}}>{p}%</div>
              </div>
            ):null;})}
            {forgeRow[1] && (
              <div style={{marginTop:10,padding:"8px 12px",background:"var(--bg2)",borderRadius:8,fontSize:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                <span style={{color:"var(--text3)"}}>Kosten: <span style={{color:"var(--gold2)"}}>{fmt(forgeRow[1])}</span></span>
                <span style={{color:"var(--text3)"}}>Zeit: <span style={{color:"var(--gold2)"}}>{forgeRow[4]}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCalc==="egg" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Ei-Schlüpfzeit Kalkulator</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Seltenheit</label>
                <select className="inp" value={eggRarity} onChange={e=>setEggRarity(e.target.value)}>
                  {EGG_RARITY_LABELS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className="lbl">Timer Speed Tech Level: {eggTimerLevel} ({eggTimerLevel*10}%)</label>
                <input type="range" min={0} max={25} value={eggTimerLevel} onChange={e=>{const v=Number(e.target.value);setEggTimerLevel(v);update(ref(db,`profiles/${user.username}`),{eggTimerLevel:v});}} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              </div>
              <div style={{padding:16,background:"var(--bg2)",borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--text3)",marginBottom:6,letterSpacing:1}}>SCHLÜPFZEIT</div>
                <div style={{fontSize:34,fontWeight:700,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>{eggTime}</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>{eggRarity} - {eggTimerLevel*10}% Timer Speed</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Alle Schlüpfzeiten (Tech {eggTimerLevel})</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr><th style={{padding:"5px 8px",textAlign:"left",color:"var(--text3)",borderBottom:"1px solid var(--border)"}}>Seltenheit</th><th style={{padding:"5px 8px",textAlign:"left",color:"var(--text3)",borderBottom:"1px solid var(--border)"}}>Zeit</th></tr></thead>
              <tbody>
                {EGG_RARITY_LABELS.map((r,ri)=>(
                  <tr key={r} style={{background:r===eggRarity?"var(--bg4)":"transparent"}}>
                    <td style={{padding:"5px 8px",color:RARITY_COLORS_ARR[ri]}}>{r}</td>
                    <td style={{padding:"5px 8px",color:"var(--gold2)",fontWeight:r===eggRarity?600:400}}>{EGG_TIMES[r]?.[eggTimerLevel]||"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeCalc==="offline" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Offline-Zeit Kalkulator</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Offline-Zeit Tech Level: {offlineTechLevel===0?"Basis":offlineTechLevel}</label>
                <input type="range" min={0} max={25} value={offlineTechLevel} onChange={e=>{const v=Number(e.target.value);setOfflineTechLevel(v);update(ref(db,`profiles/${user.username}`),{offlineTechLevel:v});}} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              </div>
              <div style={{padding:16,background:"var(--bg2)",borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--text3)",marginBottom:6,letterSpacing:1}}>MAX OFFLINE-ZEIT</div>
                <div style={{fontSize:34,fontWeight:700,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>{offlineRow[2]}</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>+{offlineRow[1]}% Bonus</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Offline-Zeit Übersicht</div>
            <div style={{maxHeight:320,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["Tech Lvl","%","Dauer"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:"left",color:"var(--text3)",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"var(--bg3)"}}>{h}</th>)}</tr></thead>
                <tbody>{OFFLINE_DATA.map((row,i)=>(
                  <tr key={i} style={{background:i===offlineTechLevel?"var(--bg4)":"transparent",borderBottom:"1px solid #2a180040"}}>
                    <td style={{padding:"5px 8px",color:"var(--text2)"}}>{row[0]===null?"Basis":row[0]}</td>
                    <td style={{padding:"5px 8px",color:"var(--gold)"}}>{row[1]}%</td>
                    <td style={{padding:"5px 8px",color:"var(--gold2)",fontWeight:i===offlineTechLevel?600:400}}>{row[2]}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeCalc==="summon" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Beschwörungs-Wahrscheinlichkeit</div>
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",gap:6}}>
                {["Haustier","Reittier","Skill"].map(t=>(
                  <button key={t} className={`btn ${summonType===t?"btn-gold":"btn-ghost"}`} style={{flex:1,fontSize:12,justifyContent:"center"}} onClick={()=>{setSummonType(t);update(ref(db,`profiles/${user.username}`),{summonType:t});}}>{t}</button>
                ))}
              </div>
              <div><label className="lbl">Level: {summonLevel}</label>
                <input type="range" min={1} max={100} value={summonLevel} onChange={e=>{const v=Number(e.target.value);setSummonLevel(v);update(ref(db,`profiles/${user.username}`),{summonLevel:v});}} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              </div>
              <div style={{fontSize:11,color:"var(--text3)"}}>Naechste Auswertung bei Level {nearestLvl}</div>
            </div>
            <div style={{marginTop:14}}>
              {RARITY_NAMES.map((r,i)=>curProbs[i]>0?(
                <div key={r} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:13}}>
                    <span style={{color:RARITY_COLORS_ARR[i]}}>{r}</span>
                    <span style={{color:RARITY_COLORS_ARR[i],fontWeight:600}}>{curProbs[i]}%</span>
                  </div>
                  <div className="pbar"><div className="pfill" style={{width:`${curProbs[i]}%`,background:RARITY_COLORS_ARR[i]}}/></div>
                </div>
              ):null)}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Beschwörungs-Tipps</div>
            {[
              ["Haustier","Ab Level 25: Legendaer moeglich (0.02%)\nAb Level 43: Ultimate moeglich\nAb Level 69: Mythisch moeglich\nLevel 82+: Legendaer Mindest-16.5%"],
              ["Reittier","Ab Level 24: Selten stark (82%+)\nAb Level 33: Episch moeglich (5%)\nAb Level 40: Legendaer moeglich\nLevel 67+: Ultimate moeglich"],
              ["Skill","Kosten steigen stark (400 bis 4.400)\nAb Level 40: Legendaer moeglich\nAb Level 68: Mythisch moeglich\nLevel 82+: Legendaer Mindest-16.5%"],
              ["Allgemein","Tickets sparen bis 5%+ Chance\nPremium Pass gibt regelmaessig Tickets\nNur beschwören wenn Chance gut ist"],
            ].map(([title,text])=>(
              <div key={title} style={{marginBottom:10,padding:"8px 12px",background:"var(--bg2)",borderRadius:8,borderLeft:"3px solid var(--gold)"}}>
                <div style={{fontWeight:600,color:"var(--gold2)",marginBottom:3,fontSize:13}}>{title}</div>
                <div style={{fontSize:12,color:"var(--text2)",whiteSpace:"pre-line"}}>{text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-20">
        <div className="card-title">Meine persönlichen Notizen</div>
        <textarea className="inp" rows={4} value={myNote} onChange={e=>setMyNote(e.target.value)} placeholder="Eigene Notizen, Ziele, Build-Plaene..."/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10,gap:8,alignItems:"center"}}>
          {(noteSaved||profileSaved) && <span style={{color:"#22c55e",fontSize:13}}>✅ Gespeichert</span>}
          <button className="btn btn-gold btn-sm" onClick={saveNote}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── SPIELINFO ────────────────────────────────────────────────
function Spielinfo() {
  const [section, setSection] = useState("war");

  const WAR_ACTIONS = [
    {day:"Tag 1 (Dienstag)",pts:"1 Pkt",color:"#22c55e",actions:[
      ["Primitiv/Mittelalter/Fruehmodern schmieden","1"],["Modern/Weltraum/Interstellar schmieden","2"],
      ["Multiversum/Quanten/Unterwelt/Goettlich schmieden","3"],
      ["Gewoehnliche Skill beschworen","125"],["Seltene Skill beschworen","150"],["Epische Skill beschworen","175"],
      ["Legendaere Skill beschworen","200"],["Ultimate Skill beschworen","225"],["Mythische Skill beschworen","250"],
      ["Gewoehnliche Skill upgraden","125"],["Seltene Skill upgraden","150"],["Epische Skill upgraden","175"],
      ["Legendaere Skill upgraden","200"],["Ultimate Skill upgraden","225"],["Mythische Skill upgraden","250"],
      ["Tech Tree I abschliessen","1.000"],["Tech Tree II abschliessen","10.000"],
      ["Tech Tree III abschliessen","30.000"],["Tech Tree IV abschliessen","50.000"],["Tech Tree V abschliessen","100.000"],
    ]},
    {day:"Tag 2 (Mittwoch)",pts:"2 Pkt",color:"#3b82f6",actions:[
      ["1.000 Muenzen fuer Schmiede ausgeben","27"],["1 Edelstein fuer Schmiede ausgeben","50"],
      ["Hammer Thief Dungeon Schluessel nutzen","3.000"],["Ghost Town Dungeon Schluessel nutzen","3.000"],
      ["Invasion Dungeon Schluessel nutzen","3.000"],["Zombie Rush Dungeon Schluessel nutzen","3.000"],
      ["Gewoehnliches Ei ausbrueten","200"],["Seltenes Ei ausbrueten","800"],["Episches Ei ausbrueten","1.600"],
      ["Legendaeres Ei ausbrueten","3.200"],["Ultimate Ei ausbrueten","6.400"],["Mythisches Ei ausbrueten","12.800"],
      ["Gewoehnliches Haustier zusammenfuehren","50"],["Seltenes Haustier zusammenfuehren","200"],
      ["Episches Haustier zusammenfuehren","400"],["Legendaeres Haustier zusammenfuehren","800"],
      ["Ultimate Haustier zusammenfuehren","1.600"],["Mythisches Haustier zusammenfuehren","3.200"],
    ]},
    {day:"Tag 3 (Donnerstag)",pts:"2 Pkt",color:"#a855f7",actions:[
      ["Primitiv/Mittelalter/Fruehmodern schmieden","1"],["Modern/Weltraum/Interstellar schmieden","2"],
      ["Multiversum/Quanten/Unterwelt/Goettlich schmieden","3"],
      ["Gewoehnliche Skill beschworen","125"],["Seltene Skill beschworen","150"],["Epische Skill beschworen","175"],
      ["Legendaere Skill beschworen","200"],["Ultimate Skill beschworen","225"],["Mythische Skill beschworen","250"],
      ["Gewoehnliche Skill upgraden","125"],["Seltene Skill upgraden","150"],["Epische Skill upgraden","175"],
      ["Legendaere Skill upgraden","200"],["Ultimate Skill upgraden","225"],["Mythische Skill upgraden","250"],
      ["Gewoehnlichen Reittier beschworen","50"],["Seltenen Reittier beschworen","100"],
      ["Epischen Reittier beschworen","250"],["Legendaeren Reittier beschworen","500"],
      ["Ultimate Reittier beschworen","1.500"],["Mythischen Reittier beschworen","2.500"],
      ["Gewoehnlichen Reittier zusammenfuehren","50"],["Seltenen Reittier zusammenfuehren","100"],
      ["Epischen Reittier zusammenfuehren","250"],["Legendaeren Reittier zusammenfuehren","500"],
      ["Ultimate Reittier zusammenfuehren","1.500"],["Mythischen Reittier zusammenfuehren","2.500"],
    ]},
    {day:"Tag 4 (Freitag)",pts:"2 Pkt",color:"#f59e0b",actions:[
      ["1.000 Muenzen fuer Schmiede ausgeben","27"],["1 Edelstein fuer Schmiede ausgeben","50"],
      ["Tech Tree I abschliessen","1.000"],["Tech Tree II abschliessen","10.000"],
      ["Tech Tree III abschliessen","30.000"],["Tech Tree IV abschliessen","50.000"],["Tech Tree V abschliessen","100.000"],
      ["Gewoehnliches Ei ausbrueten","200"],["Seltenes Ei ausbrueten","800"],["Episches Ei ausbrueten","1.600"],
      ["Legendaeres Ei ausbrueten","3.200"],["Ultimate Ei ausbrueten","6.400"],["Mythisches Ei ausbrueten","12.800"],
      ["Gewoehnliches Haustier zusammenfuehren","50"],["Seltenes Haustier zusammenfuehren","200"],
      ["Episches Haustier zusammenfuehren","400"],["Legendaeres Haustier zusammenfuehren","800"],
      ["Ultimate Haustier zusammenfuehren","1.600"],["Mythisches Haustier zusammenfuehren","3.200"],
    ]},
    {day:"Tag 5 (Samstag)",pts:"2 Pkt",color:"#ef4444",actions:[
      ["Primitiv/Mittelalter/Fruehmodern schmieden","1"],["Modern/Weltraum/Interstellar schmieden","2"],
      ["Multiversum/Quanten/Unterwelt/Goettlich schmieden","3"],
      ["Hammer Thief Dungeon Schluessel nutzen","3.000"],["Ghost Town Dungeon Schluessel nutzen","3.000"],
      ["Invasion Dungeon Schluessel nutzen","3.000"],["Zombie Rush Dungeon Schluessel nutzen","3.000"],
      ["Gewoehnlichen Reittier beschworen","50"],["Seltenen Reittier beschworen","100"],
      ["Epischen Reittier beschworen","250"],["Legendaeren Reittier beschworen","500"],
      ["Ultimate Reittier beschworen","1.500"],["Mythischen Reittier beschworen","2.500"],
      ["Gewoehnlichen Reittier zusammenfuehren","50"],["Seltenen Reittier zusammenfuehren","100"],
      ["Epischen Reittier zusammenfuehren","250"],["Legendaeren Reittier zusammenfuehren","500"],
      ["Ultimate Reittier zusammenfuehren","1.500"],["Mythischen Reittier zusammenfuehren","2.500"],
    ]},
    {day:"Tag 6 (Sonntag)",pts:"4 Pkt",color:"#ec4899",actions:[
      ["Rivalen-Clan-Mitglied besiegen","1-50"],["All-Out Brawl gewinnen","1.000"],
    ]},
  ];

  const INDIVIDUAL_REWARDS = [
    ["10k","70","250","100","-","-","-"],["20k","-","-","-","15k","220","115"],
    ["50k","70","250","100","-","-","-"],["75k","-","-","-","15k","220","115"],
    ["100k","70","250","100","-","-","-"],["150k","-","-","-","15k","220","115"],
    ["200k","70","250","100","-","-","-"],["250k","-","-","-","15k","220","115"],
    ["300k","70","250","100","-","-","-"],["350k","-","-","-","15k","220","115"],
    ["400k","70","250","100","-","-","-"],["450k","-","-","-","15k","220","115"],
    ["500k","70","250","100","-","-","-"],
  ];

  const WAR_REWARDS = [
    {tier:"S",pts:"25+",wH:"5.7k",wC:"150k",wT:"7.8k",wE:"3.15k",wP:"5.9k",wW:"3.15k",lH:"2.85k",lC:"75k",lT:"3.9k",lE:"1.5k",lP:"2.9k",lW:"1.5k"},
    {tier:"A",pts:"20+",wH:"2.5k",wC:"80k",wT:"3.6k",wE:"1.5k",wP:"2.8k",wW:"1.5k",lH:"1.25k",lC:"40k",lT:"1.8k",lE:"750",lP:"1.4k",lW:"750"},
    {tier:"B",pts:"15+",wH:"1.4k",wC:"55k",wT:"2.1k",wE:"840",wP:"1.58k",wW:"840",lH:"700",lC:"27.5k",lT:"1.05k",lE:"420",lP:"790",lW:"420"},
    {tier:"C",pts:"10+",wH:"750",wC:"20k",wT:"1.05k",wE:"420",wP:"800",wW:"420",lH:"375",lC:"10k",lT:"525",lE:"210",lP:"400",lW:"210"},
    {tier:"D",pts:"5+",wH:"380",wC:"10k",wT:"520",wE:"210",wP:"400",wW:"200",lH:"190",lC:"5k",lT:"260",lE:"105",lP:"200",lW:"100"},
    {tier:"E",pts:"0+",wH:"190",wC:"5k",wT:"260",wE:"100",wP:"200",wW:"100",lH:"100",lC:"2.5k",lT:"130",lE:"50",lP:"100",lW:"50"},
  ];

  const TECH_DATA = [
    ["I","1/5",40,"5m",1],["I","2/5",56,"10m",1],["I","3/5",78,"20m",3],["I","4/5",110,"40m",6],["I","5/5",154,"1h 20m",11],
    ["II","1/5",214,"2h 40m",22],["II","2/5",301,"5h 20m",44],["II","3/5",422,"10h 40m",88],["II","4/5",590,"21h 20m",177],["II","5/5",826,"23h 28m",194],
    ["III","1/5",1157,"1d 1h 48m",215],["III","2/5",1318,"1d 4h 23m",235],["III","3/5",1503,"1d 7h 14m",259],["III","4/5",1714,"1d 10h 21m",284],["III","5/5",1954,"1d 13h 47m",313],
    ["IV","1/5",2227,"1d 17h 34m",344],["IV","2/5",2540,"1d 21h 43m",379],["IV","3/5",2895,"2d 2h 18m",417],["IV","4/5",3300,"2d 7h 19m",458],["IV","5/5",3762,"2d 12h 51m",504],
    ["V","1/5",4289,"2d 18h 57m",554],["V","2/5",4889,"3d 1h 38m",610],["V","3/5",5574,"3d 9h 0m",671],["V","4/5",6354,"3d 17h 6m",738],["V","5/5",7244,"4d 2h 1m",812],
  ];

  return (
    <div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {[["war","War-Aktionen"],["rewards","Belohnungen"],["tech","Tech-Kosten"],["tips","Tipps"]].map(([id,label])=>(
          <button key={id} className={`btn ${section===id?"btn-gold":"btn-ghost"}`} style={{fontSize:12}} onClick={()=>setSection(id)}>{label}</button>
        ))}
      </div>

      {section==="war" && (
        <div>
          <div style={{padding:"10px 16px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,marginBottom:16,fontSize:13,color:"var(--text3)"}}>
            Strategie: Eier und Reittiere fuer Tag 5 (Samstag) aufsparen - beste Punkteausbeute! Tech Tree Upgrades an Tag 1/4 starten und an Tag 4 abschliessen.
          </div>
          {WAR_ACTIONS.map((day,di)=>(
            <div key={di} className="card mb-16" style={{borderColor:`${day.color}30`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:14,color:day.color}}>{day.day}</div>
                <span style={{padding:"2px 8px",borderRadius:12,fontSize:11,background:`${day.color}20`,color:day.color}}>{day.pts}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:4}}>
                {day.actions.map(([action,pts],i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",background:"var(--bg2)",borderRadius:6,fontSize:12}}>
                    <span style={{color:"var(--text2)"}}>{action}</span>
                    <span style={{color:"var(--gold2)",fontWeight:600,marginLeft:8,flexShrink:0}}>{pts} Pkt</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {section==="rewards" && (
        <div>
          <div className="card mb-16">
            <div className="card-title">Individuelle War-Belohnungen (Meilensteine)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["Meilenstein","Haemmer","Tickets","Eier","Muenzen","Traenke","Winder"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:"var(--text3)",borderBottom:"1px solid var(--border)"}}>{h}</th>)}</tr></thead>
                <tbody>{INDIVIDUAL_REWARDS.map((row,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #2a180040"}}>
                    {row.map((cell,j)=><td key={j} style={{padding:"6px 10px",color:j===0?"var(--gold2)":cell==="-"?"var(--text3)":"var(--text2)"}}>{cell}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Clan War Belohnungen (nach Tier)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:"1px solid var(--border)"}}>
                    {["Tier","Pkt","","Haemmer","Muenzen","Tickets","Eier","Traenke","Winder"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:"left",color:"var(--text3)"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {WAR_REWARDS.map(w=>[
                    <tr key={w.tier+"w"} style={{background:"#22c55e08"}}>
                      <td rowSpan={2} style={{padding:"5px 8px",color:"var(--gold2)",fontWeight:600}}>{w.tier}</td>
                      <td rowSpan={2} style={{padding:"5px 8px",color:"var(--text3)",fontSize:10}}>{w.pts}</td>
                      <td style={{padding:"5px 8px",color:"#22c55e",fontSize:11}}>Sieg</td>
                      {[w.wH,w.wC,w.wT,w.wE,w.wP,w.wW].map((v,i)=><td key={i} style={{padding:"5px 8px",color:"var(--text2)"}}>{v}</td>)}
                    </tr>,
                    <tr key={w.tier+"l"} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"5px 8px",color:"#ef4444",fontSize:11}}>Niederlage</td>
                      {[w.lH,w.lC,w.lT,w.lE,w.lP,w.lW].map((v,i)=><td key={i} style={{padding:"5px 8px",color:"var(--text3)"}}>{v}</td>)}
                    </tr>
                  ])}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section==="tech" && (
        <div className="card">
          <div className="card-title">Tech Tree Kosten und Zeiten</div>
          <div style={{fontSize:13,color:"var(--text3)",marginBottom:12}}>Gilt pro Node. Jeder Node hat 5 Level pro Tier (I-V) = 25 Upgrades gesamt.</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{["Tier","Level","Rote Traenke","Zeit","Edelsteine"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:"var(--text3)",borderBottom:"1px solid var(--border)"}}>{h}</th>)}</tr></thead>
              <tbody>{TECH_DATA.map((row,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #2a180040",background:row[1]==="1/5"?"var(--bg4)":"transparent"}}>
                  {[`Tier ${row[0]}`,row[1],row[2],row[3],row[4]].map((cell,j)=><td key={j} style={{padding:"6px 10px",color:j===0?"var(--gold2)":"var(--text2)"}}>{cell}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {section==="tips" && (
        <div className="grid-2">
          {[
            {title:"Clan War Strategie",tips:[
              "Samstag = beste Punkteausbeute (alle Aktionen verfuegbar)",
              "Tech Tree Upgrades an Tag 1/4 starten - an Tag 4 abschliessen (100k Pkt)",
              "Eier an Tag 2 und 4 ausbrueten (bis 12.800 Pkt fuer Mythisch)",
              "Reittiere an Tag 3 und 5 beschworen/zusammenfuehren",
              "Sonntag: Alle 5 Tickets fuer Brawl nutzen - 1.000 Pkt beim Sieg",
            ]},
            {title:"Schmied-Tipps",tips:[
              "Schmied-Upgrade vor Schlaf/Arbeit starten",
              "Gratis-Forge % aus Tech Tree erhoeht effektive Hammeranzahl",
              "Ab Schmied Level 17+ lohnt Weltraum-Ausruestung stark",
              "Ab Level 23+ Interstellar, Level 26+ Multiversum",
              "Schmied-Ast im Tech Tree als erstes ausbauen",
              "Offline alle 3-4h sammeln (Base: 4h Maximum)",
            ]},
            {title:"Haustier/Reittier Tipps",tips:[
              "Haustiere: Ab Level 25 lohnt Legendaer-Chance (0.02%)",
              "Warte bis 5%+ Chance fuer gewuenschte Seltenheit",
              "Fruehs: Regen-Pet nutzen fuer besseres Ueberleben",
              "Reittiere sind langfristig eine der besten Investitionen",
              "Reittiere aus Clan War, PvP Liga und Shop",
              "Schwaechere Haustiere zum Upgraden/Mergen nutzen",
            ]},
            {title:"Allgemeine Tipps",tips:[
              "Premium Pass = bestes Preis-Leistungs-Verhaeltnis",
              "Fernkampf-Waffen > Nahkampf fuer die meisten Spieler",
              "Build: Angriffsspeed + Lifesteal + Double Chance",
              "Endgame: Crit Chance + Crit Damage Kombination",
              "PvP-Tickets taeglich nutzen (Reset Mitternacht UTC)",
              "Aufstieg: Schmiede-Ast zuerst maxen fuer guenstigere Kosten",
            ]},
          ].map(({title,tips})=>(
            <div key={title} className="card">
              <div className="card-title">{title}</div>
              {tips.map((tip,i)=>(
                <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <span style={{color:"var(--gold)",flexShrink:0}}>-</span>
                  <span style={{color:"var(--text2)",lineHeight:1.5}}>{tip}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NOTES ────────────────────────────────────────────────────
function Notes({ noteList, isAdmin, db, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({title:"",content:"",pinned:false,adminOnly:false});

  async function addNote() {
    if (!form.title||!form.content) return;
    await push(ref(db,"notes"), {...form, author:user.username, createdAt:Date.now()});
    setForm({title:"",content:"",pinned:false,adminOnly:false}); setShowAdd(false);
  }

  async function deleteNote(id) { await remove(ref(db,`notes/${id}`)); }
  async function togglePin(id, pinned) { await update(ref(db,`notes/${id}`), {pinned:!pinned}); }

  const visible = noteList.filter(n => !n.adminOnly || isAdmin);
  const pinned = visible.filter(n=>n.pinned);
  const rest = visible.filter(n=>!n.pinned);

  function NoteCard({n}) {
    return (
      <div className="note-card" style={{borderColor:n.pinned?"var(--gold)40":"var(--border)"}}>
        <div className="flex-between mb-8">
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:n.pinned?"var(--gold2)":"var(--text)",display:"flex",alignItems:"center",gap:6}}>
            {n.pinned&&<span style={{color:"var(--gold2)"}}>📌</span>}
            {n.adminOnly&&<span style={{fontSize:11,color:"#ef444490"}}>🔒</span>}
            {n.title}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:11,color:"var(--text3)"}}>{n.author} · {new Date(n.createdAt).toLocaleDateString("de-DE")}</span>
            {isAdmin && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={()=>togglePin(n.id,n.pinned)}>📌</button>
                <button className="btn btn-red btn-sm" onClick={()=>deleteNote(n.id)}>🗑️</button>
              </>
            )}
          </div>
        </div>
        <div style={{fontSize:14,color:"var(--text2)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.content}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div style={{fontSize:15,color:"var(--text2)"}}>Clan-Ankündigungen, Strategien & Hinweise</div>
        {isAdmin && <button className="btn btn-gold btn-sm" onClick={()=>setShowAdd(true)}>+ Notiz</button>}
      </div>
      {!isAdmin && <div style={{padding:"10px 14px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,marginBottom:16,fontSize:13,color:"var(--text3)"}}>🔒 Nur Admins können Notizen erstellen.</div>}
      {pinned.length>0 && (
        <div className="mb-16">
          <div style={{fontSize:11,color:"var(--text3)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>📌 Angeheftet</div>
          {pinned.map(n=><NoteCard key={n.id} n={n}/>)}
        </div>
      )}
      {rest.length>0 && (
        <div>
          <div style={{fontSize:11,color:"var(--text3)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>📋 Alle Notizen</div>
          {rest.map(n=><NoteCard key={n.id} n={n}/>)}
        </div>
      )}
      {visible.length===0 && (
        <div className="card" style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div className="text-muted">Noch keine Notizen vorhanden</div>
        </div>
      )}

      {showAdd && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">📝 Neue Notiz</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Titel *</label><input className="inp" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Titel der Notiz"/></div>
              <div><label className="lbl">Inhalt *</label><textarea className="inp" rows={5} value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} placeholder="Inhalt…"/></div>
              <div style={{display:"flex",gap:16}}>
                <label style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer",fontSize:14}}>
                  <input type="checkbox" checked={form.pinned} onChange={e=>setForm(p=>({...p,pinned:e.target.checked}))}/>📌 Anheften
                </label>
                <label style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer",fontSize:14}}>
                  <input type="checkbox" checked={form.adminOnly} onChange={e=>setForm(p=>({...p,adminOnly:e.target.checked}))}/>🔒 Nur Admins
                </label>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Abbrechen</button>
              <button className="btn btn-gold" onClick={addNote}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MESSAGES ─────────────────────────────────────────────────
function Messages({ messages, currentUser, accountList, db }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [text, setText] = useState("");
  const msgList = Object.entries(messages).map(([id,m])=>({id,...m}));

  // Konversationen: alle User mit denen ich Nachrichten habe
  const conversations = {};
  msgList.forEach(m => {
    const other = m.from===currentUser.username ? m.to : m.from;
    if (m.from===currentUser.username || m.to===currentUser.username) {
      if (!conversations[other]) conversations[other] = [];
      conversations[other].push(m);
    }
  });

  // Alle anderen User für neue Konversation
  const otherUsers = accountList
    .filter(a => a.username !== currentUser.username)
    .sort((a,b) => a.username.localeCompare(b.username));

  // Nachrichten der aktuellen Konversation
  const currentMsgs = selectedUser
    ? (conversations[selectedUser]||[]).sort((a,b)=>a.createdAt-b.createdAt)
    : [];

  // Ungelesene markieren als gelesen
  useEffect(() => {
    if (!selectedUser) return;
    msgList.forEach(m => {
      if (m.to===currentUser.username && m.from===selectedUser && !m.read) {
        update(ref(db,`messages/${m.id}`), {read:true});
      }
    });
  }, [selectedUser, messages]);

  async function sendMsg() {
    if (!text.trim() || !selectedUser) return;
    await push(ref(db,"messages"), {
      from: currentUser.username,
      to: selectedUser,
      text: text.trim(),
      createdAt: Date.now(),
      read: false,
    });
    setText("");
  }

  function unreadFrom(username) {
    return msgList.filter(m=>m.from===username&&m.to===currentUser.username&&!m.read).length;
  }

  const lastMsg = (username) => {
    const msgs = (conversations[username]||[]).sort((a,b)=>b.createdAt-a.createdAt);
    return msgs[0];
  };

  // Alle User die eine Konversation haben + Rest
  const convUsers = Object.keys(conversations).sort((a,b)=>{
    const la = lastMsg(a)?.createdAt||0;
    const lb = lastMsg(b)?.createdAt||0;
    return lb-la;
  });

  return (
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,height:"calc(100vh - 200px)",minHeight:400}}>
      {/* Sidebar */}
      <div className="card" style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",fontFamily:"'Cinzel',serif",fontSize:12,color:"var(--gold2)",letterSpacing:1}}>
          💬 NACHRICHTEN
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {/* Neue Konversation */}
          <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)"}}>
            <select className="inp" style={{fontSize:12,padding:"5px 8px"}} value="" onChange={e=>{ if(e.target.value) setSelectedUser(e.target.value); }}>
              <option value="">+ Neue Nachricht…</option>
              {otherUsers.map(u=><option key={u.id} value={u.username}>{u.username}</option>)}
            </select>
          </div>
          {/* Konversationsliste */}
          {convUsers.length===0 && (
            <div style={{padding:"20px 16px",fontSize:13,color:"var(--text3)",textAlign:"center"}}>
              Noch keine Nachrichten.<br/>Wähle oben einen Spieler aus.
            </div>
          )}
          {convUsers.map(username=>{
            const unread = unreadFrom(username);
            const last = lastMsg(username);
            const isSelected = selectedUser===username;
            return (
              <div key={username} onClick={()=>setSelectedUser(username)}
                style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid var(--border)",background:isSelected?"var(--bg4)":"transparent",borderLeft:isSelected?"3px solid var(--gold2)":"3px solid transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <span style={{fontWeight:600,fontSize:13,color:isSelected?"var(--gold2)":"var(--text)"}}>{username}</span>
                  {unread>0 && <span style={{background:"var(--gold2)",color:"#000",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:700}}>{unread}</span>}
                </div>
                {last && <div style={{fontSize:11,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {last.from===currentUser.username?"Du: ":""}{last.text}
                </div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Bereich */}
      <div className="card" style={{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {!selectedUser ? (
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"var(--text3)"}}>
            <div style={{fontSize:40}}>💬</div>
            <div style={{fontSize:14}}>Wähle einen Spieler aus um eine Nachricht zu schreiben</div>
          </div>
        ) : (<>
          {/* Header */}
          <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"var(--bg4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
              {RANK_ICONS[accountList.find(a=>a.username===selectedUser)?.role]||"⚒️"}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{selectedUser}</div>
              <div style={{fontSize:11,color:"var(--text3)"}}>
                {accountList.find(a=>a.username===selectedUser)?.role||""}
              </div>
            </div>
          </div>

          {/* Nachrichten */}
          <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
            {currentMsgs.length===0 && (
              <div style={{textAlign:"center",color:"var(--text3)",fontSize:13,marginTop:20}}>
                Noch keine Nachrichten. Schreib etwas!
              </div>
            )}
            {currentMsgs.map(m=>{
              const isMe = m.from===currentUser.username;
              return (
                <div key={m.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
                  <div style={{
                    maxWidth:"75%",padding:"8px 12px",borderRadius:isMe?"12px 12px 4px 12px":"12px 12px 12px 4px",
                    background:isMe?"linear-gradient(135deg,var(--gold),#8a5c00)":"var(--bg4)",
                    color:isMe?"#000":"var(--text)",
                    fontSize:14,lineHeight:1.5,
                    border:isMe?"none":"1px solid var(--border)"
                  }}>
                    <div>{m.text}</div>
                    <div style={{fontSize:10,marginTop:4,opacity:.6,textAlign:"right"}}>
                      {new Date(m.createdAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}
                      {isMe && <span style={{marginLeft:4}}>{m.read?"✓✓":"✓"}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:8}}>
            <input className="inp" placeholder="Nachricht schreiben…" value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMsg()}
              style={{flex:1}}/>
            <button className="btn btn-gold" onClick={sendMsg} disabled={!text.trim()} style={{flexShrink:0}}>
              Senden
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── ADMIN ────────────────────────────────────────────────────
function Admin({ accounts, memberList, db, currentUser, wars }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({username:"",password:"",role:"R5"});
  const [editId, setEditId] = useState(null);
  const [settings, setSettings] = useState({clanName:"GERXY",announcement:""});
  const [localSettings, setLocalSettings] = useState({clanName:"GERXY",announcement:""});
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db,"settings"), s => { if(s.val()){setSettings(s.val());setLocalSettings(s.val());} });
    return () => unsub();
  }, []);

  const accList = Object.entries(accounts).map(([id,a])=>({id,...a}));

  async function addAccount() {
    if (!form.username||!form.password) return;
    if (accList.find(a=>a.username.toLowerCase()===form.username.toLowerCase())) { alert("Benutzername bereits vergeben (auch mit anderer Schreibweise)!"); return; }
    const hashed = await hashPw(form.password);
    await push(ref(db,"accounts"), {username:form.username,passwordHash:hashed,role:form.role});
    setForm({username:"",password:"",role:"R5"}); setShowAdd(false);
  }

  async function deleteAccount(id) {
    if (id===currentUser.id) { alert("Du kannst dein eigenes Konto nicht löschen!"); return; }
    await remove(ref(db,`accounts/${id}`));
  }

  async function changeRole(id, role) {
    await update(ref(db,`accounts/${id}`), {role});
    setEditId(null);
  }

  async function saveSettings() {
    await set(ref(db,"settings"), localSettings);
    setSettingsSaved(true); setTimeout(()=>setSettingsSaved(false),2000);
  }

  async function resetWeeklyPoints() {
    const mems = memberList;
    for (const m of mems) {
      await update(ref(db,`members/${m.id}`), {weeklyPoints:0});
    }
    setShowReset(false);
  }

  // Bereinigt doppelte Namen in allen Wars (Groß/Kleinschreibung)
  async function cleanupNames() {
    const warSnap = Object.entries(wars).map(([id,w])=>({id,...w}));
    let fixed = 0;
    for (const war of warSnap) {
      if (!war.memberPoints) continue;
      const normalized = {};
      let changed = false;
      Object.entries(war.memberPoints).forEach(([name, val]) => {
        // Finde den richtigen Account-Namen
        const matchedAccount = accList.find(a => a.username.toLowerCase()===name.toLowerCase());
        const finalName = matchedAccount ? matchedAccount.username : name;
        if (finalName !== name) changed = true;
        normalized[finalName] = (normalized[finalName]||0) + (Number(val)||0);
      });
      if (changed || Object.keys(normalized).length !== Object.keys(war.memberPoints).length) {
        const ourTotal = Object.values(normalized).reduce((s,v)=>s+Number(v),0);
        await update(ref(db,`wars/${war.id}`), {memberPoints:normalized, ourPoints:ourTotal});
        fixed++;
      }
    }
    alert(`Bereinigung abgeschlossen! ${fixed} War(s) wurden korrigiert.`);
  }

  const PERMS = {
    "Anführer":   ["✅ Alles","✅ Accounts verwalten","✅ Einstellungen","✅ Wars & Mitglieder"],
    "Kommandant": ["✅ Alles","✅ Accounts verwalten","✅ Einstellungen","✅ Wars & Mitglieder"],
    "Hauptmann":  ["✅ Alles","✅ Accounts verwalten","✅ Einstellungen","✅ Wars & Mitglieder"],
    "R1":["❌ Accounts","❌ Einstellungen","❌ Wars","👁️ Nur lesen"],
    "R2":["❌ Accounts","❌ Einstellungen","❌ Wars","👁️ Nur lesen"],
    "R3":["❌ Accounts","❌ Einstellungen","❌ Wars","👁️ Nur lesen"],
    "R4":["❌ Accounts","❌ Einstellungen","❌ Wars","👁️ Nur lesen"],
    "R5":["❌ Accounts","❌ Einstellungen","❌ Wars","👁️ Nur lesen"],
  };

  return (
    <div>
      <div className="grid-2">
        {/* Settings */}
        <div className="card">
          <div className="card-title">⚙️ Clan-Einstellungen</div>
          <div style={{display:"grid",gap:12}}>
            <div><label className="lbl">Clan-Name</label><input className="inp" value={localSettings.clanName||""} onChange={e=>setLocalSettings(p=>({...p,clanName:e.target.value}))}/></div>
            <div><label className="lbl">Ankündigung (Dashboard)</label><textarea className="inp" rows={3} value={localSettings.announcement||""} onChange={e=>setLocalSettings(p=>({...p,announcement:e.target.value}))}/></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="btn btn-gold" onClick={saveSettings}>💾 Speichern</button>
              {settingsSaved && <span style={{color:"#22c55e",fontSize:13}}>✅ Gespeichert!</span>}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{borderColor:"#ef444440"}}>
          <div className="card-title" style={{color:"#ef4444"}}>⚠️ Aktionen</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>Wöchentliche Punkte zurücksetzen</div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:10}}>Setzt die Wochenpunkte aller Mitglieder auf 0 (Gesamtpunkte bleiben erhalten).</div>
            <button className="btn btn-red" onClick={()=>setShowReset(true)}>🔄 Wochenpunkte reset</button>
          </div>
          <hr style={{border:"none",borderTop:"1px solid #3a200040",margin:"16px 0"}}/>
          <div>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>Namen bereinigen</div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:10}}>
              Führt doppelte Namen in allen Wars zusammen (z.B. friskydogbreath + Friskydogbreath → Friskydogbreath). Einmalig ausführen um alte Daten zu korrigieren.
            </div>
            <button className="btn btn-ghost" style={{borderColor:"#f59e0b40",color:"#f59e0b"}} onClick={cleanupNames}>🔧 Namen bereinigen</button>
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="card mt-20">
        <div className="flex-between mb-16">
          <div className="card-title" style={{marginBottom:0}}>👥 Account-Verwaltung</div>
          <button className="btn btn-gold btn-sm" onClick={()=>setShowAdd(true)}>+ Account</button>
        </div>
        {accList.map(acc=>(
          <div key={acc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"var(--bg2)",border:`1px solid ${RANK_COLORS[acc.role]||"#5a3a00"}30`,borderRadius:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`${RANK_COLORS[acc.role]||"#5a3a00"}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:`1.5px solid ${RANK_COLORS[acc.role]||"#5a3a00"}50`,flexShrink:0}}>
              {RANK_ICONS[acc.role]||"⚒️"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600}}>{acc.username} {acc.id===currentUser.id&&<span style={{fontSize:11,color:"#22c55e90"}}>(Du)</span>}</div>
              {editId===acc.id ? (
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  <select className="inp" style={{maxWidth:150}} defaultValue={acc.role} onChange={e=>changeRole(acc.id,e.target.value)}>
                    {ALL_RANKS.map(r=><option key={r}>{r}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setEditId(null)}>✕</button>
                </div>
              ) : (
                <span className="rank-badge" style={{marginTop:3,color:RANK_COLORS[acc.role]||"#c88500",borderColor:`${RANK_COLORS[acc.role]||"#c88500"}40`,background:`${RANK_COLORS[acc.role]||"#c88500"}10`}}>
                  {acc.role}
                </span>
              )}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setEditId(acc.id)}>🔑 Rolle</button>
              {acc.id!==currentUser.id&&<button className="btn btn-red btn-sm" onClick={()=>deleteAccount(acc.id)}>🗑️</button>}
            </div>
          </div>
        ))}
        {accList.length===0 && <div className="text-muted text-sm">Noch keine Accounts</div>}
      </div>

      {/* Role Overview */}
      <div className="card mt-20">
        <div className="card-title">🔑 Rechte-Übersicht</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {Object.entries(PERMS).map(([role,perms])=>(
            <div key={role} style={{padding:"12px",background:"var(--bg2)",borderRadius:8,border:`1px solid ${RANK_COLORS[role]||"#5a3a00"}30`}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:RANK_COLORS[role]||"var(--gold2)",marginBottom:6}}>{RANK_ICONS[role]} {role}</div>
              {perms.map((p,i)=><div key={i} style={{fontSize:11,color:p.startsWith("✅")?"#22c55e80":p.startsWith("👁️")?"var(--gold)80":"#ef444480",marginBottom:2}}>{p}</div>)}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">👤 Account erstellen</div>
            <div style={{style:"grid",gap:12}}>
              <div className="mb-12"><label className="lbl">Benutzername *</label><input className="inp" value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} placeholder="Spielername"/></div>
              <div className="mb-12"><label className="lbl">Passwort *</label><input className="inp" type="text" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Passwort festlegen"/></div>
              <div className="mb-16"><label className="lbl">Rolle</label>
                <select className="inp" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
                  {ALL_RANKS.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{padding:"10px 12px",background:"#2a180060",border:"1px solid var(--border)",borderRadius:8,fontSize:12,color:"var(--text3)"}}>
                💡 Das Passwort wird verschlüsselt gespeichert. Teile die Zugangsdaten direkt mit dem Mitglied.
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Abbrechen</button>
              <button className="btn btn-gold" onClick={addAccount}>Erstellen</button>
            </div>
          </div>
        </div>
      )}

      {showReset && (
        <div className="overlay">
          <div className="modal" style={{maxWidth:400,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#ef4444",marginBottom:12}}>Wochenpunkte zurücksetzen?</div>
            <div style={{fontSize:14,color:"var(--text2)",marginBottom:20}}>Die Wochenpunkte aller {memberList.length} Mitglieder werden auf 0 gesetzt. Gesamtpunkte bleiben erhalten.</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn btn-ghost" onClick={()=>setShowReset(false)}>Abbrechen</button>
              <button className="btn btn-red" onClick={resetWeeklyPoints}>✅ Ja, zurücksetzen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
