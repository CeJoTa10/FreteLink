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

export default function CDDashboard() {
  useEffect(() => {
    window.location.replace('/dashboard/centro-distribuicao');
  }, []);

  const [cargas, setCargas] = useState<Carga[]>([]);
  const [cds, setCds] = useState<CentroDistribuicao[]>([]);
  const [selectedCarga, setSelectedCarga] = useState<Carga | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingCoords, setTrackingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simIntervalId, setSimIntervalId] = useState<NodeJS.Timeout | null>(null);

  // States para Modais de Cadastro
  const [showCdModal, setShowCdModal] = useState(false);
  const [showCargaModal, setShowCargaModal] = useState(false);

  // Form de CD
  const [newCd, setNewCd] = useState({
    nome: '',
    estado: '',
    cidade: '',
    endereco_completo: '',
    lat: '',
    lng: '',
  });

  // Form de Carga
  const [newCarga, setNewCarga] = useState({
    descricao: '',
    valor_frete: '',
    cd_origem_id: '',
    cd_destino_id: '',
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const truckMarker = useRef<google.maps.Marker | null>(null);
  const originMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const routePolyline = useRef<google.maps.Polyline | null>(null);

  // 1. Buscar cargas e CDs
  const fetchCargasAndCds = async () => {
    setLoading(true);
    
    // Buscar CDs
    const { data: cdsData, error: cdsError } = await supabase
      .from('centros_distribuicao')
      .select('*');

    if (cdsError) {
      console.error('Erro ao buscar CDs:', cdsError);
    } else {
      setCds(cdsData || []);
    }

    // Buscar Cargas
    const { data: cargasData, error: cargasError } = await supabase
      .from('cargas')
      .select(`
        id,
        descricao,
        valor_frete,
        status,
        motorista_id,
        cd_origem:centros_distribuicao!cd_origem_id (id, nome, estado, cidade, lat, lng),
        cd_destino:centros_distribuicao!cd_destino_id (id, nome, estado, cidade, lat, lng)
      `);

    if (cargasError) {
      console.error('Erro ao buscar cargas:', cargasError);
    } else {
      const mappedCargas = (cargasData || []) as unknown as Carga[];
      setCargas(mappedCargas);
      if (mappedCargas.length > 0 && !selectedCarga) {
        setSelectedCarga(mappedCargas[0]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCargasAndCds();
  }, []);

  const [mapReady, setMapReady] = useState(false);

  // 2. Inicializar o Google Maps usando o Script global
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    function initMap() {
      if (!mapRef.current || googleMap.current) return;

      const google = window.google;
      googleMap.current = new google.maps.Map(mapRef.current, {
        center: { lat: -23.561684, lng: -46.655981 }, // SP por padrão
        zoom: 7,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#212121' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#747474' }] },
          { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
          { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] }
        ],
        disableDefaultUI: false,
      });
      setMapReady(true);
    }

    if (typeof window !== 'undefined') {
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
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      setMapReady(false);
      googleMap.current = null;
      if (originMarker.current) originMarker.current.setMap(null);
      if (destMarker.current) destMarker.current.setMap(null);
      if (truckMarker.current) truckMarker.current.setMap(null);
      if (routePolyline.current) routePolyline.current.setMap(null);
    };
  }, []);;

  // 3. Atualizar mapa com base na Carga Selecionada
  useEffect(() => {
    if (!mapReady || !selectedCarga || !googleMap.current) return;

    const google = window.google;
    const map = googleMap.current;

    // Limpar marcadores anteriores
    if (originMarker.current) originMarker.current.setMap(null);
    if (destMarker.current) destMarker.current.setMap(null);
    if (routePolyline.current) routePolyline.current.setMap(null);

    const orig = selectedCarga.cd_origem;
    const dest = selectedCarga.cd_destino;

    // Criar marcador de Origem (CD)
    originMarker.current = new google.maps.Marker({
      position: { lat: orig.lat, lng: orig.lng },
      map: map,
      title: orig.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#10b981', // Verde
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 10,
      },
    });

    // Criar marcador de Destino (CD)
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
        scale: 10,
      },
    });

    // Desenhar Rota Teórica (Linha tracejada)
    routePolyline.current = new google.maps.Polyline({
      path: [
        { lat: orig.lat, lng: orig.lng },
        { lat: dest.lat, lng: dest.lng },
      ],
      geodesic: true,
      strokeColor: '#6366f1',
      strokeOpacity: 0.5,
      strokeWeight: 3,
      map: map,
    });

    // Ajustar zoom para enquadrar origem e destino
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(orig.lat, orig.lng));
    bounds.extend(new google.maps.LatLng(dest.lat, dest.lng));
    map.fitBounds(bounds);

    // Buscar rastreamento inicial se a carga estiver em trânsito
    if (selectedCarga.status === 'em_transito') {
      supabase
        .from('rastreamento_ativo')
        .select('lat, lng')
        .eq('carga_id', selectedCarga.id)
        .single()
        .then(({ data }) => {
          if (data) {
            updateTruckMarker(data.lat, data.lng);
          }
        });
    } else {
      if (truckMarker.current) {
        truckMarker.current.setMap(null);
        truckMarker.current = null;
      }
      setTrackingCoords(null);
    }
  }, [selectedCarga]);

  // Função auxiliar para atualizar/criar marcador do caminhão
  const updateTruckMarker = (lat: number, lng: number) => {
    if (!googleMap.current) return;
    const google = window.google;
    const map = googleMap.current;

    setTrackingCoords({ lat, lng });

    if (truckMarker.current) {
      truckMarker.current.setPosition({ lat, lng });
    } else {
      truckMarker.current = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: 'Caminhoneiro em Trânsito',
        icon: {
          path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z', // SVG de caminhão
          fillColor: '#f59e0b', // Amber
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#ffffff',
          scale: 1.5,
          anchor: new google.maps.Point(12, 12),
        },
      });
    }
  };

  // 4. Conectar Supabase Realtime
  useEffect(() => {
    if (!selectedCarga || selectedCarga.status !== 'em_transito') return;

    const subscription = supabase
      .channel(`realtime-cargas-${selectedCarga.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rastreamento_ativo',
          filter: `carga_id=eq.${selectedCarga.id}`,
        },
        (payload) => {
          const newRecord = payload.new as { lat: number; lng: number };
          if (newRecord && newRecord.lat && newRecord.lng) {
            updateTruckMarker(newRecord.lat, newRecord.lng);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedCarga]);

  // 5. Simular Viagem
  const toggleSimulation = async () => {
    if (!selectedCarga || selectedCarga.status !== 'em_transito') {
      alert('Selecione uma carga "Em Trânsito" para simular.');
      return;
    }

    if (simulating) {
      if (simIntervalId) clearInterval(simIntervalId);
      setSimulating(false);
      return;
    }

    setSimulating(true);
    const orig = selectedCarga.cd_origem;
    const dest = selectedCarga.cd_destino;

    let progress = 0;
    const steps = 30;

    const interval = setInterval(async () => {
      progress += 1;
      const ratio = progress / steps;

      const lat = orig.lat + (dest.lat - orig.lat) * ratio;
      const lng = orig.lng + (dest.lng - orig.lng) * ratio;

      await supabase.from('rastreamento_ativo').upsert({
        carga_id: selectedCarga.id,
        motorista_id: '7a27407a-4241-4c84-99a0-0377254a5e0d',
        lat,
        lng,
        ultima_atualizacao: new Date().toISOString(),
      });

      if (progress >= steps) {
        clearInterval(interval);
        setSimulating(false);
        alert('Simulação concluída!');
      }
    }, 1500);

    setSimIntervalId(interval);
  };

  // 6. Enviar cadastro de CD com geocodificação automática
  const handleCdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!window.google || !window.google.maps) {
      alert('A API de Mapas ainda não foi carregada. Tente novamente em instantes.');
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    const queryAddress = `${newCd.endereco_completo}, ${newCd.cidade}, ${newCd.estado}, Brazil`;

    geocoder.geocode({ address: queryAddress }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const latVal = loc.lat();
        const lngVal = loc.lng();

        const { error } = await supabase
          .from('centros_distribuicao')
          .insert({
            id: crypto.randomUUID(),
            nome: newCd.nome,
            estado: newCd.estado.toUpperCase(),
            cidade: newCd.cidade,
            endereco_completo: results[0].formatted_address || newCd.endereco_completo,
            lat: latVal,
            lng: lngVal,
          });

        if (error) {
          alert('Erro ao cadastrar CD: ' + error.message);
        } else {
          alert('Centro de Distribuição cadastrado com sucesso!');
          setShowCdModal(false);
          setNewCd({ nome: '', estado: '', cidade: '', endereco_completo: '', lat: '', lng: '' });
          fetchCargasAndCds();
        }
      } else {
        alert(`Não foi possível geocodificar o endereço. Status: ${status}`);
      }
    });
  };

  // 7. Enviar nova carga
  const handleCargaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(newCarga.valor_frete);

    if (isNaN(valorNum)) {
      alert('Insira um valor de frete válido.');
      return;
    }

    if (!newCarga.cd_origem_id || !newCarga.cd_destino_id) {
      alert('Selecione os CDs de origem e destino.');
      return;
    }

    const { error } = await supabase
      .from('cargas')
      .insert({
        cd_origem_id: newCarga.cd_origem_id,
        cd_destino_id: newCarga.cd_destino_id,
        descricao: newCarga.descricao,
        valor_frete: valorNum,
        status: 'pendente',
      });

    if (error) {
      alert('Erro ao publicar carga: ' + error.message);
    } else {
      alert('Nova carga publicada com sucesso!');
      setShowCargaModal(false);
      setNewCarga({ descricao: '', valor_frete: '', cd_origem_id: '', cd_destino_id: '' });
      fetchCargasAndCds();
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden">
      
      {/* Lado Esquerdo: Gerenciamento */}
      <aside className="w-[40%] border-r border-zinc-800 flex flex-col bg-zinc-900/60 backdrop-blur-md">
        <header className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-bold tracking-wider">PAINEL DO CD</h1>
            </div>
            <a href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">Voltar à Home</a>
          </div>
          
          {/* Botões de Ação Rápida */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowCdModal(true)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2 px-3 rounded text-xs border border-zinc-700 transition-colors"
            >
              + Cadastrar CD
            </button>
            <button
              onClick={() => setShowCargaModal(true)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-2 px-3 rounded text-xs transition-colors"
            >
              + Publicar Carga
            </button>
          </div>
        </header>

        {/* Lista de Cargas */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Cargas Ativas</h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="text-sm text-zinc-500">Buscando informações...</span>
            </div>
          ) : cargas.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-12">Nenhuma carga cadastrada.</div>
          ) : (
            cargas.map((carga) => (
              <div
                key={carga.id}
                onClick={() => setSelectedCarga(carga)}
                className={`p-5 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedCarga?.id === carga.id
                    ? 'bg-zinc-800/80 border-indigo-500'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-white block truncate max-w-[200px]">
                    {carga.descricao}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded ${
                      carga.status === 'em_transito'
                        ? 'bg-amber-500/20 text-amber-400'
                        : carga.status === 'pendente'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {carga.status === 'em_transito' ? 'em trânsito' : carga.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mt-3 border-t border-zinc-800/60 pt-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Origem</span>
                    <span className="font-semibold text-zinc-300">
                      {carga.cd_origem?.cidade || 'Indefinido'} - {carga.cd_origem?.estado || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Destino</span>
                    <span className="font-semibold text-indigo-400">
                      {carga.cd_destino?.cidade || 'Indefinido'} - {carga.cd_destino?.estado || ''}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/40 text-xs">
                  <span className="text-zinc-500">Frete:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    R$ {Number(carga.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))
          )}
        </main>

        {/* Detalhes da Carga */}
        {selectedCarga && (
          <footer className="p-6 border-t border-zinc-800 bg-zinc-950/40 space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1">Carga Selecionada</h3>
              <p className="text-sm font-semibold">{selectedCarga.descricao}</p>
            </div>

            {selectedCarga.status === 'em_transito' && (
              <div className="p-4 rounded bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400 font-bold">Rastreamento Conectado</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                {trackingCoords ? (
                  <p className="text-xs text-zinc-400">
                    Posição: <span className="font-mono text-zinc-300">{trackingCoords.lat.toFixed(5)}, {trackingCoords.lng.toFixed(5)}</span>
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500">Aguardando coordenadas...</p>
                )}
                
                <button
                  onClick={toggleSimulation}
                  className={`w-full py-2.5 px-4 rounded text-xs font-bold transition-all duration-200 ${
                    simulating
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-black'
                  }`}
                >
                  {simulating ? 'Parar Simulação' : 'Simular Viagem em Tempo Real'}
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>

      {/* Lado Direito: Mapa */}
      <section className="w-[60%] h-full relative">
        <div ref={mapRef} className="w-full h-full bg-zinc-900" />
        
        <div className="absolute top-6 right-6 bg-zinc-900/90 border border-zinc-800 p-4 rounded-md shadow-2xl backdrop-blur-sm z-10 space-y-2 text-xs">
          <h4 className="font-bold text-white tracking-wide">LEGENDA</h4>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block border border-white" />
            <span className="text-zinc-300">CD Origem</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-indigo-500 inline-block border border-white" />
            <span className="text-zinc-300">CD Destino</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-amber-500 inline-block border border-white" />
            <span className="text-zinc-300">Caminhão</span>
          </div>
        </div>
      </section>

      {/* MODAL 1: Cadastro de CD */}
      {showCdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md p-6 rounded-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Cadastrar Centro de Distribuição</h3>
            <form onSubmit={handleCdSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Nome do CD</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CD Logística Campinas"
                  value={newCd.nome}
                  onChange={(e) => setNewCd({ ...newCd, nome: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1 font-semibold">Cidade</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Campinas"
                    value={newCd.cidade}
                    onChange={(e) => setNewCd({ ...newCd, cidade: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 font-semibold">Estado (UF)</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="Ex: SP"
                    value={newCd.estado}
                    onChange={(e) => setNewCd({ ...newCd, estado: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Endereço Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Rua, Número - Bairro"
                  value={newCd.endereco_completo}
                  onChange={(e) => setNewCd({ ...newCd, endereco_completo: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCdModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-2 px-4 rounded"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Publicar Carga */}
      {showCargaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md p-6 rounded-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Publicar Nova Carga</h3>
            <form onSubmit={handleCargaSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Descrição da Carga</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carga de milho ensacado - 12 toneladas"
                  value={newCarga.descricao}
                  onChange={(e) => setNewCarga({ ...newCarga, descricao: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Valor do Frete (R$)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 4200.00"
                  value={newCarga.valor_frete}
                  onChange={(e) => setNewCarga({ ...newCarga, valor_frete: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Centro de Distribuição Origem</label>
                <select
                  required
                  value={newCarga.cd_origem_id}
                  onChange={(e) => setNewCarga({ ...newCarga, cd_origem_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {cds.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.nome} ({cd.cidade} - {cd.estado})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-semibold">Centro de Distribuição Destino</label>
                <select
                  required
                  value={newCarga.cd_destino_id}
                  onChange={(e) => setNewCarga({ ...newCarga, cd_destino_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {cds.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.nome} ({cd.cidade} - {cd.estado})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCargaModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-2 px-4 rounded"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
