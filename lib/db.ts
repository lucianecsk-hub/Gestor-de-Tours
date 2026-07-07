import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export type Entry = {
  id: string;
  data: string;
  tour: string;
  valorTour: number | string;
  espanhol: number | string;
  portugues: number | string;
  italiano: number | string;
  ingles: number | string;
  cityQtd: number | string;
  cityPreco: number | string;
  heliQtd: number | string;
  heliPreco: number | string;
  tipPax: number | string;
  tipGas: number | string;
  pagamentoInvoice: number | string;
  moods: string[];
  nota: number | string;
  obs: string;
};

export type Settings = {
  guiaNome: string;
  guiaEndereco: string;
  guiaEmail: string;
  guiaTelefone: string;
  clienteNome: string;
  clienteEndereco: string;
  clienteCidade: string;
  proximoInvoiceNum: number;
  cityTourLimite: number;
  cityTourTaxaAte: number;
  cityTourTaxaDepois: number;
};

export async function getEntries(): Promise<Entry[]> {
  const rows = await sql`SELECT id, data FROM entries ORDER BY (data->>'data') ASC`;
  return rows.map((r: any) => ({ id: r.id, ...(r.data as object) } as Entry));
}

export async function upsertEntry(entry: Entry) {
  const json = JSON.stringify(entry);
  await sql`
    INSERT INTO entries (id, data)
    VALUES (${entry.id}, ${json}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = ${json}::jsonb
  `;
}

export async function deleteEntry(id: string) {
  await sql`DELETE FROM entries WHERE id = ${id}`;
}

export async function getSettings(): Promise<Settings | null> {
  const rows = await sql`SELECT data FROM settings WHERE id = 1`;
  return rows.length ? (rows[0].data as Settings) : null;
}

export async function saveSettings(settings: Settings) {
  const json = JSON.stringify(settings);
  await sql`
    INSERT INTO settings (id, data)
    VALUES (1, ${json}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = ${json}::jsonb
  `;
}
