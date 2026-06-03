'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CentroDistribuicao {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  endereco_completo: string;
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

export default function MotoristaDashboard() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // States de Cargas
  const [fretesDisponiveis, setFretesDisponiveis] = useState<Carga[]>([]);
  const [cargaAtiva, setCargaAtiva] = useState<Carga | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Refs de Mapa para Carga Ativa
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const originMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const routePolyline = useRef<google.maps.Polyline | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  const [mapReady, setMapReady] = useState(false);

  // 1. Verificar Autenticação
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: perfil, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !perfil || perfil.tipo_usuario !== 'MOTORISTA') {
        if (perfil?.tipo_usuario === 'GERENTE_CD') {
          router.push('/dashboard/centro-distribuicao');
        } else {
          router.push('/login');
        }
        return;
      }

      setNome(perfil.nome_completo);
      setUserId(session.user.id);
      setLoading(false);
      fetchDashboardData(session.user.id);
    };

    checkAuth();
  }, [router]);

  // 2. Buscar Dados do Dashboard
  const fetchDashboardData = async (uid: string) => {
    // 2.1. Buscar Cargas Disponíveis (Pendente)
    const { data: disponiveis, error: dispError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, cidade, estado, endereco_completo, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, cidade, estado, endereco_completo, lat, lng)
      `)
      .eq('status', 'pendente');

    if (!dispError) {
      setFretesDisponiveis((disponiveis || []) as unknown as Carga[]);
    }

    // 2.2. Buscar Carga Ativa deste Motorista (Em Trânsito)
    const { data: ativa, error: ativaError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, cidade, estado, endereco_completo, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, cidade, estado, endereco_completo, lat, lng)
      `)
      .eq('motorista_id', uid)
      .eq('status', 'em_transito')
      .maybeSingle();

    if (!ativaError && ativa) {
      setCargaAtiva(ativa as unknown as Carga);
    } else {
      setCargaAtiva(null);
    }
  };

  // 3. Inicializar Mapa se houver carga ativa
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
        disableDefaultUI: true, // Celular limpo
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#18181b' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#18181b' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
          { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#27272a' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#09090b' }] }
        ]
      });

      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: googleMap.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#10b981', // Emerald
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
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
      if (originMarker.current) originMarker.current.setMap(null);
      if (destMarker.current) destMarker.current.setMap(null);
      if (routePolyline.current) routePolyline.current.setMap(null);
      directionsRenderer.current = null;
    };
  }, [cargaAtiva]);

  // 4. Traçar Rota da Carga Ativa (Directions API)
  useEffect(() => {
    if (!mapReady || !cargaAtiva || !googleMap.current || !directionsRenderer.current) return;

    const google = window.google;
    const map = googleMap.current;

    // Limpar elementos antigos
    if (originMarker.current) originMarker.current.setMap(null);
    if (destMarker.current) destMarker.current.setMap(null);
    if (routePolyline.current) routePolyline.current.setMap(null);
    directionsRenderer.current.setDirections({ routes: [] } as any);

    const orig = cargaAtiva.cd_origem;
    const dest = cargaAtiva.cd_destino;

    // Marcadores
    originMarker.current = new google.maps.Marker({
      position: { lat: orig.lat, lng: orig.lng },
      map: map,
      title: orig.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 8,
      },
    });

    destMarker.current = new google.maps.Marker({
      position: { lat: dest.lat, lng: dest.lng },
      map: map,
      title: dest.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#6366f1',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 8,
      },
    });

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: `${orig.cidade}, ${orig.estado}, Brazil`,
        destination: `${dest.cidade}, ${dest.estado}, Brazil`,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === 'OK' && result) {
          directionsRenderer.current?.setDirections(result);
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(orig.lat, orig.lng));
          bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
          map.fitBounds(bounds);
        } else {
          console.warn(`Directions API falhou (Status: ${status}). Usando fallback Polyline.`);
          
          routePolyline.current = new google.maps.Polyline({
            path: [
              { lat: orig.lat, lng: orig.lng },
              { lat: dest.lat, lng: dest.lng }
            ],
            geodesic: true,
            strokeColor: '#10b981',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            map: map,
          });

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(orig.lat, orig.lng));
          bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
          map.fitBounds(bounds);
        }
      }
    );

  }, [cargaAtiva, mapReady]);

  // 5. Aceitar Frete
  const handleAceitarFrete = async (cargaId: string) => {
    if (!userId) return;
    setActionLoading(cargaId);

    try {
      const { error } = await supabase
        .from('cargas')
        .update({
          status: 'em_transito',
          motorista_id: userId
        })
        .eq('id', cargaId);

      if (error) throw error;

      alert('Frete aceito! Rota em andamento iniciada.');
      await fetchDashboardData(userId);
    } catch (err: any) {
      alert('Erro ao aceitar frete: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 6. Concluir Frete
  const handleConcluirFrete = async () => {
    if (!cargaAtiva || !userId) return;
    setActionLoading('concluir');

    try {
      const { error } = await supabase
        .from('cargas')
        .update({
          status: 'concluida'
        })
        .eq('id', cargaAtiva.id);

      if (error) throw error;

      // Remover coordenadas do rastreamento se houver
      await supabase.from('rastreamento_ativo').delete().eq('carga_id', cargaAtiva.id);

      alert('Entrega finalizada com sucesso! Bom trabalho.');
      await fetchDashboardData(userId);
    } catch (err: any) {
      alert('Erro ao finalizar entrega: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white font-sans">
        <div className="text-center space-y-2">
          <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin block mx-auto" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Verificando Credenciais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative pb-12 select-none">
      
      {/* Luz Emerald Decorativa */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Header Fixo/Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex justify-between items-center max-w-4xl w-full mx-auto">
        <div>
          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black block">Portal do Motorista</span>
          <span className="text-sm font-bold block">{nome}</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleLogout}
            className="text-xs border border-zinc-800 hover:border-red-500/20 bg-zinc-950 px-3.5 py-2 rounded text-zinc-400 hover:text-red-400 transition-all duration-300"
          >
            Sair / Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8 z-10">
        
        {/* Caso tenha Carga Ativa */}
        {cargaAtiva ? (
          <section className="space-y-6">
            <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">Viagem em Andamento</h2>
                <p className="text-[10px] text-zinc-500">Siga as instruções rodoviárias abaixo</p>
              </div>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-black px-2.5 py-1 rounded">
                Em Trânsito
              </span>
            </div>

            {/* Card Detalhado da Viagem */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-bold text-zinc-100">{cargaAtiva.descricao}</h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs border-y border-zinc-850 py-3.5 text-zinc-400">
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase font-bold">Origem</span>
                  <span className="font-semibold text-zinc-200 block text-sm">
                    {cargaAtiva.cd_origem.cidade} - {cargaAtiva.cd_origem.estado}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">{cargaAtiva.cd_origem.nome}</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block uppercase font-bold">Destino</span>
                  <span className="font-semibold text-indigo-400 block text-sm">
                    {cargaAtiva.cd_destino.cidade} - {cargaAtiva.cd_destino.estado}
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">{cargaAtiva.cd_destino.nome}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-zinc-500">Valor Acertado:</span>
                <span className="text-lg font-black text-emerald-400">
                  R$ {Number(cargaAtiva.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Mapa de Rota */}
            <div className="relative rounded-xl overflow-hidden border border-zinc-800" style={{ height: '320px' }}>
              <div ref={mapRef} className="w-full h-full bg-zinc-900" />
            </div>

            {/* Ações da Carga Ativa */}
            <div className="flex gap-4">
              <button
                onClick={handleConcluirFrete}
                disabled={actionLoading !== null}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-lg uppercase tracking-wider text-xs transition-all duration-300 shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-2"
              >
                {actionLoading === 'concluir' ? (
                  <>
                    <span className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Concluindo...</span>
                  </>
                ) : (
                  <span>Concluir e Finalizar Entrega 🏁</span>
                )}
              </button>
              <Link
                href="/caminhoneiro"
                className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 font-extrabold rounded-lg uppercase tracking-wider text-xs transition-colors flex items-center justify-center"
              >
                Abrir Portal de Navegação 📱
              </Link>
            </div>
          </section>
        ) : (
          /* Lista de Cargas Disponíveis (Mural) */
          <section className="space-y-6">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">Mural de Cargas Disponíveis</h2>
              <p className="text-[10px] text-zinc-500">Aceite uma das demandas listadas para iniciar viagem</p>
            </div>

            {fretesDisponiveis.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/30 border border-zinc-900 rounded-xl text-zinc-500 text-xs">
                Nenhum frete pendente disponível no momento. Aguarde novos lançamentos dos CDs.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fretesDisponiveis.map((frete) => (
                  <div key={frete.id} className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-bold text-zinc-200 line-clamp-1">{frete.descricao}</h3>
                        <span className="text-[9px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded font-mono">
                          {frete.cd_origem.estado} $\rightarrow$ {frete.cd_destino.estado}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-3 mt-1">
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold">Cidade Origem</span>
                          <span className="font-semibold text-zinc-300 block truncate">{frete.cd_origem.cidade}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold">Cidade Destino</span>
                          <span className="font-semibold text-indigo-400 block truncate">{frete.cd_destino.cidade}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold text-left">Valor</span>
                        <span className="text-sm font-extrabold text-emerald-400">
                          R$ {Number(frete.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleAceitarFrete(frete.id)}
                        disabled={actionLoading !== null}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-extrabold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center space-x-1"
                      >
                        {actionLoading === frete.id ? (
                          <span className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin block" />
                        ) : (
                          <span>Aceitar</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Navegação Global Voltar */}
      <footer className="w-full text-center mt-6">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors">
          Voltar para a Home
        </Link>
      </footer>
    </div>
  );
}
