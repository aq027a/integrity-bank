import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "integrity-bank-v7";

const DIFFICULTIES = [
  { id: 0, label: "Easy",    pts: 10  },
  { id: 1, label: "Medium",  pts: 20  },
  { id: 2, label: "Hard",    pts: 50  },
  { id: 3, label: "Extreme", pts: 100 },
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

const EMPTY_STATE = { balance: 0, queue: [], txs: [] };

function safeLoad(raw) {
  try {
    const p = JSON.parse(raw);
    return {
      balance: typeof p.balance === "number" ? p.balance : 0,
      queue:   Array.isArray(p.queue) ? p.queue : [],
      txs:     Array.isArray(p.txs)   ? p.txs   : [],
    };
  } catch { return null; }
}

// ── Icons ──────────────────────────────────────────
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

// ── Main ───────────────────────────────────────────
export default function App() {
  const [data, setData]       = useState(EMPTY_STATE);
  const [ready, setReady]     = useState(false);
  const [tab, setTab]         = useState("home");
  const [flash, setFlash]     = useState(null);
  const [promise, setPromise] = useState("");
  const [diff, setDiff]       = useState(1);
  const textRef = useRef(null);

  // Load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = safeLoad(raw);
        if (loaded) setData(loaded);
      }
    } catch (_) {}
    setReady(true);
  }, []);

  // Persist on every change (after initial load)
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }, [data, ready]);

  // Focus textarea when add tab opens
  useEffect(() => {
    if (tab === "add") setTimeout(() => textRef.current?.focus(), 100);
  }, [tab]);

  function showFlash(pts, kept) {
    setFlash({ pts, kept });
    setTimeout(() => setFlash(null), 1500);
  }

  function addToQueue() {
    if (!promise.trim()) return;
    const d = DIFFICULTIES[diff];
    setData(prev => ({
      ...prev,
      queue: [{ id: Date.now(), promise: promise.trim(), diff: d, created: Date.now() }, ...prev.queue],
    }));
    setPromise(""); setDiff(1); setTab("home");
  }

  function resolve(item, kept) {
    const pts = kept ? item.diff.pts : -item.diff.pts;
    const tx = { id: Date.now(), promise: item.promise, kept, diff: item.diff, pts, ts: Date.now() };
    setData(prev => ({
      balance: prev.balance + pts,
      queue: prev.queue.filter(q => q.id !== item.id),
      txs: [tx, ...prev.txs],
    }));
    showFlash(pts, kept);
  }

  function removeQueue(id) {
    setData(prev => ({ ...prev, queue: prev.queue.filter(q => q.id !== id) }));
  }

  function removeTx(tx) {
    // only undo actual promise transactions, not entries without diff
    if (!tx || !tx.diff) return;
    setData(prev => ({
      ...prev,
      balance: prev.balance - tx.pts,
      txs: prev.txs.filter(t => t.id !== tx.id),
    }));
  }

  const { balance, queue, txs } = data;
  const keptCount   = txs.filter(t => t.kept  && t.diff).length;
  const brokenCount = txs.filter(t => !t.kept && t.diff).length;
  const rate = keptCount + brokenCount > 0
    ? Math.round((keptCount / (keptCount + brokenCount)) * 100)
    : 100;

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#f0efed", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "28px", height: "28px", border: "2px solid #ddd", borderTopColor: "#1a9e8a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily: "-apple-system,'Helvetica Neue',sans-serif", background: "#f0efed", minHeight: "100vh", maxWidth: "390px", margin: "0 auto", paddingBottom: "90px" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #f0efed; }
        textarea { font-family: inherit; }
        textarea:focus { outline: none; }
        @keyframes up   { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pop  { 0%{opacity:1;transform:translateX(-50%) scale(1)} 60%{opacity:1;transform:translateX(-50%) translateY(-20px) scale(1.1)} 100%{opacity:0;transform:translateX(-50%) translateY(-36px) scale(0.9)} }
        .tap { cursor: pointer; }
        .tap:active { opacity: 0.55; }
      `}</style>

      {/* Flash */}
      {flash && (
        <div key={flash.pts + "" + Date.now()} style={{
          position: "fixed", top: "32%", left: "50%",
          fontSize: "46px", fontWeight: "700", letterSpacing: "-2px",
          color: flash.kept ? "#1a9e8a" : "#e53535",
          pointerEvents: "none", zIndex: 999,
          animation: "pop 1.5s ease-out forwards",
        }}>
          {flash.pts > 0 ? "+" : ""}{flash.pts}
        </div>
      )}

      {/* ══════════════ HOME ══════════════ */}
      {tab === "home" && (
        <div style={{ animation: "up 0.25s ease-out" }}>

          <div style={{ padding: "56px 20px 18px" }}>
            <span style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", color: "#111" }}>Home</span>
          </div>

          {/* Balance */}
          <div style={{ margin: "0 20px", background: "#fff", borderRadius: "20px", padding: "22px 22px 20px" }}>
            <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "6px", letterSpacing: "0.3px" }}>Integrity Balance</div>
            <div style={{ fontSize: "38px", fontWeight: "700", letterSpacing: "-1.5px", color: balance >= 0 ? "#111" : "#e53535", lineHeight: 1 }}>
              {fmtEur(balance)}
            </div>
            <div style={{ fontSize: "13px", color: "#1a9e8a", marginTop: "10px", fontWeight: "500" }}>{getRank(balance)}</div>
          </div>

          {/* Stats */}
          <div style={{ margin: "12px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {[
              { label: "Kept",   val: keptCount,   color: "#1a9e8a" },
              { label: "Broken", val: brokenCount, color: "#e53535" },
              { label: "Rate",   val: rate + "%",  color: "#111"    },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: "16px", padding: "14px 0", textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "700", color: s.color }}>{s.val}</div>
                <div style={{ fontSize: "10px", color: "#bbb", marginTop: "3px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Open Promises */}
          {queue.length > 0 && (
            <div style={{ margin: "20px 20px 0" }}>
              <div style={{ fontSize: "15px", fontWeight: "600", color: "#111", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                Open Promises
                <span style={{ fontSize: "11px", background: "#1a9e8a", color: "#fff", borderRadius: "99px", padding: "2px 8px", fontWeight: "600" }}>
                  {queue.length}
                </span>
              </div>
              <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden" }}>
                {queue.map((item, i) => (
                  <div key={item.id} style={{
                    padding: "16px 18px",
                    borderBottom: i < queue.length - 1 ? "1px solid #f5f4f2" : "none",
                  }}>
                    {/* Promise text + date + delete */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ flex: 1, paddingRight: "10px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "500", color: "#111", lineHeight: "1.4" }}>
                          {item.promise}
                        </div>
                        <div style={{ fontSize: "11px", color: "#bbb", marginTop: "4px" }}>
                          {item.diff.label} · {fmtDate(item.created)}
                        </div>
                      </div>
                      <button className="tap" onClick={() => removeQueue(item.id)} style={{ background: "none", border: "none", padding: "2px", flexShrink: 0, marginTop: "2px" }}>
                        <IcoTrash />
                      </button>
                    </div>
                    {/* Broke / Kept */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="tap" onClick={() => resolve(item, false)} style={{
                        flex: 1, padding: "11px 8px",
                        background: "#fff3f3", border: "1.5px solid #fca5a5", borderRadius: "12px",
                        color: "#e53535", fontSize: "13px", fontWeight: "600", fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      }}>
                        Broke it <span style={{ opacity: 0.65, fontSize: "12px" }}>−{item.diff.pts}</span>
                      </button>
                      <button className="tap" onClick={() => resolve(item, true)} style={{
                        flex: 1, padding: "11px 8px",
                        background: "#1a9e8a", border: "none", borderRadius: "12px",
                        color: "#fff", fontSize: "13px", fontWeight: "600", fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      }}>
                        Kept it <span style={{ opacity: 0.75, fontSize: "12px" }}>+{item.diff.pts}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions */}
          <div style={{ margin: "20px 20px 0" }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#111", marginBottom: "12px" }}>Transactions</div>
            <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden" }}>
              {txs.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center", color: "#ccc", fontSize: "14px" }}>
                  No transactions yet
                </div>
              ) : txs.map((tx, i) => (
                <div key={tx.id} style={{
                  display: "flex", alignItems: "center", gap: "13px",
                  padding: "14px 18px",
                  borderBottom: i < txs.length - 1 ? "1px solid #f5f4f2" : "none",
                }}>
                  {/* Icon circle */}
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    background: tx.pts >= 0 ? "#e8f5f3" : "#fdecea",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: tx.pts >= 0 ? "#1a9e8a" : "#e53535",
                    fontSize: "14px", fontWeight: "700",
                  }}>
                    {tx.pts >= 0 ? "↑" : "↓"}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tx.promise}
                    </div>
                    <div style={{ fontSize: "11px", color: "#bbb", marginTop: "3px" }}>
                      {tx.diff ? tx.diff.label + " · " : ""}{fmtDate(tx.ts)}
                    </div>
                  </div>
                  {/* Amount */}
                  <div style={{ fontSize: "14px", fontWeight: "600", flexShrink: 0, color: tx.pts >= 0 ? "#1a9e8a" : "#e53535" }}>
                    {tx.pts >= 0 ? "+" : ""}{fmtEur(tx.pts)}
                  </div>
                  {/* Delete — always visible on mobile */}
                  {tx.diff && (
                    <button className="tap" onClick={() => removeTx(tx)} style={{ background: "none", border: "none", padding: "4px", flexShrink: 0 }}>
                      <IcoTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ADD ══════════════ */}
      {tab === "add" && (
        <div style={{ padding: "56px 20px 40px", animation: "up 0.22s ease-out" }}>
          <div style={{ fontSize: "26px", fontWeight: "700", letterSpacing: "-0.5px", color: "#111", marginBottom: "24px" }}>
            New Promise
          </div>

          <div style={{ background: "#fff", borderRadius: "20px", padding: "18px", marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", color: "#bbb", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>I promise to…</div>
            <textarea
              ref={textRef}
              value={promise}
              onChange={e => setPromise(e.target.value)}
              placeholder="Describe your commitment"
              rows={3}
              style={{ width: "100%", border: "none", background: "transparent", color: "#111", fontSize: "16px", lineHeight: "1.5", resize: "none" }}
            />
          </div>

          <div style={{ background: "#fff", borderRadius: "20px", padding: "18px", marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", color: "#bbb", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>Difficulty</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {DIFFICULTIES.map((d, i) => (
                <button key={d.id} className="tap" onClick={() => setDiff(i)} style={{
                  flex: 1, padding: "10px 0", border: "none",
                  background: diff === i ? "#111" : "#f5f4f2",
                  borderRadius: "12px", fontFamily: "inherit",
                  color: diff === i ? "#fff" : "#555",
                  fontSize: "12px", fontWeight: "600",
                }}>
                  <div>{d.label}</div>
                  <div style={{ fontSize: "10px", opacity: 0.5, marginTop: "2px" }}>±{d.pts}</div>
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
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#e53535" }}>−{fmtEur(DIFFICULTIES[diff].pts)}</span>
              </div>
            </div>
          )}

          <button className="tap" onClick={addToQueue} disabled={!promise.trim()} style={{
            width: "100%", padding: "17px", border: "none", borderRadius: "16px", fontFamily: "inherit",
            background: promise.trim() ? "#1a9e8a" : "#e5e3e0",
            color: promise.trim() ? "#fff" : "#aaa",
            fontSize: "15px", fontWeight: "600",
          }}>
            Add to Open Promises
          </button>
        </div>
      )}

      {/* ══════════════ BOTTOM NAV ══════════════ */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: "390px",
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid #eee",
        display: "flex", alignItems: "center",
        padding: "10px 0 26px",
      }}>
        <button className="tap" onClick={() => setTab("home")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0" }}>
          <IcoHome on={tab === "home"} />
          <span style={{ fontSize: "10px", color: tab === "home" ? "#1a9e8a" : "#bbb", fontWeight: "500" }}>Home</span>
        </button>

        <button className="tap" onClick={() => setTab("add")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0" }}>
          <div style={{
            width: "46px", height: "46px", borderRadius: "50%", background: "#1a9e8a",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: "-18px", boxShadow: "0 4px 16px rgba(26,158,138,0.4)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </button>

        <button className="tap" onClick={() => setTab("list")} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px 0" }}>
          <IcoList on={tab === "list"} />
          <span style={{ fontSize: "10px", color: tab === "list" ? "#1a9e8a" : "#bbb", fontWeight: "500" }}>All</span>
        </button>
      </div>
    </div>
  );
}
