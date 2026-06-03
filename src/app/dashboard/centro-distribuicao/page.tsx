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

export default function CentroDistribuicaoDashboard() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);

  // States de cargas
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [selectedCarga, setSelectedCarga] = useState<Carga | null>(null);

  // States do formulário de carga
  const [cidadeOrigem, setCidadeOrigem] = useState('');
  const [cidadeDestino, setCidadeDestino] = useState('');
  const [tipoCarga, setTipoCarga] = useState('');
  const [valorFrete, setValorFrete] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Refs do mapa
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

      if (error || !perfil || perfil.tipo_usuario !== 'GERENTE_CD') {
        if (perfil?.tipo_usuario === 'MOTORISTA') {
          router.push('/dashboard/motorista');
        } else {
          router.push('/login');
        }
        return;
      }

      setNome(perfil.nome_completo);
      setLoading(false);
      fetchCargas();
    };

    checkAuth();
  }, [router]);

  // 2. Buscar cargas
  const fetchCargas = async () => {
    const { data: cargasData, error: cargasError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, estado, cidade, endereco_completo, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, estado, cidade, endereco_completo, lat, lng)
      `);

    if (cargasError) {
      console.error('Erro ao buscar cargas:', cargasError);
    } else {
      const mapped = (cargasData || []) as unknown as Carga[];
      setCargas(mapped);
      if (mapped.length > 0 && !selectedCarga) {
        setSelectedCarga(mapped[0]);
      }
    }
  };

  // 3. Inicializar o Google Maps
  useEffect(() => {
    if (loading) return;
    let checkInterval: NodeJS.Timeout;

    function initMap() {
      if (!mapRef.current || googleMap.current) return;

      const google = window.google;
      googleMap.current = new google.maps.Map(mapRef.current, {
        center: { lat: -23.561684, lng: -46.655981 }, // SP padrão
        zoom: 7,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#18181b' }] }, // Zinc 900
          { elementType: 'labels.text.stroke', stylers: [{ color: '#18181b' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
          { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3f3f46' }] },
          { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#27272a' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#18181b' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#09090b' }] }
        ],
        disableDefaultUI: false,
      });

      // Renderer para direções
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        map: googleMap.current,
        suppressMarkers: true, // Customizaremos os marcadores
        polylineOptions: {
          strokeColor: '#6366f1', // Indigo
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });

      setMapReady(true);
    }

    if (window.google) {
      initMap();
    } else {
      checkInterval = setInterval(() => {
        if (window.google) {
          initMap();
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
  }, [loading]);

  // 4. Traçar Rota por Rodovias (Directions API com Fallback)
  useEffect(() => {
    if (!mapReady || !selectedCarga || !googleMap.current || !directionsRenderer.current) return;

    const google = window.google;
    const map = googleMap.current;

    // Limpar elementos anteriores
    if (originMarker.current) originMarker.current.setMap(null);
    if (destMarker.current) destMarker.current.setMap(null);
    if (routePolyline.current) routePolyline.current.setMap(null);
    directionsRenderer.current.setDirections({ routes: [] } as any);

    const orig = selectedCarga.cd_origem;
    const dest = selectedCarga.cd_destino;

    // Criar marcadores customizados
    originMarker.current = new google.maps.Marker({
      position: { lat: orig.lat, lng: orig.lng },
      map: map,
      title: orig.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#10b981', // Emerald
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 9,
      },
    });

    destMarker.current = new google.maps.Marker({
      position: { lat: dest.lat, lng: dest.lng },
      map: map,
      title: dest.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#6366f1', // Indigo
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 9,
      },
    });

    // Chamar Directions API
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

          // Ajustar limites do mapa
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(orig.lat, orig.lng));
          bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
          map.fitBounds(bounds);
        } else {
          console.warn(
            `A API de Direções falhou (Status: ${status}). Se for um erro de faturamento ou limite de cota, desenharemos um fallback em linha reta.`
          );

          // Rota em Linha Reta de Fallback
          routePolyline.current = new google.maps.Polyline({
            path: [
              { lat: orig.lat, lng: orig.lng },
              { lat: dest.lat, lng: dest.lng }
            ],
            geodesic: true,
            strokeColor: '#f43f5e', // Rosa/Vermelho para indicar fallback
            strokeOpacity: 0.7,
            strokeWeight: 3,
            map: map,
          });

          // Ajustar limites
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(orig.lat, orig.lng));
          bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
          map.fitBounds(bounds);
        }
      }
    );

  }, [selectedCarga, mapReady]);

  // Auxiliares do Formulário
  const parseCityState = (input: string) => {
    const match = input.match(/^([^(),-]+)(?:\s*[(),-]+\s*([A-Za-z]{2}))?/);
    if (match) {
      const city = match[1].trim();
      const state = match[2] ? match[2].trim().toUpperCase() : '';
      return { city, state };
    }
    return { city: input.trim(), state: '' };
  };

  const geocodeCity = (city: string, state: string): Promise<{ lat: number; lng: number; address: string }> => {
    return new Promise((resolve, reject) => {
      if (!window.google) {
        reject(new Error('Google Maps não está carregado.'));
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      const addressQuery = state ? `${city}, ${state}, Brazil` : `${city}, Brazil`;
      
      geocoder.geocode({ address: addressQuery }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            address: results[0].formatted_address
          });
        } else {
          reject(new Error(`Não foi possível encontrar a cidade: ${city}. Status: ${status}`));
        }
      });
    });
  };

  // Buscar ou Criar CD automaticamente
  const getOrCreateCD = async (cityName: string, stateName: string): Promise<string> => {
    // 1. Procurar CD existente no banco
    const { data: existing } = await supabase
      .from('centros_distribuicao')
      .select('id')
      .eq('cidade', cityName)
      .eq('estado', stateName)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // 2. Se não existir, geocodificar e cadastrar
    const geocoded = await geocodeCity(cityName, stateName);
    const newCdId = crypto.randomUUID();

    const { error: insertError } = await supabase
      .from('centros_distribuicao')
      .insert({
        id: newCdId,
        nome: `CD ${cityName}`,
        cidade: cityName,
        estado: stateName,
        endereco_completo: geocoded.address,
        lat: geocoded.lat,
        lng: geocoded.lng
      });

    if (insertError) {
      throw new Error(`Falha ao registrar novo CD: ${insertError.message}`);
    }

    return newCdId;
  };

  // Lançar Nova Carga
  const handlePublishCarga = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    const valorNum = parseFloat(valorFrete);
    if (isNaN(valorNum) || valorNum <= 0) {
      setFormError('Insira um valor de frete válido.');
      setFormLoading(false);
      return;
    }

    try {
      const orig = parseCityState(cidadeOrigem);
      const dest = parseCityState(cidadeDestino);

      if (!orig.city || !dest.city) {
        throw new Error('Informe a cidade de origem e destino.');
      }

      // Buscar/Criar os CDs dinamicamente
      const cdOrigemId = await getOrCreateCD(orig.city, orig.state);
      const cdDestinoId = await getOrCreateCD(dest.city, dest.state);

      // Inserir Carga
      const { error: insertError } = await supabase
        .from('cargas')
        .insert({
          descricao: tipoCarga,
          valor_frete: valorNum,
          cd_origem_id: cdOrigemId,
          cd_destino_id: cdDestinoId,
          status: 'pendente'
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setFormSuccess('Carga publicada com sucesso!');
      setCidadeOrigem('');
      setCidadeDestino('');
      setTipoCarga('');
      setValorFrete('');
      
      // Atualizar lista
      await fetchCargas();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao publicar a carga.');
    } finally {
      setFormLoading(false);
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
          <span className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin block mx-auto" />
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Verificando Credenciais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden">
      
      {/* Coluna da Esquerda: Lançamentos e Cargas */}
      <aside className="w-[42%] border-r border-zinc-800 flex flex-col bg-zinc-900/60 backdrop-blur-md overflow-hidden relative">
        
        {/* Header com Navegação */}
        <header className="p-6 border-b border-zinc-800 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <h1 className="text-sm font-black tracking-widest bg-gradient-to-r from-emerald-400 to-indigo-500 bg-clip-text text-transparent">
                PAINEL DO GERENTE CD
              </h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs border border-zinc-800 hover:border-red-500/20 bg-zinc-950 px-3 py-1.5 rounded text-zinc-400 hover:text-red-400 transition-all duration-300"
            >
              Sair / Logout
            </button>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Operador: <span className="text-zinc-300 font-semibold">{nome}</span></p>
          </div>
        </header>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Formulário de Lançamento */}
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-2">
              <h2 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Lançar Nova Carga</h2>
              <p className="text-[10px] text-zinc-500">Adicione novas cargas no sistema (CDs serão criados dinamicamente via mapa)</p>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-lg">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded-lg">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handlePublishCarga} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-bold">Cidade Origem</label>
                  <input
                    type="text"
                    required
                    placeholder="Campinas (SP)"
                    value={cidadeOrigem}
                    onChange={(e) => setCidadeOrigem(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-bold">Cidade Destino</label>
                  <input
                    type="text"
                    required
                    placeholder="Santos (SP)"
                    value={cidadeDestino}
                    onChange={(e) => setCidadeDestino(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-bold">Tipo de Carga</label>
                <input
                  type="text"
                  required
                  placeholder="Carga de soja - 15 toneladas"
                  value={tipoCarga}
                  onChange={(e) => setTipoCarga(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1.5 uppercase font-bold">Valor do Frete (R$)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="2500.00"
                  value={valorFrete}
                  onChange={(e) => setValorFrete(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-zinc-700 transition-colors placeholder:text-zinc-700"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-lg uppercase tracking-wider text-[11px] transition-all duration-300 shadow-md shadow-indigo-600/10 flex items-center justify-center space-x-2"
              >
                {formLoading ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <span>Publicar Carga</span>
                )}
              </button>
            </form>
          </section>

          {/* Lista de Cargas */}
          <section className="space-y-4">
            <h2 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider border-b border-zinc-800 pb-2">
              Cargas Cadastradas
            </h2>
            
            {cargas.length === 0 ? (
              <div className="text-zinc-500 text-center py-10">Nenhuma carga publicada ainda.</div>
            ) : (
              <div className="space-y-3">
                {cargas.map((carga) => (
                  <div
                    key={carga.id}
                    onClick={() => setSelectedCarga(carga)}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                      selectedCarga?.id === carga.id
                        ? 'bg-zinc-800/80 border-indigo-500 shadow-lg shadow-indigo-500/5'
                        : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-zinc-100 block truncate max-w-[220px]">
                        {carga.descricao}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${
                          carga.status === 'em_transito'
                            ? 'bg-amber-500/20 text-amber-400'
                            : carga.status === 'pendente'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {carga.status === 'em_transito' ? 'Em Trânsito' : carga.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 mt-2 border-t border-zinc-800/60 pt-2.5">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Origem</span>
                        <span className="font-semibold text-zinc-300 truncate block">
                          {carga.cd_origem?.cidade} - {carga.cd_origem?.estado}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase font-bold">Destino</span>
                        <span className="font-semibold text-zinc-300 truncate block">
                          {carga.cd_destino?.cidade} - {carga.cd_destino?.estado}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-800/40 text-[11px]">
                      <span className="text-zinc-500">Frete:</span>
                      <span className="font-extrabold text-emerald-400">
                        R$ {Number(carga.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Link discreto de voltar */}
        <div className="p-4 border-t border-zinc-800 text-center bg-zinc-950/20">
          <Link href="/" className="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors">
            Voltar para a Home
          </Link>
        </div>
      </aside>

      {/* Lado Direito: Mapa */}
      <section className="flex-1 h-full relative">
        <div ref={mapRef} className="w-full h-full bg-zinc-900" />
        
        {selectedCarga && (
          <div className="absolute bottom-6 left-6 right-6 bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-2xl backdrop-blur-md z-10 flex justify-between items-center text-xs max-w-lg">
            <div>
              <h4 className="font-black text-indigo-400 uppercase tracking-widest text-[9px] mb-1">Rota Ativa</h4>
              <p className="font-bold text-white text-sm">{selectedCarga.cd_origem.cidade} $\rightarrow$ {selectedCarga.cd_destino.cidade}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Direções reais calculadas via Google Maps API</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Valor Líquido</span>
              <span className="text-lg font-black text-emerald-400">R$ {Number(selectedCarga.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
