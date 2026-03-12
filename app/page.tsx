"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock3, FileText, Trash2, Users, Wallet, ClipboardList, Search, CloudUpload } from "lucide-react";

const colaboradoresBase = [
  "Adones",
  "Gabriela",
  "Clébio",
  "Matheus",
  "Françoah",
  "Judson",
  "Luana",
  "Francisco",
  "Vanessa",
  "Outro"
];

const responsaveisBase = ["Fábio", "Françoah", "Gabriela", "Adones", "Vanessa", "Outro"];
const storageKey = "operacao2d-diario-de-bordo";
const endpointNotion = "/api/notion-diario";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function hojeISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function horaAtual() {
  const agora = new Date();
  return `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
}

function formatarDataBR(data: string) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function valorNumero(valor: string | number) {
  const num = Number(valor || 0);
  return Number.isFinite(num) ? num : 0;
}

type Registro = {
  id: string;
  data: string;
  hora: string;
  texto: string;
  responsavel: string;
  colaboradoresPresentes: string[];
  faturamentoDelivery: string;
  faturamentoSalao: string;
  createdAt: string;
  syncedToNotion?: boolean;
};

export default function Page() {
  const [form, setForm] = useState({
    data: hojeISO(),
    hora: horaAtual(),
    texto: "",
    responsavel: "",
    colaboradoresPresentes: [] as string[],
    faturamentoDelivery: "",
    faturamentoSalao: ""
  });
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [syncNotionAtivo, setSyncNotionAtivo] = useState(true);

  useEffect(() => {
    const salvos = localStorage.getItem(storageKey);
    if (salvos) {
      try {
        setRegistros(JSON.parse(salvos));
      } catch {
        setRegistros([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(registros));
  }, [registros]);

  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => setMensagem(""), 2600);
    return () => clearTimeout(timer);
  }, [mensagem]);

  const faturamentoTotal = useMemo(
    () => valorNumero(form.faturamentoDelivery) + valorNumero(form.faturamentoSalao),
    [form.faturamentoDelivery, form.faturamentoSalao]
  );

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return registros;
    return registros.filter((registro) => {
      const pilha = [registro.data, registro.hora, registro.texto, registro.responsavel, ...registro.colaboradoresPresentes]
        .join(" ")
        .toLowerCase();
      return pilha.includes(termo);
    });
  }, [busca, registros]);

  const resumo = useMemo(() => {
    const totalDelivery = registros.reduce((acc, item) => acc + valorNumero(item.faturamentoDelivery), 0);
    const totalSalao = registros.reduce((acc, item) => acc + valorNumero(item.faturamentoSalao), 0);
    return { totalRegistros: registros.length, totalDelivery, totalSalao, totalGeral: totalDelivery + totalSalao };
  }, [registros]);

  function atualizarCampo<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function alternarColaborador(nome: string) {
    setForm((prev) => ({
      ...prev,
      colaboradoresPresentes: prev.colaboradoresPresentes.includes(nome)
        ? prev.colaboradoresPresentes.filter((item) => item !== nome)
        : [...prev.colaboradoresPresentes, nome],
    }));
  }

  function limparFormulario() {
    setForm({
      data: hojeISO(),
      hora: horaAtual(),
      texto: "",
      responsavel: "",
      colaboradoresPresentes: [],
      faturamentoDelivery: "",
      faturamentoSalao: ""
    });
  }

  async function enviarRegistro(e: React.FormEvent) {
    e.preventDefault();
    if (!form.data || !form.hora || !form.texto.trim() || !form.responsavel) {
      setMensagem("Preencha data, hora, responsável e relato do dia.");
      return;
    }

    const novoRegistro: Registro = {
      id: crypto.randomUUID(),
      ...form,
      createdAt: new Date().toISOString(),
      syncedToNotion: false,
    };

    setRegistros((prev) => [novoRegistro, ...prev]);

    if (syncNotionAtivo) {
      try {
        setSincronizando(true);
        await enviarParaNotion(novoRegistro);
        setRegistros((prev) => prev.map((item) => item.id === novoRegistro.id ? { ...item, syncedToNotion: true } : item));
        setMensagem("Diário enviado, salvo localmente e sincronizado com o Notion.");
      } catch (error) {
        console.error(error);
        setMensagem("Diário salvo localmente, mas a sincronização com o Notion falhou.");
      } finally {
        setSincronizando(false);
      }
    } else {
      setMensagem("Diário enviado e salvo localmente.");
    }

    limparFormulario();
  }

  async function enviarParaNotion(registro: Registro) {
    const response = await fetch(endpointNotion, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: registro.data,
        hora: registro.hora,
        texto: registro.texto,
        responsavel: registro.responsavel,
        colaboradoresPresentes: registro.colaboradoresPresentes,
        faturamentoDelivery: valorNumero(registro.faturamentoDelivery),
        faturamentoSalao: valorNumero(registro.faturamentoSalao),
        faturamentoTotal: valorNumero(registro.faturamentoDelivery) + valorNumero(registro.faturamentoSalao),
        createdAt: registro.createdAt,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao sincronizar com o Notion.");
    return data;
  }

  function excluirRegistro(id: string) {
    setRegistros((prev) => prev.filter((item) => item.id !== id));
    setMensagem("Registro removido do histórico.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <header style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 28, padding: 28, background: "linear-gradient(135deg,#b91c1c,#dc2626,#171717)", marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 24, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 700 }}>
              <div style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".2em" }}>
                Operação 2D • Diário de Bordo Diário
              </div>
              <h1 style={{ fontSize: 42, lineHeight: 1.05, marginTop: 18, marginBottom: 12 }}>Registrar o campo, ler a operação e decidir melhor.</h1>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,.78)", lineHeight: 1.6 }}>
                Página pronta para os líderes documentarem o dia, guardarem histórico e sincronizarem cada diário com o Notion por uma rota segura.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 12, flex: 1, minWidth: 320 }}>
              <ResumoCard titulo="Registros" valor={String(resumo.totalRegistros)} />
              <ResumoCard titulo="Delivery acumulado" valor={brl.format(resumo.totalDelivery)} />
              <ResumoCard titulo="Salão acumulado" valor={brl.format(resumo.totalSalao)} />
              <ResumoCard titulo="Faturamento total" valor={brl.format(resumo.totalGeral)} destaque />
            </div>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 24 }}>
          <section style={panelStyle}>
            <SectionHeader kicker="Formulário funcional" title="Diário de Bordo" badge={syncNotionAtivo ? "Navegador + Notion" : "Navegador"} />

            <form onSubmit={enviarRegistro} style={{ display: "grid", gap: 18 }}>
              <div style={row2}>
                <Campo icon={<Calendar size={16} />} label="Data">
                  <input type="date" value={form.data} onChange={(e) => atualizarCampo("data", e.target.value)} style={inputStyle} />
                </Campo>
                <Campo icon={<Clock3 size={16} />} label="Hora">
                  <input type="time" value={form.hora} onChange={(e) => atualizarCampo("hora", e.target.value)} style={inputStyle} />
                </Campo>
              </div>

              <div style={row2}>
                <Campo icon={<ClipboardList size={16} />} label="Responsável">
                  <select value={form.responsavel} onChange={(e) => atualizarCampo("responsavel", e.target.value)} style={inputStyle}>
                    <option value="">Selecione o responsável</option>
                    {responsaveisBase.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </select>
                </Campo>
                <div>
                  <Label icon={<Users size={16} />} label="Colaboradores presentes" />
                  <div style={chipBoxStyle}>
                    {colaboradoresBase.map((nome) => {
                      const ativo = form.colaboradoresPresentes.includes(nome);
                      return (
                        <button key={nome} type="button" onClick={() => alternarColaborador(nome)} style={{ ...chipStyle, ...(ativo ? activeChipStyle : {}) }}>
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <Label icon={<FileText size={16} />} label="Relato do dia" />
                <textarea rows={8} value={form.texto} onChange={(e) => atualizarCampo("texto", e.target.value)} placeholder="Descreva ritmo da operação, problemas, decisões, clima da equipe, aprendizados e pontos de atenção." style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ ...panelSoft, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Sincronização com Notion</div>
                    <div style={{ color: "rgba(255,255,255,.62)", lineHeight: 1.6, fontSize: 14 }}>Cada diário é salvo localmente e, quando ativo, enviado também para sua database no Notion.</div>
                  </div>
                  <button type="button" onClick={() => setSyncNotionAtivo((prev) => !prev)} style={{ ...toggleStyle, background: syncNotionAtivo ? "#dc2626" : "rgba(255,255,255,.06)" }}>
                    <CloudUpload size={16} /> {syncNotionAtivo ? "Notion ativo" : "Notion inativo"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
                <Campo icon={<Wallet size={16} />} label="Faturamento de delivery">
                  <InputMoeda value={form.faturamentoDelivery} onChange={(valor) => atualizarCampo("faturamentoDelivery", valor)} />
                </Campo>
                <Campo icon={<Wallet size={16} />} label="Faturamento de salão">
                  <InputMoeda value={form.faturamentoSalao} onChange={(valor) => atualizarCampo("faturamentoSalao", valor)} />
                </Campo>
                <div style={{ borderRadius: 22, padding: 18, border: "1px solid rgba(239,68,68,.35)", background: "rgba(220,38,38,.12)" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".18em", color: "#fca5a5" }}>Total do dia</div>
                  <div style={{ fontSize: 34, fontWeight: 900, marginTop: 12 }}>{brl.format(faturamentoTotal)}</div>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,.6)", fontSize: 14 }}>Soma automática de delivery + salão</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 20 }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,.55)", lineHeight: 1.6 }}>Ideal para fechamento do dia, leitura gerencial e ritual de acompanhamento da Operação 2D.</p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={limparFormulario} style={secondaryButton}>Limpar campos</button>
                  <button type="submit" disabled={sincronizando} style={{ ...primaryButton, opacity: sincronizando ? .65 : 1 }}>
                    {sincronizando ? "Sincronizando..." : "Enviar Diário"}
                  </button>
                </div>
              </div>

              {mensagem ? <div style={messageStyle}>{mensagem}</div> : null}
            </form>
          </section>

          <aside style={{ display: "grid", gap: 24 }}>
            <section style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 18 }}>
                <div>
                  <div style={kickerStyle}>Histórico salvo</div>
                  <h3 style={{ margin: "8px 0 0", fontSize: 30 }}>Registros recentes</h3>
                </div>
                <div style={{ position: "relative", minWidth: 260 }}>
                  <Search size={16} style={{ position: "absolute", left: 14, top: 14, color: "rgba(255,255,255,.35)" }} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por líder, data ou texto" style={{ ...inputStyle, paddingLeft: 40 }} />
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                {registrosFiltrados.length === 0 ? (
                  <div style={{ ...panelSoft, padding: 18, color: "rgba(255,255,255,.55)", lineHeight: 1.7 }}>Nenhum diário encontrado ainda. Assim que os líderes começarem a registrar, o histórico aparece aqui.</div>
                ) : registrosFiltrados.map((registro) => {
                  const total = valorNumero(registro.faturamentoDelivery) + valorNumero(registro.faturamentoSalao);
                  return (
                    <article key={registro.id} style={{ ...panelSoft, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".18em", color: "#f87171" }}>{formatarDataBR(registro.data)} • {registro.hora}</div>
                          <h4 style={{ margin: "8px 0 10px", fontSize: 20 }}>{registro.responsavel}</h4>
                          <p style={{ margin: 0, color: "rgba(255,255,255,.76)", lineHeight: 1.7 }}>{registro.texto}</p>
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          <span style={{ ...statusPill, background: registro.syncedToNotion ? "rgba(16,185,129,.14)" : "rgba(245,158,11,.14)", color: registro.syncedToNotion ? "#6ee7b7" : "#fcd34d" }}>
                            {registro.syncedToNotion ? "Sincronizado no Notion" : "Local / pendente"}
                          </span>
                          <button type="button" onClick={() => excluirRegistro(registro.id)} style={deleteButton}><Trash2 size={14} /> Excluir</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 16 }}>
                        <MiniInfo titulo="Delivery" valor={brl.format(valorNumero(registro.faturamentoDelivery))} />
                        <MiniInfo titulo="Salão" valor={brl.format(valorNumero(registro.faturamentoSalao))} />
                        <MiniInfo titulo="Total" valor={brl.format(total)} destaque />
                      </div>
                      <div style={{ ...miniPanel, marginTop: 16 }}>
                        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".18em", color: "rgba(255,255,255,.45)" }}>Colaboradores presentes</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                          {registro.colaboradoresPresentes.length ? registro.colaboradoresPresentes.map((nome) => <span key={nome} style={chipStyle}>{nome}</span>) : <span style={{ color: "rgba(255,255,255,.45)" }}>Sem colaboradores marcados.</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section style={{ ...panelStyle, border: "1px solid rgba(239,68,68,.28)", background: "linear-gradient(180deg, rgba(220,38,38,.12), rgba(10,10,10,.8))" }}>
              <div style={kickerStyle}>Publicação</div>
              <h3 style={{ margin: "8px 0 0", fontSize: 30 }}>Como conectar ao Notion</h3>
              <div style={{ ...miniPanel, marginTop: 16, lineHeight: 1.7, color: "rgba(255,255,255,.78)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Variáveis obrigatórias</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, color: "#fca5a5" }}>
                  NOTION_TOKEN=seu_token_interno<br />
                  NOTION_DATABASE_ID=seu_database_id
                </div>
                <p style={{ marginBottom: 0 }}>
                  A database no Notion precisa ter estas propriedades: <strong>Diário de Bordo</strong> (title), <strong>Data</strong> (date), <strong>Hora</strong> (rich text), <strong>Responsável</strong> (select), <strong>Colaboradores presentes</strong> (multi-select), <strong>Relato do dia</strong> (rich text), <strong>Faturamento Delivery</strong> (number), <strong>Faturamento Salão</strong> (number), <strong>Faturamento Total</strong> (number) e <strong>Criado em</strong> (date).
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SectionHeader({ kicker, title, badge }: { kicker: string; title: string; badge: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 18, marginBottom: 18 }}>
      <div>
        <div style={kickerStyle}>{kicker}</div>
        <h2 style={{ margin: "8px 0 0", fontSize: 34 }}>{title}</h2>
      </div>
      <div style={{ background: "#dc2626", color: "#fff", padding: "10px 14px", borderRadius: 16, fontWeight: 700, fontSize: 14 }}>{badge}</div>
    </div>
  );
}

function Campo({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div><Label icon={icon} label={label} />{children}</div>;
}
function Label({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.86)" }}><span style={{ color: "#ef4444" }}>{icon}</span>{label}</div>;
}
function ResumoCard({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return <div style={{ border: destaque ? "1px solid rgba(252,165,165,.32)" : "1px solid rgba(255,255,255,.14)", background: destaque ? "rgba(127,29,29,.35)" : "rgba(0,0,0,.24)", borderRadius: 18, padding: 14 }}><div style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>{titulo}</div><div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{valor}</div></div>;
}
function MiniInfo({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return <div style={{ border: destaque ? "1px solid rgba(239,68,68,.28)" : "1px solid rgba(255,255,255,.1)", background: destaque ? "rgba(220,38,38,.12)" : "rgba(10,10,10,.65)", borderRadius: 18, padding: 14 }}><div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".18em", color: "rgba(255,255,255,.45)" }}>{titulo}</div><div style={{ marginTop: 8, fontSize: 16, fontWeight: 800 }}>{valor}</div></div>;
}
function InputMoeda({ value, onChange }: { value: string; onChange: (valor: string) => void }) {
  return <div style={{ position: "relative" }}><span style={{ position: "absolute", left: 14, top: 13, color: "rgba(255,255,255,.5)", fontSize: 14 }}>R$</span><input type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 40 }} /></div>;
}

const panelStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,.1)", borderRadius: 28, padding: 24, background: "#111111", boxShadow: "0 20px 50px rgba(0,0,0,.25)" };
const panelSoft: React.CSSProperties = { border: "1px solid rgba(255,255,255,.08)", borderRadius: 22, background: "rgba(0,0,0,.22)" };
const miniPanel: React.CSSProperties = { border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, background: "rgba(10,10,10,.72)", padding: 14 };
const inputStyle: React.CSSProperties = { width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,.1)", background: "#0a0a0a", color: "#fff", padding: "12px 14px", outline: "none" };
const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 };
const chipBoxStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, minHeight: 52, borderRadius: 18, border: "1px solid rgba(255,255,255,.1)", background: "#0a0a0a", padding: 12 };
const chipStyle: React.CSSProperties = { borderRadius: 999, padding: "7px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.85)" };
const activeChipStyle: React.CSSProperties = { border: "1px solid #ef4444", background: "#dc2626", color: "#fff" };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 18, background: "#dc2626", color: "#fff", padding: "12px 18px", fontWeight: 800, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid rgba(255,255,255,.15)", borderRadius: 18, background: "rgba(255,255,255,.05)", color: "#fff", padding: "12px 18px", fontWeight: 700, cursor: "pointer" };
const deleteButton: React.CSSProperties = { display: "inline-flex", gap: 8, alignItems: "center", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.8)", padding: "10px 12px", cursor: "pointer" };
const toggleStyle: React.CSSProperties = { display: "inline-flex", gap: 8, alignItems: "center", border: 0, borderRadius: 999, color: "#fff", padding: "11px 14px", fontWeight: 800, cursor: "pointer" };
const messageStyle: React.CSSProperties = { borderRadius: 18, border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.22)", padding: "12px 14px", fontSize: 14, color: "rgba(255,255,255,.82)" };
const kickerStyle: React.CSSProperties = { fontSize: 12, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".22em", fontWeight: 800 };
const statusPill: React.CSSProperties = { display: "inline-flex", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 800 };
