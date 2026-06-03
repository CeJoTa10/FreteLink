process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

const sql = `
-- 1. Garante Centros de Distribuição para testes
INSERT INTO public.centros_distribuicao (id, nome, estado, cidade, endereco_completo, lat, lng)
VALUES 
  ('966a7ce7-948e-41e9-98d3-0230fb7b6c5e', 'CD Logística São Paulo', 'SP', 'São Paulo', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP', -23.561684, -46.655981)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  estado = EXCLUDED.estado,
  cidade = EXCLUDED.cidade,
  endereco_completo = EXCLUDED.endereco_completo,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

INSERT INTO public.centros_distribuicao (id, nome, estado, cidade, endereco_completo, lat, lng)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'CD Logística Rio de Janeiro', 'RJ', 'Rio de Janeiro', 'Av. Rio Branco, 156 - Centro, Rio de Janeiro - RJ', -22.906847, -43.172896)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  estado = EXCLUDED.estado,
  cidade = EXCLUDED.cidade,
  endereco_completo = EXCLUDED.endereco_completo,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

INSERT INTO public.centros_distribuicao (id, nome, estado, cidade, endereco_completo, lat, lng)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'CD Logística Belo Horizonte', 'MG', 'Belo Horizonte', 'Praça da Liberdade - Funcionários, Belo Horizonte - MG', -19.924557, -43.935238)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  estado = EXCLUDED.estado,
  cidade = EXCLUDED.cidade,
  endereco_completo = EXCLUDED.endereco_completo,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- 2. Garante o motorista padrão
INSERT INTO public.motoristas (id, nome, telefone, placa_veiculo)
VALUES 
  ('7a27407a-4241-4c84-99a0-0377254a5e0d', 'João Caminhoneiro', '+55 11 99999-9999', 'ABC-1234')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  telefone = EXCLUDED.telefone,
  placa_veiculo = EXCLUDED.placa_veiculo;

-- 3. Inserir cargas de teste
-- Carga 1: Pendente
INSERT INTO public.cargas (id, cd_origem_id, cd_destino_id, descricao, valor_frete, status, motorista_id)
VALUES 
  ('c8b87d60-705b-4395-8e10-3860bb4e334a', '966a7ce7-948e-41e9-98d3-0230fb7b6c5e', '550e8400-e29b-41d4-a716-446655440000', 'Carga de autopeças industriais', 3800.00, 'pendente', NULL)
ON CONFLICT (id) DO NOTHING;

-- Carga 2: Em trânsito (Vinculada ao motorista padrão)
INSERT INTO public.cargas (id, cd_origem_id, cd_destino_id, descricao, valor_frete, status, motorista_id)
VALUES 
  ('a4d2c8e0-1c3b-4c5d-8e9f-0a1b2c3d4e5f', '966a7ce7-948e-41e9-98d3-0230fb7b6c5e', '550e8400-e29b-41d4-a716-446655440001', 'Bobinas de aço e chapas metálicas', 5200.00, 'em_transito', '7a27407a-4241-4c84-99a0-0377254a5e0d')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  motorista_id = EXCLUDED.motorista_id;

-- 4. Rastreamento ativo para a carga em trânsito
INSERT INTO public.rastreamento_ativo (carga_id, motorista_id, lat, lng, ultima_atualizacao)
VALUES 
  ('a4d2c8e0-1c3b-4c5d-8e9f-0a1b2c3d4e5f', '7a27407a-4241-4c84-99a0-0377254a5e0d', -23.561684, -46.655981, now())
ON CONFLICT (carga_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  ultima_atualizacao = now();
`;

async function main() {
  console.log("Conectando para inserir dados de teste...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Inserindo dados...");
    await client.query(sql);
    console.log("Dados inseridos com sucesso!");
  } catch (err) {
    console.error("Erro ao inserir dados:", err);
  } finally {
    await client.end();
  }
}

main();
