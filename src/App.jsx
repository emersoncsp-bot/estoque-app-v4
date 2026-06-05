import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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

const S = {
  input: { width: "100%", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "9px 13px", color: "#e8e6e0", fontFamily: "'DM Mono','Courier New',monospace", fontSize: 13, outline: "none", boxSizing: "border-box" },
  tag: (color) => ({ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: `1px solid ${color}44`, background: `${color}18`, color, display: "inline-block" }),
};

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

      // PIN sincronizado com Supabase
      try {
        const { data: pinRows } = await supabase
.from("configuracoes")
.select("valor")
.eq("chave", "pin");
if (pinRows && pinRows.length > 0) setPin(pinRows[pinRows.length - 1].valor);
} catch (_) {}

      setLoaded(true);
    };
    load();
  }, []);

  // ── PIN ───────────────────────────────────────────────────
  const savePin = async (p) => {
const { error: updErr, count } = await supabase
.from("configuracoes")
.update({ valor: p })
.eq("chave", "pin")
.select();
if (updErr) throw new Error("Erro ao atualizar PIN: " + updErr.message);
if (!count || count === 0) {
const { error: insErr } = await supabase
.from("configuracoes")
.insert({ chave: "pin", valor: p });
if (insErr) throw new Error("Erro ao inserir PIN: " + insErr.message);
}
setPin(p);
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
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setMvScanActive(true);
      const handle = (text) => { stopScan(); onResult(text.trim()); };
      if ("BarcodeDetector" in window) {
        const bd = new BarcodeDetector({ formats: ["qr_code"] });
        scanTimer.current = setInterval(async () => {
          try { const c = await bd.detect(videoRef.current); if (c.length > 0) handle(c[0].rawValue); } catch (_) {}
        }, 300);
      } else {
        if (!window.jsQR) {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
          document.head.appendChild(s);
          await new Promise((res, rej) => { s.onload = res; s.onerror = rej; });
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        scanTimer.current = setInterval(() => {
          if (!videoRef.current?.videoWidth) return;
          canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(img.data, img.width, img.height);
          if (code) handle(code.data);
        }, 300);
      }
    } catch (e) { alert("Câmera indisponível: " + e.message); }
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
    if (!validCode(code)) { setMvError("Código inválido. Use o formato ECXXXXX"); return; }
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
    if (!validCode(code)) { setMvError("QR inválido: esperado ECXXXXX"); return; }
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
    if (!validCode(code))                           { setApError("Código deve ser ECXXXXX"); return; }
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
if (ep1 !== ep2) { setAdminMsg("PINs não coincidem."); return; }
try {
await savePin(ep1);
setEp1(""); setEp2("");
setAdminMsg("PIN alterado com sucesso!"); setTimeout(() => setAdminMsg(""), 3000);
} catch (e) {
setAdminMsg("Erro ao salvar PIN: " + (e.message || "verifique as permissões no Supabase"));
}
};


  // ── Filtered list ─────────────────────────────────────────
  const filtered = produtos.filter(p =>
    p.code.includes(search.toUpperCase()) ||
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.shelf || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1117", color: "#f0f0f0", fontFamily: "monospace" }}>
      Carregando…
    </div>
  );

  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8e6e0", fontFamily: "'DM Mono','Courier New',monospace" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #2a2a35", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#5a8a6a", textTransform: "uppercase", marginBottom: 3 }}>Sistema de Estoque</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Estoque de Tubo Padrão</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={S.tag("#5a8a6a")}>{produtos.length} produto{produtos.length !== 1 ? "s" : ""}</span>
          <button onClick={() => askPin(() => { setAdminMsg(""); setAdminTab("produtos"); startAddProd(); setShowAdmin(true); })}
            style={{ background: "#1e2028", color: "#aaa", border: "1px solid #2a2a35", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            ⚙ Admin
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2a35", padding: "0 28px" }}>
        {["estoque", "historico"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "13px 18px", fontSize: 12, letterSpacing: 1,
            color: tab === t ? "#5a8a6a" : "#555",
            borderBottom: tab === t ? "2px solid #5a8a6a" : "2px solid transparent",
            textTransform: "uppercase", fontFamily: "inherit", fontWeight: tab === t ? 700 : 400,
          }}>
            {t === "estoque" ? "📋 LISTA DE PADRÕES" : "📋 Histórico"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "22px 28px" }}>

        {tab === "estoque" && <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, nome ou local…" style={{ ...S.input, flex: 1 }} />
            <button onClick={openMove} style={{
              background: "#5a8a6a", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
            }}>🔄 Realizar Movimentação</button>
          </div>

          {filtered.length === 0
            ? <div style={{ textAlign: "center", color: "#444", padding: "60px 0", fontSize: 14 }}>
                {produtos.length === 0 ? "Nenhum produto cadastrado." : "Nenhum resultado."}
              </div>
            : <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2a2a35" }}>
                      {["Código", "Descrição", "Categoria do padrão", "Local de armazenamento"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "9px 12px", color: "#5a5a6a", fontWeight: 600, letterSpacing: 1, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.code} style={{ borderBottom: "1px solid #1e1e28", background: i % 2 === 0 ? "transparent" : "#0d0f14" }}>
                        <td style={{ padding: "11px 12px", fontWeight: 700, color: "#a8d8b8", letterSpacing: 1 }}>{p.code}</td>
                        <td style={{ padding: "11px 12px", color: "#aaa" }}>{p.name || <Em />}</td>
                        <td style={{ padding: "11px 12px", color: "#aaa" }}>{p.category || <Em />}</td>
                        <td style={{ padding: "11px 12px" }}><span style={S.tag("#7ab0d8")}>🗄 {p.shelf}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </>}

        {tab === "historico" && <>
          <div style={{ marginBottom: 14, color: "#5a5a6a", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            {historico.length} movimentação{historico.length !== 1 ? "ões" : ""} registrada{historico.length !== 1 ? "s" : ""}
          </div>
          {historico.length === 0
            ? <div style={{ textAlign: "center", color: "#444", padding: "60px 0", fontSize: 14 }}>Nenhuma movimentação registrada.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historico.map(h => (
                  <div key={h.id} style={{ background: "#16181f", border: "1px solid #2a2a35", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <span style={{ color: "#a8d8b8", fontWeight: 700, letterSpacing: 1, minWidth: 75 }}>{h.code}</span>
                    <span style={S.tag("#7ab0d8")}>{h.de}</span>
                    <span style={{ color: "#555" }}>→</span>
                    <span style={S.tag("#5a8a6a")}>{h.para}</span>
                    <span style={{ color: "#888", fontSize: 11, marginLeft: "auto" }}>👤 {h.responsavel}</span>
                    <span style={{ color: "#555", fontSize: 10 }}>🕐 {fmt(h.data)}</span>
                  </div>
                ))}
              </div>
          }
        </>}
      </div>

      {/* ══ MODAL: MOVIMENTAÇÃO WIZARD ══ */}
      {showMove && <Modal title="🔄 Realizar Movimentação" onClose={closeMove}>
        <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
          {[["1", "Produto"], ["2", "Local"], ["3", "Responsável"]].map(([n, l], i) => {
            const active = mvStep === i + 1, done = mvStep > i + 1;
            return (
              <div key={n} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 7, fontSize: 11,
                background: done ? "#0f1a10" : active ? "#1a2a1e" : "#16181f",
                border: `1px solid ${done ? "#2a4a1e" : active ? "#2a4a2e" : "#2a2a35"}`,
                color: done ? "#5a8a6a" : active ? "#a8d8b8" : "#555",
                fontWeight: active ? 700 : 400,
              }}>{done ? "✓ " : n + ". "}{l}</div>
            );
          })}
        </div>

        {mvStep === 1 && <>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>Escaneie o QR Code do produto ou digite o código manualmente.</div>
          <Lbl>Código do produto *</Lbl>
          <input value={mvProdInput} onChange={e => setMvProdInput(e.target.value.toUpperCase())}
            placeholder="EC00001" maxLength={7} style={S.input} onKeyDown={e => e.key === "Enter" && mvStep1Next()} />
          {mvError && <Err>{mvError}</Err>}
          <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000", display: mvScanActive ? "block" : "none", maxHeight: 220, marginTop: 12 }} playsInline muted />
          {!mvScanActive
            ? <div style={{ background: "#0d0f14", border: "1px dashed #2a2a35", borderRadius: 8, height: 50, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 11, marginTop: 8, cursor: "pointer" }} onClick={scanStep1}>📷 Toque para escanear QR Code</div>
            : <button onClick={stopScan} style={{ marginTop: 8, width: "100%", background: "#2a1a1a", color: "#e87070", border: "1px solid #4a2a2a", borderRadius: 7, padding: "7px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>⏹ Parar câmera</button>
          }
          <Row><Btn2 onClick={closeMove}>Cancelar</Btn2><Btn1 onClick={mvStep1Next}>Próximo →</Btn1></Row>
        </>}

        {mvStep === 2 && <>
          <div style={{ background: "#1a2a1e", border: "1px solid #2a4a2e", borderRadius: 8, padding: "9px 13px", marginBottom: 12, fontSize: 12 }}>
            ✅ Produto: <strong style={{ color: "#a8d8b8" }}>{mvProdObj?.code}</strong>
            {mvProdObj?.name && <span style={{ color: "#777" }}> — {mvProdObj.name}</span>}
            <br /><span style={{ color: "#555", fontSize: 11 }}>Local atual: {mvProdObj?.shelf}</span>
          </div>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>Escaneie o QR Code do local de destino ou selecione manualmente.</div>
          <Lbl>Local de armazenamento de destino *</Lbl>
          <Select value={mvLocalInput} onChange={e => setMvLocalInput(e.target.value)} placeholder="Selecione o local" options={locais} />
          {mvError && <Err>{mvError}</Err>}
          <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000", display: mvScanActive ? "block" : "none", maxHeight: 220, marginTop: 12 }} playsInline muted />
          {!mvScanActive
            ? <div style={{ background: "#0d0f14", border: "1px dashed #2a2a35", borderRadius: 8, height: 50, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 11, marginTop: 8, cursor: "pointer" }} onClick={scanStep2}>📷 Toque para escanear QR Code</div>
            : <button onClick={stopScan} style={{ marginTop: 8, width: "100%", background: "#2a1a1a", color: "#e87070", border: "1px solid #4a2a2a", borderRadius: 7, padding: "7px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>⏹ Parar câmera</button>
          }
          <Row><Btn2 onClick={() => { stopScan(); setMvStep(1); setMvError(""); }}>← Voltar</Btn2><Btn1 onClick={mvStep2Next}>Próximo →</Btn1></Row>
        </>}

        {mvStep === 3 && <>
          <div style={{ background: "#16181f", border: "1px solid #2a2a35", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12, lineHeight: 2 }}>
            <div>Produto: <strong style={{ color: "#a8d8b8" }}>{mvProdObj?.code}</strong>{mvProdObj?.name && <span style={{ color: "#777" }}> — {mvProdObj.name}</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>De:</span><span style={S.tag("#7ab0d8")}>{mvProdObj?.shelf}</span>
              <span style={{ color: "#555" }}>→</span>
              <span>Para:</span><span style={S.tag("#5a8a6a")}>{mvLocalInput}</span>
            </div>
          </div>
          <Lbl>Responsável pela movimentação *</Lbl>
          <Select value={mvRespInput} onChange={e => setMvRespInput(e.target.value)} placeholder="Selecione o responsável" options={resps} />
          {mvError && <Err>{mvError}</Err>}
          <Row>
            <Btn2 onClick={() => { setMvStep(2); setMvError(""); }}>← Voltar</Btn2>
            <Btn1 onClick={mvStep3Confirm}>✅ Confirmar</Btn1>
          </Row>
        </>}
      </Modal>}

      {/* ══ MODAL: PIN GATE ══ */}
      {showPinGate && <Modal title="🔒 Área Restrita" onClose={() => setShowPinGate(false)}>
        <div style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>Digite o PIN de administrador:</div>
        <input type="password" inputMode="numeric" maxLength={8} value={pinInput}
          onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && confirmPin()}
          placeholder="••••" style={{ ...S.input, fontSize: 22, letterSpacing: 8, textAlign: "center" }} />
        {pinError && <Err>{pinError}</Err>}
        <Row><Btn2 onClick={() => setShowPinGate(false)}>Cancelar</Btn2><Btn1 onClick={confirmPin}>Entrar</Btn1></Row>
      </Modal>}

      {/* ══ MODAL: ADMIN ══ */}
      {showAdmin && <Modal title="⚙ Administração" onClose={() => setShowAdmin(false)} wide>
        <div style={{ display: "flex", gap: 5, marginBottom: 16, flexWrap: "wrap" }}>
          {[["produtos", "📦 Produtos"], ["locais", "🗄 Locais"], ["categorias", "🏷 Categorias"], ["responsaveis", "👤 Usuários"], ["pin", "🔑 PIN"]].map(([t, l]) => (
            <button key={t} onClick={() => { setAdminTab(t); setAdminMsg(""); }}
              style={{ flex: 1, minWidth: 80, padding: "7px 4px", border: "1px solid", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                borderColor: adminTab === t ? "#5a8a6a" : "#2a2a35", background: adminTab === t ? "#1a2a1e" : "#16181f",
                color: adminTab === t ? "#5a8a6a" : "#666", fontWeight: adminTab === t ? 700 : 400,
              }}>{l}</button>
          ))}
        </div>

        {/* Produtos */}
        {adminTab === "produtos" && <>
          <div style={{ background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#5a8a6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
              {apEdit ? "✏️ Editar produto" : "➕ Novo produto"}
            </div>
            <Lbl>Código *</Lbl>
            <input value={apCode} onChange={e => setApCode(e.target.value)} placeholder="EC00001" maxLength={7} style={{ ...S.input }} disabled={!!apEdit} />
            <Lbl>Descrição (opcional)</Lbl>
            <input value={apName} onChange={e => setApName(e.target.value)} placeholder="Ex: 244.48 x 13.84" style={S.input} />
            <Lbl>Categoria do padrão (opcional)</Lbl>
            <Select value={apCat} onChange={e => setApCat(e.target.value)} placeholder="Selecione a categoria" options={categorias} />
            <Lbl>Local de armazenamento *</Lbl>
            <Select value={apLocal} onChange={e => setApLocal(e.target.value)} placeholder="Selecione o local" options={locais} />
            {apError && <Err>{apError}</Err>}
            <Row>
              {apEdit && <Btn2 onClick={startAddProd}>Cancelar edição</Btn2>}
              <Btn1 onClick={saveProd}>{apEdit ? "💾 Salvar" : "➕ Cadastrar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {produtos.length === 0 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhum produto cadastrado.</div>}
            {produtos.map(p => (
              <div key={p.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "8px 12px", fontSize: 12, gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: "#a8d8b8", fontWeight: 700 }}>{p.code}</span>
                  {p.name && <span style={{ color: "#777" }}> — {p.name}</span>}
                  <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{p.shelf}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <IconBtn onClick={() => startEditProd(p)} color="#7ab0d8">✏️</IconBtn>
                  <IconBtn onClick={() => deleteProd(p.code)} color="#e87070">🗑</IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Locais */}
        {adminTab === "locais" && <>
          <div style={{ background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#5a8a6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
              {alEdit ? "✏️ Editar local" : "➕ Novo local"}
            </div>
            <Lbl>Nome do local *</Lbl>
            <input value={alVal} onChange={e => setAlVal(e.target.value)} placeholder="Ex: Estaleiro 1" style={S.input} />
            <Row>
              {alEdit && <Btn2 onClick={() => { setAlEdit(null); setAlVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveLocal}>{alEdit ? "💾 Salvar" : "➕ Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {locais.length === 0 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhum local cadastrado.</div>}
            {locais.map(l => (
              <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>
                <span style={{ color: "#7ab0d8" }}>🗄 {l}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setAlEdit(l); setAlVal(l); }} color="#7ab0d8">✏️</IconBtn>
                  <IconBtn onClick={() => deleteLocal(l)} color="#e87070">🗑</IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Categorias */}
        {adminTab === "categorias" && <>
          <div style={{ background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#5a8a6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
              {acEdit ? "✏️ Editar categoria" : "➕ Nova categoria"}
            </div>
            <Lbl>Nome da categoria *</Lbl>
            <input value={acVal} onChange={e => setAcVal(e.target.value)} placeholder="Ex: Tubos Estruturais" style={S.input} />
            <Row>
              {acEdit && <Btn2 onClick={() => { setAcEdit(null); setAcVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveCat}>{acEdit ? "💾 Salvar" : "➕ Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {categorias.length === 0 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhuma categoria cadastrada.</div>}
            {categorias.map(c => (
              <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>
                <span style={{ color: "#d8c87a" }}>🏷 {c}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setAcEdit(c); setAcVal(c); }} color="#7ab0d8">✏️</IconBtn>
                  <IconBtn onClick={() => deleteCat(c)} color="#e87070">🗑</IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* Usuários */}
        {adminTab === "responsaveis" && <>
          <div style={{ background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#5a8a6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
              {arEdit ? "✏️ Editar usuário" : "➕ Novo usuário"}
            </div>
            <Lbl>Nome *</Lbl>
            <input value={arVal} onChange={e => setArVal(e.target.value)} placeholder="Ex: 701234 - Nome Sobrenome" style={S.input} />
            <Row>
              {arEdit && <Btn2 onClick={() => { setArEdit(null); setArVal(""); }}>Cancelar</Btn2>}
              <Btn1 onClick={saveResp}>{arEdit ? "💾 Salvar" : "➕ Adicionar"}</Btn1>
            </Row>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {resps.length === 0 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhum usuário cadastrado.</div>}
            {resps.map(r => (
              <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>
                <span style={{ color: "#a8d8b8" }}>👤 {r}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn onClick={() => { setArEdit(r); setArVal(r); }} color="#7ab0d8">✏️</IconBtn>
                  <IconBtn onClick={() => deleteResp(r)} color="#e87070">🗑</IconBtn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* PIN */}
        {adminTab === "pin" && <>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>Altere o PIN de administrador (mínimo 4 dígitos).<br />PIN padrão inicial: <strong>1234</strong></div>
          <Lbl>Novo PIN</Lbl>
          <input type="password" inputMode="numeric" value={ep1} onChange={e => setEp1(e.target.value)} placeholder="••••" style={S.input} />
          <Lbl>Confirmar PIN</Lbl>
          <input type="password" inputMode="numeric" value={ep2} onChange={e => setEp2(e.target.value)} placeholder="••••" style={S.input} />
          <div style={{ marginTop: 12 }}><Btn1 onClick={changePin}>💾 Salvar novo PIN</Btn1></div>
        </>}

        {adminMsg && <div style={{ marginTop: 14, color: "#5a8a6a", fontSize: 12, textAlign: "center", background: "#1a2a1e", border: "1px solid #2a4a2e", borderRadius: 7, padding: "8px" }}>{adminMsg}</div>}
      </Modal>}

    </div>
  );
}

// ── Micro-components ──────────────────────────────────────────
function Em() { return <span style={{ color: "#444", fontStyle: "italic" }}>—</span>; }
function Lbl({ children }) { return <div style={{ fontSize: 10, color: "#5a5a6a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 5, marginTop: 12 }}>{children}</div>; }
function Err({ children }) { return <div style={{ color: "#e87070", fontSize: 12, marginTop: 6 }}>{children}</div>; }
function Row({ children }) { return <div style={{ display: "flex", gap: 10, marginTop: 14 }}>{children}</div>; }
function Btn1({ onClick, children, style = {} }) {
  return <button onClick={onClick} style={{ flex: 1, background: "#5a8a6a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, ...style }}>{children}</button>;
}
function Btn2({ onClick, children }) {
  return <button onClick={onClick} style={{ flex: 1, background: "#1e2028", color: "#aaa", border: "1px solid #2a2a35", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>{children}</button>;
}
function IconBtn({ onClick, color, children, title }) {
  return <button onClick={onClick} title={title} style={{ background: "none", border: `1px solid ${color}33`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 13, color, lineHeight: 1 }}>{children}</button>;
}
function Select({ value, onChange, placeholder, options }) {
  return (
    <select value={value} onChange={onChange} style={{ width: "100%", background: "#0f1117", border: "1px solid #2a2a35", borderRadius: 7, padding: "9px 13px", color: "#e8e6e0", fontFamily: "'DM Mono','Courier New',monospace", fontSize: 13, outline: "none", boxSizing: "border-box", appearance: "none", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#16181f", border: "1px solid #2a2a35", borderRadius: 14, padding: 24, width: "100%", maxWidth: wide ? 480 : 380, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
