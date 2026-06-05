-- ==========================================
-- Passo 01: Script do Banco de Dados (Supabase SQL)
-- Rodar este script no SQL Editor do Dashboard do Supabase
-- ==========================================

-- 1. Criar a tabela 'perfis' que herda o ID do auth.users nativo
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT NOT NULL,
    username TEXT,
    tipo_usuario TEXT NOT NULL CONSTRAINT check_tipo_usuario CHECK (tipo_usuario IN ('MOTORISTA', 'GERENTE_CD')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar a segurança em nível de linha (RLS)
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas RLS básicas:

-- 3.1. Permitir leitura do próprio perfil
DROP POLICY IF EXISTS "Usuários podem ler o próprio perfil" ON public.perfis;
CREATE POLICY "Usuários podem ler o próprio perfil"
ON public.perfis FOR SELECT
USING (auth.uid() = id);

-- 3.2. Permitir atualização do próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.perfis;
CREATE POLICY "Usuários podem atualizar o próprio perfil"
ON public.perfis FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3.3. Permitir inserção do próprio perfil (necessário para o cadastro funcionar via cliente)
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.perfis;
CREATE POLICY "Usuários podem inserir o próprio perfil"
ON public.perfis FOR INSERT
WITH CHECK (auth.uid() = id);
