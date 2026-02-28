import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const DIFFICULTIES = [
  { id: 0, label: "Easy",    pts: 10,  penalty: 80  },
  { id: 1, label: "Medium",  pts: 20,  penalty: 60  },
  { id: 2, label: "Hard",    pts: 50,  penalty: 40  },
  { id: 3, label: "Extreme", pts: 100, penalty: 20  },
];

function getRank(score) {
  if (score >= 500) return "Legendary";
  if (score >= 300) return "Excellent";
  if (score >= 150) return "Reliable";
  if (score >= 50)  return "Growing";
  if (score >= 0)   return "Starting";
  return "In Deficit";
}

function fmtEur(val) {
  const abs = Math.abs(val);
  const str = abs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (val < 0 ? "−€\u00a0" : "€\u00a0") + str;
}

function fmtDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
}

const IcoHome = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? "#1a9e8a" : "none"} stroke={on ? "#1a9e8a" : "#bbb"} strokeWidth="1.8">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
  </svg>
);
const IcoList = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? "#1a9e8a" : "#bbb"} strokeWidth="1.8">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const IcoTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

const Spinner = () => (
  <div style={{ minHeight: "100vh", background: "#f0efed", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: "28px", height: "28px", border: "2px solid #ddd", borderTopColor: "#1a9e8a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

function Heatmap({ txs }) {
  const containerRef = useRef(null);
  const [numWeeks, setNumWeeks] = useState(16);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      const dayLabelWidth = 28 + 4; // label + gap
      const cellSize = 12 + 2;      // cell + gap
      const available = width - dayLabelWidth;
      const weeks = Math.max(8, Math.floor(available / cellSize));
      setNumWeeks(weeks);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Count kept vs broken per day (ignore points)
  const dayMap = {};
  txs.forEach(tx => {
    const key = new Date(tx.created_at).toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { kept: 0, broken: 0 };
    if (tx.kept) dayMap[key].kept++;
    else dayMap[key].broken++;
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const totalDays = numWeeks * 7;
  const cells = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, day: dayMap[key] || null, d });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthLabels = [];
  weeks.forEach((week, wi) => {
    if (week[0].d.getDate() <= 7)
      monthLabels.push({ wi, label: week[0].d.toLocaleDateString("en-US", { month: "short" }) });
  });

  function cellColor(day) {
    if (!day) return "#f0efed";
    if (day.kept > 0 && day.broken === 0) return "#1a9e8a";
    if (day.broken > 0 && day.kept === 0) return "#e53535";
    // mixed day: more kept = green, more broken = red, equal = orange
    if (day.kept > day.broken) return "#1a9e8a";
    if (day.broken > day.kept) return "#e53535";
    return "#f59e0b"; // exactly equal = orange
  }

  function cellTitle(cell) {
    if (!cell.day) return cell.date;
    const { kept, broken } = cell.day;
    return `${cell.date}: ${kept} kept, ${broken} broken`;
  }
  const days = ["Mon","","Wed","","Fri","","Sun"];

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div style={{ display: "flex", marginLeft: "32px", marginBottom: "4px" }}>
        {weeks.map((_, wi) => {
          const lbl = monthLabels.find(m => m.wi === wi);
          return <div key={wi} style={{ flex: 1, fontSize: "9px", color: "#bbb", overflow: "hidden" }}>{lbl ? lbl.label : ""}</div>;
        })}
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ display: "flex", flexDirection: "column", marginRight: "4px", flexShrink: 0 }}>
          {days.map((d, i) => <div key={i} style={{ height: "12px", marginBottom: "2px", fontSize: "9px", color: "#bbb", lineHeight: "12px", width: "28px" }}>{d}</div>)}
        </div>
        <div style={{ display: "flex", gap: "2px", flex: 1 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
              {week.map((cell, di) => (
                <div key={di} title={cellTitle(cell)}
                  style={{ width: "100%", aspectRatio: "1", borderRadius: "2px", background: cellColor(cell.day) }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e) {
    e.preventDefault(); setLoading(true); setError("");
    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0efed", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "32px", fontWeight: "700", letterSpacing: "-1px", color: "#111" }}>Integrity Bank</div>
          <div style={{ fontSize: "14px", color: "#aaa", marginTop: "6px" }}>Your word. Your worth.</div>
        </div>
        <div style={{ background: "#fff", borderRadius: "24px", padding: "28px" }}>
          <form onSubmit={handleEmail}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: "100%", padding: "14px", border: "1.5px solid #e8e8e6", borderRadius: "12px", fontSize: "15px", fontFamily: "inherit", color: "#111", marginBottom: "10px", background: "#fff" }} />
            <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: "100%", padding: "14px", border: "1.5px solid #e8e8e6", borderRadius: "12px", fontSize: "15px", fontFamily: "inherit", color: "#111", marginBottom: "16px", background: "#fff" }} />
            {error && <div style={{ color: "#e53535", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "15px", border: "none", borderRadius: "14px", background: "#1a9e8a", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
              {loading ? "..." : mode === "login" ? "Einloggen" : "Account erstellen"}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              style={{ background: "none", border: "none", color: "#1a9e8a", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
              {mode === "login" ? "Noch kein Account? Registrieren" : "Schon registriert? Einloggen"}
            </button>
          </div>
        </div>
      </div>
      <style>{`input:focus { outline: none; border-color: #1a9e8a !important; }`}</style>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [txs, setTxs] = useState([]);
  const [balance, setBalance] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [tab, setTab] = useState("home");
  const [flash, setFlash] = useState(null);
  const [promise, setPromise] = useState("");
  const [diff, setDiff] = useState(1);
  const textRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setQueue([]); setTxs([]); setBalance(0); return; }
    loadData();
  }, [session]);

  async function loadData() {
    setDataLoading(true);
    const uid = session.user.id;
    const [{ data: qData }, { data: tData }] = await Promise.all([
      supabase.from("promises_queue").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);
    setQueue(qData || []); setTxs(tData || []);
    setBalance((tData || []).reduce((sum, tx) => sum + tx.pts, 0));
    setDataLoading(false);
  }

  useEffect(() => { if (tab === "add") setTimeout(() => textRef.current?.focus(), 100); }, [tab]);

  function showFlash(pts, kept) { setFlash({ pts, kept }); setTimeout(() => setFlash(null), 1500); }

  async function addToQueue() {
    if (!promise.trim()) return;
    const d = DIFFICULTIES[diff];
    const { data, error } = await supabase.from("promises_queue").insert({
      user_id: session.user.id, promise: promise.trim(),
      diff_label: d.label, diff_pts: d.pts, diff_penalty: d.penalty,
    }).select().single();
    if (!error && data) setQueue(prev => [data, ...prev]);
    setPromise(""); setDiff(1); setTab("home");
  }

  async function resolve(item, kept) {
    const pts = kept ? item.diff_pts : -item.diff_penalty;
    const [{ error: delErr }, { data: tx, error: txErr }] = await Promise.all([
      supabase.from("promises_queue").delete().eq("id", item.id),
      supabase.from("transactions").insert({
        user_id: session.user.id, promise: item.promise,
        kept, diff_label: item.diff_label, diff_pts: item.diff_pts, pts,
      }).select().single(),
    ]);
    if (!delErr && !txErr && tx) {
      setQueue(prev => prev.filter(q => q.id !== item.id));
      setTxs(prev => [tx, ...prev]);
      setBalance(prev => prev + pts);
      showFlash(pts, kept);
    }
  }

  async function removeQueue(id) {
    await supabase.from("promises_queue").delete().eq("id", id);
    setQueue(prev => prev.filter(q => q.id !== id));
  }

  async function removeTx(tx) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    setTxs(prev => prev.filter(t => t.id !== tx.id));
    setBalance(prev => prev - tx.pts);
  }

  const keptCount = txs.filter(t => t.kept).length;
  const brokenCount = txs.filter(t => !t.kept).length;
  const rate = keptCount + brokenCount > 0 ? Math.round((keptCount / (keptCount + brokenCount)) * 100) : 100;

  if (authLoading) return <Spinner />;
  if (!session) return <AuthScreen />;

  const TxRow = ({ tx, i, total }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "13px", padding: "14px 18px", borderBottom: i < total - 1 ? "1px solid #f5f4f2" : "none" }}>
      <div style={{ width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0, background: tx.pts >= 0 ? "#e8f5f3" : "#fdecea", display: "flex", alignItems: "center", justifyContent: "center", color: tx.pts >= 0 ? "#1a9e8a" : "#e53535", fontSize: "14px", fontWeight: "700" }}>
        {tx.pts >= 0 ? "↑" : "↓"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: "500", color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.promise}</div>
        <div style={{ fontSize: "11px", color: "#bbb", marginTop: "3px" }}>{tx.diff_label} · {fmtDate(tx.created_at)}</div>
      </div>
      <div style={{ fontSize: "14px", fontWeight: "600", flexShrink: 0, color: tx.pts >= 0 ? "#1a9e8a" : "#e53535" }}>{tx.pts >= 0 ? "+" : ""}{fmtEur(tx.pts)}</div>
      <button className="tap" onClick={() => removeTx(tx)} style={{ background: "none", border: "none", padding: "4px", flexShrink: 0 }}><IcoTrash /></button>
    </div>
  );

  return (
    <div style={{ fontFamily: "-apple-system,'Helvetica Neue',sans-serif", background: "#f0efed", minHeight: "100vh", maxWidth: "390px", margin: "0 auto", paddingBottom: "90px" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #f0efed; }
        textarea, input { font-family: inherit; }
        textarea:focus, input:focus { outline: none; }
        @keyframes up  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pop { 0%{opacity:1;transform:translateX(-50%) scale(1)} 60%{opacity:1;transform:translateX(-50%) translateY(-20px) scale(1.1)} 100%{opacity:0;transform:translateX(-50%) translateY(-36px) scale(0.9)} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .tap { cursor: pointer; } .tap:active { opacity: 0.55; }
      `}</style>

      {flash && (
        <div key={String(flash.pts) + Date.now()} style={{ position: "fixed", top: "32%", left: "50%", fontSize: "46px", fontWeight: "700", letterSpacing: "-2px", color: flash.kept ? "#1a9e8a" : "#e53535", pointerEvents: "none", zIndex: 999, animation: "pop 1.5s ease-out forwards" }}>
          {flash.pts > 0 ? "+" : ""}{flash.pts}
        </div>
      )}

      {tab === "home" && (
        <div style={{ animation: "up 0.25s ease-out" }}>
          <div style={{ padding: "56px 20px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", color: "#111" }}>Home</span>
            <button className="tap" onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", fontSize: "12px", color: "#bbb", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
          </div>
          {dataLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
              <div style={{ width: "24px", height: "24px", border: "2px solid #ddd", borderTopColor: "#1a9e8a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : (
            <>
              <div style={{ margin: "0 20px", background: "#fff", borderRadius: "20px", padding: "22px" }}>
                <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>Integrity Balance</div>
                <div style={{ fontSize: "38px", fontWeight: "700", letterSpacing: "-1.5px", color: balance >= 0 ? "#111" : "#e53535", lineHeight: 1 }}>{fmtEur(balance)}</div>
                <div style={{ fontSize: "13px", color: "#1a9e8a", marginTop: "10px", fontWeight: "500" }}>{getRank(balance)}</div>
              </div>
              <div style={{ margin: "12px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[{ label: "Kept", val: keptCount, color: "#1a9e8a" }, { label: "Broken", val: brokenCount, color: "#e53535" }, { label: "Rate", val: rate + "%", color: "#111" }].map(s => (
                  <div key={s.label} style={{ background: "#fff", borderRadius: "16px", padding: "14px 0", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: "10px", color: "#bbb", marginTop: "3px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {queue.length > 0 && (
                <div style={{ margin: "20px 20px 0" }}>
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "#111", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    Open Promises
                    <span style={{ fontSize: "11px", background: "#1a9e8a", color: "#fff", borderRadius: "99px", padding: "2px 8px", fontWeight: "600" }}>{queue.length}</span>
                  </div>
                  <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden" }}>
                    {queue.map((item, i) => (
                      <div key={item.id} style={{ padding: "16px 18px", borderBottom: i < queue.length - 1 ? "1px solid #f5f4f2" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                          <div style={{ flex: 1, paddingRight: "10px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "500", color: "#111", lineHeight: "1.4" }}>{item.promise}</div>
                            <div style={{ fontSize: "11px", color: "#bbb", marginTop: "4px" }}>{item.diff_label} · {fmtDate(item.created_at)}</div>
                          </div>
                          <button className="tap" onClick={() => removeQueue(item.id)} style={{ background: "none", border: "none", padding: "2px", flexShrink: 0, marginTop: "2px" }}><IcoTrash /></button>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="tap" onClick={() => resolve(item, false)} style={{ flex: 1, padding: "11px 8px", background: "#fff3f3", border: "1.5px solid #fca5a5", borderRadius: "12px", color: "#e53535", fontSize: "13px", fontWeight: "600", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            Broke it <span style={{ opacity: 0.65, fontSize: "12px" }}>−{item.diff_penalty}</span>
                          </button>
                          <button className="tap" onClick={() => resolve(item, true)} style={{ flex: 1, padding: "11px 8px", background: "#1a9e8a", border: "none", borderRadius: "12px", color: "#fff", fontSize: "13px", fontWeight: "600", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            Kept it <span style={{ opacity: 0.75, fontSize: "12px" }}>+{item.diff_pts}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ margin: "20px 20px 0" }}>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#111", marginBottom: "12px" }}>Transactions</div>
                <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden" }}>
                  {txs.length === 0 ? <div style={{ padding: "36px 20px", textAlign: "center", color: "#ccc", fontSize: "14px" }}>No transactions yet</div>
                    : txs.map((tx, i) => <TxRow key={tx.id} tx={tx} i={i} total={txs.length} />)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "add" && (
        <div style={{ padding: "56px 20px 40px", animation: "up 0.22s ease-out" }}>
          <div style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", color: "#111", marginBottom: "24px" }}>New Promise</div>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "18px", marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", color: "#bbb", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>I promise to…</div>
            <textarea ref={textRef} value={promise} onChange={e => setPromise(e.target.value)} placeholder="Describe your commitment" rows={3}
              style={{ width: "100%", border: "none", background: "transparent", color: "#111", fontSize: "16px", lineHeight: "1.5", resize: "none" }} />
          </div>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "18px", marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", color: "#bbb", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>Difficulty</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {DIFFICULTIES.map((d, i) => (
                <button key={d.id} className="tap" onClick={() => setDiff(i)} style={{ flex: 1, padding: "10px 0", border: "none", background: diff === i ? "#111" : "#f5f4f2", borderRadius: "12px", fontFamily: "inherit", color: diff === i ? "#fff" : "#555", fontSize: "12px", fontWeight: "600" }}>
                  <div>{d.label}</div>
                  <div style={{ fontSize: "10px", opacity: 0.5, marginTop: "2px" }}>+{d.pts}/−{d.penalty}</div>
                </button>
              ))}
            </div>
          </div>
          {promise.trim() && (
            <div style={{ background: "#fff", borderRadius: "16px", padding: "14px 18px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#999" }}>If kept</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a9e8a" }}>+{fmtEur(DIFFICULTIES[diff].pts)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#999" }}>If broken</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#e53535" }}>−{fmtEur(DIFFICULTIES[diff].penalty)}</span>
              </div>
            </div>
          )}
          <button className="tap" onClick={addToQueue} disabled={!promise.trim()} style={{ width: "100%", padding: "17px", border: "none", borderRadius: "16px", fontFamily: "inherit", background: promise.trim() ? "#1a9e8a" : "#e5e3e0", color: promise.trim() ? "#fff" : "#aaa", fontSize: "15px", fontWeight: "600" }}>
            Add to Open Promises
          </button>
        </div>
      )}

      {tab === "all" && (
        <div style={{ padding: "56px 20px 40px", animation: "up 0.25s ease-out" }}>
          <div style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", color: "#111", marginBottom: "24px" }}>Activity</div>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "20px 16px", marginBottom: "20px", overflowX: "auto" }}>
            <Heatmap txs={txs} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              {[{ c: "#e53535", l: "Broken" }, { c: "#f59e0b", l: "Gemischt" }, { c: "#f0efed", l: "–", b: "1px solid #e0e0de" }, { c: "#1a9e8a", l: "Kept" }].map(item => (
                <div key={item.l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: item.c, border: item.b }} />
                  <span style={{ fontSize: "10px", color: "#bbb" }}>{item.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: "15px", fontWeight: "600", color: "#111", marginBottom: "12px" }}>All Transactions</div>
          <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden" }}>
            {txs.length === 0 ? <div style={{ padding: "36px 20px", textAlign: "center", color: "#ccc", fontSize: "14px" }}>No transactions yet</div>
              : txs.map((tx, i) => <TxRow key={tx.id} tx={tx} i={i} total={txs.length} />)}
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "390px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid #eee", display: "flex", alignItems: "center", padding: "10px 0 26px" }}>
        <button className="tap" onClick={() => setTab("home")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0" }}>
          <IcoHome on={tab === "home"} />
          <span style={{ fontSize: "10px", color: tab === "home" ? "#1a9e8a" : "#bbb", fontWeight: "500" }}>Home</span>
        </button>
        <button className="tap" onClick={() => setTab("add")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#1a9e8a", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "-18px", boxShadow: "0 4px 16px rgba(26,158,138,0.4)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </button>
        <button className="tap" onClick={() => setTab("all")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0" }}>
          <IcoList on={tab === "all"} />
          <span style={{ fontSize: "10px", color: tab === "all" ? "#1a9e8a" : "#bbb", fontWeight: "500" }}>All</span>
        </button>
      </div>
    </div>
  );
}
