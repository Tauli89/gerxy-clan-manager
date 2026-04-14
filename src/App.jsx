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
  { day:"Dienstag",  mult:1,  actions:["Schmieden (Primitiv/Mittelalt/Frühneuzeit): 1 Pkt","Schmieden (Modern/Weltraum/Interstellar): 2 Pkt","Schmieden (Unterwelt): 2 Pkt","Schmieden (Multiversum/Quanten/Göttlich): 3 Pkt","Tech Tree I: 300 | II: 7.5k | III: 20k | IV: 35k | V: 62k","Skill-Upgrades: 50–175 Pkt"] },
  { day:"Mittwoch",  mult:2,  actions:["1.000 Münzen für Schmiede: 10 Pkt","Schmied-Upgrade starten/abschließen: 10.000 Pkt","Dungeon-Schlüssel nutzen: 1.000 Pkt","Eier ausbrüten: 250–16.000 Pkt","Haustiere zusammenführen: 50–3.200 Pkt"] },
  { day:"Donnerstag",mult:3,  actions:["Alle Schmied-Aktionen","Skill-Upgrades: 50–175 Pkt","Mount-Beschwörungen: 400–3.000 Pkt"] },
  { day:"Freitag",   mult:4,  actions:["1.000 Münzen für Schmiede: 10 Pkt","Schmied-Upgrade starten/abschließen: 10.000 Pkt","Tech Tree Upgrades (I–V)","Eier ausbrüten & Haustiere zusammenführen"] },
  { day:"Samstag",   mult:5,  actions:["Alle Schmied-Aktionen","Dungeon-Schlüssel nutzen: 1.000 Pkt","Mount-Beschwörungen & Zusammenführungen"] },
  { day:"Sonntag",   mult:2,  actions:["Rivalen besiegen: 1–50 Pkt","All-Out Brawl gewinnen: 1.000 Pkt","5 Tickets zu Beginn, Reset nach allen Niederlagen"] },
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
    const found = accList.find(a => a.username===username && a.passwordHash===hashed);
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

  if (!user) return <><style>{CSS}</style><LoginScreen onLogin={login} onRegister={register} accounts={accounts} loading={loading}/></>;

  const memberList = Object.entries(members).map(([id,m])=>({id,...m}));
  const warList = Object.entries(wars).map(([id,w])=>({id,...w})).sort((a,b)=>b.dateFrom?.localeCompare(a.dateFrom));
  const noteList = Object.entries(notes).map(([id,n])=>({id,...n})).sort((a,b)=>b.createdAt-a.createdAt);
  const [messages, setMessages] = useState({});

  useEffect(() => {
    const unsub = onValue(ref(db,"messages"), s => setMessages(s.val()||{}));
    return () => unsub();
  }, []);

  // Ungelesene Nachrichten zählen
  const unreadCount = Object.values(messages).filter(m =>
    m.to === user.username && !m.read
  ).length;

  const tabs = [
    {id:"dashboard",label:"⚔️ Dashboard"},
    {id:"members",label:"👥 Mitglieder"},
    {id:"war",label:"🏆 Clan War"},
    {id:"mypage",label:"📊 Meine Seite"},
    {id:"notes",label:"📋 Notizen"},
    {id:"messages",label:`💬 Nachrichten${unreadCount>0?` (${unreadCount})`:""}` },
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
                <button className="btn btn-ghost btn-sm" onClick={logout}>🚪</button>
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
            {tab==="mypage" && <MyPage user={user} memberList={memberList} db={db}/>}
            {tab==="notes" && <Notes noteList={noteList} isAdmin={isAdmin} db={db} user={user}/>}
            {tab==="messages" && <Messages messages={messages} currentUser={user} accountList={Object.entries(accounts).map(([id,a])=>({id,...a}))} db={db}/>}
            {tab==="admin" && isAdmin && <Admin accounts={accounts} memberList={memberList} db={db} currentUser={user} members={members}/>}
          </div>
        )}
      </div>
    </>
  );
}

