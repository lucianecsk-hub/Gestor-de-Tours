'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Auth from '@/components/Auth';

const MOODS = ['Feliz','Triste','Animado','Frustrado','Improdutivo','Produtivo','Com sono','Ativo','Falante','Calado'];
const TOUR_OPTIONS = ['GCW', 'GCW BILINGUE', 'GCW TRILINGUE', 'DEATH VALLEY', 'DV + 51', 'DV + STARS', 'VALLEY OF FIRE', 'MT CHARLESTON', 'ANTILOPE', 'ZION', 'ZION + BRYCE', 'HOOVER DAM'];

const DEFAULT_SETTINGS = {
  guiaNome: 'Daniel Kochinski',
  guiaEndereco: '9510 Wooded Hills dr',
  guiaEmail: 'danielkochinski@gmail.com',
  guiaTelefone: '702-542-8667',
  clienteNome: 'LAS VEGAS VIP SERVICES ONE LLC',
  clienteEndereco: '2566 LA CARA AVE',
  clienteCidade: 'LAS VEGAS, NV, 89121',
  proximoInvoiceNum: 51,
  cityTourLimite: 14,
  cityTourTaxaAte: 10,
  cityTourTaxaDepois: 15,
  heliTaxa: 20,
  pgtoExtraPaxTaxa: 10,
};

type Entry = {
  id: string;
  data: string;
  tour: string;
  valorTour: string;
  espanhol: string; portugues: string; italiano: string; ingles: string;
  pgtoExtraPax: string;
  cityQtd: string; cityQtdTotal: string; cityPreco: string;
  heliQtd: string; heliPreco: string;
  tipPax: string; tipGas: string;
  pagamentoInvoice: string;
  moods: string[];
  nota: string;
  obs: string;
  revisado: boolean;
};

type Settings = typeof DEFAULT_SETTINGS;

function emptyEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    data: new Date().toISOString().slice(0,10),
    tour: 'GCW',
    valorTour: '',
    espanhol: '', portugues: '', italiano: '', ingles: '',
    pgtoExtraPax: '0',
    cityQtd: '', cityQtdTotal: '', cityPreco: '',
    heliQtd: '', heliPreco: '20',
    tipPax: '', tipGas: '',
    pagamentoInvoice: '',
    moods: [],
    nota: '',
    obs: '',
    revisado: false,
  };
}

function num(v: string | number) { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n; }
function money(v: number) { return v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }

function computeEntry(e: Entry, settings: Settings) {
  const clientesTotal = num(e.espanhol)+num(e.portugues)+num(e.italiano)+num(e.ingles);
  const cityTotal = num(e.cityQtd) * num(e.cityPreco);
  const heliTotal = num(e.heliQtd) * num(e.heliPreco);
  const pgtoExtraTotal = num(e.portugues) * num(e.pgtoExtraPax);
  const vendasTotal = num(e.valorTour) + cityTotal + heliTotal + pgtoExtraTotal;
  const tipTotal = num(e.tipPax) + num(e.tipGas);
  const pagamentoTotal = num(e.pagamentoInvoice) + tipTotal;
  const comissaoCity = cityTotal;

  return { clientesTotal, cityTotal, heliTotal, pgtoExtraTotal, vendasTotal, tipTotal, pagamentoTotal, comissaoCity };
}

