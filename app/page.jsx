"use client";

import { useState, useEffect, useMemo } from "react";

// ============================================================
// CONSTANTS
// ============================================================
const REFERRAL_TYPES = {
  beauty_salon: { label: "美容院",  emoji: "✂️", color: "#f472b6" },
  hr:           { label: "人材",    emoji: "💼", color: "#60a5fa" },
  real_estate:  { label: "不動産",  emoji: "🏠", color: "#34d399" },
  meeting:      { label: "面談",    emoji: "🤝", color: "#fbbf24" },
  book:         { label: "本紹介",  emoji: "📚", color: "#a78bfa" },
  person:       { label: "人紹介",  emoji: "👤", color: "#fb923c" },
};

const STATUS_CONFIG = {
  active:    { label: "アクティブ",   dot: "#22c55e" },
  pending:   { label: "ペンディング", dot: "#f59e0b" },
  completed: { label: "完了",         dot: "#60a5fa" },
  archived:  { label: "アーカイブ",   dot: "#6b7280" },
};

const GENDER_LABELS = { male: "男性", female: "女性", other: "その他" };

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg: "#07080f", surface: "#0e0f1a", surface2: "#151623", surface3: "#1c1d2e",
  border: "#252638", border2: "#2e3048",
  accent: "#6366f1", accentGlow: "rgba(99,102,241,0.3)", accentDim: "rgba(99,102,241,0.12)",
  text: "#e2e4f0", muted: "#6b6d8a", dim: "#40425a",
  success: "#22c55e", warn: "#f59e0b", danger: "#ef4444",
};

const S = {
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "20px" },
  input: {
    background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: "8px",
    padding: "9px 13px", color: C.text, fontSize: "14px", width: "100%",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },
  label: {
    fontSize: "11px", color: C.muted, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", display: "block", marginBottom: "5px",
  },
  btn: {
    background: C.accent, color: "#fff", border: "none", borderRadius: "8px",
    padding: "10px 22px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  btnGhost: {
    background: "transparent", color: C.muted, border: `1px solid ${C.border2}`,
    borderRadius: "8px", padding: "9px 18px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
  },
  btnDanger: {
    background: "rgba(239,68,68,0.1)", color: C.danger, border: `1px solid rgba(239,68,68,0.25)`,
    borderRadius: "8px", padding: "8px 16px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
  },
};

// ============================================================
// STORAGE
// ============================================================
const DB = {
  people: () => { try { return JSON.parse(localStorage.getItem("crm_people2") || "[]"); } catch { return []; } },
  referrals: () => { try { return JSON.parse(localStorage.getItem("crm_refs2") || "[]"); } catch { return []; } },
  savePeople: (d) => localStorage.setItem("crm_people2", JSON.stringify(d)),
  saveReferrals: (d) => localStorage.setItem("crm_refs2", JSON.stringify(d)),
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function computeStatus(person) {
  if (person.status === "completed") return "completed";
  if (person.status === "archived") return "archived";
  const ref = person.last_contact_date ? new Date(person.last_contact_date) : new Date(person.created_at || Date.now());
  const days = Math.floor((Date.now() - ref.getTime()) / 86400000);
  if (days >= 90) return "archived";
  if (days >= 30) return "pending";
  return "active";
}

// ============================================================
// AI
// ============================================================
async function callAI(memo) {
  const today = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();
  const prompt = `あなたは人間関係管理の専門アシスタントです。メモから人物情報を抽出しJSONのみで返してください。

今日: ${today}（年省略時は${year}年で補完）

JSONスキーマ（不明はnull）:
{
  "name":string|null,"met_date":"YYYY-MM-DD"|null,"met_place":string|null,
  "age":number|null,"gender":"male"|"female"|"other"|null,
  "occupation":string|null,"residence":string|null,"university":string|null,
  "hometown":string|null,"family_structure":string|null,"conversation":string|null,
  "referral_types":["beauty_salon"|"hr"|"real_estate"|"meeting"|"book"|"person"],
  "next_action":string|null,"next_action_due":"YYYY-MM-DD"|null,
  "has_meeting":false,"meeting_date":"YYYY-MM-DD"|null,
  "is_friend":false,"friended_date":"YYYY-MM-DD"|null,"notes":string|null
}

送客先: 美容院→beauty_salon, 転職/就職→hr, 不動産→real_estate, 面談/アポ→meeting, 本→book, 人紹介→person
JSONのみ返してください。

メモ: ${memo}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map((c) => c.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function Tag({ type }) {
  const cfg = REFERRAL_TYPES[type];
  if (!cfg) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33`,
    }}>{cfg.emoji} {cfg.label}</span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: C.muted }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

function Divider() { return <div style={{ height: "1px", background: C.border, margin: "16px 0" }} />; }

function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type === "error" ? C.danger : C.success;
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
      background: C.surface, border: `1px solid ${bg}44`, borderRadius: "10px",
      padding: "12px 20px", fontSize: "13px", color: C.text, fontWeight: 600,
      boxShadow: `0 4px 24px ${bg}22`, display: "flex", alignItems: "center", gap: "8px",
    }}>
      <span style={{ color: bg }}>{type === "error" ? "✕" : "✓"}</span> {msg}
    </div>
  );
}

const tagFriend = {
  display:"inline-flex",alignItems:"center",padding:"2px 9px",borderRadius:"20px",
  fontSize:"11px",fontWeight:700,background:"rgba(34,197,94,0.12)",
  color:"#22c55e",border:"1px solid rgba(34,197,94,0.25)",
};
const tagMeeting = {
  display:"inline-flex",alignItems:"center",padding:"2px 9px",borderRadius:"20px",
  fontSize:"11px",fontWeight:700,background:"rgba(251,191,36,0.12)",
  color:"#fbbf24",border:"1px solid rgba(251,191,36,0.25)",
};

