'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function CadastroPage() {
  const router = useRouter();
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState<'MOTORISTA' | 'GERENTE_CD'>('MOTORISTA');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Se o usuário já estiver logado, redirecionar automaticamente
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Buscar perfil para saber para onde redirecionar
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
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validação básica dos campos
    if (!nomeCompleto || !username.trim() || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      // Chama a rota interna do servidor que usa a chave de admin do Supabase
      // para criar o usuário, contornando restrições do provedor de e-mail
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase().trim(),
          password,
          nomeCompleto: nomeCompleto.trim(),
          tipoUsuario,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao criar a conta.');
      }

      setSuccessMsg('Conta criada com sucesso! Redirecionando...');

      // Faz login automaticamente após o cadastro
      const emailInterno = `${username.toLowerCase().trim()}@frete-link-app.com`;
      await supabase.auth.signInWithPassword({ email: emailInterno, password });

      setTimeout(() => {
        if (tipoUsuario === 'MOTORISTA') {
          router.push('/dashboard/motorista');
        } else {
          router.push('/dashboard/centro-distribuicao');
        }
      }, 1200);

    } catch (err: any) {
      console.error('Erro de cadastro detalhado:', err);
      setErrorMsg(err.message || 'Ocorreu um erro no processo de cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 font-sans select-none overflow-hidden">
      {/* Detalhes visuais de fundo */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-8 bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl relative">

        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-500 bg-clip-text text-transparent">
              FRETE LINK
            </span>
          </Link>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Crie sua Conta de Teste</h2>
          <p className="text-xs text-zinc-400">Escolha o tipo de acesso abaixo e preencha os dados</p>
        </div>

        {/* Mensagens de feedback */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-lg animate-fade-in">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded-lg animate-fade-in">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {/* Seleção do Tipo de Usuário (Cards Visuais) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Quem é você no sistema?
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Card Motorista */}
              <div
                onClick={() => setTipoUsuario('MOTORISTA')}
                className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all duration-300 select-none ${tipoUsuario === 'MOTORISTA'
                  ? 'bg-emerald-950/20 border-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                  }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${tipoUsuario === 'MOTORISTA' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-700'
                    }`}>
                    {tipoUsuario === 'MOTORISTA' && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                  </span>
                  <span className="text-emerald-400">🚛</span>
                </div>
                <span className="font-bold text-zinc-100">Motorista</span>
                <span className="text-[10px] text-zinc-400 mt-1">
                  Busca fretes interestaduais e compartilha GPS da rota em tempo real.
                </span>
              </div>

              {/* Card Gerente CD */}
              <div
                onClick={() => setTipoUsuario('GERENTE_CD')}
                className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all duration-300 select-none ${tipoUsuario === 'GERENTE_CD'
                  ? 'bg-indigo-950/20 border-indigo-500 shadow-lg shadow-indigo-500/10'
                  : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                  }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${tipoUsuario === 'GERENTE_CD' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-700'
                    }`}>
                    {tipoUsuario === 'GERENTE_CD' && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                  </span>
                  <span className="text-indigo-400">🏬</span>
                </div>
                <span className="font-bold text-zinc-100">Gerente de CD</span>
                <span className="text-[10px] text-zinc-400 mt-1">
                  Cadastra centros, lança cargas e rastreia motoristas no mapa.
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Campo Nome */}
            <div>
              <label htmlFor="nomeCompleto" className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                Nome Completo
              </label>
              <input
                id="nomeCompleto"
                type="text"
                required
                placeholder="Ex: João da Silva"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              />
            </div>

            {/* Campo Nome de Usuário (Substituindo o E-mail) */}
            <div>
              <label htmlFor="username" className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                Nome de Usuário
              </label>
              <input
                id="username"
                type="text"
                required
                placeholder="Ex: joaosilva"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600 lowercase font-mono"
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
                placeholder="Sua senha forte"
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
            className={`w-full py-4 rounded-lg font-bold tracking-wide uppercase text-xs transition-all duration-300 flex items-center justify-center space-x-2 ${loading
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : tipoUsuario === 'MOTORISTA'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'
              }`}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin inline-block" />
                <span>Criando Conta...</span>
              </>
            ) : (
              <span>Criar minha conta de {tipoUsuario === 'MOTORISTA' ? 'Motorista' : 'Gerente'}</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-zinc-500">
            Já possui uma conta?{' '}
            <Link href="/" className="text-zinc-400 hover:text-white underline transition-colors">
              Fazer Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}