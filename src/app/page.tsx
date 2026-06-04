import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans select-none">
      {/* Efeitos de fundo */}
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-zinc-900/80">
        <span className="text-xl font-black tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-500 bg-clip-text text-transparent">
          FRETE LINK
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-all duration-200"
          >
            Acessar Sistema
          </Link>
          <Link
            href="/cadastro"
            className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white shadow-lg shadow-emerald-500/10 transition-all duration-200"
          >
            Criar Cadastro
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center gap-8">
        {/* Título principal */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-tight text-white">
            O elo definitivo entre a{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              carga
            </span>{' '}
            e o{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              destino
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Conectamos Centros de Distribuição a motoristas interestaduais. Monitoramento
            inteligente em tempo real e rotas precisas até a doca de destino.
          </p>
        </div>

        {/* Divisor decorativo */}
        <div className="flex items-center gap-4 w-full max-w-xs">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-zinc-700" />
          <span className="text-zinc-600 text-xs uppercase tracking-widest">Escolha seu acesso</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-zinc-700" />
        </div>

        {/* Botões de acesso de área */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
          {/* Área do CD */}
          <Link
            href="/login"
            className="flex-1 group flex flex-col items-center gap-3 p-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-950/40 hover:border-indigo-500/60 transition-all duration-300 shadow-lg shadow-indigo-500/5"
          >
            <span className="text-3xl">🏬</span>
            <div className="text-center">
              <span className="block text-sm font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                Área do CD
              </span>
              <span className="block text-xs text-zinc-500 mt-0.5">Lançar Cargas</span>
            </div>
            <span className="text-xs text-indigo-400/60 group-hover:text-indigo-400 transition-colors mt-1">
              Entrar →
            </span>
          </Link>

          {/* Área do Motorista */}
          <Link
            href="/login"
            className="flex-1 group flex flex-col items-center gap-3 p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-500/60 transition-all duration-300 shadow-lg shadow-emerald-500/5"
          >
            <span className="text-3xl">🚛</span>
            <div className="text-center">
              <span className="block text-sm font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                Área do Motorista
              </span>
              <span className="block text-xs text-zinc-500 mt-0.5">Buscar Fretes</span>
            </div>
            <span className="text-xs text-emerald-400/60 group-hover:text-emerald-400 transition-colors mt-1">
              Entrar →
            </span>
          </Link>
        </div>

        {/* Indicadores de rodapé */}
        <div className="flex items-center gap-8 mt-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            GPS em tempo real
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Rotas interestaduais
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            Monitoramento 24h
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 border-t border-zinc-900/50">
        <p className="text-xs text-zinc-700">
          © {new Date().getFullYear()} Frete Link — Tecnologia de Logística Interestadual
        </p>
      </footer>
    </div>
  );
}