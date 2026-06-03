const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seed() {
  console.log("Iniciando o seeding de usuários...");

  const usersToCreate = [
    {
      email: 'motorista@fretelink.com',
      password: 'SenhaForte123!',
      type: 'motorista',
      profileData: {
        nome: 'João Caminhoneiro',
        telefone: '+55 11 99999-9999',
        placa_veiculo: 'ABC-1234'
      }
    },
    {
      email: 'cd@fretelink.com',
      password: 'SenhaForte123!',
      type: 'cd',
      profileData: {
        nome: 'CD Logística São Paulo',
        estado: 'SP',
        cidade: 'São Paulo',
        endereco_completo: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        lat: -23.561684,
        lng: -46.655981
      }
    }
  ];

  for (const userData of usersToCreate) {
    console.log(`\nProcessando: ${userData.email}...`);

    // 1. Verificar se o usuário de auth já existe
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("Erro ao listar usuários:", listError);
      continue;
    }

    let user = users.find(u => u.email === userData.email);

    if (user) {
      console.log(`Usuário auth para ${userData.email} já existe. ID: ${user.id}`);
    } else {
      // Criar usuário no Auth
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (createError) {
        console.error(`Erro ao criar auth user para ${userData.email}:`, createError);
        continue;
      }

      user = createData.user;
      console.log(`Usuário auth criado com sucesso! ID: ${user.id}`);
    }

    // 2. Inserir/Atualizar perfil na tabela pública
    if (userData.type === 'motorista') {
      const { error: profileError } = await supabase
        .from('motoristas')
        .upsert({
          id: user.id,
          ...userData.profileData
        });

      if (profileError) {
        console.error(`Erro ao criar perfil de motorista para ${userData.email}:`, profileError);
      } else {
        console.log(`Perfil de motorista criado/atualizado com sucesso!`);
      }
    } else if (userData.type === 'cd') {
      const { error: profileError } = await supabase
        .from('centros_distribuicao')
        .upsert({
          id: user.id,
          ...userData.profileData
        });

      if (profileError) {
        console.error(`Erro ao criar perfil de CD para ${userData.email}:`, profileError);
      } else {
        console.log(`Perfil de CD criado/atualizado com sucesso!`);
      }
    }
  }

  console.log("\nSeeding concluído!");
}

seed();
