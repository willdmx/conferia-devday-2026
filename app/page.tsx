"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, FileCheck2, FileText, Import, Info, LayoutDashboard, LoaderCircle, Plus, ShieldCheck, Sparkles, Table2, Trash2, TriangleAlert, X } from "lucide-react";
import { MAX_CONTRACT_LENGTH, analysisRequestSchema, analysisSchema, type Analysis, type Delivery, type Issue } from "@/lib/schemas";
import { DEMO_CONTRACT, DEMO_DELIVERIES, DEMO_CSV } from "@/lib/demo";
import { parseDeliveriesCsv } from "@/lib/csv";
import { parseMoneyToCents } from "@/lib/format";

type Draft = { id: string; description: string; quantity: string; deliveredAt: string; total: string };
type Review = { reviewed: boolean; note: string; reviewedAt: string | null };
type Workspace = { contract: string; drafts: Draft[]; analysis: Analysis | null; analysisKey: string | null; reviews: Record<string, Review> };
type Filter = "all" | "pending" | "reviewed";
const STORAGE_KEY = "conferia.workspace.v1";
const EMPTY: Workspace = { contract: "", drafts: [], analysis: null, analysisKey: null, reviews: {} };
const fingerprint = (contract: string, drafts: Draft[]) => JSON.stringify({ contract, drafts });
const toDraft = (item: Delivery): Draft => ({ id: item.id, description: item.description, quantity: String(item.quantity), deliveredAt: item.deliveredAt, total: (item.totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
const isDraft = (value: unknown): value is Draft => !!value && typeof value === "object" && ["id", "description", "quantity", "deliveredAt", "total"].every((key) => typeof (value as Record<string, unknown>)[key] === "string");
const issueLabels: Record<Issue["type"], string> = { quantity: "Quantidade", deadline: "Prazo", value: "Valor", review: "Revisão necessária", missing: "Entrega ausente", unexpected: "Item adicional" };

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [storage, setStorage] = useState<"loading" | "saved" | "unavailable">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [health, setHealth] = useState<{ configured: boolean; model: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const { contract, drafts, analysis, reviews } = workspace;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || typeof saved.contract !== "string" || !Array.isArray(saved.drafts) || saved.drafts.length > 10 || !saved.drafts.every(isDraft)) throw new Error("invalid");
        const parsed = analysisSchema.safeParse(saved.analysis);
        const restored = parsed.success && saved.analysisKey === fingerprint(saved.contract, saved.drafts) ? parsed.data : null;
        const safeReviews: Record<string, Review> = {};
        if (restored && saved.reviews && typeof saved.reviews === "object") for (const issue of restored.issues) {
          const review = saved.reviews[issue.id];
          if (review && typeof review.reviewed === "boolean" && typeof review.note === "string") safeReviews[issue.id] = { reviewed: review.reviewed, note: review.note.slice(0, 500), reviewedAt: typeof review.reviewedAt === "string" && !Number.isNaN(Date.parse(review.reviewedAt)) ? review.reviewedAt : null };
        }
        setWorkspace({ contract: saved.contract, drafts: saved.drafts, analysis: restored, analysisKey: restored ? saved.analysisKey : null, reviews: safeReviews });
      }
    } catch { setNotice("Não foi possível recuperar o rascunho anterior. Você pode começar uma nova conferência."); }
    setHydrated(true);
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => { if (data && typeof data.configured === "boolean") setHealth(data); }).catch(() => {});
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...workspace })); setStorage("saved"); }
    catch { setStorage("unavailable"); }
  }, [workspace, hydrated]);

  function updateInputs(update: Partial<Pick<Workspace, "contract" | "drafts">>) {
    revision.current += 1;
    request.current?.abort();
    setLoading(false);
    setError(null);
    setWorkspace((previous) => ({ ...previous, ...update, analysis: null, analysisKey: null, reviews: {} }));
  }

  function loadExample() {
    updateInputs({ contract: DEMO_CONTRACT, drafts: DEMO_DELIVERIES.map(toDraft) });
    setNotice("Exemplo fictício carregado. Clique em “Conferir entregas” para executar a análise com IA.");
    setFilter("all");
  }

  function updateDraft(index: number, field: keyof Draft, value: string) {
    updateInputs({ drafts: drafts.map((draft, i) => i === index ? { ...draft, [field]: value } : draft) });
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("O CSV deve ter até 100 KB e no máximo 10 itens.");
      const imported = parseDeliveriesCsv(await file.text());
      updateInputs({ drafts: imported.map(toDraft) });
      setNotice(`${imported.length} ${imported.length === 1 ? "entrega importada" : "entregas importadas"}. Confira os dados antes de analisar.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar o CSV."); }
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob(["\ufeff", DEMO_CSV], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "conferia-entregas-exemplo.csv"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function analyze() {
    setError(null); setNotice(null);
    let deliveries: Delivery[];
    try {
      deliveries = drafts.map((draft) => {
        if (!draft.quantity.trim()) throw new Error("Preencha a quantidade de todos os itens.");
        if (!draft.total.trim()) throw new Error("Preencha o valor total de todos os itens.");
        return { id: draft.id.trim(), description: draft.description.trim(), quantity: Number(draft.quantity.replace(",", ".")), deliveredAt: draft.deliveredAt, totalCents: parseMoneyToCents(draft.total) };
      });
      const validation = analysisRequestSchema.safeParse({ contract, deliveries });
      if (!validation.success) {
        const issue = validation.error.issues[0];
        const field = issue?.path[2];
        const labels: Record<string, string> = { quantity: "Informe uma quantidade válida, igual ou maior que zero.", totalCents: "Informe um valor total válido, igual ou maior que zero.", description: "Informe a descrição de cada entrega.", id: "Informe um ID válido para cada entrega." };
        const message = issue && issue.code !== "custom" && typeof field === "string" && labels[field] ? labels[field] : issue?.message;
        throw new Error(message || "Confira o contrato e os dados das entregas.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Confira os dados antes de analisar."); return; }
    const currentRevision = ++revision.current;
    const key = fingerprint(contract, drafts);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 70_000);
    setWorkspace((previous) => ({ ...previous, analysis: null, analysisKey: null, reviews: {} }));
    setLoading(true); setFilter("all");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contract, deliveries }), signal: controller.signal });
      const body = await response.json().catch(() => { throw new Error("O serviço retornou uma resposta inesperada. Tente novamente em instantes."); });
      if (!response.ok) throw new Error(body?.error?.message || "Não foi possível concluir a conferência. Tente novamente.");
      const parsed = analysisSchema.safeParse(body);
      if (!parsed.success) throw new Error("A análise retornou dados incompletos. Tente novamente.");
      if (currentRevision !== revision.current) return;
      setWorkspace((previous) => ({ ...previous, analysis: parsed.data, analysisKey: key, reviews: {} }));
      setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (cause) {
      if (currentRevision === revision.current) setError(controller.signal.aborted ? "A conferência demorou mais que o esperado. Tente novamente em instantes." : cause instanceof TypeError ? "Não foi possível conectar. Verifique sua conexão e tente novamente." : cause instanceof Error ? cause.message : "Não foi possível concluir a conferência. Tente novamente.");
    } finally { clearTimeout(timeout); if (currentRevision === revision.current) setLoading(false); }
  }

  function updateReview(issueId: string, update: Partial<Review>) {
    setWorkspace((previous) => ({ ...previous, reviews: { ...previous.reviews, [issueId]: { ...(previous.reviews[issueId] ?? { reviewed: false, note: "", reviewedAt: null }), ...update } } }));
  }

  const reviewedCount = analysis?.issues.filter((issue) => reviews[issue.id]?.reviewed).length ?? 0;
  const pendingCount = (analysis?.issues.length ?? 0) - reviewedCount;
  const conformingIds = analysis?.items.filter((item) => item.id && analysis.matchedItemIds.includes(item.id) && !analysis.issues.some((issue) => issue.itemId === item.id)).map((item) => item.id) ?? [];
  const visibleIssues = analysis?.issues.filter((issue) => filter === "all" || (filter === "reviewed" ? reviews[issue.id]?.reviewed : !reviews[issue.id]?.reviewed)) ?? [];

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Navegação principal">
        <a className="brand-mark" href="#inicio" aria-label="Conferia, início"><Check size={25} strokeWidth={3} /><span /></a>
        <div className="rail-nav"><a href="#documentos" className="rail-link active" aria-label="Documentos"><LayoutDashboard size={21} /></a><a href="#conferencia" className="rail-link" aria-label="Resultado da conferência"><ClipboardCheck size={21} /></a></div>
        <div className="rail-bottom"><a href="#sobre" className="rail-link" aria-label="Como a conferência funciona"><CircleHelp size={21} /></a><span className="rail-avatar" title="Ambiente de demonstração">C</span></div>
      </aside>
      <div className="main-shell" id="inicio">
        <header className="topbar">
          <a className="wordmark" href="#inicio">conferia<span>.</span></a>
          <span className="topbar-divider" /><span className="workspace-name">Espaço de conferência</span>
          <div className="topbar-right"><span className="event-label">DEV<span>DAY</span> <i /> SÃO PAULO 2026</span><span className="demo-badge">Demonstração</span></div>
        </header>
        <main className="content">
          <section className="hero">
            <div><p className="eyebrow"><span className="tiny-dot" /> CADA ENTREGA CONTA</p><h1>O combinado,<br className="mobile-break" /> <span>conferido.</span></h1><p className="hero-description">Do contrato à entrega, clareza em cada detalhe.<br />Encontre diferenças. Veja as evidências. Revise com confiança.</p></div>
            <button className="button button-example" onClick={loadExample} disabled={loading || !hydrated}><Sparkles size={17} /> Carregar exemplo fictício <ArrowRight size={17} /></button>
          </section>

          <nav className="workflow" aria-label="Etapas da conferência">
            <a href="#documentos" className="workflow-step current"><span className="step-number">{analysis ? <Check size={14} /> : "01"}</span><span>Seus documentos</span><span className="step-caption">Contrato + entregas</span></a><ChevronRight size={16} className="step-chevron" />
            <a href="#conferencia" className={`workflow-step ${analysis || loading ? "current" : ""}`}><span className="step-number">{analysis ? <Check size={14} /> : "02"}</span><span>Conferência</span><span className="step-caption">IA + regras objetivas</span></a><ChevronRight size={16} className="step-chevron" />
            <a href="#conferencia" className={`workflow-step ${analysis ? "current" : ""}`}><span className="step-number">03</span><span>Sua revisão</span><span className="step-caption">Você tem a palavra final</span></a>
          </nav>

          <div className="alerts" aria-live="polite">
            {notice && <div className="notice"><Info size={17} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={16} /></button></div>}
            {error && <div className="notice error" role="alert"><TriangleAlert size={18} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Fechar erro"><X size={16} /></button></div>}
            {storage === "unavailable" && <div className="notice warning"><TriangleAlert size={17} /><span>O navegador não permitiu salvar os dados. As revisões serão mantidas apenas enquanto esta página estiver aberta.</span></div>}
          </div>

          <section id="documentos" className="documents-section">
            <div className="section-kicker"><span>01 / DOCUMENTOS</span><span className="save-status"><span className={`tiny-dot ${storage !== "saved" ? "muted" : ""}`} />{storage === "saved" ? "Rascunho salvo neste navegador" : storage === "unavailable" ? "Salvamento indisponível" : "Carregando rascunho"}</span></div>
            <div className="documents-grid">
              <section className="panel contract-panel">
                <div className="panel-heading"><div className="panel-title"><span className="icon-tile"><FileText size={19} /></span><div><h2>O que foi contratado</h2><p>O combinado é o ponto de partida.</p></div></div><span className="subtle-badge">TEXTO</span></div>
                <label className="sr-only" htmlFor="contract">Texto do contrato fictício</label>
                <textarea id="contract" className="contract-editor" value={contract} onChange={(event) => updateInputs({ contract: event.target.value })} disabled={loading} placeholder={"Cole aqui seu contrato fictício…\n\nInclua o ID, a descrição, a quantidade, o prazo e o valor total de cada item.\n\nAté 10 itens, sem dados pessoais."} maxLength={MAX_CONTRACT_LENGTH} spellCheck={false} />
                <div className="panel-footnote"><ShieldCheck size={14} /><span>Use apenas dados fictícios. Sem interpretação jurídica.</span><span className="character-count">{contract.length.toLocaleString("pt-BR")} caracteres</span></div>
              </section>

              <section className="panel deliveries-panel">
                <div className="panel-heading"><div className="panel-title"><span className="icon-tile"><Table2 size={19} /></span><div><h2>O que foi entregue</h2><p>Edite os dados ou importe sua tabela.</p></div></div><button className="button button-small" onClick={() => fileInput.current?.click()} disabled={loading}><Import size={15} /> Importar CSV</button><input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Importar tabela de entregas em CSV" onChange={importCsv} disabled={loading} /></div>
                {drafts.length ? <div className="table-scroll"><table className="delivery-table"><caption className="sr-only">Tabela editável das entregas recebidas</caption><thead><tr><th>ID</th><th>DESCRIÇÃO</th><th>QTD.</th><th>ENTREGA</th><th>VALOR TOTAL (R$)</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{drafts.map((draft, index) => <tr key={index}><td><input aria-label={`ID da entrega ${index + 1}`} value={draft.id} onChange={(event) => updateDraft(index, "id", event.target.value)} className="cell-id" maxLength={40} disabled={loading} placeholder="001" /></td><td><input aria-label={`Descrição da entrega ${index + 1}`} value={draft.description} onChange={(event) => updateDraft(index, "description", event.target.value)} maxLength={300} disabled={loading} placeholder="Descrição do item" /></td><td><input aria-label={`Quantidade da entrega ${index + 1}`} value={draft.quantity} onChange={(event) => updateDraft(index, "quantity", event.target.value)} inputMode="decimal" disabled={loading} placeholder="0" /></td><td><input aria-label={`Data da entrega ${index + 1}`} type="date" value={draft.deliveredAt} onChange={(event) => updateDraft(index, "deliveredAt", event.target.value)} disabled={loading} /></td><td><input aria-label={`Valor total em reais da entrega ${index + 1}`} value={draft.total} onChange={(event) => updateDraft(index, "total", event.target.value)} inputMode="decimal" disabled={loading} placeholder="0,00" /></td><td><button className="icon-button delete-row" aria-label={`Remover entrega ${index + 1}`} onClick={() => updateInputs({ drafts: drafts.filter((_, i) => i !== index) })} disabled={loading}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div> : <div className="table-empty"><span className="empty-icon"><Table2 size={28} strokeWidth={1.4} /></span><strong>Uma tabela. Todos os detalhes.</strong><p>Adicione suas entregas ou carregue<br />o exemplo fictício para começar.</p><button className="text-button" onClick={() => fileInput.current?.click()} disabled={loading}>Importar uma tabela CSV <ArrowRight size={14} /></button></div>}
                <div className="table-actions"><button className="text-button" onClick={() => updateInputs({ drafts: [...drafts, { id: "", description: "", quantity: "", deliveredAt: "", total: "" }] })} disabled={loading || drafts.length >= 10}><Plus size={15} /> Adicionar entrega</button><span>{drafts.length}/10 itens</span><button className="text-button csv-download" onClick={downloadCsv}><ArrowDownToLine size={14} /> Modelo CSV</button></div>
              </section>
            </div>
            <div className="analyze-bar"><div className="analysis-promise"><span className="promise-icon"><Sparkles size={18} /></span><div><strong>A IA lê. As regras conferem. Você decide.</strong><p>Quantidade, prazo e valor comparados com evidências do contrato.</p></div></div><button className="button button-primary" onClick={analyze} disabled={loading || !hydrated || !contract.trim() || !drafts.length}>{loading ? <LoaderCircle className="spin" size={18} /> : <FileCheck2 size={18} />}{loading ? "Conferindo entregas…" : "Conferir entregas"}{!loading && <ArrowRight size={17} />}</button></div>
          </section>

          <section id="conferencia" className="results-section" ref={results} aria-busy={loading}>
            <div className="section-kicker"><span>02 / CONFERÊNCIA E REVISÃO</span>{analysis && <span className="real-analysis"><CheckCircle2 size={13} /> Análise real concluída</span>}</div>
            {loading ? <div className="loading-panel" role="status"><div className="loading-orbit"><FileCheck2 size={28} /><LoaderCircle size={54} className="spin" /></div><h2>Lendo o contrato com IA…</h2><p>Os itens serão comparados com as entregas por regras objetivas.<br />Estamos verificando também a origem de cada evidência.</p><span className="loading-track"><span /></span></div> : analysis ? <>
              <div className="results-heading"><div><h2>{analysis.issues.length === 0 ? "Tudo de acordo com o combinado." : pendingCount === 0 ? "Revisão concluída. Tudo registrado." : "Os detalhes que merecem atenção."}</h2><p>{analysis.issues.length === 0 ? "Nenhuma diferença identificada nos dados informados." : "Cada ocorrência tem uma evidência. A conclusão continua com você."}</p></div><span className="analysis-time">{new Date(analysis.meta.analyzedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="metrics-grid"><Metric value={analysis.items.length} label="Itens do contrato" icon={<FileText size={18} />} /><Metric value={analysis.issues.length} label="Ocorrências encontradas" icon={<TriangleAlert size={18} />} accent="amber" /><Metric value={conformingIds.length} label="Itens sem divergências" icon={<CheckCircle2 size={18} />} accent="green" /><Metric value={`${reviewedCount}/${analysis.issues.length}`} label="Ocorrências revisadas" icon={<ClipboardCheck size={18} />} accent="green" /></div>
              {analysis.warnings.length > 0 && <div className="analysis-warnings"><Info size={17} /><div><strong>Atenção aos dados extraídos</strong>{analysis.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div></div>}
              <div className="review-toolbar"><div className="filter-tabs" role="group" aria-label="Filtrar ocorrências">{([["all", "Todas", analysis.issues.length], ["pending", "Pendentes", pendingCount], ["reviewed", "Revisadas", reviewedCount]] as const).map(([value, label, count]) => <button key={value} onClick={() => setFilter(value)} className={filter === value ? "selected" : ""} aria-pressed={filter === value}>{label}<span>{count}</span></button>)}</div><span className="review-hint"><ShieldCheck size={14} /> Revisão humana, sempre</span></div>
              <div className="issue-list">{visibleIssues.map((issue) => <IssueCard key={issue.id} issue={issue} review={reviews[issue.id]} onChange={(update) => updateReview(issue.id, update)} />)}</div>
              {visibleIssues.length === 0 && <div className="filtered-empty"><CheckCheck size={27} /><h3>{filter === "pending" ? "Nenhuma ocorrência pendente." : filter === "reviewed" ? "Suas revisões aparecerão aqui." : "Nenhuma divergência encontrada."}</h3><p>{filter === "reviewed" ? "Confira as evidências e marque cada ocorrência como revisada." : "Todos os dados disponíveis foram conferidos."}</p></div>}
              {conformingIds.length > 0 && <div className="conforming-note"><CheckCircle2 size={17} /><span><strong>{conformingIds.length} {conformingIds.length === 1 ? "item sem divergências" : "itens sem divergências"}</strong><span className="conforming-ids">{conformingIds.map((id) => `Item ${id}`).join(" · ")}</span></span><span className="conforming-caption">Quantidade, prazo e valor conferidos</span></div>}
              {analysis.issues.length > 0 && <div className="review-progress"><span><strong>{reviewedCount}</strong> de {analysis.issues.length} ocorrências revisadas</span><div className="progress-track"><div style={{ width: `${reviewedCount / analysis.issues.length * 100}%` }} /></div><span>{Math.round(reviewedCount / analysis.issues.length * 100)}%</span></div>}
            </> : <div className="results-empty"><div className="results-empty-art"><span /><FileCheck2 size={35} strokeWidth={1.3} /><span className="art-check"><Check size={12} strokeWidth={3} /></span></div><h2>Clareza começa com uma conferência.</h2><p>Adicione o contrato e as entregas acima.<br />As diferenças e suas evidências vão aparecer aqui.</p><div className="empty-tags"><span>Quantidade</span><i /><span>Prazo</span><i /><span>Valor</span></div></div>}
          </section>

          <footer id="sobre" className="footer"><div><ShieldCheck size={16} /><p>Conferência documental, sem interpretação jurídica.<br /><span>A IA extrai os dados. Código compara. A revisão é sua.</span></p></div><span className="connection-status"><span className={`tiny-dot ${health?.configured ? "" : "muted"}`} />{health?.configured ? "OpenAI configurada" : health ? "OpenAI · configuração pendente" : "OpenAI · configuração não verificada"}</span></footer>
        </main>
      </div>
    </div>
  );
}

function Metric({ value, label, icon, accent = "neutral" }: { value: string | number; label: string; icon: React.ReactNode; accent?: string }) {
  return <div className={`metric metric-${accent}`}><div className="metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong></div>;
}

function IssueCard({ issue, review, onChange }: { issue: Issue; review?: Review; onChange: (update: Partial<Review>) => void }) {
  const [showNote, setShowNote] = useState(!!review?.note);
  const reviewed = review?.reviewed ?? false;
  return <article className={`issue-card issue-${issue.type} ${reviewed ? "is-reviewed" : ""}`}>
    <div className="issue-heading"><div className="issue-title-row"><span className={`issue-type type-${issue.type}`}>{issueLabels[issue.type]}</span><span className="issue-item-id">ITEM {issue.itemId}</span></div><span className={`review-state ${reviewed ? "done" : ""}`}><span className="tiny-dot" />{reviewed ? "Revisada" : "Pendente"}</span></div>
    <h3>{issue.title}</h3><p className="issue-description">{issue.description}</p>
    <div className="comparison-grid"><div><span className="comparison-label">CONTRATADO</span><strong>{issue.expected}</strong></div><ArrowRight size={18} /><div><span className="comparison-label">ENTREGUE</span><strong className="delivered-value">{issue.delivered}</strong></div><p className="difference-detail">{issue.detail}</p></div>
    <div className="evidence-block"><span className="evidence-label"><FileText size={14} /> EVIDÊNCIA NO CONTRATO</span>{issue.contractEvidence ? <blockquote>“{issue.contractEvidence}”</blockquote> : <p className="missing-evidence">Não há evidência suficiente no contrato. É necessária revisão humana.</p>}{issue.deliveryEvidence && <p className="delivery-evidence"><Table2 size={12} /><span>Na tabela: {issue.deliveryEvidence}</span></p>}</div>
    <div className="issue-review"><button className={`review-button ${reviewed ? "checked" : ""}`} onClick={() => onChange({ reviewed: !reviewed, reviewedAt: reviewed ? null : new Date().toISOString() })} aria-pressed={reviewed}><span className="review-checkbox">{reviewed && <Check size={12} strokeWidth={3} />}</span>{reviewed ? "Ocorrência revisada" : "Marcar como revisada"}</button><button className="note-toggle" onClick={() => setShowNote(!showNote)} aria-expanded={showNote}>{showNote ? "Ocultar observação" : review?.note ? "Ver observação" : "+ Adicionar observação"}</button></div>
    {showNote && <div className="review-note"><label htmlFor={`note-${issue.id}`}>Observação da revisão <span>(opcional)</span></label><textarea id={`note-${issue.id}`} maxLength={500} rows={2} value={review?.note ?? ""} placeholder="Registre o que foi conferido ou o próximo passo…" onChange={(event) => onChange({ note: event.target.value })} /></div>}
  </article>;
}