// ============================================================
// NAV
// ============================================================
function Nav({ page, setPage, overdueCount }) {
  const items = [
    { id: "dashboard", icon: "◈", label: "ダッシュ" },
    { id: "input",     icon: "+", label: "新規入力" },
    { id: "people",    icon: "⊞", label: "人物一覧" },
    { id: "actions",   icon: "◎", label: "アクション", badge: overdueCount },
  ];
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 200,
      background: `${C.surface}ee`, backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", padding: "0 8px", height: "52px", gap: "2px", overflowX: "auto", flexWrap: "nowrap",
    }}>
      <div style={{
        fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "15px",
        color: C.accent, marginRight: "20px", letterSpacing: "-0.02em",
      }}>PCRM</div>
      {items.map((item) => (
        <button key={item.id} onClick={() => setPage(item.id)} style={{
          background: page === item.id ? C.accentDim : "transparent",
          color: page === item.id ? C.accent : C.muted,
          border: page === item.id ? `1px solid ${C.accentGlow}` : "1px solid transparent",
          borderRadius: "8px", padding: "5px 13px", fontSize: "12px", fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          <span style={{ fontSize: "14px" }}>{item.icon}</span>
          {item.label}
          {item.badge > 0 && (
            <span style={{
              background: C.danger, color: "#fff", borderRadius: "10px",
              fontSize: "9px", fontWeight: 800, padding: "1px 5px",
            }}>{item.badge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ============================================================
// INPUT PAGE
// ============================================================
function InputPage({ onConfirm, toast }) {
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  const examples = [
    "5/2 りゅうと 25歳 営業、高井戸住み。挑戦したい気持ちはあるが何をしていいかわからない。知り合いの美容院へ案内し、5/20までに本を読む約束をした。",
    "昨日 田中さつき 32歳 渋谷で出会い、マーケター。大阪出身。不動産を探していると言っていた。今度面談を設定する予定。",
  ];

  async function handleParse() {
    if (!memo.trim()) return;
    setLoading(true);
    try {
      const parsed = await callAI(memo);
      onConfirm(parsed, memo);
    } catch {
      toast("AI解析に失敗しました。Claude APIキーを確認してください。", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, margin: "0 0 4px" }}>メモ入力</h2>
      <p style={{ color: C.muted, fontSize: "13px", margin: "0 0 20px" }}>自由にメモを書くとAIが自動で整理します</p>

      <div style={S.card}>
        <label style={S.label}>メモ・箇条書き</label>
        <textarea
          value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="例）5/2 りゅうと 25歳 営業、高井戸住み…"
          style={{ ...S.input, minHeight: "160px", resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleParse} disabled={!memo.trim() || loading} style={{
            ...S.btn, opacity: !memo.trim() || loading ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            {loading
              ? <><span style={{ display:"inline-block",width:"14px",height:"14px",border:"2px solid #fff4",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />AI解析中…</>
              : "✦ AIで整理する"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <div style={{ fontSize: "11px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "10px" }}>入力例（クリックで挿入）</div>
        {examples.map((ex, i) => (
          <button key={i} onClick={() => setMemo(ex)} style={{
            ...S.btnGhost, textAlign: "left", fontSize: "12px", color: C.muted,
            lineHeight: 1.6, padding: "10px 14px", width: "100%", marginBottom: "8px", display: "block",
          }}>{ex}</button>
        ))}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============================================================
// CONFIRM PAGE
// ============================================================
function ConfirmPage({ parsed, originalMemo, onSave, onBack, toast }) {
  const [form, setForm] = useState(() => ({
    name: parsed.name || "",
    met_date: parsed.met_date || "",
    met_place: parsed.met_place || "",
    age: parsed.age || "",
    gender: parsed.gender || "",
    occupation: parsed.occupation || "",
    residence: parsed.residence || "",
    university: parsed.university || "",
    hometown: parsed.hometown || "",
    family_structure: parsed.family_structure || "",
    conversation: parsed.conversation || "",
    referral_types: parsed.referral_types || [],
    next_action: parsed.next_action || "",
    next_action_due: parsed.next_action_due || "",
    has_meeting: parsed.has_meeting || false,
    meeting_date: parsed.meeting_date || "",
    is_friend: parsed.is_friend || false,
    friended_date: parsed.friended_date || "",
    notes: parsed.notes || "",
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleRef(type) {
    set("referral_types", form.referral_types.includes(type)
      ? form.referral_types.filter((t) => t !== type)
      : [...form.referral_types, type]);
  }

  const hi = (val) => ({
    ...S.input,
    borderColor: val ? C.border2 : `${C.accent}55`,
    background: val ? C.surface2 : `${C.accent}08`,
  });

  function TwoToggle({ val, onChange, trueLabel, falseLabel, trueColor }) {
    const tc = trueColor || C.accent;
    return (
      <div style={{ display: "flex", gap: "6px" }}>
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => onChange(v)} style={{
            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${val === v ? tc : C.border2}`,
            background: val === v ? `${tc}18` : C.surface2,
            color: val === v ? tc : C.muted,
          }}>{v ? trueLabel : falseLabel}</button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, margin: "0 0 4px" }}>AI整理結果の確認</h2>
      <p style={{ color: C.muted, fontSize: "13px", margin: "0 0 16px" }}>
        内容を確認・修正して保存してください。<span style={{ color: C.accent }}>紫枠</span>はAIが推測した項目です。
      </p>

      <div style={{ ...S.card, background: C.surface2, marginBottom: "12px", fontSize: "12px", color: C.muted, lineHeight: 1.7 }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: C.dim, marginBottom: "6px" }}>元のメモ</div>
        {originalMemo}
      </div>

      {/* Basic */}
      <div style={S.card}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px", letterSpacing: "0.05em" }}>基本情報</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[
            ["name","名前","text","名前（必須）"],["met_date","出会った日","date",""],
            ["met_place","出会った場所","text","渋谷・オンラインなど"],["age","年齢","number","25"],
            ["occupation","職業","text","営業・エンジニアなど"],["residence","住まい","text","高井戸"],
            ["university","卒業大学","text",""],["hometown","出身地","text",""],
            ["family_structure","家族構成","text","既婚・子1人など"],
          ].map(([k, l, t, p]) => (
            <div key={k}>
              <label style={S.label}>{l}{k==="name"?" *":""}</label>
              <input type={t} style={hi(form[k])} value={form[k]||""} onChange={(e) => set(k, e.target.value)} placeholder={p} />
            </div>
          ))}
          <div>
            <label style={S.label}>性別</label>
            <select style={hi(form.gender)} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">選択</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={S.label}>会話内容</label>
          <textarea style={{ ...hi(form.conversation), minHeight: "80px", resize: "vertical", lineHeight: 1.7 }}
            value={form.conversation} onChange={(e) => set("conversation", e.target.value)} placeholder="話した内容のサマリー" />
        </div>
      </div>

      {/* Referrals */}
      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px", letterSpacing: "0.05em" }}>送客先（複数選択可）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {Object.entries(REFERRAL_TYPES).map(([key, cfg]) => {
            const active = form.referral_types.includes(key);
            return (
              <button key={key} onClick={() => toggleRef(key)} style={{
                padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${active ? cfg.color : C.border2}`,
                background: active ? `${cfg.color}20` : C.surface2,
                color: active ? cfg.color : C.muted,
                display: "flex", alignItems: "center", gap: "4px",
              }}>{cfg.emoji} {cfg.label}</button>
            );
          })}
        </div>
      </div>

      {/* NA */}
      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px", letterSpacing: "0.05em" }}>ネクストアクション</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
          <div>
            <label style={S.label}>内容</label>
            <input style={hi(form.next_action)} value={form.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="〇〇に連絡する" />
          </div>
          <div>
            <label style={S.label}>期限</label>
            <input type="date" style={hi(form.next_action_due)} value={form.next_action_due} onChange={(e) => set("next_action_due", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Meeting / Friend */}
      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px", letterSpacing: "0.05em" }}>面談・友達登録</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={S.label}>面談</label>
            <TwoToggle val={form.has_meeting} onChange={(v) => set("has_meeting", v)} trueLabel="あり" falseLabel="なし" />
            {form.has_meeting && (
              <input type="date" style={{ ...S.input, marginTop: "8px" }} value={form.meeting_date} onChange={(e) => set("meeting_date", e.target.value)} />
            )}
          </div>
          <div>
            <label style={S.label}>友達登録</label>
            <TwoToggle val={form.is_friend} onChange={(v) => set("is_friend", v)} trueLabel="済み" falseLabel="未" trueColor={C.success} />
            {form.is_friend && (
              <input type="date" style={{ ...S.input, marginTop: "8px" }} value={form.friended_date} onChange={(e) => set("friended_date", e.target.value)} />
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ ...S.card, marginTop: "10px" }}>
        <label style={S.label}>備考</label>
        <textarea style={{ ...S.input, minHeight: "60px", resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="その他メモ" />
      </div>

      <div style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button style={S.btnGhost} onClick={onBack}>← 戻る</button>
        <button style={S.btn} onClick={() => {
          if (!form.name.trim()) { toast("名前は必須です", "error"); return; }
          onSave(form);
        }}>✓ 確定して保存</button>
      </div>
    </div>
  );
}

// ============================================================
// PEOPLE LIST
// ============================================================
function PeoplePage({ people, referrals, onSelect, onNew }) {
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRef, setFilterRef] = useState("");

  const filtered = useMemo(() => people.filter((p) => {
    if (search && !`${p.name} ${p.occupation} ${p.met_place}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterGender && p.gender !== filterGender) return false;
    if (filterStatus && computeStatus(p) !== filterStatus) return false;
    if (filterRef && !referrals.some((r) => r.person_id === p.id && r.referral_type === filterRef)) return false;
    return true;
  }), [people, referrals, search, filterGender, filterStatus, filterRef]);

  return (
    <div style={{ padding: "28px 24px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, margin: "0 0 2px" }}>人物一覧</h2>
          <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{filtered.length}件 / 全{people.length}件</p>
        </div>
        <button style={S.btn} onClick={onNew}>＋ 新規入力</button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前・職業・場所で検索" style={{ ...S.input, maxWidth: "220px" }} />
        <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} style={{ ...S.input, maxWidth: "120px" }}>
          <option value="">性別</option>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="other">その他</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...S.input, maxWidth: "150px" }}>
          <option value="">ステータス</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterRef} onChange={(e) => setFilterRef(e.target.value)} style={{ ...S.input, maxWidth: "130px" }}>
          <option value="">送客先</option>
          {Object.entries(REFERRAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "60px", color: C.muted }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>👤</div>
          <div style={{ fontWeight: 700 }}>人物が見つかりません</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.map((p) => {
            const pRefs = referrals.filter((r) => r.person_id === p.id);
            const st = computeStatus(p);
            const stCfg = STATUS_CONFIG[st];
            const isOverdue = p.next_action && !p.next_action_done && p.next_action_due && new Date(p.next_action_due) < new Date();
            return (
              <div key={p.id} onClick={() => onSelect(p.id)} style={{
                ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: "14px",
                padding: "13px 18px", borderColor: isOverdue ? `${C.danger}44` : C.border,
              }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "10px",
                  background: `${C.accent}20`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: 800, color: C.accent, flexShrink: 0,
                  fontFamily: "'Syne',sans-serif",
                }}>{p.name?.[0] || "?"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px" }}>{p.name}</span>
                    {p.age && <span style={{ fontSize: "12px", color: C.muted }}>{p.age}歳</span>}
                    {p.gender && <span style={{ fontSize: "12px", color: C.muted }}>{GENDER_LABELS[p.gender]}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: stCfg.dot }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stCfg.dot, display: "inline-block" }} />
                      {stCfg.label}
                    </span>
                    {isOverdue && <span style={{ fontSize: "10px", fontWeight: 700, color: C.danger, background: "rgba(239,68,68,0.12)", padding: "2px 7px", borderRadius: "10px" }}>期限切れ</span>}
                  </div>
                  <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: C.muted, flexWrap: "wrap" }}>
                    {p.occupation && <span>💼 {p.occupation}</span>}
                    {p.met_place && <span>📍 {p.met_place}</span>}
                    {p.met_date && <span>📅 {p.met_date}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "180px", flexShrink: 0 }}>
                  {pRefs.map((r, i) => <Tag key={i} type={r.referral_type} />)}
                  {p.is_friend && <span style={tagFriend}>✓ 友達</span>}
                  {p.has_meeting && <span style={tagMeeting}>面談</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PERSON DETAIL
// ============================================================
function PersonDetail({ personId, people, referrals, onBack, onEdit, onDelete, onToggleNA }) {
  const person = people.find((p) => p.id === personId);
  if (!person) return <div style={{ padding: "40px", textAlign: "center", color: C.muted }}>人物が見つかりません</div>;

  const pRefs = referrals.filter((r) => r.person_id === person.id);
  const st = computeStatus(person);
  const isOverdue = person.next_action && !person.next_action_done && person.next_action_due && new Date(person.next_action_due) < new Date();

  const infoRows = [
    ["出会った日", person.met_date], ["出会った場所", person.met_place],
    ["年齢", person.age ? `${person.age}歳` : null], ["性別", GENDER_LABELS[person.gender]],
    ["職業", person.occupation], ["住まい", person.residence],
    ["卒業大学", person.university], ["出身地", person.hometown],
    ["家族構成", person.family_structure],
  ].filter(([, v]) => v);

  return (
    <div style={{ padding: "28px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...S.btnGhost, fontSize: "12px", marginBottom: "16px" }}>← 一覧に戻る</button>

      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "13px",
          background: `${C.accent}22`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", fontWeight: 800, color: C.accent, flexShrink: 0,
          fontFamily: "'Syne',sans-serif",
        }}>{person.name?.[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "20px", fontWeight: 800 }}>{person.name}</div>
          <div style={{ display: "flex", gap: "8px", marginTop: "5px", flexWrap: "wrap" }}>
            <StatusBadge status={st} />
            {pRefs.map((r, i) => <Tag key={i} type={r.referral_type} />)}
            {person.is_friend && <span style={tagFriend}>✓ 友達登録</span>}
            {person.has_meeting && <span style={tagMeeting}>面談済</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button style={S.btnGhost} onClick={onEdit}>編集</button>
          <button style={S.btnDanger} onClick={() => { if (window.confirm(`${person.name}を削除しますか？`)) onDelete(person.id); }}>削除</button>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: "10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: C.accent, marginBottom: "12px", letterSpacing: "0.05em" }}>基本情報</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {infoRows.map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: "10px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "14px", color: C.text }}>{val}</div>
            </div>
          ))}
        </div>
        {person.conversation && (
          <>
            <Divider />
            <div style={{ fontSize: "10px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>会話内容</div>
            <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{person.conversation}</div>
          </>
        )}
      </div>

      {person.next_action && (
        <div style={{
          ...S.card, marginBottom: "10px",
          borderColor: isOverdue ? `${C.danger}44` : person.next_action_done ? `${C.success}33` : C.border,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: isOverdue ? C.danger : C.accent, letterSpacing: "0.05em" }}>
              {isOverdue ? "⚠ 期限切れアクション" : "ネクストアクション"}
            </div>
            <button onClick={() => onToggleNA(person.id)} style={{
              ...S.btnGhost, fontSize: "11px", padding: "4px 12px",
              color: person.next_action_done ? C.success : C.muted,
            }}>{person.next_action_done ? "✓ 完了済み" : "完了にする"}</button>
          </div>
          <div style={{ fontSize: "14px", color: person.next_action_done ? C.muted : C.text, textDecoration: person.next_action_done ? "line-through" : "none" }}>
            {person.next_action}
          </div>
          {person.next_action_due && (
            <div style={{ fontSize: "12px", color: isOverdue ? C.danger : C.muted, marginTop: "4px" }}>期限: {person.next_action_due}</div>
          )}
        </div>
      )}

      {(person.has_meeting || person.is_friend || person.notes) && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: "24px" }}>
            {person.has_meeting && (
              <div>
                <div style={{ fontSize: "10px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "3px" }}>面談日</div>
                <div style={{ fontSize: "14px", color: "#fbbf24" }}>{person.meeting_date || "日付未設定"}</div>
              </div>
            )}
            {person.is_friend && (
              <div>
                <div style={{ fontSize: "10px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "3px" }}>友達登録日</div>
                <div style={{ fontSize: "14px", color: C.success }}>{person.friended_date || "日付未設定"}</div>
              </div>
            )}
          </div>
          {person.notes && (
            <>
              {(person.has_meeting || person.is_friend) && <Divider />}
              <div style={{ fontSize: "10px", color: C.dim, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>備考</div>
              <div style={{ fontSize: "13px", color: C.muted, lineHeight: 1.8 }}>{person.notes}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EDIT PAGE
// ============================================================
function EditPersonPage({ personId, people, referrals, onSave, onBack, toast }) {
  const person = people.find((p) => p.id === personId);
  const pRefs = referrals.filter((r) => r.person_id === personId);

  const [form, setForm] = useState(() => !person ? {} : {
    name: person.name || "", met_date: person.met_date || "", met_place: person.met_place || "",
    age: person.age || "", gender: person.gender || "", occupation: person.occupation || "",
    residence: person.residence || "", university: person.university || "",
    hometown: person.hometown || "", family_structure: person.family_structure || "",
    conversation: person.conversation || "", referral_types: pRefs.map((r) => r.referral_type),
    next_action: person.next_action || "", next_action_due: person.next_action_due || "",
    next_action_done: person.next_action_done || false,
    has_meeting: person.has_meeting || false, meeting_date: person.meeting_date || "",
    is_friend: person.is_friend || false, friended_date: person.friended_date || "",
    status: person.status || "active", notes: person.notes || "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function toggleRef(type) {
    set("referral_types", form.referral_types.includes(type) ? form.referral_types.filter((t) => t !== type) : [...form.referral_types, type]);
  }

  if (!person) return null;

  function TwoToggle({ k, trueLabel, falseLabel, color }) {
    const tc = color || C.accent;
    return (
      <div style={{ display: "flex", gap: "6px" }}>
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => set(k, v)} style={{
            flex:1, padding:"7px", borderRadius:"7px", fontSize:"12px", fontWeight:700,
            cursor:"pointer", fontFamily:"inherit",
            border:`1px solid ${form[k]===v ? tc : C.border2}`,
            background: form[k]===v ? `${tc}18` : C.surface2,
            color: form[k]===v ? tc : C.muted,
          }}>{v ? trueLabel : falseLabel}</button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, margin: "0 0 16px" }}>{person.name} を編集</h2>

      <div style={S.card}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px" }}>基本情報</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[
            ["name","名前","text"],["met_date","出会った日","date"],
            ["met_place","出会った場所","text"],["age","年齢","number"],
            ["occupation","職業","text"],["residence","住まい","text"],
            ["university","卒業大学","text"],["hometown","出身地","text"],
            ["family_structure","家族構成","text"],
          ].map(([k,l,t]) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input type={t} style={S.input} value={form[k]||""} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
          <div>
            <label style={S.label}>性別</label>
            <select style={S.input} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">選択</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label style={S.label}>ステータス</label>
            <select style={S.input} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={S.label}>会話内容</label>
          <textarea style={{ ...S.input, minHeight: "80px", resize: "vertical", lineHeight: 1.7 }} value={form.conversation} onChange={(e) => set("conversation", e.target.value)} />
        </div>
      </div>

      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px" }}>送客先</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {Object.entries(REFERRAL_TYPES).map(([key, cfg]) => {
            const active = form.referral_types.includes(key);
            return (
              <button key={key} onClick={() => toggleRef(key)} style={{
                padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${active ? cfg.color : C.border2}`,
                background: active ? `${cfg.color}20` : C.surface2,
                color: active ? cfg.color : C.muted,
              }}>{cfg.emoji} {cfg.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px" }}>ネクストアクション</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
          <div>
            <label style={S.label}>内容</label>
            <input style={S.input} value={form.next_action} onChange={(e) => set("next_action", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>期限</label>
            <input type="date" style={S.input} value={form.next_action_due} onChange={(e) => set("next_action_due", e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          <input type="checkbox" id="na_done" checked={form.next_action_done} onChange={(e) => set("next_action_done", e.target.checked)} />
          <label htmlFor="na_done" style={{ fontSize: "13px", color: C.muted, cursor: "pointer" }}>完了済み</label>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: C.accent, marginBottom: "12px" }}>面談・友達登録</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={S.label}>面談</label>
            <TwoToggle k="has_meeting" trueLabel="あり" falseLabel="なし" />
            {form.has_meeting && <input type="date" style={{ ...S.input, marginTop: "8px" }} value={form.meeting_date} onChange={(e) => set("meeting_date", e.target.value)} />}
          </div>
          <div>
            <label style={S.label}>友達登録</label>
            <TwoToggle k="is_friend" trueLabel="済み" falseLabel="未" color={C.success} />
            {form.is_friend && <input type="date" style={{ ...S.input, marginTop: "8px" }} value={form.friended_date} onChange={(e) => set("friended_date", e.target.value)} />}
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: "10px" }}>
        <label style={S.label}>備考</label>
        <textarea style={{ ...S.input, minHeight: "60px", resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button style={S.btnGhost} onClick={onBack}>キャンセル</button>
        <button style={S.btn} onClick={() => {
          if (!form.name.trim()) { toast("名前は必須です", "error"); return; }
          onSave(personId, form);
        }}>保存する</button>
      </div>
    </div>
  );
}

// ============================================================
// ACTIONS PAGE
// ============================================================
function ActionsPage({ people, onSelect, onToggleNA }) {
  const overdue = people.filter((p) =>
    p.next_action && !p.next_action_done && p.next_action_due && new Date(p.next_action_due) < new Date()
  ).sort((a, b) => new Date(a.next_action_due) - new Date(b.next_action_due));

  const pending = people.filter((p) =>
    p.next_action && !p.next_action_done && (!p.next_action_due || new Date(p.next_action_due) >= new Date())
  ).sort((a, b) => !a.next_action_due ? 1 : !b.next_action_due ? -1 : new Date(a.next_action_due) - new Date(b.next_action_due));

  const done = people.filter((p) => p.next_action && p.next_action_done);

  function Row({ p, type }) {
    const daysOver = p.next_action_due ? Math.floor((Date.now() - new Date(p.next_action_due).getTime()) / 86400000) : 0;
    return (
      <div onClick={() => onSelect(p.id)} style={{
        ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px",
        cursor: "pointer", borderColor: type === "overdue" ? `${C.danger}44` : C.border,
      }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "8px", background: `${C.accent}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: 800, color: C.accent, flexShrink: 0,
          fontFamily: "'Syne',sans-serif",
        }}>{p.name?.[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "2px" }}>{p.name}</div>
          <div style={{ fontSize: "12px", color: type === "done" ? C.dim : C.muted, textDecoration: type === "done" ? "line-through" : "none" }}>{p.next_action}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {p.next_action_due && (
            <div style={{ fontSize: "11px", color: type === "overdue" ? C.danger : C.muted, fontWeight: type === "overdue" ? 700 : 400 }}>
              {p.next_action_due}{type === "overdue" ? ` (+${daysOver}日)` : ""}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onToggleNA(p.id); }} style={{
            ...S.btnGhost, fontSize: "11px", padding: "3px 10px", marginTop: "4px",
            color: p.next_action_done ? C.success : C.muted,
          }}>{p.next_action_done ? "✓ 完了" : "完了にする"}</button>
        </div>
      </div>
    );
  }

  const Section = ({ title, items, type, color }) => items.length === 0 ? null : (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: color || C.muted, letterSpacing: "0.08em", marginBottom: "8px" }}>{title} ({items.length}件)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {items.map((p) => <Row key={p.id} p={p} type={type} />)}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "28px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "20px" }}>ネクストアクション管理</h2>
      <Section title="⚠ 期限切れ" items={overdue} type="overdue" color={C.danger} />
      <Section title="未対応" items={pending} type="pending" color={C.muted} />
      <Section title="完了済み" items={done} type="done" color={C.dim} />
      {overdue.length === 0 && pending.length === 0 && done.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "60px", color: C.muted }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>✓</div>
          <div style={{ fontWeight: 700 }}>アクションはありません</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ people, referrals, setPage }) {
  const now = new Date();

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getMonth() + 1}月` };
  });

  const mStats = months.map(({ year, month, label }) => {
    const list = people.filter((p) => {
      if (!p.met_date) return false;
      const d = new Date(p.met_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const refCount = [...new Set(referrals.filter((r) => list.some((p) => p.id === r.person_id)).map((r) => r.person_id))].length;
    return { label, met: list.length, referral: refCount, meeting: list.filter((p) => p.has_meeting).length, friend: list.filter((p) => p.is_friend).length };
  });

  const totMet = people.length;
  const totRef = [...new Set(referrals.map((r) => r.person_id))].length;
  const totMeet = people.filter((p) => p.has_meeting).length;
  const totFriend = people.filter((p) => p.is_friend).length;
  const totNA = people.filter((p) => p.next_action).length;
  const fmt = (n, d) => d > 0 ? `${(n / d * 100).toFixed(1)}%` : "—";

  const overduePeople = people.filter((p) =>
    p.next_action && !p.next_action_done && p.next_action_due && new Date(p.next_action_due) < new Date()
  );

  // Place stats
  const placeMap = {};
  people.forEach((p) => {
    const k = p.met_place || "不明";
    if (!placeMap[k]) placeMap[k] = { met: 0, friend: 0, meet: 0 };
    placeMap[k].met++; if (p.is_friend) placeMap[k].friend++; if (p.has_meeting) placeMap[k].meet++;
  });
  const placeStats = Object.entries(placeMap)
    .map(([place, s]) => ({ place, met: s.met, land: s.met > 0 ? (s.friend / s.met * 100).toFixed(0) : 0, meet: s.met > 0 ? (s.meet / s.met * 100).toFixed(0) : 0 }))
    .sort((a, b) => b.met - a.met).slice(0, 5);

  // Gender stats
  const gMap = {};
  people.forEach((p) => {
    const k = p.gender || "other";
    if (!gMap[k]) gMap[k] = { met: 0, friend: 0 };
    gMap[k].met++; if (p.is_friend) gMap[k].friend++;
  });
  const gStats = Object.entries(gMap).map(([g, s]) => ({ label: GENDER_LABELS[g] || g, met: s.met, land: s.met > 0 ? (s.friend / s.met * 100).toFixed(0) : 0 }));

  // Ref type stats
  const rtMap = {};
  referrals.forEach((r) => {
    if (!rtMap[r.referral_type]) rtMap[r.referral_type] = { cnt: 0, friend: 0 };
    rtMap[r.referral_type].cnt++;
    if (people.find((p) => p.id === r.person_id)?.is_friend) rtMap[r.referral_type].friend++;
  });
  const rtStats = Object.entries(rtMap).map(([t, s]) => ({
    t, label: REFERRAL_TYPES[t]?.label || t, emoji: REFERRAL_TYPES[t]?.emoji || "",
    color: REFERRAL_TYPES[t]?.color || C.accent, cnt: s.cnt, land: s.cnt > 0 ? (s.friend / s.cnt * 100).toFixed(0) : 0,
  }));

  const maxMet = Math.max(...mStats.map((m) => m.met), 1);
  const barCols = [C.accent, "#34d399", "#fbbf24", "#f472b6"];
  const barKeys = ["met", "referral", "meeting", "friend"];
  const barLabs = ["出会い", "送客", "面談", "友達登録"];

  function KCard({ label, value, sub, color }) {
    return (
      <div style={{ ...S.card, flex: "1 1 110px" }}>
        <div style={{ fontSize: "10px", color: C.muted, fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>{label}</div>
        <div style={{ fontSize: "26px", fontWeight: 800, color: color || C.text, lineHeight: 1, fontFamily: "'Syne',sans-serif" }}>{value}</div>
        {sub && <div style={{ fontSize: "10px", color: C.dim, marginTop: "3px" }}>{sub}</div>}
      </div>
    );
  }

  function MBar({ label, pct, color, sub }) {
    return (
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>
          <span style={{ color: color || C.accent, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ height: "5px", background: C.surface3, borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(Number(pct), 100)}%`, background: color || C.accent, borderRadius: "3px" }} />
        </div>
        {sub && <div style={{ fontSize: "10px", color: C.dim, marginTop: "2px" }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "22px", fontWeight: 800, margin: "0 0 2px" }}>ダッシュボード</h2>
          <p style={{ color: C.muted, fontSize: "13px", margin: 0 }}>{now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 現在</p>
        </div>
        <button style={S.btn} onClick={() => setPage("input")}>＋ 新規入力</button>
      </div>

      {/* Count row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <KCard label="総出会い数" value={totMet} sub="人" color={C.text} />
        <KCard label="送客人数" value={totRef} sub="人" color="#60a5fa" />
        <KCard label="面談獲得" value={totMeet} sub="人" color="#fbbf24" />
        <KCard label="友達登録" value={totFriend} sub="人" color="#22c55e" />
        <KCard label="NA設定" value={totNA} sub="人" color="#a78bfa" />
      </div>

      {/* Rate row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        <KCard label="送客率" value={fmt(totRef, totMet)} sub="送客÷出会い" color="#60a5fa" />
        <KCard label="着地率" value={fmt(totFriend, totRef)} sub="友達÷送客" color="#34d399" />
        <KCard label="面談率" value={fmt(totMeet, totRef)} sub="面談÷送客" color="#fbbf24" />
        <KCard label="出会い面談率" value={fmt(totMeet, totMet)} sub="面談÷出会い" color="#f472b6" />
        <KCard label="NA率" value={fmt(totNA, totMet)} sub="NA設定÷出会い" color="#a78bfa" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        {/* Monthly chart */}
        <div style={S.card}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>月別推移（直近6ヶ月）</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
            {barKeys.map((k, i) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: C.muted }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: barCols[i], display: "inline-block" }} />
                {barLabs[i]}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "90px" }}>
            {mStats.map((m, mi) => (
              <div key={mi} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", display: "flex", gap: "1px", alignItems: "flex-end", height: "78px" }}>
                  {barKeys.map((k, i) => (
                    <div key={k} style={{
                      flex: 1, height: `${maxMet > 0 ? (m[k] / maxMet * 78) : 0}px`,
                      background: barCols[i], borderRadius: "2px 2px 0 0", minHeight: m[k] > 0 ? "3px" : "0", opacity: 0.85,
                    }} title={`${barLabs[i]}: ${m[k]}`} />
                  ))}
                </div>
                <div style={{ fontSize: "10px", color: C.dim, marginTop: "3px" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Place stats */}
        <div style={S.card}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>場所別 着地率</div>
          {placeStats.length === 0
            ? <div style={{ color: C.dim, fontSize: "13px" }}>データなし</div>
            : placeStats.map((s) => <MBar key={s.place} label={`${s.place} (${s.met}人)`} pct={s.land} color="#34d399" sub={`面談率: ${s.meet}%`} />)
          }
        </div>

        {/* Gender stats */}
        <div style={S.card}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>性別別 着地率</div>
          {gStats.length === 0
            ? <div style={{ color: C.dim, fontSize: "13px" }}>データなし</div>
            : gStats.map((s) => <MBar key={s.label} label={`${s.label} (${s.met}人)`} pct={s.land} color="#f472b6" />)
          }
        </div>

        {/* Ref type stats */}
        <div style={S.card}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>送客先別 着地率</div>
          {rtStats.length === 0
            ? <div style={{ color: C.dim, fontSize: "13px" }}>データなし</div>
            : rtStats.map((s) => <MBar key={s.t} label={`${s.emoji} ${s.label} (${s.cnt}件)`} pct={s.land} color={s.color} />)
          }
        </div>
      </div>

      {/* Overdue */}
      {overduePeople.length > 0 && (
        <div style={{ ...S.card, borderColor: `${C.danger}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: C.danger }}>⚠ 期限切れアクション ({overduePeople.length}件)</div>
            <button style={{ ...S.btnGhost, fontSize: "11px", padding: "4px 12px" }} onClick={() => setPage("actions")}>全て見る →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {overduePeople.slice(0, 4).map((p) => (
              <div key={p.id} style={{ display: "flex", gap: "12px", fontSize: "12px", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 700, color: C.text, minWidth: "60px" }}>{p.name}</span>
                <span style={{ color: C.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.next_action}</span>
                <span style={{ color: C.danger, fontWeight: 700, flexShrink: 0 }}>{p.next_action_due}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {people.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "60px", marginTop: "16px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>まだデータがありません</div>
          <div style={{ color: C.muted, fontSize: "13px", marginBottom: "20px" }}>最初の出会いを記録してみましょう</div>
          <button style={S.btn} onClick={() => setPage("input")}>＋ 最初の人物を入力する</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [subPage, setSubPage] = useState(null);
  const [people, setPeople] = useState(() => DB.people());
  const [referrals, setReferrals] = useState(() => DB.referrals());
  const [parsedData, setParsedData] = useState(null);
  const [origMemo, setOrigMemo] = useState("");
  const [toastState, setToastState] = useState({ msg: "", type: "success" });

  useEffect(() => { DB.savePeople(people); }, [people]);
  useEffect(() => { DB.saveReferrals(referrals); }, [referrals]);

  function showToast(msg, type = "success") {
    setToastState({ msg, type });
    setTimeout(() => setToastState({ msg: "", type: "success" }), 3000);
  }

  const overdueCount = people.filter((p) =>
    p.next_action && !p.next_action_done && p.next_action_due && new Date(p.next_action_due) < new Date()
  ).length;

  function navTo(p) { setSubPage(null); setPage(p); }

  function handleAIParsed(data, memo) { setParsedData(data); setOrigMemo(memo); setSubPage("confirm"); }

  function handleSaveNew(form) {
    const id = uid();
    const now = new Date().toISOString();
    setPeople((prev) => [{
      id, user_id: "local",
      name: form.name, met_date: form.met_date || null, met_place: form.met_place || null,
      age: form.age ? Number(form.age) : null, gender: form.gender || null,
      occupation: form.occupation || null, residence: form.residence || null,
      university: form.university || null, hometown: form.hometown || null,
      family_structure: form.family_structure || null, conversation: form.conversation || null,
      next_action: form.next_action || null, next_action_due: form.next_action_due || null,
      next_action_done: false,
      has_meeting: form.has_meeting || false, meeting_date: form.meeting_date || null,
      is_friend: form.is_friend || false, friended_date: form.friended_date || null,
      status: "active", notes: form.notes || null,
      last_contact_date: form.met_date || now.split("T")[0],
      created_at: now, updated_at: now,
    }, ...prev]);
    if (form.referral_types?.length > 0) {
      setReferrals((prev) => [...prev, ...form.referral_types.map((type) => ({
        id: uid(), person_id: id, user_id: "local", referral_type: type,
        referral_date: form.met_date || now.split("T")[0], result: null, created_at: now,
      }))]);
    }
    showToast(`${form.name}を登録しました`);
    setSubPage(null); setPage("people");
  }

  function handleUpdate(id, form) {
    setPeople((prev) => prev.map((p) => p.id !== id ? p : {
      ...p, name: form.name, met_date: form.met_date||null, met_place: form.met_place||null,
      age: form.age ? Number(form.age) : null, gender: form.gender||null,
      occupation: form.occupation||null, residence: form.residence||null,
      university: form.university||null, hometown: form.hometown||null,
      family_structure: form.family_structure||null, conversation: form.conversation||null,
      next_action: form.next_action||null, next_action_due: form.next_action_due||null,
      next_action_done: form.next_action_done||false,
      has_meeting: form.has_meeting||false, meeting_date: form.meeting_date||null,
      is_friend: form.is_friend||false, friended_date: form.friended_date||null,
      status: form.status||"active", notes: form.notes||null,
      updated_at: new Date().toISOString(),
    }));
    setReferrals((prev) => [
      ...prev.filter((r) => r.person_id !== id),
      ...(form.referral_types||[]).map((type) => ({
        id: uid(), person_id: id, user_id: "local", referral_type: type,
        referral_date: form.met_date || new Date().toISOString().split("T")[0],
        result: null, created_at: new Date().toISOString(),
      })),
    ]);
    showToast("保存しました");
    setSubPage(`detail:${id}`);
  }

  function handleDelete(id) {
    const p = people.find((x) => x.id === id);
    setPeople((prev) => prev.filter((x) => x.id !== id));
    setReferrals((prev) => prev.filter((r) => r.person_id !== id));
    showToast(`${p?.name}を削除しました`);
    setSubPage(null); setPage("people");
  }

  function handleToggleNA(id) {
    setPeople((prev) => prev.map((p) => p.id === id ? { ...p, next_action_done: !p.next_action_done } : p));
  }

  const navPage = subPage?.startsWith("detail") || subPage?.startsWith("edit") ? "people" : page;

  function renderContent() {
    if (subPage === "confirm") return (
      <ConfirmPage parsed={parsedData} originalMemo={origMemo} onSave={handleSaveNew} onBack={() => setSubPage(null)} toast={showToast} />
    );
    if (subPage?.startsWith("detail:")) {
      const id = subPage.split(":")[1];
      return (
        <PersonDetail personId={id} people={people} referrals={referrals}
          onBack={() => setSubPage(null)} onEdit={() => setSubPage(`edit:${id}`)}
          onDelete={handleDelete} onToggleNA={handleToggleNA} />
      );
    }
    if (subPage?.startsWith("edit:")) {
      const id = subPage.split(":")[1];
      return (
        <EditPersonPage personId={id} people={people} referrals={referrals}
          onSave={handleUpdate} onBack={() => setSubPage(`detail:${id}`)} toast={showToast} />
      );
    }
    if (page === "dashboard") return <Dashboard people={people} referrals={referrals} setPage={navTo} />;
    if (page === "input") return <InputPage onConfirm={handleAIParsed} toast={showToast} />;
    if (page === "people") return (
      <PeoplePage people={people} referrals={referrals} onSelect={(id) => setSubPage(`detail:${id}`)} onNew={() => navTo("input")} />
    );
    if (page === "actions") return (
      <ActionsPage people={people} onSelect={(id) => setSubPage(`detail:${id}`)} onToggleNA={handleToggleNA} />
    );
    return null;
  }

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Syne',sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <Nav page={navPage} setPage={navTo} overdueCount={overdueCount} />
      <main>{renderContent()}</main>
      <Toast msg={toastState.msg} type={toastState.type} />
    </div>
  );
}
