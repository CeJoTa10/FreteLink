'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CentroDistribuicao {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  lat: number;
  lng: number;
}

interface Carga {
  id: string;
  descricao: string;
  valor_frete: number;
  status: 'pendente' | 'em_transito' | 'concluida' | 'cancelada';
  motorista_id: string | null;
  cd_origem: CentroDistribuicao;
  cd_destino: CentroDistribuicao;
}

interface MotoristaProfile {
  nome: string;
  telefone: string;
  placa_veiculo: string;
}

export default function CaminhoneiroPortal() {
  useEffect(() => {
    window.location.replace('/dashboard/motorista');
  }, []);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MotoristaProfile | null>(null);

  // States de Login/Cadastro
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placa, setPlaca] = useState('');

  // States de Dados Logísticos
  const [fretesDisponiveis, setFretesDisponiveis] = useState<Carga[]>([]);
  const [cargaAtiva, setCargaAtiva] = useState<Carga | null>(null);
  const [gpsTrackingActive, setGpsTrackingActive] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const directionsService = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const gpsInterval = useRef<NodeJS.Timeout | null>(null);

  // 1. Monitorar Sessão de Autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfileAndCargas(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfileAndCargas(session.user.id);
      } else {
        setProfile(null);
        setCargaAtiva(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (gpsInterval.current) clearInterval(gpsInterval.current);
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // 2. Buscar Dados do Motorista e Cargas
  const fetchProfileAndCargas = async (userId: string) => {
    setLoading(true);

    // Buscar Perfil do Motorista
    const { data: profileData, error: profileError } = await supabase
      .from('motoristas')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Perfil não encontrado, o usuário precisa cadastrar o perfil.');
    } else {
      setProfile(profileData);
    }

    // Buscar Cargas Disponíveis (pendentes)
    const { data: disponiveis, error: dispError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, estado, cidade, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, estado, cidade, lat, lng)
      `)
      .eq('status', 'pendente');

    if (!dispError) {
      setFretesDisponiveis((disponiveis || []) as unknown as Carga[]);
    }

    // Buscar Carga Ativa deste Motorista (em_transito)
    const { data: ativa, error: ativaError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, estado, cidade, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, estado, cidade, lat, lng)
      `)
      .eq('motorista_id', userId)
      .eq('status', 'em_transito')
      .maybeSingle();

    if (!ativaError && ativa) {
      setCargaAtiva(ativa as unknown as Carga);
    } else {
      setCargaAtiva(null);
    }

    setLoading(false);
  };

  // 3. Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.includes('.') || !email.includes('@')) {
      alert('Por favor, insira um e-mail válido com domínio (ex: motorista@fretelink.com).');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Erro no Login: ' + error.message);
      setLoading(false);
    }
  };

  // 4. Cadastro (Auth + Perfil)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.includes('.') || !email.includes('@')) {
      alert('Por favor, insira um e-mail válido com domínio (ex: motorista@fretelink.com).');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      alert('Erro no Cadastro: ' + error.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      // Inserir Perfil do Motorista
      const { error: profileError } = await supabase
        .from('motoristas')
        .insert({
          id: data.user.id,
          nome,
          telefone,
          placa_veiculo: placa.toUpperCase(),
        });

      if (profileError) {
        alert('Cadastro realizado, mas falhou ao criar perfil: ' + profileError.message);
      } else {
        alert('Cadastro realizado com sucesso! Bem-vindo.');
      }
    }
  };

  // 5. Logout
  const handleLogout = async () => {
    if (gpsInterval.current) clearInterval(gpsInterval.current);
    setGpsTrackingActive(false);
    await supabase.auth.signOut();
  };

  // 6. Aceitar Frete
  const handleAceitarFrete = async (cargaId: string) => {
    if (!session || !profile) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('cargas')
      .update({
        status: 'em_transito',
        motorista_id: session.user.id,
      })
      .eq('id', cargaId);

    if (error) {
      alert('Erro ao aceitar frete: ' + error.message);
      setLoading(false);
    } else {
      alert('Frete aceito! Iniciando navegação...');
      fetchProfileAndCargas(session.user.id);
    }
  };

  // 7. Concluir Frete
  const handleConcluirFrete = async () => {
    if (!cargaAtiva || !session) return;

    setLoading(true);
    const { error } = await supabase
      .from('cargas')
      .update({ status: 'concluida' })
      .eq('id', cargaAtiva.id);

    if (error) {
      alert('Erro ao concluir frete: ' + error.message);
      setLoading(false);
    } else {
      // Remover rastreamento ativo
      await supabase.from('rastreamento_ativo').delete().eq('carga_id', cargaAtiva.id);
      
      // Limpar estados de rastreamento
      if (gpsInterval.current) clearInterval(gpsInterval.current);
      setGpsTrackingActive(false);

      alert('Entrega finalizada com sucesso! Parabéns!');
      fetchProfileAndCargas(session.user.id);
    }
  };

  const [mapReady, setMapReady] = useState(false);

  // 8. Inicializar Mapa e Google Directions na Carga Ativa usando o Script global
  useEffect(() => {
    const activeCarga = cargaAtiva;
    if (!activeCarga) return;
    let checkInterval: NodeJS.Timeout;

    function initMapsAPI() {
      if (!mapRef.current || googleMap.current) return;
      if (!activeCarga) return;

      const google = window.google;
      googleMap.current = new google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat: activeCarga.cd_origem.lat, lng: activeCarga.cd_origem.lng },
        disableDefaultUI: true, // Interface de celular limpa
      });

      directionsService.current = new google.maps.DirectionsService();
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: googleMap.current,
        suppressMarkers: false,
      });

      setMapReady(true);
    }

    if (window.google) {
      initMapsAPI();
    } else {
      checkInterval = setInterval(() => {
        if (window.google) {
          initMapsAPI();
          clearInterval(checkInterval);
        }
      }, 100);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      setMapReady(false);
      googleMap.current = null;
      directionsRenderer.current = null;
      directionsService.current = null;
    };
  }, [cargaAtiva]);

  // 8.1. Traçar Rota quando o mapa e a carga estiverem prontos
  useEffect(() => {
    if (!mapReady || !cargaAtiva || !directionsService.current || !directionsRenderer.current) return;

    directionsService.current.route(
      {
        origin: { lat: cargaAtiva.cd_origem.lat, lng: cargaAtiva.cd_origem.lng },
        destination: { lat: cargaAtiva.cd_destino.lat, lng: cargaAtiva.cd_destino.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === 'OK') {
          directionsRenderer.current.setDirections(result);
        } else {
          console.error('Falha ao obter rota Directions:', status);
        }
      }
    );
  }, [mapReady, cargaAtiva]);

  // 9. Geolocalização Real: Captura a cada 30 segundos
  const dispararEnvioCoordenadas = async (position: GeolocationPosition) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    setCurrentCoords({ lat, lng });

    if (cargaAtiva && session) {
      const { error } = await supabase.from('rastreamento_ativo').upsert({
        carga_id: cargaAtiva.id,
        motorista_id: session.user.id,
        lat,
        lng,
        ultima_atualizacao: new Date().toISOString(),
      });
      if (error) {
        console.error('Erro ao enviar coordenadas:', error);
      }
    }
  };

  useEffect(() => {
    if (cargaAtiva && session) {
      setGpsTrackingActive(true);
      
      // Capturar geolocalização inicial
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          dispararEnvioCoordenadas,
          (err) => console.error('Erro de GPS:', err),
          { enableHighAccuracy: true }
        );

        // Configurar loop a cada 30 segundos
        gpsInterval.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            dispararEnvioCoordenadas,
            (err) => console.error('Erro de loop GPS:', err),
            { enableHighAccuracy: true }
          );
        }, 30000); // 30 segundos
      }
    }

    return () => {
      if (gpsInterval.current) clearInterval(gpsInterval.current);
      setGpsTrackingActive(false);
    };
  }, [cargaAtiva, session]);

  // Carregamento inicial
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-2">
          <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin block mx-auto" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Carregando Portal Mobile...</p>
        </div>
      </div>
    );
  }

  // Tela de Login/Cadastro
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col justify-center items-center bg-black px-6 text-white font-sans">
        <div className="w-full max-w-sm space-y-8 bg-zinc-900/40 border border-zinc-800 p-8 rounded-lg">
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-widest text-emerald-400">FRETE LINK</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Área do Caminhoneiro</p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4 text-sm">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-semibold">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="João Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-semibold">Telefone de Contato</label>
                  <input
                    type="text"
                    required
                    placeholder="+55 11 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-semibold">Placa do Cavalo/Caminhão</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC1D23"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-center uppercase font-mono font-bold"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-semibold">E-mail</label>
              <input
                type="email"
                required
                placeholder="motorista@fretelink.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-semibold">Senha</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded text-sm tracking-wide uppercase transition-colors"
            >
              {isSignUp ? 'Cadastrar Minha Conta' : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-zinc-400 hover:text-white underline transition-colors"
            >
              {isSignUp ? 'Já tenho cadastro. Fazer login.' : 'Não tenho cadastro. Criar conta agora.'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard do Caminhoneiro Logado
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white font-sans max-w-md mx-auto border-x border-zinc-800">
      
      {/* Header Mobile */}
      <header className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black block">Motorista Ativo</span>
          <span className="text-sm font-bold block">{profile?.nome || 'Perfil Pendente'}</span>
          <span className="text-[10px] text-zinc-400 font-mono block">Placa: {profile?.placa_veiculo || 'N/A'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs border border-zinc-800 hover:border-red-500/20 bg-zinc-950 px-3 py-1.5 rounded text-zinc-400 hover:text-red-400 transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Rastreamento GPS Flutuante */}
      {gpsTrackingActive && (
        <div className="bg-emerald-500 text-black px-4 py-2 text-xs flex justify-between items-center font-bold">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-black animate-ping" />
            <span>GPS ATIVO (Compartilhando Rota)</span>
          </div>
          {currentCoords && (
            <span className="font-mono">{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        
        {/* Caso TENHA Carga Ativa */}
        {cargaAtiva ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-3">
              <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                Frete em Andamento
              </span>
              <h2 className="text-base font-bold">{cargaAtiva.descricao}</h2>
              
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-zinc-800/80 pt-3 text-zinc-400">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Origem</span>
                  <span className="font-semibold text-zinc-200">{cargaAtiva.cd_origem.cidade} - {cargaAtiva.cd_origem.estado}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Destino</span>
                  <span className="font-semibold text-indigo-400">{cargaAtiva.cd_destino.cidade} - {cargaAtiva.cd_destino.estado}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-zinc-800/80">
                <span className="text-xs text-zinc-500">Valor Acordado:</span>
                <span className="text-base font-bold text-emerald-400">
                  R$ {Number(cargaAtiva.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Mapa de Rota */}
            <div className="relative rounded-lg overflow-hidden border border-zinc-800" style={{ height: '300px' }}>
              <div ref={mapRef} className="w-full h-full bg-zinc-900" />
            </div>

            {/* Botão Concluir Viagem */}
            <button
              onClick={handleConcluirFrete}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-lg uppercase text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-colors"
            >
              Concluir Entrega (Finalizar)
            </button>
          </div>
        ) : (
          
          /* Caso NÃO TENHA Carga Ativa: Mostra Cargas Disponíveis */
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-500">Cargas Interestaduais Disponíveis</h2>
            
            {fretesDisponiveis.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800 rounded-lg text-zinc-500 text-xs">
                Nenhum frete disponível no momento. Aguarde o lançamento de novas requisições pelos CDs.
              </div>
            ) : (
              fretesDisponiveis.map((frete) => (
                <div key={frete.id} className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-white max-w-[200px] truncate">{frete.descricao}</h3>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-mono">
                      Origem: {frete.cd_origem.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 border-y border-zinc-800/80 py-3">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Cidade Origem</span>
                      <span className="font-semibold text-zinc-300">{frete.cd_origem.cidade} ({frete.cd_origem.estado})</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Cidade Destino</span>
                      <span className="font-semibold text-indigo-400">{frete.cd_destino.cidade} ({frete.cd_destino.estado})</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Valor Líquido</span>
                      <span className="text-base font-black text-emerald-400">
                        R$ {Number(frete.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAceitarFrete(frete.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-2.5 rounded text-xs uppercase tracking-wider transition-colors"
                    >
                      Aceitar Frete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

    </div>
  );
}
