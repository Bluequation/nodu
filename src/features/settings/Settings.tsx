import { useEffect, useState, type FormEvent } from "react";
import { Check, Download, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { ChangeEvent } from "react";
import type { StudySettings } from "../../domain/study";
import { createBackup, inspectBackup, restoreBackup, type BackupSummary } from "../../data/backup";
import { getStudySettings, saveStudySettings } from "../../data/study";

const DEFAULTS: StudySettings = { retention: 0.9, newLimit: 10, reviewLimit: 70, leech: 4 };
export function SettingsPage() {
  const [settings, setSettings] = useState<StudySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [backup, setBackup] = useState<BackupSummary | null>(null);
  const [backupFile, setBackupFile] = useState("");
  const [backupMode, setBackupMode] = useState<"merge" | "replace">("merge");
  const [backupError, setBackupError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  useEffect(() => { getStudySettings().then(setSettings).finally(() => setLoading(false)); }, []);
  function change<K extends keyof StudySettings>(key: K, value: StudySettings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (settings.retention < 0.8 || settings.retention > 0.97) { setFeedback("A retenção desejada deve ficar entre 80% e 97%."); return; }
    if (settings.newLimit < 0 || settings.newLimit > 200 || settings.reviewLimit < 1 || settings.reviewLimit > 1000) { setFeedback("Confira os limites diários."); return; }
    await saveStudySettings(settings);
    setFeedback("Preferências salvas neste navegador.");
  }

  async function downloadBackup() {
    setBackupBusy(true); setBackupError("");
    try {
      const content = await createBackup();
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ritmo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback("Backup baixado. Guarde-o em um local seguro.");
    } catch {
      setBackupError("Não foi possível gerar o backup.");
    } finally { setBackupBusy(false); }
  }
  async function inspectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupError(""); setBackup(null);
    if (file.size > 50_000_000) { setBackupError("O backup ultrapassa 50 MB."); return; }
    try {
      const summary = inspectBackup(await file.text());
      setBackup(summary); setBackupFile(file.name);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Não foi possível ler o backup.");
    } finally { event.target.value = ""; }
  }
  async function applyBackup() {
    if (!backup || backupBusy) return;
    const warning = backupMode === "replace"
      ? "Isso substituirá os dados atuais do Ritmo 8 neste navegador. O localStorage legado não será apagado. Faça um backup atual antes de continuar."
      : "Isso mesclará os dados do arquivo com os dados atuais. Registros com o mesmo ID serão atualizados.";
    if (!confirm(warning)) return;
    setBackupBusy(true); setBackupError("");
    try {
      await restoreBackup(backup, backupMode);
      setFeedback("Backup restaurado. Recarregando o Ritmo…");
      window.location.reload();
    } catch {
      setBackupError("Não foi possível restaurar o backup. Os dados locais anteriores foram mantidos se a transação não foi concluída.");
      setBackupBusy(false);
    }
  }
  if (loading) return <div className="loading-panel">Carregando preferências…</div>;
  return <div className="stack">
    <header className="heading"><div><small>RITMO / PREFERÊNCIAS</small><h1>Ajustes</h1><p>Configure a carga de estudo e a meta de retenção do FSRS.</p></div><span className="soft-tag"><ShieldCheck size={14}/> Dados locais</span></header>
    <form className="stack" onSubmit={submit}>
      <section className="panel wizard-panel">
        <div className="panel-title-row"><div><span className="step-kicker">REVISÃO ESPAÇADA</span><h2><SlidersHorizontal size={19}/> Preferências do FSRS-6</h2><p>Essas opções influenciam o cálculo dos próximos intervalos. Não alteram o histórico já registrado.</p></div><span className="soft-tag">FSRS-6</span></div>
        <div className="setting-control">
          <div><label htmlFor="retention">Retenção desejada</label><p>Meta de probabilidade de recordar o conhecimento no momento da revisão.</p></div>
          <strong>{Math.round(settings.retention * 100)}%</strong>
          <input id="retention" type="range" min="0.8" max="0.97" step="0.01" value={settings.retention} onChange={event => change("retention", Number(event.target.value))}/>
          <div className="range-labels"><span>80% · Menor carga</span><span>97% · Maior carga</span></div>
        </div>
        <div className="form-grid">
          <div className="field-block"><label htmlFor="new-limit">Novas famílias por dia</label><input id="new-limit" type="number" min="0" max="200" value={settings.newLimit} onChange={event => change("newLimit", Number(event.target.value))}/><small>Quantidade máxima de novos microconhecimentos iniciados por dia.</small></div>
          <div className="field-block"><label htmlFor="review-limit">Revisões antigas por dia</label><input id="review-limit" type="number" min="1" max="1000" value={settings.reviewLimit} onChange={event => change("reviewLimit", Number(event.target.value))}/><small>Limite para cartões que já tiveram ao menos uma revisão.</small></div>
          <div className="field-block"><label htmlFor="leech">Alerta de esquecimento recorrente</label><select id="leech" value={settings.leech} onChange={event => change("leech", Number(event.target.value))}>{[2,3,4,5,6,7,8,9,10].map(value => <option key={value} value={value}>{value} esquecimentos</option>)}</select><small>Ao atingir esse número, o Ritmo sugere revisar a qualidade do cartão.</small></div>
        </div>
        {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
        <div className="form-actions"><button className="primary-button" type="submit">Salvar preferências <Check size={15}/></button></div>
      </section>
    </form>
    <section className="panel wizard-panel backup-panel">
      <div className="panel-title-row"><div><span className="step-kicker">SEGURANÇA DOS DADOS</span><h2><Download size={19}/> Backup e restauração</h2><p>Exporte seus dados para guardar uma cópia. O arquivo não é enviado a nenhum servidor.</p></div><span className="soft-tag">Local</span></div>
      <div className="backup-export-row"><div><strong>Baixar backup completo</strong><small>Planos, flashcards, revisões FSRS, caderno de erros, questões, sessões e configurações.</small></div><button className="primary-button" type="button" disabled={backupBusy} onClick={downloadBackup}>{backupBusy ? "Preparando…" : "Baixar backup"} <Download size={15}/></button></div>
      <div className="field-block"><label htmlFor="backup-file">Restaurar ou mesclar um backup Ritmo 8</label><div className="file-picker"><ShieldCheck size={18}/><span>{backupFile || "Escolha um arquivo ritmo-backup-v1.json"}</span><label className="secondary-button" htmlFor="backup-file">Procurar</label><input id="backup-file" type="file" accept=".json,application/json" onChange={inspectFile}/></div></div>
      {backup && <div className="backup-preview"><strong>Arquivo validado · {new Date(backup.exportedAt).toLocaleString("pt-BR")}</strong><div className="backup-counts">{Object.entries(backup.counts).map(([key, value]) => <span key={key}><b>{value}</b>{key}</span>)}</div><div className="field-block"><label>Como deseja restaurar?</label><select value={backupMode} onChange={event => setBackupMode(event.target.value as "merge" | "replace")}><option value="merge">Mesclar — preservar registros que não estão no arquivo</option><option value="replace">Substituir — trocar os dados do Ritmo 8 pelos do backup</option></select></div><button className="primary-button" type="button" disabled={backupBusy} onClick={applyBackup}>Restaurar backup <Check size={15}/></button></div>}
      {backupError && <p className="inline-feedback" role="alert">{backupError}</p>}
      <p className="field-hint">A opção “Substituir” afeta somente os stores do Ritmo 8 no IndexedDB. A cópia legada no localStorage permanece intacta. Recomendamos baixar um backup antes de restaurar.</p>
    </section>
    <section className="panel privacy-panel"><ShieldCheck size={22}/><div><strong>Seus dados permanecem no navegador</strong><p>O Ritmo 8 não exige conta, chave de IA ou serviço externo para funcionar. A leitura de PDF textual pode carregar o leitor PDF.js sob demanda; o arquivo é processado no próprio navegador.</p></div></section>
  </div>;
}
