CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL
);

INSERT INTO settings (id, data)
VALUES (1, '{
  "guiaNome": "Daniel Kochinski",
  "guiaEndereco": "9510 Wooded Hills dr",
  "guiaEmail": "danielkochinski@gmail.com",
  "guiaTelefone": "702-542-8667",
  "clienteNome": "LAS VEGAS VIP SERVICES ONE LLC",
  "clienteEndereco": "2566 LA CARA AVE",
  "clienteCidade": "LAS VEGAS, NV, 89121",
  "proximoInvoiceNum": 51,
  "cityTourLimite": 15,
  "cityTourTaxaAte": 15,
  "cityTourTaxaDepois": 20
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
