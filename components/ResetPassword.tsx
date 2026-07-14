'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err: any) {
      setError(err.message || 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Definir nova senha</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Digite a nova senha para sua conta.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password" required placeholder="Nova senha" value={password}
            onChange={e=>setPassword(e.target.value)} minLength={6}
            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          <button disabled={loading} type="submit"
            className="bg-slate-900 text-white text-sm font-medium rounded px-3 py-2 hover:bg-slate-700 disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
