import { useEffect, useState, type FormEvent } from "react";
import { Check, Download, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { StudySettings } from "../../domain/study";
import { getStudySettings, saveStudySettings } from "../../data/study";

const DEFAULTS: StudySettings = { retention: 0.9, newLimit: 10, reviewLimit: 70, leech: 4 };
export function SettingsPage() {
  const [settings, setSettings] = useState<StudySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
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
    <section className="panel privacy-panel"><ShieldCheck size={22}/><div><strong>Seus dados permanecem no navegador</strong><p>O Ritmo 8 não exige conta, chave de IA ou serviço externo para funcionar. A leitura de PDF textual pode carregar o leitor PDF.js sob demanda; o arquivo é processado no próprio navegador.</p></div></section>
  </div>;
}
