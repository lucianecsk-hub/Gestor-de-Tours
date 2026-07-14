'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recover'>('login');
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
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Conta criada. Verifique seu e-mail para confirmar antes de entrar (se a confirmação estiver ativada no Supabase).');
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        if (error) throw error;
        setInfo('Se esse e-mail estiver cadastrado, você vai receber um link para redefinir sua senha. Confira sua caixa de entrada (e o spam).');
      }
    } catch (err: any) {
      setError(err.message || 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<string, string> = {
    login: 'Entre com seu e-mail e senha.',
    signup: 'Crie sua conta.',
    recover: 'Digite seu e-mail para receber um link de recuperação de senha.',
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Gestor de Tours & Invoices</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">{titles[mode]}</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email" required placeholder="E-mail" value={email}
            onChange={e=>setEmail(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {mode !== 'recover' && (
            <input
              type="password" required placeholder="Senha" value={password}
              onChange={e=>setPassword(e.target.value)} minLength={6}
              className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          )}
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          {info && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{info}</div>}
          <button disabled={loading} type="submit"
            className="bg-slate-900 text-white text-sm font-medium rounded px-3 py-2 hover:bg-slate-700 disabled:opacity-50">
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="flex flex-col gap-1 mt-4">
          {mode === 'login' && (
            <button
              onClick={() => { setMode('recover'); setError(null); setInfo(null); }}
              className="text-xs text-slate-500 hover:text-slate-800 underline text-left">
              Esqueci minha senha
            </button>
          )}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline text-left">
            {mode === 'login' ? 'Ainda não tem conta? Criar uma' : mode === 'signup' ? 'Já tem conta? Entrar' : 'Voltar para o login'}
          </button>
        </div>
      </div>
    </div>
  );
}
