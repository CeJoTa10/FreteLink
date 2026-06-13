import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Instanciado dentro do handler para garantir que as variáveis de
    // ambiente do servidor estejam disponíveis em tempo de execução,
    // não em tempo de build (evita o erro "supabaseKey is required").
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { username, password, nomeCompleto, tipoUsuario } = await req.json();

    // Validações básicas
    if (!username?.trim() || !password || !nomeCompleto?.trim() || !tipoUsuario) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (!['MOTORISTA', 'GERENTE_CD'].includes(tipoUsuario)) {
      return NextResponse.json(
        { error: 'Tipo de usuário inválido.' },
        { status: 400 }
      );
    }

    const emailInterno = `${username.toLowerCase().trim()}@frete-link-app.com`;

    // 1. Verificar se o username já existe (via email mascarado)
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const usernameJaExiste = existing?.users?.some(
      (u) => u.email === emailInterno
    );

    if (usernameJaExiste) {
      return NextResponse.json(
        { error: 'Este nome de usuário já está em uso. Escolha outro.' },
        { status: 409 }
      );
    }

    // 2. Criar usuário no Supabase Auth (admin API ignora restrições do provider)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailInterno,
      password,
      email_confirm: true, // Confirma automaticamente sem e-mail
      user_metadata: {
        nome_completo: nomeCompleto.trim(),
        username: username.toLowerCase().trim(),
        tipo_usuario: tipoUsuario
      }
    });

    if (authError || !authData?.user) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Erro ao criar o usuário.' },
        { status: 500 }
      );
    }

    // 3. Inserir/Atualizar dados na tabela pública 'perfis'
    const { error: profileError } = await supabaseAdmin
      .from('perfis')
      .upsert({
        id: authData.user.id,
        nome_completo: nomeCompleto.trim(),
        username: username.toLowerCase().trim(),
        tipo_usuario: tipoUsuario,
      });

    if (profileError) {
      console.error('Erro ao criar perfil, revertendo usuário...', profileError);
      // Rollback: deletar o usuário de auth criado para evitar usuário fantasma
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Erro ao salvar o perfil: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, userId: authData.user.id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Erro inesperado na rota de cadastro:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
