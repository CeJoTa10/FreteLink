process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Erro: POSTGRES_URL não definida no .env.local");
  process.exit(1);
}

const sql = `
-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PERFIS (public.perfis)
CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('MOTORISTA', 'GERENTE_CD')),
  username TEXT UNIQUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em perfis
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Limpar antigas
DROP POLICY IF EXISTS "Permitir leitura de perfil" ON public.perfis;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.perfis;
DROP POLICY IF EXISTS "Permitir atualização de perfil" ON public.perfis;
DROP POLICY IF EXISTS "Usuários podem ler o próprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.perfis;

-- Criar seguras
CREATE POLICY "Permitir leitura de perfil" ON public.perfis
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserção de perfil" ON public.perfis
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir atualização de perfil" ON public.perfis
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- 2. TABELA DE MOTORISTAS (public.motoristas)
CREATE TABLE IF NOT EXISTS public.motoristas (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  placa_veiculo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em motoristas
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;

-- Limpar antigas
DROP POLICY IF EXISTS "Enable read/write for all users" ON public.motoristas;
DROP POLICY IF EXISTS "Permitir leitura de motoristas" ON public.motoristas;
DROP POLICY IF EXISTS "Permitir inserção de motoristas" ON public.motoristas;
DROP POLICY IF EXISTS "Permitir atualização de motoristas" ON public.motoristas;
DROP POLICY IF EXISTS "Permitir exclusão de motoristas" ON public.motoristas;

-- Criar seguras
CREATE POLICY "Permitir leitura de motoristas" ON public.motoristas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção de motoristas" ON public.motoristas
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir atualização de motoristas" ON public.motoristas
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir exclusão de motoristas" ON public.motoristas
  FOR DELETE USING (auth.uid() = id);


-- 3. TABELA DE CENTROS DE DISTRIBUIÇÃO (public.centros_distribuicao)
CREATE TABLE IF NOT EXISTS public.centros_distribuicao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  estado TEXT NOT NULL,
  cidade TEXT NOT NULL,
  endereco_completo TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em centros_distribuicao
ALTER TABLE public.centros_distribuicao ENABLE ROW LEVEL SECURITY;

-- Limpar antigas
DROP POLICY IF EXISTS "Enable read/write for all users" ON public.centros_distribuicao;
DROP POLICY IF EXISTS "Permitir leitura de CDs" ON public.centros_distribuicao;
DROP POLICY IF EXISTS "Permitir escrita de CDs" ON public.centros_distribuicao;

-- Criar seguras
CREATE POLICY "Permitir leitura de CDs" ON public.centros_distribuicao
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir escrita de CDs" ON public.centros_distribuicao
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- 4. TABELA DE CARGAS (public.cargas)
CREATE TABLE IF NOT EXISTS public.cargas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor_frete NUMERIC NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_transito', 'concluida', 'cancelada')),
  motorista_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cd_origem_id UUID REFERENCES public.centros_distribuicao(id) ON DELETE CASCADE,
  cd_destino_id UUID REFERENCES public.centros_distribuicao(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em cargas
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;

-- Limpar antigas
DROP POLICY IF EXISTS "Enable read/write for all users" ON public.cargas;
DROP POLICY IF EXISTS "Permitir leitura de cargas" ON public.cargas;
DROP POLICY IF EXISTS "Permitir inserção de cargas" ON public.cargas;
DROP POLICY IF EXISTS "Permitir atualização de cargas" ON public.cargas;
DROP POLICY IF EXISTS "Permitir exclusão de cargas" ON public.cargas;

-- Criar seguras
CREATE POLICY "Permitir leitura de cargas" ON public.cargas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção de cargas" ON public.cargas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir atualização de cargas" ON public.cargas
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir exclusão de cargas" ON public.cargas
  FOR DELETE USING (auth.role() = 'authenticated');


-- 5. TABELA DE RASTREAMENTO ATIVO (public.rastreamento_ativo)
CREATE TABLE IF NOT EXISTS public.rastreamento_ativo (
  carga_id UUID REFERENCES public.cargas(id) ON DELETE CASCADE PRIMARY KEY,
  motorista_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  ultima_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em rastreamento_ativo
ALTER TABLE public.rastreamento_ativo ENABLE ROW LEVEL SECURITY;

-- Limpar antigas
DROP POLICY IF EXISTS "Enable read/write for all users" ON public.rastreamento_ativo;
DROP POLICY IF EXISTS "Permitir leitura de rastreamento" ON public.rastreamento_ativo;
DROP POLICY IF EXISTS "Permitir escrita de rastreamento" ON public.rastreamento_ativo;

-- Criar seguras
CREATE POLICY "Permitir leitura de rastreamento" ON public.rastreamento_ativo
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir escrita de rastreamento" ON public.rastreamento_ativo
  FOR ALL USING (auth.uid() = motorista_id) WITH CHECK (auth.uid() = motorista_id);


-- Habilitar o Realtime na tabela rastreamento_ativo
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.rastreamento_ativo;
COMMIT;


-- TRIGGER DE AUTOCRIAÇÃO DE PERFIL E MOTORISTA AO CRIAR NOVO USUÁRIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, username, tipo_usuario)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome_completo', new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'tipo_usuario', 'MOTORISTA')
  )
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE(new.raw_user_meta_data->>'tipo_usuario', 'MOTORISTA') = 'MOTORISTA' THEN
    INSERT INTO public.motoristas (id, nome, telefone, placa_veiculo)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'nome_completo', new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
      COALESCE(new.raw_user_meta_data->>'telefone', ''),
      COALESCE(new.raw_user_meta_data->>'placa_veiculo', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

NOTIFY pgrst, 'reload schema';
`;

async function main() {
  console.log("Conectando ao banco PostgreSQL do Supabase...");
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Conectado. Executando script SQL completo...");
    await client.query(sql);
    console.log("Banco de dados configurado e protegido com sucesso!");
  } catch (err) {
    console.error("Erro ao configurar banco de dados:", err);
  } finally {
    await client.end();
  }
}

main();
