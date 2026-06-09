const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Successfully connected to the database to inspect users.');

    // Query auth.users joined with public.perfis and public.motoristas
    const usersRes = await client.query(`
      SELECT 
        u.id, 
        u.email, 
        u.created_at,
        p.nome_completo as perfil_nome,
        p.tipo_usuario as perfil_tipo,
        p.username as perfil_username,
        m.nome as motorista_nome,
        m.placa_veiculo as motorista_placa
      FROM auth.users u
      LEFT JOIN public.perfis p ON u.id = p.id
      LEFT JOIN public.motoristas m ON u.id = m.id
      ORDER BY u.created_at DESC;
    `);

    console.log('\n--- AUTH USERS AND MAPPED PROFILES ---');
    if (usersRes.rows.length === 0) {
      console.log('No users found in auth.users.');
    } else {
      for (const row of usersRes.rows) {
        console.log(`Email: ${row.email}`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Created At: ${row.created_at}`);
        console.log(`  Perfil: ${row.perfil_nome || 'N/A'} (${row.perfil_tipo || 'N/A'}) - Username: ${row.perfil_username || 'N/A'}`);
        console.log(`  Motorista Perfil: ${row.motorista_nome || 'N/A'} - Placa: ${row.motorista_placa || 'N/A'}`);
        console.log('--------------------------------------------------');
      }
    }

  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await client.end();
  }
}

run();
