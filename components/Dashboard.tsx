'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Auth from '@/components/Auth';
import ResetPassword from '@/components/ResetPassword';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

const MOODS = ['Feliz','Triste','Animado','Frustrado','Produtivo','Improdutivo','Ativo','Com sono','Falante','Calado'];

const MOOD_META: Record<string, { emoji: string; score: number }> = {
  'Feliz':       { emoji: '😄', score: 2 },
  'Animado':     { emoji: '🤩', score: 2 },
  'Produtivo':   { emoji: '💪', score: 1 },
  'Ativo':       { emoji: '⚡', score: 1 },
  'Falante':     { emoji: '🗣️', score: 0 },
  'Calado':      { emoji: '🤐', score: 0 },
  'Com sono':    { emoji: '😴', score: -1 },
  'Improdutivo': { emoji: '📉', score: -1 },
  'Frustrado':   { emoji: '😤', score: -2 },
  'Triste':      { emoji: '😢', score: -2 },
};

function moodGaugeEmoji(avg: number): string {
  if (avg >= 1) return '😄';
  if (avg >= 0.3) return '🙂';
  if (avg > -0.3) return '😐';
  if (avg > -1) return '🙁';
  return '😞';
}

const TOUR_OPTIONS = ['GCW', 'GCW BILINGUE', 'GCW TRILINGUE', 'DEATH VALLEY', 'DV + 51', 'DV + STARS', 'VALLEY OF FIRE', 'MT CHARLESTON', 'ANTILOPE', 'ZION', 'ZION + BRYCE', 'HOOVER DAM', 'RED ROCK', 'CITY TOUR', 'TOUR DE 3 DIAS'];

const DEFAULT_SETTINGS = {
  guiaNome: 'Daniel Kochinski',
  guiaEndereco: '9510 Wooded Hills dr',
  guiaEmail: 'danielkochinski@gmail.com',
  guiaTelefone: '702-542-8667',
  clienteNome: 'LAS VEGAS VIP SERVICES ONE LLC',
  clienteEmail: '',
  clienteEndereco: '2566 LA CARA AVE',
  clienteCidade: 'LAS VEGAS, NV, 89121',
  proximoInvoiceNum: 51,
  cityTourLimite: 14,
  cityTourTaxaAte: 10,
  cityTourTaxaDepois: 15,
  heliTaxa: 20,
  pgtoExtraPaxTaxa: 10,
  comissaoGasTaxa: 40,
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

const LV_TZ = 'America/Los_Angeles'; // Las Vegas usa o mesmo fuso que Los Angeles (Pacific Time)

function todayInLasVegas(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: LV_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}

function currentYearInLasVegas(): number {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: LV_TZ, year: 'numeric' });
  return parseInt(fmt.format(new Date()), 10);
}