// ── LOGIN ────────────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister, accounts, loading }) {
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
    if (accList.find(a => a.username.toLowerCase() === user.toLowerCase())) {
      setErr("Dieser Benutzername ist bereits vergeben."); return;
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
  const maxPoints = Math.max(...memberList.map(m=>Number(m.weeklyPoints)||0), 1);

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
              {warStatus.isActive ? `🔥 AKTIV — ${warStatus.todayInfo?.day} (${warStatus.todayInfo?.mult}x Multiplikator)` : "⏳ Nächster War startet in"}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="war-time">{fmtCountdown(Math.max(0,ms))}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>bis {warStatus.isActive?"Kriegsende":"Kriegsbeginn (Dienstag UTC)"}</div>
          </div>
        </div>
        {warStatus.isActive && warStatus.todayInfo && (
          <div style={{marginTop:8}}>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:6,letterSpacing:1}}>HEUTIGE AKTIONEN:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {warStatus.todayInfo.actions.map((a,i) => (
                <span key={i} style={{fontSize:12,padding:"3px 8px",background:"#c8850a15",border:"1px solid #c8850a30",borderRadius:6,color:"var(--text2)"}}>{a}</span>
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
          <div className="card-title">🥇 Top Wochenpunkte</div>
          {[...memberList].sort((a,b)=>(Number(b.weeklyPoints)||0)-(Number(a.weeklyPoints)||0)).slice(0,8).map((m,i)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{fontSize:16,width:24,textAlign:"center",flexShrink:0}}>{["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"][i]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{RANK_ICONS[m.rank]} {m.name}</span>
                  <span style={{color:"var(--gold2)",fontSize:13,flexShrink:0,marginLeft:8}}>{fmt(m.weeklyPoints||0)}</span>
                </div>
                <div className="pbar"><div className="pfill" style={{width:`${((Number(m.weeklyPoints)||0)/maxPoints)*100}%`}}/></div>
              </div>
            </div>
          ))}
          {memberList.length===0 && <div className="text-muted text-sm">Noch keine Mitglieder</div>}
        </div>
        <div className="card">
          <div className="card-title">📅 War-Tagesplan</div>
          {WAR_DAYS.map((wd,i)=>{
            const isToday = warStatus.isActive && warStatus.warDayIndex===i;
            return (
              <div key={i} className="war-day-card" style={{borderColor:isToday?"var(--gold)":"var(--border)",background:isToday?"#c8850a15":"var(--bg2)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontFamily:"'Cinzel',serif",color:isToday?"var(--gold2)":"var(--text2)"}}>{isToday?"🔥 ":""}{wd.day}</span>
                  <span style={{padding:"2px 8px",borderRadius:12,background:"#c8850a20",color:"var(--gold)",fontSize:11,fontFamily:"'Cinzel',serif"}}>{wd.mult}x Mult.</span>
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
  const [expandedWar, setExpandedWar] = useState(null);
  const [editingPoints, setEditingPoints] = useState({}); // warId -> {username -> points}
  const [form, setForm] = useState({opponent:"",result:"Sieg",theirPoints:"",dateFrom:today,dateTo:today,note:""});
  const warStatus = getWarStatus();
  const [ms, setMs] = useState(warStatus.msLeft);
  useEffect(() => { setMs(prev => prev-1000); }, [timer]);

  const wins = warList.filter(w=>w.result==="Sieg").length;
  const winrate = warList.length ? Math.round((wins/warList.length)*100) : 0;

  // Gesamtpunkte pro Mitglied über alle Wars
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
      ...form,
      theirPoints: Number(form.theirPoints)||0,
      memberPoints,
      ourPoints: 0,
    });
    setForm({opponent:"",result:"Sieg",theirPoints:"",dateFrom:today,dateTo:today,note:""});
    setShowAdd(false);
  }

  async function deleteWar(id) { await remove(ref(db,`wars/${id}`)); }

  async function savePoints(warId) {
    const pts = editingPoints[warId] || {};
    const updates = {};
    Object.entries(pts).forEach(([name, val]) => {
      updates[name] = Number(val)||0;
    });
    // Merge with existing
    const war = warList.find(w=>w.id===warId);
    const merged = {...(war?.memberPoints||{}), ...updates};
    const ourTotal = Object.values(merged).reduce((s,v)=>s+Number(v),0);
    await update(ref(db,`wars/${warId}`), { memberPoints: merged, ourPoints: ourTotal });
    setEditingPoints(p=>({...p,[warId]:undefined}));
  }

  function startEditing(war) {
    setEditingPoints(p=>({...p,[war.id]: {...(war.memberPoints||{})}}));
    setExpandedWar(war.id);
  }

  return (
    <div>
      {/* Timer Banner */}
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

      {/* Stats */}
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
        {/* War Liste */}
        <div>
          <div className="flex-between mb-12">
            <div className="card-title" style={{marginBottom:0}}>⚔️ War-Historie</div>
            {isAdmin && <button className="btn btn-gold btn-sm" onClick={()=>setShowAdd(true)}>+ War</button>}
          </div>

          {warList.length===0 && <div className="card"><div className="text-muted text-sm">Noch keine Wars eingetragen</div></div>}

          {warList.map(w=>{
            const isExpanded = expandedWar===w.id;
            const editing = editingPoints[w.id];
            const members = accountList.map(a=>a.username);
            const pts = editing || w.memberPoints || {};
            const sortedMembers = [...members].sort((a,b)=>(Number(pts[b]||0))-(Number(pts[a]||0)));

            return (
              <div key={w.id} style={{background:"var(--bg3)",border:`1px solid ${w.result==="Sieg"?"#22c55e20":"#ef444420"}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
                {/* War Header */}
                <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpandedWar(isExpanded?null:w.id)}>
                  <div style={{fontSize:24,flexShrink:0}}>{w.result==="Sieg"?"🏆":"💀"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:15}}>vs. {w.opponent}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>
                      {w.dateFrom}{w.dateTo&&w.dateTo!==w.dateFrom?` → ${w.dateTo}`:""}
                    </div>
                    {w.note && <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>📝 {w.note}</div>}
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{color:"var(--gold2)",fontWeight:600,fontSize:16}}>{fmt(w.ourPoints||0)}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>vs {fmt(w.theirPoints||0)}</div>
                  </div>
                  <span style={{padding:"4px 10px",borderRadius:16,fontSize:12,background:w.result==="Sieg"?"#22c55e20":"#ef444420",color:w.result==="Sieg"?"#22c55e":"#ef4444",border:`1px solid ${w.result==="Sieg"?"#22c55e":"#ef4444"}`,flexShrink:0}}>
                    {w.result==="Sieg"?"SIEG":"NIE."}
                  </span>
                  <span style={{color:"var(--text3)",fontSize:12,flexShrink:0}}>{isExpanded?"▲":"▼"}</span>
                </div>

                {/* Expanded: Mitglieder-Punkte */}
                {isExpanded && (
                  <div style={{borderTop:"1px solid var(--border)",padding:"14px 16px"}}>
                    <div className="flex-between mb-12">
                      <div style={{fontSize:12,color:"var(--text3)",letterSpacing:1,textTransform:"uppercase"}}>Punkte der Mitglieder</div>
                      <div style={{display:"flex",gap:6}}>
                        {isAdmin && !editing && <button className="btn btn-ghost btn-sm" onClick={()=>startEditing(w)}>✏️ Bearbeiten</button>}
                        {isAdmin && editing && <button className="btn btn-gold btn-sm" onClick={()=>savePoints(w.id)}>💾 Speichern</button>}
                        {isAdmin && editing && <button className="btn btn-ghost btn-sm" onClick={()=>setEditingPoints(p=>({...p,[w.id]:undefined}))}>✕</button>}
                        {isAdmin && <button className="btn btn-red btn-sm" onClick={()=>deleteWar(w.id)}>🗑️</button>}
                      </div>
                    </div>
                    {sortedMembers.map(name=>{
                      const p = editing ? (editing[name]||"") : (w.memberPoints?.[name]||0);
                      const maxP = Math.max(...sortedMembers.map(n=>Number(pts[n]||0)),1);
                      return (
                        <div key={name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:130,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{name}</div>
                          {editing ? (
                            <input className="inp" type="number" value={editing[name]||""} placeholder="0"
                              onChange={e=>setEditingPoints(prev=>({...prev,[w.id]:{...prev[w.id],[name]:e.target.value}}))}
                              style={{maxWidth:110,padding:"4px 8px",fontSize:13}}/>
                          ) : (
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                                <span style={{fontSize:12,color:"var(--text3)"}}></span>
                                <span style={{color:"var(--gold2)",fontSize:13,fontWeight:600}}>{fmt(Number(p)||0)}</span>
                              </div>
                              <div className="pbar"><div className="pfill" style={{width:`${(Number(p)||0)/maxP*100}%`}}/></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{marginTop:10,padding:"8px 12px",background:"var(--bg2)",borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:13}}>
                      <span style={{color:"var(--text3)"}}>Gesamt unsere Punkte:</span>
                      <span style={{color:"var(--gold2)",fontWeight:600}}>{fmt(w.ourPoints||0)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Gesamtpunkte Ranking über alle Wars */}
        <div className="card">
          <div className="card-title">🏅 Gesamtpunkte Ranking (alle Wars)</div>
          {totalRanking.length===0 && <div className="text-muted text-sm">Noch keine Punkte eingetragen</div>}
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

      {/* Add War Modal */}
      {showAdd && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">⚔️ Neuer Clan War</div>
            <div style={{display:"grid",gap:12}}>
              <div><label className="lbl">Gegner-Clan *</label><input className="inp" value={form.opponent} onChange={e=>setForm(p=>({...p,opponent:e.target.value}))} placeholder="Clan-Name"/></div>
              <div className="grid-2">
                <div><label className="lbl">Von (Datum)</label><input className="inp" type="date" value={form.dateFrom} onChange={e=>setForm(p=>({...p,dateFrom:e.target.value}))}/></div>
                <div><label className="lbl">Bis (Datum)</label><input className="inp" type="date" value={form.dateTo} onChange={e=>setForm(p=>({...p,dateTo:e.target.value}))}/></div>
              </div>
              <div><label className="lbl">Gegner-Gesamtpunkte</label><input className="inp" type="number" value={form.theirPoints} onChange={e=>setForm(p=>({...p,theirPoints:e.target.value}))} placeholder="0"/></div>
              <div><label className="lbl">Ergebnis</label>
                <select className="inp" value={form.result} onChange={e=>setForm(p=>({...p,result:e.target.value}))}>
                  <option>Sieg</option><option>Niederlage</option>
                </select>
              </div>
              <div><label className="lbl">Notiz</label><textarea className="inp" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={{minHeight:60}}/></div>
              <div style={{padding:"10px 14px",background:"var(--bg2)",borderRadius:8,fontSize:12,color:"var(--text3)"}}>
                💡 Nach dem Erstellen kannst du auf den War klicken und die Punkte jedes Mitglieds eintragen. Unsere Gesamtpunkte werden automatisch berechnet.
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
function MyPage({ user, memberList, db }) {
  const myData = memberList.find(m => m.name?.toLowerCase()===user.username?.toLowerCase()) || {};
  const [forgeLevel, setForgeLevel] = useState(10);
  const [freeForge, setFreeForge] = useState(0);
  const [hammers, setHammers] = useState(100);
  const [calcResult, setCalcResult] = useState(null);
  const [myNote, setMyNote] = useState(myData.personalNote||"");
  const [noteSaved, setNoteSaved] = useState(false);

  const FORGE_COSTS = [0,400,700,1500,3500,10000,25000,50000,33300*3,50000*3,83300*3,112000*3,113000*4,153000*4,166000*5,224000*5,252000*6,291000*7,344000*8,413000*9,502000*10];

  function calcWarPoints() {
    const pointsPerHammer = forgeLevel >= 20 ? 3 : forgeLevel >= 12 ? 2.5 : forgeLevel >= 7 ? 2 : 1.2;
    const effectiveHammers = hammers * (1 + freeForge/100);
    const expected = Math.round(effectiveHammers * pointsPerHammer);
    const low = Math.round(expected * 0.7);
    const high = Math.round(expected * 1.3);
    setCalcResult({ expected, low, high, effectiveHammers: Math.round(effectiveHammers) });
  }

  async function saveNote() {
    const m = memberList.find(m2 => m2.name?.toLowerCase()===user.username?.toLowerCase());
    if (m) { await update(ref(db,`members/${m.id}`), {personalNote:myNote}); setNoteSaved(true); setTimeout(()=>setNoteSaved(false),2000); }
  }

  const forgeCost = FORGE_COSTS[forgeLevel] || 0;

  return (
    <div>
      <div style={{marginBottom:20,padding:"14px 18px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:`${RANK_COLORS[myData.rank||user.role]||"#5a3a00"}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,border:`2px solid ${RANK_COLORS[myData.rank||user.role]||"#5a3a00"}50`}}>
          {RANK_ICONS[myData.rank||user.role]||"⚒️"}
        </div>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"var(--gold2)"}}>{user.username}</div>
          <span className="rank-badge" style={{color:RANK_COLORS[myData.rank||user.role]||"#c88500",borderColor:`${RANK_COLORS[myData.rank||user.role]||"#c88500"}40`,background:`${RANK_COLORS[myData.rank||user.role]||"#c88500"}10`}}>
            {myData.rank||user.role}
          </span>
        </div>
        {myData.weeklyPoints && (
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{color:"var(--gold2)",fontSize:20,fontWeight:600}}>{fmt(myData.weeklyPoints)}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>Wochenpunkte</div>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Forge War Points Calculator */}
        <div className="card">
          <div className="card-title">⚒️ War-Punkte Kalkulator</div>
          <div style={{display:"grid",gap:12}}>
            <div>
              <label className="lbl">Schmied-Level ({forgeLevel})</label>
              <input type="range" min={1} max={35} value={forgeLevel} onChange={e=>setForgeLevel(Number(e.target.value))} style={{width:"100%",accentColor:"var(--gold2)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)"}}>
                <span>1</span><span style={{color:"var(--gold2)"}}>{forgeLevel}</span><span>35</span>
              </div>
            </div>
            <div><label className="lbl">Gratis-Schmiede % ({freeForge}%)</label>
              <input type="range" min={0} max={50} value={freeForge} onChange={e=>setFreeForge(Number(e.target.value))} style={{width:"100%",accentColor:"var(--gold2)"}}/>
            </div>
            <div><label className="lbl">Verfügbare Hämmer</label>
              <input className="inp" type="number" value={hammers} onChange={e=>setHammers(Number(e.target.value))}/></div>
            <button className="btn btn-gold" onClick={calcWarPoints} style={{justifyContent:"center"}}>🔢 Berechnen</button>
          </div>
          {calcResult && (
            <div className="calc-result">
              <div className="calc-row"><span>Effektive Hämmer</span><span>{calcResult.effectiveHammers}</span></div>
              <div className="calc-row"><span>Erwartete Punkte</span><span style={{color:"var(--gold2)"}}>{fmt(calcResult.expected)}</span></div>
              <div className="calc-row"><span>Spanne</span><span>{fmt(calcResult.low)} – {fmt(calcResult.high)}</span></div>
            </div>
          )}
          {forgeCost>0 && (
            <div style={{marginTop:12,padding:"8px 12px",background:"var(--bg2)",borderRadius:8,fontSize:13,color:"var(--text2)"}}>
              💰 Nächstes Upgrade (Lvl {forgeLevel}→{forgeLevel+1}): ca. {fmt(forgeCost)} Münzen
            </div>
          )}
        </div>

        {/* Game Tips */}
        <div className="card">
          <div className="card-title">💡 Tipps & Strategie</div>
          <div style={{display:"grid",gap:8,fontSize:13,lineHeight:1.6}}>
            {[
              ["⚡","Offline alle 3–4h sammeln (max. 4h Base)"],
              ["🔨","Schmied-Timer vor Schlaf/Arbeit starten"],
              ["🎯","Beste Dungeons: Hammer Thief (tgl.), Invasion (Pets)"],
              ["📅","Ressourcen für War-Tage sparen (Sa = 5x Multiplik.)"],
              ["🐾","Früh Regen-Pet nutzen für Überleben"],
              ["⚔️","Angriffsspeed + Lifesteal + Double Chance priorisieren"],
              ["🏰","Premium Pass = bestes Preis-Leistungs-Verhältnis"],
              ["🎲","Skill-Tickets nur wenn die gewünschte Seltenheit steigt"],
              ["🚀","Fernkampf-Waffen > Nahkampf für die meisten Spieler"],
              ["🔗","Tech Tree: Schmied-Ast zuerst ausbauen"],
            ].map(([icon,tip],i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{flexShrink:0}}>{icon}</span>
                <span style={{color:"var(--text2)"}}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Personal Note */}
      <div className="card mt-20">
        <div className="card-title">📝 Meine persönlichen Notizen</div>
        <textarea className="inp" rows={5} value={myNote} onChange={e=>setMyNote(e.target.value)} placeholder="Eigene Notizen, Ziele, Build-Pläne…"/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10,gap:8,alignItems:"center"}}>
          {noteSaved && <span style={{color:"#22c55e",fontSize:13}}>✅ Gespeichert</span>}
          <button className="btn btn-gold btn-sm" onClick={saveNote}>Speichern</button>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="card mt-20">
        <div className="card-title">📖 Quick Reference</div>
        <div className="grid-2">
          <div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Zeitalter & Punkte</div>
            {[["Primitiv/Mittelalt./Früh","1 Pkt"],["Modern/Weltraum/Interstellar","2 Pkt"],["Unterwelt","2 Pkt"],["Multiversum/Quanten/Göttlich","3 Pkt"]].map(([era,pts])=>(
              <div key={era} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                <span style={{color:"var(--text2)"}}>{era}</span><span style={{color:"var(--gold2)"}}>{pts}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Tägliche Limits</div>
            {[["Offline-Timer","4h (Base)","var(--text)"],["Münzen/Sek","1","var(--gold2)"],["Hämmer/Min","1","var(--gold2)"],["PvP-Saison","Di–So UTC","var(--text)"],["IGN-Änderung","200 Gems","var(--text)"],["Max. Clan-Größe","50 Mitglieder","var(--text)"]].map(([k,v,c])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                <span style={{color:"var(--text3)"}}>{k}</span><span style={{color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
function Admin({ accounts, memberList, db, currentUser }) {
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
    if (accList.find(a=>a.username===form.username)) { alert("Benutzername bereits vergeben!"); return; }
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
