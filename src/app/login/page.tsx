'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Se o usuário já estiver logado, redirecionar automaticamente
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLoading(true);
        const { data: perfil } = await supabase
          .from('perfis')
          .select('tipo_usuario')
          .eq('id', session.user.id)
          .single();

        if (perfil) {
          if (perfil.tipo_usuario === 'MOTORISTA') {
            router.push('/dashboard/motorista');
          } else if (perfil.tipo_usuario === 'GERENTE_CD') {
            router.push('/dashboard/centro-distribuicao');
          }
        }
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!data?.user) {
        throw new Error('Falha ao autenticar o usuário.');
      }

      // Buscar perfil na tabela 'perfis'
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (perfilError || !perfil) {
        console.error('Perfil não encontrado no banco:', perfilError);
        throw new Error('Usuário autenticado, mas nenhum perfil correspondente foi localizado na tabela perfis.');
      }

      // Redirecionamento baseado no tipo de usuário
      if (perfil.tipo_usuario === 'MOTORISTA') {
        router.push('/dashboard/motorista');
      } else if (perfil.tipo_usuario === 'GERENTE_CD') {
        router.push('/dashboard/centro-distribuicao');
      } else {
        throw new Error('Tipo de usuário desconhecido.');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao efetuar login.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 font-sans select-none overflow-hidden">
      {/* Detalhes visuais de fundo */}
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-8 bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl relative">

        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-500 bg-clip-text text-transparent">
              FRETE LINK
            </span>
          </Link>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Faça seu Login</h2>
          <p className="text-xs text-zinc-400">Insira suas credenciais para acessar seu painel</p>
        </div>

        {/* Mensagens de feedback */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-lg animate-fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 text-sm">
          <div className="space-y-4">
            {/* Campo E-mail */}
            <div>
              <label htmlFor="email" className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                Endereço de E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="Ex: motorista@teste.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label htmlFor="password" className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                Senha de Acesso
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="Sua senha secreta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Botão de Cadastro */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold tracking-wide uppercase text-xs transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white shadow-lg shadow-emerald-500/10`}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-zinc-500">
            Não tem uma conta ainda?{' '}
            <Link href="/cadastro" className="text-zinc-400 hover:text-white underline transition-colors">
              Criar Cadastro
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

