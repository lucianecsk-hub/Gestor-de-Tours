'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Conta criada. Verifique seu e-mail para confirmar antes de entrar (se a confirmação estiver ativada no Supabase).');
      }
    } catch (err: any) {
      setError(err.message || 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Gestor de Tours & Invoices</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          {mode === 'login' ? 'Entre com seu e-mail e senha.' : 'Crie sua conta.'}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email" required placeholder="E-mail" value={email}
            onChange={e=>setEmail(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            type="password" required placeholder="Senha" value={password}
            onChange={e=>setPassword(e.target.value)} minLength={6}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          {info && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{info}</div>}
          <button disabled={loading} type="submit"
            className="bg-slate-900 text-white text-sm font-medium rounded px-3 py-2 hover:bg-slate-700 disabled:opacity-50">
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}
          className="text-xs text-slate-500 hover:text-slate-800 mt-4 underline">
          {mode === 'login' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}
