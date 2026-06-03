process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Erro: POSTGRES_URL não definida no .env.local");
  process.exit(1);
}

const sql = `
-- 1. Criar a tabela 'perfis'
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT NOT NULL,
    tipo_usuario TEXT NOT NULL CONSTRAINT check_tipo_usuario CHECK (tipo_usuario IN ('MOTORISTA', 'GERENTE_CD')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- 3. Limpar políticas antigas
DROP POLICY IF EXISTS "Usuários podem ler o próprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.perfis;
DROP POLICY IF EXISTS "Permitir leitura de perfil" ON public.perfis;
DROP POLICY IF EXISTS "Permitir atualização de perfil" ON public.perfis;

-- 4. Criar políticas robustas
-- Permitir leitura se for o próprio usuário ou para fins de validação no login
CREATE POLICY "Permitir leitura de perfil"
ON public.perfis FOR SELECT
USING (true);

-- Permitir atualização somente do próprio perfil
CREATE POLICY "Permitir atualização de perfil"
ON public.perfis FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Permitir inserção de qualquer perfil (o vínculo de FK com auth.users(id) garante integridade)
CREATE POLICY "Permitir inserção de perfil"
ON public.perfis FOR INSERT
WITH CHECK (true);
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
    console.log("Conectado. Configurando a tabela 'perfis' e RLS...");
    await client.query(sql);
    console.log("Banco de dados configurado com sucesso para perfis!");
  } catch (err) {
    console.error("Erro ao configurar banco de dados:", err);
  } finally {
    await client.end();
  }
}

main();