function emptyEntry(gasDefault: string = '40'): Entry {
  return {
    id: crypto.randomUUID(),
    data: todayInLasVegas(),
    tour: 'GCW',
    valorTour: '',
    espanhol: '', portugues: '', italiano: '', ingles: '',
    pgtoExtraPax: '0',
    cityQtd: '', cityQtdTotal: '', cityPreco: '',
    heliQtd: '', heliPreco: '20',
    tipPax: '', tipGas: gasDefault,
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

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatInvoicePeriod(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '';
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  if (sy === ey && sm === em) {
    return `${MONTHS_EN[sm-1]} ${sd} - ${ed}, ${ey}`;
  }
  if (sy === ey) {
    return `${MONTHS_EN[sm-1]} ${sd} - ${MONTHS_EN[em-1]} ${ed}, ${ey}`;
  }
  return `${MONTHS_EN[sm-1]} ${sd}, ${sy} - ${MONTHS_EN[em-1]} ${ed}, ${ey}`;
}

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatInvoicePeriodPT(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '';
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  if (sy === ey && sm === em) {
    return `${sd} a ${ed} de ${MONTHS_PT[sm-1]} de ${ey}`;
  }
  if (sy === ey) {
    return `${sd} de ${MONTHS_PT[sm-1]} a ${ed} de ${MONTHS_PT[em-1]} de ${ey}`;
  }
  return `${sd} de ${MONTHS_PT[sm-1]} de ${sy} a ${ed} de ${MONTHS_PT[em-1]} de ${ey}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mondayOfWeek(dateStr: string): string {
  const d = parseYMD(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatYMD(d);
}

const WEEKDAYS_PT = ['D','S','T','Q','Q','S','S'];

function MiniMonth({ year, month, highlighted }: { year: number; month: number; highlighted: Set<string> }) {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="border border-slate-200 rounded p-2">
      <div className="text-xs font-semibold text-center mb-1">{MONTHS_PT[month-1].slice(0,3)}</div>
      <div className="grid grid-cols-7 gap-0.5 text-[9px] text-slate-400 mb-0.5">
        {WEEKDAYS_PT.map((w,i) => <div key={i} className="text-center">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const has = highlighted.has(dateStr);
          return (
            <div key={i} className={`text-[9px] text-center rounded-sm py-0.5 ${has ? 'bg-emerald-500 text-white font-semibold' : 'text-slate-500'}`}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [form, setForm] = useState<Entry>(emptyEntry(String(DEFAULT_SETTINGS.comissaoGasTaxa)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invoiceRange, setInvoiceRange] = useState({start:'', end:''});
  const [invoiceDataEmissao, setInvoiceDataEmissao] = useState(() => todayInLasVegas());
  const [invoiceNum, setInvoiceNum] = useState<number | null>(null);
  const [invoiceNumInput, setInvoiceNumInput] = useState<number>(settings.proximoInvoiceNum);
  const [customRange, setCustomRange] = useState({start:'', end:''});
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);
  const [settingsForm, setSettingsForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  async function saveSettingsForm() {
    setSettingsSaving(true);
    await persistSettings(settingsForm);
    setSettingsSaving(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoaded(false);
      try {
        const [entriesRes, settingsRes, invoicesRes] = await Promise.all([
          supabase.from('entries').select('id, data').eq('user_id', session.user.id),
          supabase.from('settings').select('data').eq('user_id', session.user.id).maybeSingle(),
          supabase.from('invoices_enviadas').select('*').eq('user_id', session.user.id).order('numero', { ascending: false }),
        ]);
        if (entriesRes.error) throw entriesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        setEntries((entriesRes.data || []).map((r: any) => ({ id: r.id, ...r.data })));
        if (settingsRes.data?.data) setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.data.data });
        if (!invoicesRes.error) setInvoicesHistory(invoicesRes.data || []);
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
      setForm(emptyEntry(String(settings.comissaoGasTaxa)));
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

  const customTourBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    customEntries.forEach(e => {
      const tour = e.tour || 'Sem tour';
      counts[tour] = (counts[tour] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  }, [customEntries]);

  const [comparePeriods, setComparePeriods] = useState<{start:string,end:string}[]>([
    {start:'', end:''}, {start:'', end:''}
  ]);

  function computePeriodStats(start: string, end: string) {
    const s = { servicos:0, clientes:0, espanhol:0, portugues:0, italiano:0, ingles:0, heli:0, cityQtdVendidos:0, faturado:0, tipClientes:0, comissaoGas:0, totalRecebido:0 };
    if (!start || !end) return s;
    sorted.filter(e => e.data >= start && e.data <= end).forEach(e => {
      const c = computeEntry(e, settings);
      s.servicos += 1;
      s.clientes += c.clientesTotal;
      s.espanhol += num(e.espanhol);
      s.portugues += num(e.portugues);
      s.italiano += num(e.italiano);
      s.ingles += num(e.ingles);
      s.heli += num(e.heliQtd);
      s.cityQtdVendidos += num(e.cityQtd);
      s.faturado += c.vendasTotal;
      s.tipClientes += num(e.tipPax);
      s.comissaoGas += num(e.tipGas);
      s.totalRecebido += c.pagamentoTotal;
    });
    return s;
  }

  const sortedComparePeriods = useMemo(() =>
    [...comparePeriods].sort((a,b) => a.start.localeCompare(b.start)),
    [comparePeriods]
  );
  const compareStats = useMemo(() => sortedComparePeriods.map(p => computePeriodStats(p.start, p.end)), [sortedComparePeriods, sorted, settings]);

  function pctChange(current: number, previous: number): string {
    if (!previous) return current ? '+100%' : '—';
    const pct = ((current - previous) / previous) * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  }

  const COMPARE_METRICS: { key: keyof ReturnType<typeof computePeriodStats>, label: string, isMoney?: boolean }[] = [
    { key: 'servicos', label: 'Serviços' },
    { key: 'clientes', label: 'Total de Clientes' },
    { key: 'espanhol', label: 'Espanhol' },
    { key: 'portugues', label: 'Português (Brasileiros)' },
    { key: 'italiano', label: 'Italiano' },
    { key: 'ingles', label: 'Inglês' },
    { key: 'cityQtdVendidos', label: 'City Tours Vendidos' },
    { key: 'heli', label: 'Helicóptero Vendidos' },
    { key: 'faturado', label: 'Valor Total da Invoice', isMoney: true },
    { key: 'tipClientes', label: 'Tip Clientes', isMoney: true },
    { key: 'comissaoGas', label: 'Comissão Gas', isMoney: true },
    { key: 'totalRecebido', label: 'Total Recebido', isMoney: true },
  ];

  const customStats = useMemo(() => {
    const s = { servicos:0, espanhol:0, portugues:0, italiano:0, ingles:0, clientes:0, faturado:0, cityQtdVendidos:0, tipClientes:0, comissaoGas:0, heli:0, totalRecebido:0 };
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
      s.totalRecebido += c.pagamentoTotal;
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

  const moodScoreAvg = useMemo(() => {
    let total = 0, count = 0;
    sorted.forEach(e => (e.moods||[]).forEach(m => {
      if (MOOD_META[m]) { total += MOOD_META[m].score; count += 1; }
    }));
    return count ? total / count : 0;
  }, [sorted]);

  const moodByDay = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    sorted.forEach(e => {
      (e.moods||[]).forEach(m => {
        if (!MOOD_META[m]) return;
        if (!map[e.data]) map[e.data] = { total: 0, count: 0 };
        map[e.data].total += MOOD_META[m].score;
        map[e.data].count += 1;
      });
    });
    return Object.entries(map)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ data: data.slice(5), score: Number((v.total / v.count).toFixed(2)) }));
  }, [sorted]);

  const notaByDay = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    sorted.forEach(e => {
      if (e.nota === '' || e.nota === undefined || e.nota === null) return;
      if (!map[e.data]) map[e.data] = { total: 0, count: 0 };
      map[e.data].total += num(e.nota);
      map[e.data].count += 1;
    });
    return Object.entries(map)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ data: data.slice(5), nota: Number((v.total / v.count).toFixed(1)) }));
  }, [sorted]);

  const [statsGranularity, setStatsGranularity] = useState<'semana'|'quinzena'|'mes'>('mes');
  const [selectedStatsPeriod, setSelectedStatsPeriod] = useState<{start:string,end:string,label:string} | null>(null);
  const [statsRangeFilter, setStatsRangeFilter] = useState<{start:string,end:string}>({start:'', end:''});
  const [calendarYear, setCalendarYear] = useState<number>(() => currentYearInLasVegas());

  const statsSorted = useMemo(() => {
    if (!statsRangeFilter.start || !statsRangeFilter.end) return sorted;
    return sorted.filter(e => e.data >= statsRangeFilter.start && e.data <= statsRangeFilter.end);
  }, [sorted, statsRangeFilter]);

  function groupEntriesBy(granularity: 'semana'|'quinzena'|'mes') {
    const map: Record<string, { label: string; start: string; end: string; totalRecebido: number; faturado: number; clientes: number; servicos: number }> = {};
    statsSorted.forEach(e => {
      let key: string, label: string, start: string, end: string;
      if (granularity === 'semana') {
        start = mondayOfWeek(e.data);
        const endD = parseYMD(start); endD.setDate(endD.getDate()+6);
        end = formatYMD(endD);
        key = start;
        label = `Semana de ${start.slice(8,10)}/${start.slice(5,7)}`;
      } else if (granularity === 'quinzena') {
        const b = quinzenaBounds(e.data);
        start = b.start; end = b.end; key = start;
        label = formatInvoicePeriodPT(start, end);
      } else {
        key = e.data.slice(0,7);
        const [y, m] = key.split('-').map(Number);
        start = `${key}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        end = `${key}-${String(lastDay).padStart(2,'0')}`;
        label = `${MONTHS_PT[m-1]}/${y}`;
      }
      if (!map[key]) map[key] = { label, start, end, totalRecebido: 0, faturado: 0, clientes: 0, servicos: 0 };
      const c = computeEntry(e, settings);
      map[key].totalRecebido += c.pagamentoTotal;
      map[key].faturado += c.vendasTotal;
      map[key].clientes += c.clientesTotal;
      map[key].servicos += 1;
    });
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, ...v }));
  }

  const monthlyGroups = useMemo(() => groupEntriesBy('mes'), [statsSorted, settings]);
  const statsGroups = useMemo(() => groupEntriesBy(statsGranularity), [statsSorted, settings, statsGranularity]);

  const bestMonth = useMemo(() => monthlyGroups.length ? monthlyGroups.reduce((a,b) => b.totalRecebido > a.totalRecebido ? b : a) : null, [monthlyGroups]);
  const worstMonth = useMemo(() => monthlyGroups.length ? monthlyGroups.reduce((a,b) => b.totalRecebido < a.totalRecebido ? b : a) : null, [monthlyGroups]);
  const avgMonth = useMemo(() => monthlyGroups.length ? monthlyGroups.reduce((s,g)=>s+g.totalRecebido,0)/monthlyGroups.length : 0, [monthlyGroups]);

  const statsSummary = useMemo(() => {
    const vals = statsGroups.map(g => g.totalRecebido).sort((a,b)=>a-b);
    if (!vals.length) return { media: 0, mediana: 0, maior: 0, menor: 0 };
    const media = vals.reduce((a,b)=>a+b,0) / vals.length;
    const mid = Math.floor(vals.length / 2);
    const mediana = vals.length % 2 ? vals[mid] : (vals[mid-1] + vals[mid]) / 2;
    return { media, mediana, maior: vals[vals.length-1], menor: vals[0] };
  }, [statsGroups]);

  const highlightedDates = useMemo(() => new Set(sorted.map(e => e.data)), [sorted]);
  const calendarYearsAvailable = useMemo(() => {
    const years = new Set(sorted.map(e => parseInt(e.data.slice(0,4), 10)));
    years.add(currentYearInLasVegas());
    return Array.from(years).sort((a,b)=>a-b);
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

  function buildEmailUrl(): string {
    if (!invoiceNum) return '#';
    const periodo = formatInvoicePeriod(invoiceRange.start, invoiceRange.end);
    const subject = `Invoice ${invoiceNum}/${currentYearInLasVegas()} - ${periodo}`;
    const body = `Hola,\n\nSigue la invoice del periodo ${periodo}.\n\nGracias!\n${settings.guiaNome}`;
    const to = settings.clienteEmail || '';
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function printInvoice() {
    if (!invoiceNum) { window.print(); return; }
    const original = document.title;
    document.title = `Invoice ${invoiceNum} de ${formatInvoicePeriodPT(invoiceRange.start, invoiceRange.end)}`;
    const restore = () => { document.title = original; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 3000);
  }

  function startInvoice() { setInvoiceNum(invoiceNumInput); }
  async function finalizeInvoice() {
    if (!session || invoiceNum === null) return;
    const next = {...settings, proximoInvoiceNum: invoiceNum + 1};
    await persistSettings(next);
    try {
      const { data, error } = await supabase.from('invoices_enviadas').insert({
        user_id: session.user.id,
        numero: invoiceNum,
        periodo_inicio: invoiceRange.start,
        periodo_fim: invoiceRange.end,
        data_emissao: invoiceDataEmissao,
        total: invoiceTotal,
      }).select().single();
      if (!error && data) setInvoicesHistory([data, ...invoicesHistory]);
    } catch (err) {
      // não bloqueia o fluxo se o histórico falhar
    }
    setInvoiceNum(null);
    setInvoiceRange({start:'', end:''});
    setInvoiceDataEmissao(todayInLasVegas());
  }

  async function removeInvoiceHistory(id: string) {
    if (!session) return;
    if (!window.confirm('Remover esse registro do histórico de invoices enviadas?')) return;
    try {
      await supabase.from('invoices_enviadas').delete().eq('id', id).eq('user_id', session.user.id);
      setInvoicesHistory(invoicesHistory.filter(i => i.id !== id));
    } catch (err: any) {
      setErrorMsg('Não foi possível remover: ' + err.message);
    }
  }

  const TABS: [string,string][] = [
    ['lancamentos','Lançamentos'],
    ['relatorios','Relatórios'],
    ['stats','📊'],
    ['humor','😊'],
    ['invoice','Invoice'],
    ['config','Configurações'],
  ];

  if (passwordRecovery) {
    return <ResetPassword onDone={() => setPasswordRecovery(false)} />;
  }

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
    <div className="min-h-screen bg-blue-100 text-slate-800">
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
        <div className="grid grid-cols-3 sm:flex sm:gap-1 gap-1.5 mt-4 bg-blue-200 rounded-lg p-1 sm:w-fit">
          {TABS.map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)}
              className={`px-1 sm:px-4 py-2 sm:py-1.5 text-[10px] sm:text-sm font-medium rounded-md transition text-center leading-tight overflow-hidden text-ellipsis whitespace-nowrap ${tab===key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900 hover:bg-blue-300/60'}`}>
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
                <button onClick={()=>{setForm(emptyEntry(String(settings.comissaoGasTaxa)));setEditingId(null);}} className="text-sm px-4 py-2 rounded border border-slate-300">Cancelar</button>
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
                        <button onClick={()=>{ if (window.confirm(`Tem certeza que deseja excluir o lançamento de ${e.data} (${e.tour})? Essa ação não pode ser desfeita.`)) removeEntry(e.id); }} className="text-red-500 hover:text-red-700">Excluir</button>
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
              <Field label="Limite (ex: 14)"><input type="number" className={inputCls} value={settingsForm.cityTourLimite} onChange={e=>setSettingsForm({...settingsForm,cityTourLimite:parseInt(e.target.value)||0})}/></Field>
              <Field label="Taxa até o limite ($/tour)"><input type="number" className={inputCls} value={settingsForm.cityTourTaxaAte} onChange={e=>setSettingsForm({...settingsForm,cityTourTaxaAte:parseInt(e.target.value)||0})}/></Field>
              <Field label="Taxa acima do limite ($/tour, vale para todos)"><input type="number" className={inputCls} value={settingsForm.cityTourTaxaDepois} onChange={e=>setSettingsForm({...settingsForm,cityTourTaxaDepois:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Comissão do Helicóptero</h2>
            <p className="text-xs text-slate-500 mb-3">Valor fixo por venda, preenchido automaticamente ao lançar a quantidade.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Taxa por venda ($)"><input type="number" className={inputCls} value={settingsForm.heliTaxa} onChange={e=>setSettingsForm({...settingsForm,heliTaxa:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Pgto Extra por Pax (Brasileiros)</h2>
            <p className="text-xs text-slate-500 mb-3">Valor fixo por pax brasileiro, preenchido automaticamente ao lançar a quantidade (mesma lógica do City Tour).</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Taxa por pax ($)"><input type="number" className={inputCls} value={settingsForm.pgtoExtraPaxTaxa} onChange={e=>setSettingsForm({...settingsForm,pgtoExtraPaxTaxa:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Comissão Gas</h2>
            <p className="text-xs text-slate-500 mb-3">Valor padrão que já vem preenchido em cada novo lançamento. Pode alterar quando necessário.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor padrão ($)"><input type="number" className={inputCls} value={settingsForm.comissaoGasTaxa} onChange={e=>setSettingsForm({...settingsForm,comissaoGasTaxa:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Dados para a Invoice</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seu nome (guia)"><input className={inputCls} value={settingsForm.guiaNome} onChange={e=>setSettingsForm({...settingsForm,guiaNome:e.target.value})}/></Field>
              <Field label="Seu endereço"><input className={inputCls} value={settingsForm.guiaEndereco} onChange={e=>setSettingsForm({...settingsForm,guiaEndereco:e.target.value})}/></Field>
              <Field label="Seu e-mail"><input className={inputCls} value={settingsForm.guiaEmail} onChange={e=>setSettingsForm({...settingsForm,guiaEmail:e.target.value})}/></Field>
              <Field label="Seu telefone"><input className={inputCls} value={settingsForm.guiaTelefone} onChange={e=>setSettingsForm({...settingsForm,guiaTelefone:e.target.value})}/></Field>
              <Field label="Cliente (Billed To) - nome"><input className={inputCls} value={settingsForm.clienteNome} onChange={e=>setSettingsForm({...settingsForm,clienteNome:e.target.value})}/></Field>
              <Field label="Cliente - e-mail (para envio)"><input type="email" className={inputCls} value={settingsForm.clienteEmail} onChange={e=>setSettingsForm({...settingsForm,clienteEmail:e.target.value})}/></Field>
              <Field label="Cliente - endereço"><input className={inputCls} value={settingsForm.clienteEndereco} onChange={e=>setSettingsForm({...settingsForm,clienteEndereco:e.target.value})}/></Field>
              <Field label="Cliente - cidade/estado/CEP"><input className={inputCls} value={settingsForm.clienteCidade} onChange={e=>setSettingsForm({...settingsForm,clienteCidade:e.target.value})}/></Field>
              <Field label="Próximo número de invoice"><input type="number" className={inputCls} value={settingsForm.proximoInvoiceNum} onChange={e=>setSettingsForm({...settingsForm,proximoInvoiceNum:parseInt(e.target.value)||0})}/></Field>
            </div>
          </div>

          <div className="sticky bottom-0 bg-blue-100 pt-2 pb-1 flex items-center gap-3">
            <button disabled={settingsSaving} onClick={saveSettingsForm}
              className="bg-slate-900 text-white text-sm font-medium px-6 py-3 rounded hover:bg-slate-700 disabled:opacity-50 w-full sm:w-auto">
              {settingsSaving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            {settingsSaved && <span className="text-sm text-emerald-700">✓ Salvo!</span>}
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
            <h2 className="text-sm font-semibold mb-1">Comparar Períodos</h2>
            <p className="text-xs text-slate-500 mb-3">Escolha de 2 a 4 períodos para comparar lado a lado, com a variação percentual entre cada um.</p>

            <div className="flex flex-wrap gap-3 mb-3">
              {comparePeriods.map((p, i) => (
                <div key={i} className="flex items-end gap-2 border border-slate-200 rounded p-2">
                  <Field label={`Período ${i+1} - De`}><input type="date" className={inputCls} value={p.start} onChange={e=>{
                    const next = [...comparePeriods]; next[i] = {...next[i], start: e.target.value}; setComparePeriods(next);
                  }}/></Field>
                  <Field label="Até"><input type="date" className={inputCls} value={p.end} onChange={e=>{
                    const next = [...comparePeriods]; next[i] = {...next[i], end: e.target.value}; setComparePeriods(next);
                  }}/></Field>
                  {comparePeriods.length > 2 && (
                    <button onClick={()=>setComparePeriods(comparePeriods.filter((_,idx)=>idx!==i))}
                      className="text-red-500 hover:text-red-700 text-xs pb-2.5">Remover</button>
                  )}
                </div>
              ))}
            </div>

            {comparePeriods.length < 4 && (
              <button onClick={()=>setComparePeriods([...comparePeriods, {start:'',end:''}])}
                className="text-xs border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50 mb-4">+ Adicionar período</button>
            )}

            {comparePeriods.every(p => p.start && p.end) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 text-left">Métrica</th>
                      {sortedComparePeriods.map((p, i) => (
                        <React.Fragment key={i}>
                          <th className="p-2 text-right">{formatInvoicePeriod(p.start, p.end)}</th>
                          {i > 0 && <th className="p-2 text-right text-slate-400">Variação</th>}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_METRICS.map(m => (
                      <tr key={m.key} className="border-t border-slate-100">
                        <td className="p-2 text-left text-slate-600">{m.label}</td>
                        {compareStats.map((s, i) => {
                          const val = s[m.key];
                          const prevVal = i > 0 ? compareStats[i-1][m.key] : null;
                          return (
                            <React.Fragment key={i}>
                              <td className="p-2 text-right font-medium">{m.isMoney ? `$${money(val)}` : val}</td>
                              {i > 0 && (
                                <td className={`p-2 text-right ${prevVal !== null && val > prevVal ? 'text-emerald-600' : prevVal !== null && val < prevVal ? 'text-red-500' : 'text-slate-400'}`}>
                                  {pctChange(val, prevVal ?? 0)}
                                </td>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Preencha as datas de todos os períodos para ver a comparação.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Relatório por período (escolha as datas)</h2>
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <Field label="De"><input type="date" className={inputCls} value={customRange.start} onChange={e=>setCustomRange({...customRange,start:e.target.value})}/></Field>
              <Field label="Até"><input type="date" className={inputCls} value={customRange.end} onChange={e=>setCustomRange({...customRange,end:e.target.value})}/></Field>
            </div>
            {customRange.start && customRange.end ? (
              <div>
                <div className="mb-4">
                  <span className="text-xs text-slate-500">Tours realizados no período</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customTourBreakdown.map(([tour, count]) => (
                      <span key={tour} className="text-xs bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                        {count}x {tour}
                      </span>
                    ))}
                    {customTourBreakdown.length === 0 && <span className="text-xs text-slate-400">Nenhum tour nesse período.</span>}
                  </div>
                </div>
                <div className="divide-y divide-slate-200">
                <div className="flex justify-between py-2"><span className="text-slate-500">Serviços</span><span className="font-semibold">{customStats.servicos}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Total de clientes</span><span className="font-semibold">{customStats.clientes}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Espanhol</span><span className="font-semibold">{customStats.espanhol}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Português</span><span className="font-semibold">{customStats.portugues}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Italiano</span><span className="font-semibold">{customStats.italiano}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Inglês</span><span className="font-semibold">{customStats.ingles}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Helicóptero vendidos</span><span className="font-semibold">{customStats.heli}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">City Tours vendidos</span><span className="font-semibold">{customStats.cityQtdVendidos}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Valor Total da Invoice</span><span className="font-semibold">${money(customStats.faturado)}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Tip Clientes</span><span className="font-semibold">${money(customStats.tipClientes)}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-500">Comissão Gas</span><span className="font-semibold">${money(customStats.comissaoGas)}</span></div>
                <div className="flex justify-between py-2"><span className="text-slate-700 font-semibold">Total Recebido</span><span className="font-bold">${money(customStats.totalRecebido)}</span></div>
                </div>
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
        </div>
      )}

      {tab === 'stats' && (
        <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <Field label="Filtrar de (opcional)"><input type="date" className={inputCls} value={statsRangeFilter.start} onChange={e=>setStatsRangeFilter({...statsRangeFilter, start:e.target.value})}/></Field>
              <Field label="Até"><input type="date" className={inputCls} value={statsRangeFilter.end} onChange={e=>setStatsRangeFilter({...statsRangeFilter, end:e.target.value})}/></Field>
              {(statsRangeFilter.start || statsRangeFilter.end) && (
                <button onClick={()=>setStatsRangeFilter({start:'',end:''})} className="text-xs text-slate-500 underline pb-2.5">Limpar filtro</button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Deixe em branco para ver todo o histórico. Preencha as duas datas para restringir toda a análise abaixo a esse período.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <div className="text-xs text-emerald-700 font-medium">🏆 Melhor Mês</div>
              <div className="text-sm font-bold text-emerald-900 mt-1">{bestMonth?.label ?? '—'}</div>
              <div className="text-lg font-bold text-emerald-700">${bestMonth ? money(bestMonth.totalRecebido) : '0.00'}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-xs text-red-700 font-medium">📉 Pior Mês</div>
              <div className="text-sm font-bold text-red-900 mt-1">{worstMonth?.label ?? '—'}</div>
              <div className="text-lg font-bold text-red-700">${worstMonth ? money(worstMonth.totalRecebido) : '0.00'}</div>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-center col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-600 font-medium">Média Mensal (Total Recebido)</div>
              <div className="text-lg font-bold text-slate-800 mt-1">${money(avgMonth)}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Análise por Período</h2>
            <div className="flex gap-2 mb-4">
              {(['semana','quinzena','mes'] as const).map(g => (
                <button key={g} onClick={()=>{setStatsGranularity(g); setSelectedStatsPeriod(null);}}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${statsGranularity===g ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                  {g === 'semana' ? 'Semanal' : g === 'quinzena' ? 'Quinzenal' : 'Mensal'}
                </button>
              ))}
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={statsGroups} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}
                  onClick={(e: any) => {
                    if (e && e.activeLabel) {
                      const g = statsGroups.find(g => g.label === e.activeLabel);
                      if (g) setSelectedStatsPeriod({start: g.start, end: g.end, label: g.label});
                    }
                  }}
                >
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(0, Math.ceil(statsGroups.length/6) - 1)}
                    angle={-40} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReferenceLine y={statsSummary.media} stroke="#cbd5e1" strokeDasharray="4 4" />
                  <Tooltip formatter={(v: any) => [`$${money(Number(v))}`, 'Total Recebido']} />
                  <Line type="monotone" dataKey="totalRecebido" stroke="#0f172a" strokeWidth={2} strokeDasharray="5 4"
                    dot={{ r: 4, fill: '#0f172a' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="text-center border border-slate-200 rounded p-2">
                <div className="text-[10px] text-slate-500">Média</div>
                <div className="text-sm font-semibold">${money(statsSummary.media)}</div>
              </div>
              <div className="text-center border border-slate-200 rounded p-2">
                <div className="text-[10px] text-slate-500">Mediana</div>
                <div className="text-sm font-semibold">${money(statsSummary.mediana)}</div>
              </div>
              <div className="text-center border border-slate-200 rounded p-2">
                <div className="text-[10px] text-slate-500">Maior</div>
                <div className="text-sm font-semibold text-emerald-600">${money(statsSummary.maior)}</div>
              </div>
              <div className="text-center border border-slate-200 rounded p-2">
                <div className="text-[10px] text-slate-500">Menor</div>
                <div className="text-sm font-semibold text-red-600">${money(statsSummary.menor)}</div>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Período</th>
                    <th className="p-2 text-right">Serviços</th>
                    <th className="p-2 text-right">Clientes</th>
                    <th className="p-2 text-right">Total Recebido</th>
                    <th className="p-2 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {statsGroups.map((g, i) => {
                    const prev = i > 0 ? statsGroups[i-1].totalRecebido : null;
                    const isSelected = selectedStatsPeriod?.start === g.start;
                    return (
                      <tr key={g.key} onClick={()=>setSelectedStatsPeriod({start:g.start, end:g.end, label:g.label})}
                        className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-slate-100' : ''}`}>
                        <td className="p-2">{g.label}</td>
                        <td className="p-2 text-right">{g.servicos}</td>
                        <td className="p-2 text-right">{g.clientes}</td>
                        <td className="p-2 text-right font-medium">${money(g.totalRecebido)}</td>
                        <td className={`p-2 text-right ${prev===null ? 'text-slate-400' : g.totalRecebido > prev ? 'text-emerald-600' : g.totalRecebido < prev ? 'text-red-500' : 'text-slate-400'}`}>
                          {prev===null ? '—' : pctChange(g.totalRecebido, prev)}
                        </td>
                      </tr>
                    );
                  })}
                  {statsGroups.length===0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sem dados ainda.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Toque numa linha da tabela (ou num ponto do gráfico) para ver os tours daquele período.</p>
          </div>

          {selectedStatsPeriod && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Tours em: {selectedStatsPeriod.label}</h2>
                <button onClick={()=>setSelectedStatsPeriod(null)} className="text-xs text-slate-400 hover:text-slate-700">Fechar ✕</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Tour</th>
                      <th className="p-2 text-right">Clientes</th>
                      <th className="p-2 text-right">Total Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.filter(e => e.data >= selectedStatsPeriod.start && e.data <= selectedStatsPeriod.end).map(e => {
                      const c = computeEntry(e, settings);
                      return (
                        <tr key={e.id} className="border-t border-slate-100">
                          <td className="p-2">{e.data}</td>
                          <td className="p-2">{e.tour}</td>
                          <td className="p-2 text-right">{c.clientesTotal}</td>
                          <td className="p-2 text-right">${money(c.pagamentoTotal)}</td>
                        </tr>
                      );
                    })}
                    {sorted.filter(e => e.data >= selectedStatsPeriod.start && e.data <= selectedStatsPeriod.end).length === 0 && (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhum tour nesse período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Calendário Anual — dias já lançados</h2>
              <select value={calendarYear} onChange={e=>setCalendarYear(parseInt(e.target.value,10))} className={inputCls + " w-24"}>
                {calendarYearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({length:12}, (_, i) => i+1).map(m => (
                <MiniMonth key={m} year={calendarYear} month={m} highlighted={highlightedDates} />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Dias em verde já têm lançamento salvo.</p>
          </div>
        </div>
      )}

      {tab === 'humor' && (
        <div className="no-print max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Quadro de sentimentos</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {MOODS.map(m => (
                <div key={m} className="border border-slate-200 rounded p-2 text-center">
                  <div className="text-2xl">{MOOD_META[m]?.emoji}</div>
                  <div className="text-xs text-slate-500">{m}</div>
                  <div className="text-lg font-semibold">{moodCounts[m]}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">Nota média dos tours: <span className="font-semibold text-slate-800">{avgNota ?? '—'}</span> / 5</p>

            <div className="mt-6">
              <span className="text-xs font-medium text-slate-600">Termômetro geral do seu humor</span>
              <div className="relative mt-3 mb-1 h-4 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}>
                <div
                  className="absolute -top-6 text-2xl transition-all"
                  style={{ left: `${Math.min(100, Math.max(0, ((moodScoreAvg + 2) / 4) * 100))}%`, transform: 'translateX(-50%)' }}
                >
                  {moodGaugeEmoji(moodScoreAvg)}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Precisa de atenção</span>
                <span>Neutro</span>
                <span>Ótimo</span>
              </div>
            </div>

            {moodByDay.length > 0 && (
              <div className="mt-6">
                <span className="text-xs font-medium text-slate-600">Evolução do humor por dia</span>
                <div className="mt-2" style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={moodByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis domain={[-2, 2]} tick={{ fontSize: 10 }} />
                      <ReferenceLine y={0} stroke="#cbd5e1" />
                      <Tooltip formatter={(v: any) => [v, 'Humor']} labelFormatter={(l) => `Dia ${l}`} />
                      <Bar dataKey="score" radius={[3,3,0,0]}>
                        {moodByDay.map((d, i) => (
                          <Cell key={i} fill={d.score > 0.3 ? '#22c55e' : d.score < -0.3 ? '#ef4444' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {notaByDay.length > 0 && (
              <div className="mt-6">
                <span className="text-xs font-medium text-slate-600">Nota do tour por dia</span>
                <div className="mt-2" style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={notaByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [v, 'Nota']} labelFormatter={(l) => `Dia ${l}`} />
                      <Bar dataKey="nota" radius={[3,3,0,0]}>
                        {notaByDay.map((d, i) => (
                          <Cell key={i} fill={d.nota >= 4 ? '#22c55e' : d.nota >= 2.5 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
                  <button onClick={printInvoice} className="border border-slate-300 text-sm font-medium px-4 py-2 rounded">Imprimir / Salvar PDF</button>
                  <a href={buildEmailUrl()} className="border border-slate-300 text-sm font-medium px-4 py-2 rounded inline-block text-center">Enviar por E-mail</a>
                  <button onClick={finalizeInvoice} className="text-sm px-4 py-2 rounded border border-emerald-500 text-emerald-700">Confirmar invoice enviada (avança numeração)</button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">Digite o número/ciclo que essa invoice deve ter (ex: 1, 2, 3... para cadastrar invoices antigas na mão). Fica sugerido automaticamente o próximo número (51) para as novas.</p>
            <p className="text-xs text-slate-400 mt-1">"Enviar por E-mail" abre seu app de e-mail com destinatário, assunto e mensagem prontos — mas você precisa anexar o PDF manualmente (salve primeiro com "Imprimir / Salvar PDF"). Cadastre o e-mail do cliente em Configurações.</p>
          </div>

          {invoiceNum && (
            <div className="print-area bg-white rounded-lg border border-slate-200 p-8 text-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-lg font-bold tracking-wide">INVOICE</div>
                  <div>{invoiceNum}/{currentYearInLasVegas()}</div>
                  {invoiceRange.start && invoiceRange.end && (
                    <div className="text-xs text-slate-500 mt-1">{formatInvoicePeriod(invoiceRange.start, invoiceRange.end)}</div>
                  )}
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

          <div className="no-print bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-sm font-semibold mb-3">Histórico de Invoices Enviadas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Nº</th>
                    <th className="p-2 text-left">Período</th>
                    <th className="p-2 text-left">Data de Emissão</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesHistory.map(inv => (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="p-2">{inv.numero}</td>
                      <td className="p-2">{formatInvoicePeriod(inv.periodo_inicio, inv.periodo_fim)}</td>
                      <td className="p-2">{inv.data_emissao}</td>
                      <td className="p-2 text-right">${money(Number(inv.total))}</td>
                      <td className="p-2 text-right">
                        <button onClick={()=>removeInvoiceHistory(inv.id)} className="text-red-500 hover:text-red-700">Remover</button>
                      </td>
                    </tr>
                  ))}
                  {invoicesHistory.length===0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhuma invoice arquivada ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
