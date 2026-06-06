import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";

// ── Supabase client ────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEFAULT_PIN = "1234";

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
const validCode = (c) => /^EC\d{3,5}$/.test(c.toUpperCase());

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:      "#0a0e17",
  panel:   "#111726",
  panel2:  "#0d131f",
  line:    "#1d2738",
  line2:   "#2a3850",
  txt:     "#e7eef9",
  muted:   "#8197b8",
  muted2:  "#5e7088",
  accent:  "#38bdf8",
  accentD: "#0ea5e9",
  ok:      "#34d399",
  warn:    "#f5b14c",
  loc:     "#7fb4e0",
  signal:  "#f0563f",
};
const FS = "'IBM Plex Sans', system-ui, -apple-system, sans-serif";
const FM = "'IBM Plex Mono', 'Courier New', monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.vlr, .vlr *{ box-sizing:border-box; }
.vlr ::selection{ background:rgba(56,189,248,.28); }
.vlr input::placeholder{ color:${C.muted2}; }
.vlr input:focus, .vlr select:focus{ border-color:${C.accent} !important; box-shadow:0 0 0 3px rgba(56,189,248,.13); }
.vlr input:disabled{ opacity:.5; cursor:not-allowed; }
.vlr button{ transition:background .15s ease, border-color .15s ease, color .15s ease, filter .15s ease, transform .1s ease; }
.vlr button:active{ transform:translateY(1px); }
.vlr .btn-primary:hover{ background:${C.accentD}; box-shadow:0 8px 22px -12px rgba(56,189,248,.85); }
.vlr .btn-ghost:hover{ border-color:${C.line2}; color:${C.txt}; background:${C.panel}; }
.vlr .iconbtn:hover{ filter:brightness(1.3); }
.vlr .card-hover{ transition:border-color .15s ease, background .15s ease; }
.vlr .card-hover:hover{ border-color:${C.line2}; }
.vlr .row-hover:hover td{ background:rgba(56,189,248,.04); }
.vlr select{ background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238197b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 13px center; }
.vlr option{ background:${C.panel}; color:${C.txt}; }
.vlr ::-webkit-scrollbar{ width:10px; height:10px; }
.vlr ::-webkit-scrollbar-thumb{ background:${C.line}; border-radius:8px; border:2px solid transparent; background-clip:padding-box; }
.vlr ::-webkit-scrollbar-thumb:hover{ background:${C.line2}; background-clip:padding-box; }
@keyframes vlrFade{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@keyframes vlrPulse{ 0%,100%{ opacity:.35; } 50%{ opacity:1; } }
.vlr .modal-card{ animation:vlrFade .22s ease; }
`;

const S = {
  input: { width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 13px", color: C.txt, fontFamily: FM, fontSize: 13, outline: "none", boxSizing: "border-box" },
  tag: (color) => ({ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FM, fontSize: 11.5, padding: "3px 9px", borderRadius: 7, border: `1px solid ${color}3a`, background: `${color}14`, color, lineHeight: 1.6, whiteSpace: "nowrap" }),
};

// ── Line icons ─────────────────────────────────────────────────
const PATHS = {
  search:  <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  sliders: <><path d="M4 7h16" /><path d="M4 17h16" /><circle cx="9" cy="7" r="2.4" /><circle cx="15" cy="17" r="2.4" /></>,
  swap:    <><path d="M4 8h13l-3.4-3.4" /><path d="M20 16H7l3.4 3.4" /></>,
  box:     <><path d="M3.5 7.5 12 3l8.5 4.5L12 12 3.5 7.5z" /><path d="M3.5 7.5V16L12 20.5 20.5 16V7.5" /><path d="M12 12v8.5" /></>,
  pin:     <><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></>,
  tag:     <><path d="M11 3H5a2 2 0 0 0-2 2v6l9 9 8-8-9-9z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  user:    <><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /></>,
  key:     <><circle cx="8" cy="15" r="3.4" /><path d="M10.4 12.6 20 3" /><path d="M16.5 6.5 19 9" /><path d="M14 9l2 2" /></>,
  edit:    <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  trash:   <><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6.5 7l1 12.5h9l1-12.5" /></>,
  camera:  <><path d="M4 8.5h3L8.4 6h7.2L17 8.5h3v10.5H4z" /><circle cx="12" cy="13.2" r="3.1" /></>,
  check:   <path d="M5 13l4 4L19 7" />,
  arrowR:  <><path d="M5 12h13" /><path d="M12.5 6l6 6-6 6" /></>,
  arrowL:  <><path d="M19 12H6" /><path d="M11.5 18l-6-6 6-6" /></>,
  close:   <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  clock:   <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5V12l3 1.8" /></>,
  stop:    <rect x="6" y="6" width="12" height="12" rx="2" />,
  plus:    <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  save:    <><path d="M5 5h11l3 3v11H5z" /><path d="M8 5v5h7V5" /><path d="M8 19v-6h8v6" /></>,
  list:    <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><circle cx="4.5" cy="6" r="1.1" /><circle cx="4.5" cy="12" r="1.1" /><circle cx="4.5" cy="18" r="1.1" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" /><path d="M3 4.5V8h3.5" /><path d="M12 8v4l3 1.8" /></>,
  lock:    <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  alert:   <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.2" /><circle cx="12" cy="17.3" r="0.7" fill="currentColor" stroke="none" /></>,
};
function Icon({ name, size = 16, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}>
      {PATHS[name]}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
export default function App() {
  const [loaded, setLoaded]         = useState(false);
  const [tab, setTab]               = useState("estoque");
  const [produtos, setProdutos]     = useState([]);
  const [historico, setHistorico]   = useState([]);
  const [locais, setLocais]         = useState([]);
  const [resps, setResps]           = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pin, setPin]               = useState(DEFAULT_PIN);
  const [search, setSearch]         = useState("");

  // modals
  const [showMove, setShowMove]       = useState(false);
  const [showAdmin, setShowAdmin]     = useState(false);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput]       = useState("");
  const [pinError, setPinError]       = useState("");
  const [pinTarget, setPinTarget]     = useState(null);

  // movimentação wizard
  const [mvStep, setMvStep]             = useState(1);
  const [mvProdInput, setMvProdInput]   = useState("");
  const [mvProdObj, setMvProdObj]       = useState(null);
  const [mvLocalInput, setMvLocalInput] = useState("");
  const [mvRespInput, setMvRespInput]   = useState("");
  const [mvError, setMvError]           = useState("");
  const [mvScanActive, setMvScanActive] = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const scanTimer = useRef(null);

  // admin
  const [adminTab, setAdminTab] = useState("produtos");
  const [adminMsg, setAdminMsg] = useState("");
  const [apCode, setApCode]   = useState("");
  const [apName, setApName]   = useState("");
  const [apCat,  setApCat]    = useState("");
  const [apLocal, setApLocal] = useState("");
  const [apEdit, setApEdit]   = useState(null);
  const [apError, setApError] = useState("");
  const [alVal, setAlVal]     = useState("");
  const [alEdit, setAlEdit]   = useState(null);
  const [arVal, setArVal]     = useState("");
  const [arEdit, setArEdit]   = useState(null);
  const [acVal, setAcVal]     = useState("");
  const [acEdit, setAcEdit]   = useState(null);
  const [ep1, setEp1]         = useState("");
  const [ep2, setEp2]         = useState("");

  // ── Load from Supabase ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [
        { data: prods },
        { data: hist },
        { data: locs },
        { data: rs },
        { data: cats },
      ] = await Promise.all([
        supabase.from("produtos").select("*").order("created_at", { ascending: true }),
        supabase.from("historico").select("*").order("data", { ascending: false }),
        supabase.from("locais").select("*"),
        supabase.from("responsaveis").select("*"),
        supabase.from("categorias").select("*"),
      ]);
      setProdutos(prods || []);
      setHistorico(hist || []);
      setLocais((locs || []).map(l => l.nome));
      setResps((rs || []).map(r => r.nome));
      setCategorias((cats || []).map(c => c.nome));

      // PIN lido do Supabase (sincronizado entre dispositivos)
      const { data: configPin } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "pin")
        .maybeSingle();

      if (configPin?.valor) {
        setPin(configPin.valor);
        localStorage.setItem("est-pin", configPin.valor);
      } else {
        const savedPin = localStorage.getItem("est-pin");
        if (savedPin) setPin(savedPin);
      }

      setLoaded(true);
    };
    load();
  }, []);

  // ── PIN ───────────────────────────────────────────────────
  const savePin = async (p) => {
    setPin(p);
    localStorage.setItem("est-pin", p);
    await supabase
      .from("configuracoes")
      .upsert({ chave: "pin", valor: p }, { onConflict: "chave" });
  };

  const askPin = (fn) => { setPinTarget(() => fn); setPinInput(""); setPinError(""); setShowPinGate(true); };
  const confirmPin = () => {
    if (pinInput === pin) { setShowPinGate(false); pinTarget && pinTarget(); }
    else { setPinError("PIN incorreto"); setPinInput(""); }
  };

  // ── QR Scanner ────────────────────────────────────────────
  const stopScan = () => {
    clearInterval(scanTimer.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setMvScanActive(false);
  };

  const startScan = async (onResult) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play(); // ← Bug 1 corrigido: aguarda o vídeo iniciar
      }
      setMvScanActive(true);
      const handle = (text) => { stopScan(); onResult(text.trim()); };

      if ("BarcodeDetector" in window) {
        const bd = new BarcodeDetector({ formats: ["qr_code"] });
        scanTimer.current = setInterval(async () => {
          try {
            if (!videoRef.current?.videoWidth) return; // ← Bug 2 corrigido
            const c = await bd.detect(videoRef.current);
            if (c.length > 0) handle(c[0].rawValue);
          } catch (_) {}
        }, 300);
      } else {

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        scanTimer.current = setInterval(() => {
          if (!videoRef.current?.videoWidth) return;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height);
          if (code) handle(code.data);
        }, 300);
      }
    } catch (e) {
      alert("Câmera indisponível: " + e.message);
    }
  };

  useEffect(() => () => stopScan(), []);

  // ── Movimentação ──────────────────────────────────────────
  const openMove = () => {
    setMvStep(1); setMvProdInput(""); setMvProdObj(null);
    setMvLocalInput(""); setMvRespInput(""); setMvError("");
    stopScan(); setShowMove(true);
  };
  const closeMove = () => { stopScan(); setShowMove(false); };

  const mvStep1Next = () => {
    setMvError("");
    const code = mvProdInput.toUpperCase().trim();
    if (!validCode(code)) { setMvError("Código inválido. Use o formato EC + 3 a 5 números"); return; }
    const prod = produtos.find(p => p.code === code);
    if (!prod) { setMvError("Produto não encontrado"); return; }
    setMvProdObj(prod); setMvStep(2);
  };

  const mvStep2Next = () => {
    setMvError("");
    const loc = mvLocalInput.trim();
    if (!loc) { setMvError("Selecione ou escaneie o local de destino"); return; }
    if (!locais.includes(loc)) { setMvError("Local não reconhecido"); return; }
    if (loc === mvProdObj.shelf) { setMvError("O produto já está neste local"); return; }
    setMvStep(3);
  };

  const mvStep3Confirm = async () => {
    setMvError("");
    if (!mvRespInput) { setMvError("Selecione o responsável"); return; }

    const now = new Date().toISOString();
    const evento = {
      id: Date.now(),
      code: mvProdObj.code,
      de: mvProdObj.shelf,
      para: mvLocalInput,
      responsavel: mvRespInput,
      data: now,
    };

    // Salva histórico no Supabase
    await supabase.from("historico").insert([evento]);

    // Atualiza shelf do produto no Supabase
    await supabase.from("produtos").update({ shelf: mvLocalInput }).eq("code", mvProdObj.code);

    // Atualiza estado local
    setProdutos(prev => prev.map(p => p.code === mvProdObj.code ? { ...p, shelf: mvLocalInput } : p));
    setHistorico(prev => [evento, ...prev]);

    stopScan();
    setMvStep(1); setMvProdInput(""); setMvProdObj(null);
    setMvLocalInput(""); setMvRespInput(""); setMvError("");
    setShowMove(false);
  };

  const scanStep1 = () => startScan((val) => {
    const code = val.toUpperCase();
    if (!validCode(code)) { setMvError("QR inválido: esperado EC + 3 a 5 números"); return; }
    const prod = produtos.find(p => p.code === code);
    if (!prod) { setMvError("Produto não encontrado: " + code); return; }
    setMvProdInput(code); setMvProdObj(prod); setMvStep(2);
  });

  const scanStep2 = () => startScan((val) => {
    if (!locais.includes(val)) { setMvError("Local não reconhecido: " + val); return; }
    setMvLocalInput(val); setMvStep(3);
  });

  // ── Admin – Produtos ──────────────────────────────────────
  const startAddProd  = () => { setApEdit(null); setApCode(""); setApName(""); setApCat(""); setApLocal(""); setApError(""); };
  const startEditProd = (p) => { setApEdit(p); setApCode(p.code); setApName(p.name || ""); setApCat(p.category || ""); setApLocal(p.shelf || ""); setApError(""); };

  const saveProd = async () => {
    setApError("");
    const code = apCode.toUpperCase().trim();
    if (!validCode(code))                           { setApError("Código deve ser EC + 3 a 5 números"); return; }
    if (!apLocal)                                   { setApError("Selecione o local de armazenamento"); return; }
    if (!apEdit && produtos.find(p => p.code === code)) { setApError("Produto já cadastrado"); return; }

    if (apEdit) {
      await supabase.from("produtos").update({ code, name: apName.trim(), category: apCat, shelf: apLocal }).eq("code", apEdit.code);
      setProdutos(prev => prev.map(p => p.code === apEdit.code ? { ...p, code, name: apName.trim(), category: apCat, shelf: apLocal } : p));
    } else {
      const novo = { code, name: apName.trim(), category: apCat, shelf: apLocal, created_at: new Date().toISOString() };
      await supabase.from("produtos").insert([novo]);
      setProdutos(prev => [...prev, novo]);
    }

    setApEdit(null); setApCode(""); setApName(""); setApCat(""); setApLocal(""); setApError("");
    setAdminMsg(apEdit ? "Produto atualizado!" : "Produto cadastrado!"); setTimeout(() => setAdminMsg(""), 3000);
  };

  const deleteProd = async (code) => {
    if (!window.confirm(`Excluir produto ${code}?`)) return;
    await supabase.from("produtos").delete().eq("code", code);
    setProdutos(prev => prev.filter(p => p.code !== code));
    setAdminMsg("Produto excluído."); setTimeout(() => setAdminMsg(""), 3000);
  };

  // ── Admin – Locais ────────────────────────────────────────
  const saveLocal = async () => {
    const v = alVal.trim();
    if (!v) { setAdminMsg("Nome inválido."); return; }
    if (!alEdit && locais.includes(v)) { setAdminMsg("Local já existe."); return; }

    if (alEdit) {
      await supabase.from("locais").update({ nome: v }).eq("nome", alEdit);
      await supabase.from("produtos").update({ shelf: v }).eq("shelf", alEdit);
      setLocais(prev => prev.map(l => l === alEdit ? v : l));
      setProdutos(prev => prev.map(p => p.shelf === alEdit ? { ...p, shelf: v } : p));
    } else {
      await supabase.from("locais").insert([{ nome: v }]);
      setLocais(prev => [...prev, v]);
    }

    setAlVal(""); setAlEdit(null);
    setAdminMsg(alEdit ? "Local atualizado!" : "Local adicionado!"); setTimeout(() => setAdminMsg(""), 3000);
  };

  const deleteLocal = async (l) => {
    if (!window.confirm(`Excluir local "${l}"?`)) return;
    await supabase.from("locais").delete().eq("nome", l);
    setLocais(prev => prev.filter(x => x !== l));
    setAdminMsg("Local excluído."); setTimeout(() => setAdminMsg(""), 3000);
  };

  // ── Admin – Responsáveis ──────────────────────────────────
  const saveResp = async () => {
    const v = arVal.trim();
    if (!v) { setAdminMsg("Nome inválido."); return; }
    if (!arEdit && resps.includes(v)) { setAdminMsg("Responsável já existe."); return; }

    if (arEdit) {
      await supabase.from("responsaveis").update({ nome: v }).eq("nome", arEdit);
      setResps(prev => prev.map(r => r === arEdit ? v : r));
    } else {
      await supabase.from("responsaveis").insert([{ nome: v }]);
      setResps(prev => [...prev, v]);
    }

    setArVal(""); setArEdit(null);
    setAdminMsg(arEdit ? "Usuário atualizado!" : "Usuário adicionado!"); setTimeout(() => setAdminMsg(""), 3000);
  };

  const deleteResp = async (r) => {
    if (!window.confirm(`Excluir usuário "${r}"?`)) return;
    await supabase.from("responsaveis").delete().eq("nome", r);
    setResps(prev => prev.filter(x => x !== r));
    setAdminMsg("Usuário excluído."); setTimeout(() => setAdminMsg(""), 3000);
  };

  // ── Admin – Categorias ────────────────────────────────────
  const saveCat = async () => {
    const v = acVal.trim();
    if (!v) { setAdminMsg("Nome inválido."); return; }
    if (!acEdit && categorias.includes(v)) { setAdminMsg("Categoria já existe."); return; }

    if (acEdit) {
      await supabase.from("categorias").update({ nome: v }).eq("nome", acEdit);
      setCategorias(prev => prev.map(c => c === acEdit ? v : c));
    } else {
      await supabase.from("categorias").insert([{ nome: v }]);
      setCategorias(prev => [...prev, v]);
    }

    setAcVal(""); setAcEdit(null);
    setAdminMsg(acEdit ? "Categoria atualizada!" : "Categoria adicionada!"); setTimeout(() => setAdminMsg(""), 3000);
  };

  const deleteCat = async (c) => {
    if (!window.confirm(`Excluir categoria "${c}"?`)) return;
    await supabase.from("categorias").delete().eq("nome", c);
    setCategorias(prev => prev.filter(x => x !== c));
    setAdminMsg("Categoria excluída."); setTimeout(() => setAdminMsg(""), 3000);
  };

  // ── Admin – PIN ───────────────────────────────────────────
  const changePin = async () => {
    if (ep1.length < 4) { setAdminMsg("PIN deve ter pelo menos 4 dígitos."); return; }
    if (ep1 !== ep2)    { setAdminMsg("PINs não coincidem."); return; }
    await savePin(ep1); setEp1(""); setEp2("");
    setAdminMsg("PIN alterado com sucesso!"); setTimeout(() => setAdminMsg(""), 3000);
  };

  // ── Filtered list ─────────────────────────────────────────
  const filtered = produtos.filter(p =>
    p.code.includes(search.toUpperCase()) ||
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.shelf || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!loaded) return (
    <div className="vlr" style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, color: C.muted, fontFamily: FM }}>
      <style>{CSS}</style>
      <div style={{ color: C.accent, animation: "vlrPulse 1.4s ease-in-out infinite" }}><Icon name="box" size={32} /></div>
      <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Carregando…</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  return (
    <div className="vlr" style={{
      minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: FS,
      backgroundImage: `radial-gradient(1100px 480px at 75% -12%, rgba(56,189,248,0.07), transparent 60%), linear-gradient(rgba(129,151,184,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(129,151,184,0.045) 1px, transparent 1px)`,
      backgroundSize: "100% 100%, 34px 34px, 34px 34px",
    }}>
      <style>{CSS}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.line}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "linear-gradient(180deg, rgba(17,23,38,0.55), transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #142036, #0c1220)", border: `1px solid ${C.line2}`, color: C.accent, boxShadow: "0 0 0 1px rgba(56,189,248,0.07), 0 10px 22px -14px rgba(56,189,248,0.6)" }}>
            <Icon name="box" size={22} />
          </div>
          <div>
            <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", marginBottom: 4 }}>Vallourec</div>
            <div style={{ fontFamily: FS, fontSize: 19, fontWeight: 700, letterSpacing: 0.2, color: C.txt }}>Estoque de Tubo Padrão</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={S.tag(C.accent)}>{produtos.length} padrões cadastrados</span>
          <button className="btn-ghost" onClick={() => askPin(() => { setAdminMsg(""); setAdminTab("produtos"); startAddProd(); setShowAdmin(true); })}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontFamily: FS, fontSize: 12.5, fontWeight: 500 }}>
            <Icon name="sliders" size={15} /> Admin
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, padding: "0 28px", gap: 4 }}>
        {["estoque", "historico"].map(t => {
          const on = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer",
              padding: "14px 14px", fontFamily: FM, fontSize: 11.5, letterSpacing: 1,
              color: on ? C.accent : C.muted2,
              borderBottom: on ? `2px solid ${C.accent}` : "2px solid transparent",
              textTransform: "uppercase", fontWeight: on ? 600 : 400, marginBottom: -1,
            }}>
              <Icon name={t === "estoque" ? "list" : "history"} size={15} />
              {t === "estoque" ? "Lista de padrões" : "Histórico de movimentações"}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {tab === "estoque" && <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.muted2, pointerEvents: "none", display: "flex" }}><Icon name="search" size={16} /></span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, nome ou local…" style={{ ...S.input, paddingLeft: 38 }} />
            </div>
            <button className="btn-primary" onClick={openMove} style={{
              display: "inline-flex", alignItems: "center", gap: 8, background: C.accent, color: "#04121d", border: "none", borderRadius: 9,
              padding: "0 18px", cursor: "pointer", fontFamily: FS, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            }}><Icon name="swap" size={16} /> Realizar movimentação</button>
          </div>

          {filtered.length === 0
            ? <div style={{ textAlign: "center", color: C.muted2, padding: "64px 0", fontSize: 13.5, fontFamily: FM }}>
                {produtos.length === 0 ? "Nenhum produto cadastrado." : "Nenhum resultado."}
              </div>
            : <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", background: C.panel2 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
                        {["Código", "Descrição", "Categoria do padrão", "Local de armazenamento"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "12px 14px", color: C.muted2, fontWeight: 500, letterSpacing: 1, fontSize: 10, textTransform: "uppercase", fontFamily: FM, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr key={p.code} className="row-hover" style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
                          <td style={{ padding: "12px 14px", fontFamily: FM, fontWeight: 600, color: C.accent, letterSpacing: 0.5 }}>{p.code}</td>
                          <td style={{ padding: "12px 14px", color: C.muted }}>{p.name || <Em />}</td>
                          <td style={{ padding: "12px 14px", color: C.muted }}>{p.category || <Em />}</td>
                          <td style={{ padding: "12px 14px" }}><span style={S.tag(C.loc)}><Icon name="pin" size={12} />{p.shelf}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          }
        </>}

        {tab === "historico" && <>
          <div style={{ marginBottom: 16, color: C.muted2, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: FM }}>
            {historico.length} {historico.length === 1 ? "movimentação registrada" : "movimentações registradas"}
          </div>
          {historico.length === 0
            ? <div style={{ textAlign: "center", color: C.muted2, padding: "64px 0", fontSize: 13.5, fontFamily: FM }}>Nenhuma movimentação registrada.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historico.map(h => (
                  <div key={h.id} className="card-hover" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FM, color: C.accent, fontWeight: 600, letterSpacing: 0.5, minWidth: 72 }}>{h.code}</span>
                    <span style={S.tag(C.loc)}>{h.de}</span>
                    <Icon name="arrowR" size={15} color={C.muted2} />
                    <span style={S.tag(C.ok)}>{h.para}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 12, marginLeft: "auto" }}><Icon name="user" size={14} />{h.responsavel}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted2, fontSize: 11, fontFamily: FM }}><Icon name="clock" size={13} />{fmt(h.data)}</span>
                  </div>
                ))}
              </div>
          }
        </>}
      </main>

      {/* ══ MODAL: MOVIMENTAÇÃO WIZARD ══ */}
      {showMove && <Modal title={<><Icon name="swap" size={18} color={C.accent} /> Realizar movimentação</>} onClose={closeMove}>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[["1", "Produto"], ["2", "Local"], ["3", "Responsável"]].map(([n, l], i) => {
            const active = mvStep === i + 1, done = mvStep > i + 1;
            const col = done ? C.ok : active ? C.accent : C.muted2;
            return (
              <div key={n} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 9, fontSize: 11, fontFamily: FM, letterSpacing: 0.5,
                background: done ? `${C.ok}12` : active ? `${C.accent}12` : C.panel2,
                border: `1px solid ${done ? `${C.ok}3a` : active ? `${C.accent}55` : C.line}`,
                color: col, fontWeight: active ? 600 : 400,
              }}>{done ? <Icon name="check" size={13} /> : <span>{n}.</span>}{l}</div>
            );
          })}
        </div>

        {mvStep === 1 && <>
          <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>Escaneie o QR Code do produto ou digite o código manualmente.</div>
          <Lbl>Código do produto *</Lbl>
          <input value={mvProdInput} onChange={e => setMvProdInput(e.target.value.toUpperCase())}
            placeholder="EC001" maxLength={7} style={S.input} onKeyDown={e => e.key === "Enter" && mvStep1Next()} />
          {mvError && <Err>{mvError}</Err>}
          <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000", display: mvScanActive ? "block" : "none", maxHeight: 220, marginTop: 12, border: `1px solid ${C.line}` }} playsInline muted />
          {!mvScanActive
            ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.panel2, border: `1px dashed ${C.line2}`, borderRadius: 10, height: 52, color: C.muted2, fontSize: 12, marginTop: 8, cursor: "pointer", fontFamily: FM }} onClick={scanStep1}><Icon name="camera" size={16} /> Toque para escanear QR Code</div>
            : <button onClick={stopScan} style={{ marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${C.signal}14`, color: C.signal, border: `1px solid ${C.signal}40`, borderRadius: 9, padding: "9px", cursor: "pointer", fontFamily: FS, fontSize: 12.5 }}><Icon name="stop" size={14} /> Parar câmera</button>
          }
          <Row><Btn2 onClick={closeMove}>Cancelar</Btn2><Btn1 onClick={mvStep1Next}>Próximo <Icon name="arrowR" size={15} /></Btn1></Row>
        </>}

        {mvStep === 2 && <>
          <div style={{ background: `${C.ok}10`, border: `1px solid ${C.ok}33`, borderRadius: 10, padding: "11px 13px", marginBottom: 12, fontSize: 12.5, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Icon name="check" size={16} color={C.ok} style={{ marginTop: 2 }} />
            <div>
              Produto: <strong style={{ color: C.accent, fontFamily: FM }}>{mvProdObj?.code}</strong>
              {mvProdObj?.name && <span style={{ color: C.muted }}> — {mvProdObj.name}</span>}
              <div style={{ color: C.muted2, fontSize: 11, marginTop: 3, fontFamily: FM }}>Local atual: {mvProdObj?.shelf}</div>
            </div>
          </div>
          <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>Escaneie o QR Code do local de destino ou selecione manualmente.</div>
          <Lbl>Local de armazenamento de destino *</Lbl>
          <Select value={mvLocalInput} onChange={e => setMvLocalInput(e.target.value)} placeholder="Selecione o local" options={locais} />
          {mvError && <Err>{mvError}</Err>}
          <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000", display: mvScanActive ? "block" : "none", maxHeight: 220, marginTop: 12, border: `1px solid ${C.line}` }} playsInline muted />
          {!mvScanActive
            ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.panel2, border: `1px dashed ${C.line2}`, borderRadius: 10, height: 52, color: C.muted2, fontSize: 12, marginTop: 8, cursor: "pointer", fontFamily: FM }} onClick={scanStep2}><Icon name="camera" size={16} /> Toque para escanear QR Code</div>
            : <button onClick={stopScan} style={{ marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${C.signal}14`, color: C.signal, border: `1px solid ${C.signal}40`, borderRadius: 9, padding: "9px", cursor: "pointer", fontFamily: FS, fontSize: 12.5 }}><Icon name="stop" size={14} /> Parar câmera</button>
          }
          <Row><Btn2 onClick={() => { stopScan(); setMvStep(1); setMvError(""); }}><Icon name="arrowL" size={15} /> Voltar</Btn2><Btn1 onClick={mvStep2Next}>Próximo <Icon name="arrowR" size={15} /></Btn1></Row>
        </>}

        {mvStep === 3 && <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "13px 14px", marginBottom: 14, fontSize: 12.5 }}>
            <div style={{ marginBottom: 8 }}>Produto: <strong style={{ color: C.accent, fontFamily: FM }}>{mvProdObj?.code}</strong>{mvProdObj?.name && <span style={{ color: C.muted }}> — {mvProdObj.name}</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: C.muted2 }}>De</span><span style={S.tag(C.loc)}>{mvProdObj?.shelf}</span>
              <Icon name="arrowR" size={15} color={C.muted2} />
              <span style={{ color: C.muted2 }}>Para</span><span style={S.tag(C.ok)}>{mvLocalInput}</span>
            </div>
          </div>
          <Lbl>Responsável pela movimentação *</Lbl>
          <Select value={mvRespInput} onChange={e => setMvRespInput(e.target.value)} placeholder="Selecione o responsável" options={resps} />
          {mvError && <Err>{mvError}</Err>}
          <Row>
            <Btn2 onClick={() => { setMvStep(2); setMvError(""); }}><Icon name="arrowL" size={15} /> Voltar</Btn2>
            <Btn1 onClick={mvStep3Confirm}><Icon name="check" size={15} /> Confirmar</Btn1>
          </Row>
        </>}
      </Modal>}

      {/* ══ MODAL: PIN GATE ══ */}
      {showPinGate && <Modal title={<><Icon name="lock" size={18} color={C.accent} /> Área restrita</>} onClose={() => setShowPinGate(false)}>
        <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 14 }}>Digite o PIN de administrador:</div>
        <input type="password" inputMode="numeric" maxLength={8} value={pinInput}
          onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && confirmPin()}
          placeholder="••••" style={{ ...S.input, fontSize: 22, letterSpacing: 8, textAlign: "center" }} />
        {pinError && <Err>{pinError}</Err>}
        <Row><Btn2 onClick={() => setShowPinGate(false)}>Cancelar</Btn2><Btn1 onClick={confirmPin}>Entrar</Btn1></Row>
      </Modal>}

      {/* ══ MODAL: ADMIN ══ */}
      {showAdmin && <Modal title={<><Icon name="sliders" size={18} color={C.accent} /> Administração</>} onClose={() => setShowAdmin(false)} wide>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {[["produtos", "Produtos", "box"], ["locais", "Locais", "pin"], ["categorias", "Categorias", "tag"], ["responsaveis", "Usuários", "user"], ["pin", "PIN", "key"]].map(([t, l, ic]) => {
            const on = adminTab === t;
            return (
              <button key={t} onClick={() => { setAdminTab(t); setAdminMsg(""); }}
                style={{ flex: 1, minWidth: 84, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "9px 4px", border: `1px solid ${on ? `${C.accent}55` : C.line}`, borderRadius: 10, cursor: "pointer", fontFamily: FM, fontSize: 10.5, letterSpacing: 0.5,
                  background: on ? `${C.accent}12` : C.panel2, color: on ? C.accent : C.muted2, fontWeight: on ? 600 : 400,
                }}><Icon name={ic} size={16} />{l}</button>
            );
          })}
        </div>

        {/* Produtos */}
        {adminTab === "produtos" && <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 600, fontFamily: FM }}>
              <Icon name={apEdit ? "edit" : "plus"} size={14} />{apEdit ? "Editar produto" : "Novo produto"}
            </div>
            <Lbl>Código *</Lbl>
            <input value={apCode} onChange={e => setApCode(e.target.value)} placeholder="EC001" maxLength={7} style={S.input} disabled={!!apEdit} />
            <Lbl>Descrição (opcional)</Lbl>
            <input value={apName} onChange={e => setApName(e.target.value)} placeholder="Ex: 244.48 x 13.84" style={S.input} />
            <Lbl>Categoria do padrão (opcional)</Lbl>
            <Select value={apCat} onChange={e => setApCat(e.target.value)} placeholder="Selecione a categoria" options={categorias} />
            <Lbl>Local de armazenamento *</Lbl>
            <Select value={apLocal} onChange={e => setApLocal(e.target.value)} placeholder="Selecione o local" options={locais} />
            {apError && <Err>{apError}</Err>}
            <Row>
              {apEdit && <Btn2 onClick={startAddProd}>Cancelar edição</Btn2>}
              <Btn1 onClick={saveProd}><Icon name={apEdit ? "save" : "plus"} size={15} /> {apEdit ? "Salvar" : "Cadastrar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 230, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {produtos.length === 0 && <div style={{ color: C.muted2, fontSize: 12, textAlign: "center", padding: "20px 0", fontFamily: FM }}>Nenhum produto cadastrado.</div>}
            {produtos.map(p => (
              <div key={p.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: C.accent, fontWeight: 600, fontFamily: FM }}>{p.code}</span>
                  {p.name && <span style={{ color: C.muted }}> — {p.name}</span>}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.muted2, fontSize: 11, marginTop: 3, fontFamily: FM }}><Icon name="pin" size={12} />{p.shelf}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <IconBtn onClick={() => startEditProd(p)} color={C.accent}><Icon name="edit" size={14} /></IconBtn>
                  <IconBtn onClick={() => deleteProd(p.code)} color={C.signal}><Icon name="trash" size={14} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Locais */}
        {adminTab === "locais" && <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600, fontFamily: FM }}>
              <Icon name={alEdit ? "edit" : "plus"} size={14} />{alEdit ? "Editar local" : "Novo local"}
            </div>
            <Lbl>Nome do local *</Lbl>
            <input value={alVal} onChange={e => setAlVal(e.target.value)} placeholder="Ex: Estaleiro 1" style={S.input} />
            <Row>
              {alEdit && <Btn2 onClick={() => { setAlEdit(null); setAlVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveLocal}><Icon name={alEdit ? "save" : "plus"} size={15} /> {alEdit ? "Salvar" : "Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 210, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {locais.length === 0 && <div style={{ color: C.muted2, fontSize: 12, textAlign: "center", padding: "20px 0", fontFamily: FM }}>Nenhum local cadastrado.</div>}
            {locais.map(l => (
              <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, color: C.loc }}><Icon name="pin" size={14} /> {l}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setAlEdit(l); setAlVal(l); }} color={C.accent}><Icon name="edit" size={14} /></IconBtn>
                  <IconBtn onClick={() => deleteLocal(l)} color={C.signal}><Icon name="trash" size={14} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Categorias */}
        {adminTab === "categorias" && <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600, fontFamily: FM }}>
              <Icon name={acEdit ? "edit" : "plus"} size={14} />{acEdit ? "Editar categoria" : "Nova categoria"}
            </div>
            <Lbl>Nome da categoria *</Lbl>
            <input value={acVal} onChange={e => setAcVal(e.target.value)} placeholder="Ex: Tubos Estruturais" style={S.input} />
            <Row>
              {acEdit && <Btn2 onClick={() => { setAcEdit(null); setAcVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveCat}><Icon name={acEdit ? "save" : "plus"} size={15} /> {acEdit ? "Salvar" : "Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 210, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {categorias.length === 0 && <div style={{ color: C.muted2, fontSize: 12, textAlign: "center", padding: "20px 0", fontFamily: FM }}>Nenhuma categoria cadastrada.</div>}
            {categorias.map(c => (
              <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, color: C.warn }}><Icon name="tag" size={14} /> {c}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setAcEdit(c); setAcVal(c); }} color={C.accent}><Icon name="edit" size={14} /></IconBtn>
                  <IconBtn onClick={() => deleteCat(c)} color={C.signal}><Icon name="trash" size={14} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Usuários */}
        {adminTab === "responsaveis" && <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600, fontFamily: FM }}>
              <Icon name={arEdit ? "edit" : "plus"} size={14} />{arEdit ? "Editar usuário" : "Novo usuário"}
            </div>
            <Lbl>Nome *</Lbl>
            <input value={arVal} onChange={e => setArVal(e.target.value)} placeholder="Ex: 701234 - Nome Sobrenome" style={S.input} />
            <Row>
              {arEdit && <Btn2 onClick={() => { setArEdit(null); setArVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveResp}><Icon name={arEdit ? "save" : "plus"} size={15} /> {arEdit ? "Salvar" : "Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 210, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {resps.length === 0 && <div style={{ color: C.muted2, fontSize: 12, textAlign: "center", padding: "20px 0", fontFamily: FM }}>Nenhum usuário cadastrado.</div>}
            {resps.map(r => (
              <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, color: C.txt }}><Icon name="user" size={14} color={C.accent} /> {r}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setArEdit(r); setArVal(r); }} color={C.accent}><Icon name="edit" size={14} /></IconBtn>
                  <IconBtn onClick={() => deleteResp(r)} color={C.signal}><Icon name="trash" size={14} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* PIN */}
        {adminTab === "pin" && <>
          <div style={{ color: C.muted, fontSize: 12.5, marginBottom: 14, lineHeight: 1.6 }}>Altere o PIN de administrador (mínimo 4 dígitos).<br />PIN padrão inicial: <strong style={{ color: C.txt, fontFamily: FM }}>1234</strong></div>
          <Lbl>Novo PIN</Lbl>
          <input type="password" inputMode="numeric" value={ep1} onChange={e => setEp1(e.target.value)} placeholder="••••" style={S.input} />
          <Lbl>Confirmar PIN</Lbl>
          <input type="password" inputMode="numeric" value={ep2} onChange={e => setEp2(e.target.value)} placeholder="••••" style={S.input} />
          <div style={{ marginTop: 14 }}><Btn1 onClick={changePin}><Icon name="save" size={15} /> Salvar novo PIN</Btn1></div>
        </>}

        {adminMsg && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14, color: C.ok, fontSize: 12.5, textAlign: "center", background: `${C.ok}12`, border: `1px solid ${C.ok}33`, borderRadius: 9, padding: "9px" }}><Icon name="check" size={14} />{adminMsg}</div>}
      </Modal>}

    </div>
  );
}

// ── Micro-components ──────────────────────────────────────────
function Em() { return <span style={{ color: C.muted2, fontStyle: "italic" }}>—</span>; }
function Lbl({ children }) { return <div style={{ fontFamily: FM, fontSize: 10, color: C.muted2, letterSpacing: 1.2, textTransform: "uppercase", margin: "14px 0 6px" }}>{children}</div>; }
function Err({ children }) { return <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.signal, fontSize: 12, marginTop: 7, fontFamily: FM }}><Icon name="alert" size={13} />{children}</div>; }
function Row({ children }) { return <div style={{ display: "flex", gap: 10, marginTop: 14 }}>{children}</div>; }
function Btn1({ onClick, children, style = {} }) {
  return <button className="btn-primary" onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.accent, color: "#04121d", border: "none", borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontFamily: FS, fontSize: 13, fontWeight: 600, letterSpacing: 0.2, ...style }}>{children}</button>;
}
function Btn2({ onClick, children }) {
  return <button className="btn-ghost" onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontFamily: FS, fontSize: 13, fontWeight: 500 }}>{children}</button>;
}
function IconBtn({ onClick, color, children, title }) {
  return <button className="iconbtn" onClick={onClick} title={title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: `1px solid ${color}33`, borderRadius: 8, width: 30, height: 28, cursor: "pointer", color }}>{children}</button>;
}
function Select({ value, onChange, placeholder, options }) {
  return (
    <select value={value} onChange={onChange} style={{ width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 36px 10px 13px", color: C.txt, fontFamily: FM, fontSize: 13, outline: "none", boxSizing: "border-box", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,15,0.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div className="modal-card" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: wide ? 500 : 390, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(56,189,248,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: FS, fontWeight: 600, fontSize: 15, letterSpacing: 0.2, color: C.txt }}>{title}</span>
          <button className="iconbtn" onClick={onClose} style={{ display: "inline-flex", background: "transparent", border: "none", color: C.muted2, cursor: "pointer", padding: 4 }}><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
