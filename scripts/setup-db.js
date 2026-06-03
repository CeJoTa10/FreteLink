process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Erro: POSTGRES_URL não definida no .env.local");
  process.exit(1);
}

// O SQL que criamos na Etapa 2
const sql = `
-- Habilita a extensão UUID para geração de IDs automáticos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Centros de Distribuição (CDs)
CREATE TABLE IF NOT EXISTS public.centros_distribuicao (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    estado TEXT NOT NULL, -- Ex: SP, RJ, MG
    cidade TEXT NOT NULL,
    endereco_completo TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Motoristas (Caminhoneiros)
CREATE TABLE IF NOT EXISTS public.motoristas (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    placa_veiculo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Cargas (Fretes interestaduais)
CREATE TABLE IF NOT EXISTS public.cargas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cd_origem_id UUID REFERENCES public.centros_distribuicao(id) NOT NULL,
    cd_destino_id UUID REFERENCES public.centros_distribuicao(id) NOT NULL,
    descricao TEXT NOT NULL,
    valor_frete DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_transito', 'concluida', 'cancelada')),
    motorista_id UUID REFERENCES public.motoristas(id), -- Fica nulo até um caminhoneiro aceitar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Rastreamento Ativo (Monitoramento Real-time)
CREATE TABLE IF NOT EXISTS public.rastreamento_ativo (
    carga_id UUID PRIMARY KEY REFERENCES public.cargas(id) ON DELETE CASCADE,
    motorista_id UUID REFERENCES public.motoristas(id) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Segurança: Definindo Políticas de RLS (Row Level Security) básicas
ALTER TABLE public.centros_distribuicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rastreamento_ativo ENABLE ROW LEVEL SECURITY;

-- Políticas temporárias liberadas para desenvolvimento (ajustaremos se necessário)
DROP POLICY IF EXISTS "Enable read/write for all users" ON public.centros_distribuicao;
CREATE POLICY "Enable read/write for all users" ON public.centros_distribuicao FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for all users" ON public.motoristas;
CREATE POLICY "Enable read/write for all users" ON public.motoristas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for all users" ON public.cargas;
CREATE POLICY "Enable read/write for all users" ON public.cargas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read/write for all users" ON public.rastreamento_ativo;
CREATE POLICY "Enable read/write for all users" ON public.rastreamento_ativo FOR ALL USING (true) WITH CHECK (true);

-- Habilitar o Supabase Realtime APENAS na tabela rastreamento_ativo
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.rastreamento_ativo;
COMMIT;

NOTIFY pgrst, 'reload schema';
`;

async function main() {
  console.log("Conectando ao banco de dados Supabase...");
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Conectado com sucesso. Executando o script de schema...");
    await client.query(sql);
    console.log("Schema do banco de dados configurado com sucesso!");
  } catch (err) {
    console.error("Erro ao configurar banco de dados:", err);
  } finally {
    await client.end();
  }
}

main();