// Quinzena = ciclo de faturamento: dia 1-15 e dia 16-fim do mes
function quinzenaBounds(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const yyyy = String(y);
  const mm = String(m).padStart(2, '0');
  if (d <= 15) {
    return { start: `${yyyy}-${mm}-01`, end: `${yyyy}-${mm}-15` };
  }
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${yyyy}-${mm}-16`, end: `${yyyy}-${mm}-${String(lastDay).padStart(2,'0')}` };
}

function Field({label, children, className}: {label: string, children: React.ReactNode, className?: string}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-600 flex-1 min-w-[90px] ${className || ''}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "border border-slate-300 rounded px-3 py-2.5 text-base w-full focus:outline-none focus:ring-2 focus:ring-slate-400";

export default function Dashboard() {
  const [session, setSession] = useState<any>(undefined);
  const [tab, setTab] = useState('lancamentos');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState<Entry>(emptyEntry());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invoiceRange, setInvoiceRange] = useState({start:'', end:''});
  const [invoiceDataEmissao, setInvoiceDataEmissao] = useState(() => new Date().toISOString().slice(0,10));
  const [invoiceNum, setInvoiceNum] = useState<number | null>(null);
  const [invoiceNumInput, setInvoiceNumInput] = useState<number>(settings.proximoInvoiceNum);
  const [customRange, setCustomRange] = useState({start:'', end:''});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoaded(false);
      try {
        const [entriesRes, settingsRes] = await Promise.all([
          supabase.from('entries').select('id, data').eq('user_id', session.user.id),
          supabase.from('settings').select('data').eq('user_id', session.user.id).maybeSingle(),
        ]);
        if (entriesRes.error) throw entriesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        setEntries((entriesRes.data || []).map((r: any) => ({ id: r.id, ...r.data })));
        if (settingsRes.data?.data) setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.data.data });
      } catch (err: any) {
        setErrorMsg('Não foi possível carregar os dados: ' + err.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  const sorted = useMemo(() => [...entries].sort((a,b)=>a.data.localeCompare(b.data)), [entries]);
  const sortedDesc = useMemo(() => [...sorted].reverse(), [sorted]);

  const quinzenaTotal = useMemo(() => {
    if (!form.data) return 0;
    const { start, end } = quinzenaBounds(form.data);
    const somaOutrasEntradas = entries
      .filter(en => en.id !== editingId && en.data >= start && en.data <= end)
      .reduce((s, en) => s + num(en.cityQtd), 0);
    return somaOutrasEntradas + num(form.cityQtd);
  }, [form.data, form.cityQtd, entries, editingId]);

  useEffect(() => {
    if (num(form.cityQtd) <= 0) return;
    const limite = num(settings.cityTourLimite);
    const taxa = quinzenaTotal <= limite ? settings.cityTourTaxaAte : settings.cityTourTaxaDepois;
    setForm(f => ({ ...f, cityQtdTotal: String(quinzenaTotal), cityPreco: String(taxa) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quinzenaTotal, settings.cityTourLimite, settings.cityTourTaxaAte, settings.cityTourTaxaDepois]);

  useEffect(() => {
    if (num(form.heliQtd) <= 0) return;
    setForm(f => ({ ...f, heliPreco: String(settings.heliTaxa) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.heliQtd, settings.heliTaxa]);

  useEffect(() => {
    if (num(form.portugues) <= 0) return;
    setForm(f => ({ ...f, pgtoExtraPax: String(settings.pgtoExtraPaxTaxa) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.portugues, settings.pgtoExtraPaxTaxa]);

  useEffect(() => {
    const cityTotal = num(form.cityQtd) * num(form.cityPreco);
    const heliTotal = num(form.heliQtd) * num(form.heliPreco);
    const pgtoExtraTotal = num(form.portugues) * num(form.pgtoExtraPax);
    const vendasTotal = num(form.valorTour) + cityTotal + heliTotal + pgtoExtraTotal;
    setForm(f => ({ ...f, pagamentoInvoice: vendasTotal ? String(vendasTotal) : '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.valorTour, form.cityQtd, form.cityPreco, form.heliQtd, form.heliPreco, form.portugues, form.pgtoExtraPax]);

  async function recalcQuinzena(allEntries: Entry[], dateStr: string, userId: string): Promise<Entry[]> {
    if (!dateStr) return allEntries;
    const { start, end } = quinzenaBounds(dateStr);
    const inRange = allEntries.filter(en => en.data >= start && en.data <= end);
    const total = inRange.reduce((s, en) => s + num(en.cityQtd), 0);
    const limite = num(settings.cityTourLimite);
    const rate = total <= limite ? num(settings.cityTourTaxaAte) : num(settings.cityTourTaxaDepois);
    const rateStr = String(rate);
    const totalStr = String(total);

    const toPersist: Entry[] = [];
    const updated = allEntries.map(en => {
      if (en.data >= start && en.data <= end && num(en.cityQtd) > 0 && (en.cityPreco !== rateStr || en.cityQtdTotal !== totalStr)) {
        const novoCityTotal = num(en.cityQtd) * rate;
        const heliTotal = num(en.heliQtd) * num(en.heliPreco);
        const pgtoExtraTotal = num(en.portugues) * num(en.pgtoExtraPax);
        const novoVendasTotal = num(en.valorTour) + novoCityTotal + heliTotal + pgtoExtraTotal;
        const newEn = { ...en, cityPreco: rateStr, cityQtdTotal: totalStr, pagamentoInvoice: novoVendasTotal ? String(novoVendasTotal) : en.pagamentoInvoice };
        toPersist.push(newEn);
        return newEn;
      }
      return en;
    });

    for (const en of toPersist) {
      await supabase.from('entries').update({ data: en }).eq('id', en.id).eq('user_id', userId);
    }
    return updated;
  }

  async function saveEntry() {
    if (!session) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      let newEntriesLocal: Entry[];
      const oldEntry = editingId ? entries.find(e => e.id === editingId) : undefined;
      if (editingId) {
        const { error } = await supabase.from('entries').update({ data: form }).eq('id', editingId).eq('user_id', session.user.id);
        if (error) throw error;
        newEntriesLocal = entries.map(e => e.id === editingId ? form : e);
      } else {
        const newEntry = {...form, id: crypto.randomUUID()};
        const { error } = await supabase.from('entries').insert({ id: newEntry.id, user_id: session.user.id, data: newEntry });
        if (error) throw error;
        newEntriesLocal = [...entries, newEntry];
      }
      let result = await recalcQuinzena(newEntriesLocal, form.data, session.user.id);
      if (oldEntry && oldEntry.data !== form.data) {
        const bOld = quinzenaBounds(oldEntry.data);
        const bNew = quinzenaBounds(form.data);
        if (bOld.start !== bNew.start) {
          result = await recalcQuinzena(result, oldEntry.data, session.user.id);
        }
      }
      setEntries(result);
      setForm(emptyEntry());
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg('Não foi possível salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function editEntry(e: Entry) {
    setForm(e);
    setEditingId(e.id);
    setTab('lancamentos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeEntry(id: string) {
    if (!session) return;
    try {
      const removed = entries.find(e => e.id === id);
      const { error } = await supabase.from('entries').delete().eq('id', id).eq('user_id', session.user.id);
      if (error) throw error;
      const remaining = entries.filter(e=>e.id!==id);
      const result = removed ? await recalcQuinzena(remaining, removed.data, session.user.id) : remaining;
      setEntries(result);
    } catch (err: any) {
      setErrorMsg('Não foi possível excluir: ' + err.message);
    }
  }

  async function toggleRevisado(entry: Entry) {
    if (!session) return;
    const updated = { ...entry, revisado: !entry.revisado };
    setEntries(entries.map(e => e.id === entry.id ? updated : e));
    try {
      const { error } = await supabase.from('entries').update({ data: updated }).eq('id', entry.id).eq('user_id', session.user.id);
      if (error) throw error;
    } catch (err: any) {
      setEntries(entries);
      setErrorMsg('Não foi possível marcar como revisado: ' + err.message);
    }
  }

  function toggleMood(m: string) {
    setForm(f => ({...f, moods: f.moods.includes(m) ? f.moods.filter(x=>x!==m) : [...f.moods, m]}));
  }

  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importDone, setImportDone] = useState<number | null>(null);

  function parseCsv(text: string): any[] {
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i+1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { cur.push(field); field = ''; }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i+1] === '\n') i++;
          cur.push(field); field = '';
          if (cur.length > 1 || cur[0] !== '') rows.push(cur);
          cur = [];
        } else field += ch;
      }
    }
    if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(c => c !== '')).map(r => {
      const obj: any = {};
      headers.forEach((h, idx) => obj[h] = (r[idx] ?? '').trim());
      return obj;
    });
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setImportPreview(parseCsv(text));
      setImportDone(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function runImport() {
    if (!session || importPreview.length === 0) return;
    setImporting(true);
    setImportDone(null);
    try {
      const toInsert = importPreview.map(row => ({ ...emptyEntry(), ...row, id: crypto.randomUUID(), moods: [] }));
      const CHUNK = 200;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const payload = chunk.map(e => ({ id: e.id, user_id: session.user.id, data: e }));
        const { error } = await supabase.from('entries').insert(payload);
        if (error) throw error;
        inserted += chunk.length;
        setImportProgress(`${inserted}/${toInsert.length}`);
      }
      const entriesRes = await supabase.from('entries').select('id, data').eq('user_id', session.user.id);
      if (entriesRes.data) setEntries(entriesRes.data.map((r: any) => ({ id: r.id, ...r.data })));
      setImportDone(inserted);
      setImportPreview([]);
    } catch (err: any) {
      setErrorMsg('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
    }
  }

  async function persistSettings(next: Settings) {
    if (!session) return;
    setSettings(next);
    try {
      const { error } = await supabase.from('settings').upsert({ user_id: session.user.id, data: next });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg('Não foi possível salvar as configurações: ' + err.message);
    }
  }

  const customEntries = useMemo(() => {
    if (!customRange.start || !customRange.end) return [];
    return sorted.filter(e => e.data >= customRange.start && e.data <= customRange.end);
  }, [sorted, customRange]);

  const customStats = useMemo(() => {
    const s = { servicos:0, espanhol:0, portugues:0, italiano:0, ingles:0, clientes:0, faturado:0, cityQtdVendidos:0, tipClientes:0, comissaoGas:0, heli:0 };
    customEntries.forEach(e => {
      const c = computeEntry(e, settings);
      s.servicos += 1;
      s.espanhol += num(e.espanhol);
      s.portugues += num(e.portugues);
      s.italiano += num(e.italiano);
      s.ingles += num(e.ingles);
      s.clientes += c.clientesTotal;
      s.faturado += c.vendasTotal;
      s.cityQtdVendidos += num(e.cityQtd);
      s.tipClientes += num(e.tipPax);
      s.comissaoGas += num(e.tipGas);
      s.heli += num(e.heliQtd);
    });
    return s;
  }, [customEntries, settings]);

  const monthly = useMemo(() => {
    const map: Record<string, {invoice:number, clientes:number, tips:number, totalRecebido:number, servicos:number}> = {};
    sorted.forEach(e => {
      const key = e.data ? e.data.slice(0,7) : 'Sem data';
      const c = computeEntry(e, settings);
      if (!map[key]) map[key] = {invoice:0, clientes:0, tips:0, totalRecebido:0, servicos:0};
      map[key].invoice += num(e.pagamentoInvoice);
      map[key].clientes += c.clientesTotal;
      map[key].tips += num(e.tipPax);
      map[key].totalRecebido += c.pagamentoTotal;
      map[key].servicos += 1;
    });
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [sorted, settings]);

  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {}; MOODS.forEach(m=>counts[m]=0);
    sorted.forEach(e => (e.moods||[]).forEach(m => { counts[m] = (counts[m]||0)+1; }));
    return counts;
  }, [sorted]);

  const avgNota = useMemo(() => {
    const withNota = sorted.filter(e => e.nota !== '' && e.nota !== undefined && e.nota !== null);
    if (!withNota.length) return null;
    return (withNota.reduce((s,e)=>s+num(e.nota),0) / withNota.length).toFixed(1);
  }, [sorted]);

  const invoiceEntries = useMemo(() => {
    if (!invoiceRange.start || !invoiceRange.end) return [];
    return sorted.filter(e => e.data >= invoiceRange.start && e.data <= invoiceRange.end);
  }, [sorted, invoiceRange]);

  const invoiceTotal = useMemo(() => invoiceEntries.reduce((s,e)=>{
    const c = computeEntry(e, settings);
    return s + c.vendasTotal;
  }, 0), [invoiceEntries, settings]);

  useEffect(() => {
    if (loaded && invoiceNum === null) setInvoiceNumInput(settings.proximoInvoiceNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings.proximoInvoiceNum]);

  function startInvoice() { setInvoiceNum(invoiceNumInput); }
  async function finalizeInvoice() {
    const next = {...settings, proximoInvoiceNum: (invoiceNum ?? settings.proximoInvoiceNum) + 1};
    await persistSettings(next);
    setInvoiceNum(null);
    setInvoiceRange({start:'', end:''});
    setInvoiceDataEmissao(new Date().toISOString().slice(0,10));
  }

  const TABS: [string,string][] = [
    ['lancamentos','Lançamentos'],
    ['relatorios','Relatórios'],
    ['invoice','Invoice'],
    ['config','Configurações'],
  ];

  if (session === undefined) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-slate-500">Carregando...</div>;
  }

  if (!session) {
    return <Auth onAuthed={() => {}} />;
  }

  if (!loaded) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-slate-500">Carregando seus dados...</div>;
  }

  return (
    <div className="min-h-screen bg-blue-50 text-slate-800">
      <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Gestor de Tours" className="h-16 sm:h-20 w-auto object-contain" />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Gestor de Tours & Invoices</h1>
              <p className="hidden sm:block text-sm text-slate-500 mt-1">Lançamentos diários, comissão de city tour, humor do dia e geração de invoice.</p>
            </div>
          </div>
          <div className="flex justify-between sm:block sm:text-right text-xs text-slate-500">
            <div>{session.user.email}</div>
            <button onClick={() => supabase.auth.signOut()} className="underline hover:text-slate-800 sm:mt-1">Sair</button>
          </div>
        </div>
        {errorMsg && <div className="mt-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2">{errorMsg}</div>}
        <div className="grid grid-cols-4 sm:flex sm:gap-1 gap-1 mt-4 bg-blue-100 rounded-lg p-1 sm:w-fit">
          {TABS.map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)}
              className={`px-2 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition text-center ${tab===key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-blue-200/60'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'lancamentos' && (
        <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide">{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h2>
              <div className="w-40">
                <input type="date" className={inputCls + " w-full bg-amber-50 border-amber-300 font-medium"} value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Tour">
                  <select className={inputCls} value={form.tour} onChange={e=>setForm({...form,tour:e.target.value})}>
                    {TOUR_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Valor do Tour ($)"><input type="number" className={inputCls} value={form.valorTour} onChange={e=>setForm({...form,valorTour:e.target.value})}/></Field>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-0">
                  <span className="font-medium truncate">Português</span>
                  <input type="number" className={inputCls} value={form.portugues} onChange={e=>setForm({...form,portugues:e.target.value})}/>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-0">
                  <span className="font-medium truncate">Italiano</span>
                  <input type="number" className={inputCls} value={form.italiano} onChange={e=>setForm({...form,italiano:e.target.value})}/>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-0">
                  <span className="font-medium truncate">Inglês</span>
                  <input type="number" className={inputCls} value={form.ingles} onChange={e=>setForm({...form,ingles:e.target.value})}/>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-0">
                  <span className="font-medium truncate">Espanhol</span>
                  <input type="number" className={inputCls} value={form.espanhol} onChange={e=>setForm({...form,espanhol:e.target.value})}/>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <Field label="Pgto Extra por Pax - Brasileiros ($)"><input type="number" className={inputCls} value={form.pgtoExtraPax} onChange={e=>setForm({...form,pgtoExtraPax:e.target.value})}/></Field>
              </div>
              <p className="text-xs text-slate-400 -mt-2">Preenchido automaticamente: $10 por pax brasileiro (Português). Pode editar se precisar. Multiplica pelo nº de brasileiros e entra no Pagamento Invoice e na invoice.</p>

              <div className="flex flex-wrap gap-3">
                <Field label="City Tour - Qtd vendida"><input type="number" className={inputCls} value={form.cityQtd} onChange={e=>setForm({...form,cityQtd:e.target.value})}/></Field>
                <Field label="City Tour - Qtd. Total (quinzena)"><input type="number" className={inputCls} value={form.cityQtdTotal} onChange={e=>setForm({...form,cityQtdTotal:e.target.value})}/></Field>
                <Field label="City Tour - Preço unit ($)"><input type="number" className={inputCls} value={form.cityPreco} onChange={e=>setForm({...form,cityPreco:e.target.value})}/></Field>
              </div>
              <p className="text-xs text-slate-400 -mt-2">Preenchido automaticamente: $10 até 14 city tours na quinzena, $15 a partir de 15. Pode editar se precisar.</p>

              <div className="flex flex-wrap gap-3">
                <Field label="Helicóptero - Qtd vendida"><input type="number" className={inputCls} value={form.heliQtd} onChange={e=>setForm({...form,heliQtd:e.target.value})}/></Field>
                <Field label="Helicóptero - Preço unit ($)"><input type="number" className={inputCls} value={form.heliPreco} onChange={e=>setForm({...form,heliPreco:e.target.value})}/></Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <Field label="Comissão Gas ($)"><input type="number" className={inputCls} value={form.tipGas} onChange={e=>setForm({...form,tipGas:e.target.value})}/></Field>
                <Field label="Tip Pax ($)"><input type="number" className={inputCls} value={form.tipPax} onChange={e=>setForm({...form,tipPax:e.target.value})}/></Field>
                <Field label="Gas + Tip (Total)">
                  <div className={inputCls + " bg-slate-100 text-slate-700 font-semibold"}>
                    ${money(num(form.tipGas) + num(form.tipPax))}
                  </div>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <Field label="Pagamento Invoice ($)"><input type="number" className={inputCls} value={form.pagamentoInvoice} onChange={e=>setForm({...form,pagamentoInvoice:e.target.value})}/></Field>
              </div>
              <p className="text-xs text-slate-400 -mt-2">Preenchido automaticamente: Valor do Tour + City Tour + Helicóptero. Pode editar se precisar.</p>

              <div className="flex flex-wrap gap-3">
                <Field label="Pagamento Total ($)">
                  <div className={inputCls + " bg-slate-100 text-slate-700 font-semibold"}>
                    ${money(num(form.pagamentoInvoice) + num(form.tipGas) + num(form.tipPax))}
                  </div>
                </Field>
              </div>
              <p className="text-xs text-slate-400 -mt-2">Pagamento Invoice + Comissão Gas + Tip Pax (calculado automaticamente).</p>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-slate-600">Como você estava hoje? (pode marcar mais de um)</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {MOODS.map(m => (
                  <button key={m} type="button" onClick={()=>toggleMood(m)}
                    className={`px-3 py-2 rounded-full text-sm border transition ${form.moods.includes(m) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">Nota do tour (0 a 5)</span>
              <div className="flex gap-1">
                {[0,1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={()=>setForm({...form,nota:String(n)})}
                    className={`w-10 h-10 rounded text-base border ${Number(form.nota)===n ? 'bg-amber-400 border-amber-500 text-white' : 'bg-white border-slate-300 text-slate-600'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Observação">
              <textarea className={inputCls + " mt-2 w-full"} rows={2} value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})}/>
            </Field>

            <div className="mt-4 flex gap-2">
              <button disabled={saving} onClick={saveEntry} className="bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded hover:bg-slate-700 disabled:opacity-50 w-full sm:w-auto">
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar lançamento'}
              </button>
              {editingId && (
                <button onClick={()=>{setForm(emptyEntry());setEditingId(null);}} className="text-sm px-4 py-2 rounded border border-slate-300">Cancelar</button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2 text-center">✓</th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Tour</th>
                  <th className="p-2 text-right">Clientes</th>
                  <th className="p-2 text-right">Pagto Invoice</th>
                  <th className="p-2 text-right">Tip Pax</th>
                  <th className="p-2 text-right">Pagto Total</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedDesc.map(e => {
                  const c = computeEntry(e, settings);
                  return (
                    <tr key={e.id} className={`border-t border-slate-100 ${e.revisado ? 'bg-emerald-50' : ''}`}>
                      <td className="p-2 text-center">
                        <button onClick={()=>toggleRevisado(e)} title="Marcar como revisado"
                          className={`w-6 h-6 rounded-full border flex items-center justify-center mx-auto ${e.revisado ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                          ✓
                        </button>
                      </td>
                      <td className="p-2">{e.data}</td>
                      <td className="p-2">{e.tour}</td>
                      <td className="p-2 text-right">{c.clientesTotal}</td>
                      <td className="p-2 text-right">${money(num(e.pagamentoInvoice))}</td>
                      <td className="p-2 text-right">${money(num(e.tipPax))}</td>
                      <td className="p-2 text-right">${money(c.pagamentoTotal)}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button onClick={()=>editEntry(e)} className="text-slate-500 hover:text-slate-900 mr-2">Editar</button>
                        <button onClick={()=>removeEntry(e.id)} className="text-red-500 hover:text-red-700">Excluir</button>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length===0 && <tr><td colSpan={8} className="p-4 text-center text-slate-400">Nenhum lançamento ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Comissão do City Tour</h2>
            <p className="text-xs text-slate-500 mb-3">Se a "Quantidade Total" vendida no período for até o limite, todos os city tours valem a taxa menor. Se passar do limite, TODOS passam a valer a taxa maior.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Limite (ex: 14)"><input type="number" className={inputCls} value={settings.cityTourLimite} onChange={e=>persistSettings({...settings,cityTourLimite:parseInt(e.target.value)||0})}/></Field>
              <Field label="Taxa até o limite ($/tour)"><input type="number" className={inputCls} value={settings.cityTourTaxaAte} onChange={e=>persistSettings({...settings,cityTourTaxaAte:parseInt(e.target.value)||0})}/></Field>
              <Field label="Taxa acima do limite ($/tour, vale para todos)"><input type="number" className={inputCls} value={settings.cityTourTaxaDepois} onChange={e=>persistSettings({...settings,cityTourTaxaDepois:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Comissão do Helicóptero</h2>
            <p className="text-xs text-slate-500 mb-3">Valor fixo por venda, preenchido automaticamente ao lançar a quantidade.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Taxa por venda ($)"><input type="number" className={inputCls} value={settings.heliTaxa} onChange={e=>persistSettings({...settings,heliTaxa:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Pgto Extra por Pax (Brasileiros)</h2>
            <p className="text-xs text-slate-500 mb-3">Valor fixo por pax brasileiro, preenchido automaticamente ao lançar a quantidade (mesma lógica do City Tour).</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Taxa por pax ($)"><input type="number" className={inputCls} value={settings.pgtoExtraPaxTaxa} onChange={e=>persistSettings({...settings,pgtoExtraPaxTaxa:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Dados para a Invoice</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seu nome (guia)"><input className={inputCls} value={settings.guiaNome} onChange={e=>persistSettings({...settings,guiaNome:e.target.value})}/></Field>
              <Field label="Seu endereço"><input className={inputCls} value={settings.guiaEndereco} onChange={e=>persistSettings({...settings,guiaEndereco:e.target.value})}/></Field>
              <Field label="Seu e-mail"><input className={inputCls} value={settings.guiaEmail} onChange={e=>persistSettings({...settings,guiaEmail:e.target.value})}/></Field>
              <Field label="Seu telefone"><input className={inputCls} value={settings.guiaTelefone} onChange={e=>persistSettings({...settings,guiaTelefone:e.target.value})}/></Field>
              <Field label="Cliente (Billed To) - nome"><input className={inputCls} value={settings.clienteNome} onChange={e=>persistSettings({...settings,clienteNome:e.target.value})}/></Field>
              <Field label="Cliente - endereço"><input className={inputCls} value={settings.clienteEndereco} onChange={e=>persistSettings({...settings,clienteEndereco:e.target.value})}/></Field>
              <Field label="Cliente - cidade/estado/CEP"><input className={inputCls} value={settings.clienteCidade} onChange={e=>persistSettings({...settings,clienteCidade:e.target.value})}/></Field>
              <Field label="Próximo número de invoice"><input type="number" className={inputCls} value={settings.proximoInvoiceNum} onChange={e=>persistSettings({...settings,proximoInvoiceNum:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Importar lançamentos em massa (CSV)</h2>
            <p className="text-xs text-slate-500 mb-3">
              Envie um arquivo CSV com as colunas: data, tour, valorTour, espanhol, portugues, italiano, ingles,
              cityQtd, cityPreco, cityQtdTotal, heliQtd, heliPreco, tipPax, tipGas, pagamentoInvoice, obs.
              Útil para cadastrar de uma vez lançamentos antigos.
            </p>
            <input type="file" accept=".csv" onChange={handleCsvFile} className="text-xs" />
            {importPreview.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-600 mb-2">{importPreview.length} lançamentos prontos para importar (mostrando os 5 primeiros):</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border border-slate-200">
                    <thead className="bg-slate-100"><tr>{Object.keys(importPreview[0]).map(k => <th key={k} className="p-1 text-left">{k}</th>)}</tr></thead>
                    <tbody>
                      {importPreview.slice(0,5).map((r,i) => (
                        <tr key={i} className="border-t border-slate-100">{Object.values(r).map((v,j) => <td key={j} className="p-1">{String(v)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button disabled={importing} onClick={runImport} className="mt-3 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded hover:bg-slate-700 disabled:opacity-50">
                  {importing ? `Importando... ${importProgress}` : `Importar ${importPreview.length} lançamentos`}
                </button>
              </div>
            )}
            {importDone !== null && <p className="text-xs text-emerald-700 mt-2">{importDone} lançamentos importados com sucesso!</p>}
          </div>
        </div>
      )}

      {tab === 'relatorios' && (
        <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Relatório por período (escolha as datas)</h2>
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <Field label="De"><input type="date" className={inputCls} value={customRange.start} onChange={e=>setCustomRange({...customRange,start:e.target.value})}/></Field>
              <Field label="Até"><input type="date" className={inputCls} value={customRange.end} onChange={e=>setCustomRange({...customRange,end:e.target.value})}/></Field>
            </div>
            {customRange.start && customRange.end ? (
              <div className="divide-y divide-slate-200">
                <div className="flex justify-between py-2"><span className="text-slate-500">Serviços</span><span className="font-semibold">{customStats.servicos}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Total de clientes</span><span className="font-semibold">{customStats.clientes}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Espanhol</span><span className="font-semibold">{customStats.espanhol}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Português</span><span className="font-semibold">{customStats.portugues}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Italiano</span><span className="font-semibold">{customStats.italiano}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Inglês</span><span className="font-semibold">{customStats.ingles}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Helicóptero vendidos</span><span className="font-semibold">{customStats.heli}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">City Tours vendidos</span><span className="font-semibold">{customStats.cityQtdVendidos}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Faturado</span><span className="font-semibold">${money(customStats.faturado)}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Tip Clientes</span><span className="font-semibold">${money(customStats.tipClientes)}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Comissão Gas</span><span className="font-semibold">${money(customStats.comissaoGas)}</span></div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Escolha as duas datas para ver os totais desse período.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold mb-3">Resumo por mês</h2>
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2 text-left">Mês</th>
                  <th className="p-2 text-right">Serviços</th>
                  <th className="p-2 text-right">Clientes</th>
                  <th className="p-2 text-right">Invoice</th>
                  <th className="p-2 text-right">Tips</th>
                  <th className="p-2 text-right">Total Recebido</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(([mes, v]) => (
                  <tr key={mes} className="border-t border-slate-100">
                    <td className="p-2">{mes}</td>
                    <td className="p-2 text-right">{v.servicos}</td>
                    <td className="p-2 text-right">{v.clientes}</td>
                    <td className="p-2 text-right">${money(v.invoice)}</td>
                    <td className="p-2 text-right">${money(v.tips)}</td>
                    <td className="p-2 text-right font-semibold">${money(v.totalRecebido)}</td>
                  </tr>
                ))}
                {monthly.length===0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sem dados ainda.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Quadro de sentimentos</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {MOODS.map(m => (
                <div key={m} className="border border-slate-200 rounded p-2 text-center">
                  <div className="text-xs text-slate-500">{m}</div>
                  <div className="text-lg font-semibold">{moodCounts[m]}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">Nota média dos tours: <span className="font-semibold text-slate-800">{avgNota ?? '—'}</span> / 5</p>
          </div>
        </div>
      )}

      {tab === 'invoice' && (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
          <div className="no-print bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Gerar Invoice</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <Field label="De"><input type="date" className={inputCls} value={invoiceRange.start} onChange={e=>setInvoiceRange({...invoiceRange,start:e.target.value})}/></Field>
              <Field label="Até"><input type="date" className={inputCls} value={invoiceRange.end} onChange={e=>setInvoiceRange({...invoiceRange,end:e.target.value})}/></Field>
              <Field label="Data de Emissão"><input type="date" className={inputCls} value={invoiceDataEmissao} onChange={e=>setInvoiceDataEmissao(e.target.value)}/></Field>
              <Field label="Nº da Invoice / Ciclo"><input type="number" className={inputCls + " w-24"} value={invoiceNumInput} onChange={e=>setInvoiceNumInput(parseInt(e.target.value)||0)}/></Field>
              <button onClick={startInvoice} className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded hover:bg-slate-700">Gerar prévia</button>
              {invoiceNum && (
                <>
                  <button onClick={()=>window.print()} className="border border-slate-300 text-sm font-medium px-4 py-2 rounded">Imprimir / Salvar PDF</button>
                  <button onClick={finalizeInvoice} className="text-sm px-4 py-2 rounded border border-emerald-500 text-emerald-700">Confirmar invoice enviada (avança numeração)</button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">Digite o número/ciclo que essa invoice deve ter (ex: 1, 2, 3... para cadastrar invoices antigas na mão). Fica sugerido automaticamente o próximo número (51) para as novas.</p>
          </div>

          {invoiceNum && (
            <div className="print-area bg-white rounded-lg border border-slate-200 p-8 text-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-lg font-bold tracking-wide">INVOICE</div>
                  <div>{invoiceNum}/{new Date().getFullYear()}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">DATE OF ISSUE</div>
                  <div>{invoiceDataEmissao.slice(5,7)}/{invoiceDataEmissao.slice(8,10)}/{invoiceDataEmissao.slice(0,4)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
                <div>
                  <div className="font-semibold">{settings.guiaNome}</div>
                  <div>{settings.guiaEndereco}</div>
                  <div>{settings.guiaEmail}</div>
                  <div>{settings.guiaTelefone}</div>
                </div>
                <div>
                  <div className="font-semibold">BILLED TO</div>
                  <div>{settings.clienteNome}</div>
                  <div>{settings.clienteEndereco}</div>
                  <div>{settings.clienteCidade}</div>
                </div>
              </div>
              <table className="w-full text-xs border-t border-slate-300">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-1">Days</th>
                    <th className="text-left py-1">Service Description</th>
                    <th className="text-right py-1">Unit Cost</th>
                    <th className="text-right py-1">Total Amount</th>
                    <th className="text-right py-1">Pax</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceEntries.map((e,i) => {
                    const c = computeEntry(e, settings);
                    const dataFmt = e.data.slice(5,7)+'/'+e.data.slice(8,10)+'/'+e.data.slice(2,4);
                    return (
                      <React.Fragment key={e.id}>
                        <tr className="border-t border-slate-200">
                          <td className="py-1.5 align-top">{i+1}</td>
                          <td className="py-1.5 align-top">{dataFmt}: {e.tour}</td>
                          <td className="py-1.5 text-right align-top">{money(num(e.valorTour))}</td>
                          <td className="py-1.5 text-right align-top">{money(num(e.valorTour))}</td>
                          <td className="py-1.5 text-right align-top">{c.clientesTotal}</td>
                        </tr>
                        {num(e.cityQtd) > 0 && (
                          <tr className="text-slate-500">
                            <td></td>
                            <td className="py-1">{dataFmt}: Comissão {e.cityQtd} City Tour</td>
                            <td className="py-1 text-right">{money(c.comissaoCity)}</td>
                            <td className="py-1 text-right">{money(c.comissaoCity)}</td>
                            <td></td>
                          </tr>
                        )}
                        {num(e.heliQtd) > 0 && (
                          <tr className="text-slate-500">
                            <td></td>
                            <td className="py-1">{dataFmt}: Comissão {e.heliQtd} Helicóptero</td>
                            <td className="py-1 text-right">{money(c.heliTotal)}</td>
                            <td className="py-1 text-right">{money(c.heliTotal)}</td>
                            <td></td>
                          </tr>
                        )}
                        {c.pgtoExtraTotal > 0 && (
                          <tr className="text-slate-500">
                            <td></td>
                            <td className="py-1">{dataFmt}: Extra Pax {e.portugues} Brasileiros</td>
                            <td className="py-1 text-right">{money(c.pgtoExtraTotal)}</td>
                            <td className="py-1 text-right">{money(c.pgtoExtraTotal)}</td>
                            <td></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-end mt-4 border-t border-slate-300 pt-2">
                <div className="text-sm font-semibold">Invoice Total: ${money(invoiceTotal)}</div>
              </div>
              {invoiceEntries.length===0 && <div className="text-center text-slate-400 py-6">Selecione um período com lançamentos.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
