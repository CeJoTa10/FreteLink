'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Inicializar Lenis para Scroll Suave
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out ease
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 2. Animação de Reveal com GSAP (Tensão de 0.8s)
    const title = titleRef.current;
    if (title) {
      // Dividir o texto em palavras para animar uma a uma
      const words = title.innerText.split(' ');
      title.innerHTML = words
        .map(
          (word) =>
            `<span class="inline-block overflow-hidden"><span class="word-span inline-block translate-y-[110%] transition-transform duration-300">${word}</span></span>`
        )
        .join(' ');

      const wordSpans = title.querySelectorAll('.word-span');

      const tl = gsap.timeline({ delay: 0.8 }); // Tensão de 0.8s

      // Revelar o título com efeito de slide up
      tl.to(wordSpans, {
        y: '0%',
        duration: 1.0,
        stagger: 0.15,
        ease: 'power4.out',
      });

      // Revelar subtítulo e CTAs
      tl.to(
        subtitleRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
        },
        '-=0.4'
      );

      tl.to(
        ctaRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
        },
        '-=0.6'
      );

      // Mostrar o scroll indicator
      tl.to(
        scrollIndicatorRef.current,
        {
          opacity: 0.7,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
        },
        '-=0.4'
      );
    }

    // 3. ScrollTrigger para sumir com o Scroll Indicator ao descer a página
    if (scrollIndicatorRef.current) {
      gsap.to(scrollIndicatorRef.current, {
        opacity: 0,
        y: 20,
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: '100px top',
          scrub: true,
        },
      });
    }

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div ref={heroRef} className="relative min-h-screen bg-black text-white overflow-hidden font-sans select-none">
      
      {/* 1. Background Video de Rodovia Escura em Loop */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute min-w-full min-h-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-cover opacity-45 scale-[1.05] filter brightness-[0.4] contrast-[1.1] saturate-[0.8]"
        >
          <source
            src="https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054ba2011c34f0e755333f27b9972ac&profile_id=139&oauth2_token_id=57447761"
            type="video/mp4"
          />
        </video>
        {/* Overlays para aumentar o clima cinematográfico e dar profundidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000000_100%)] opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.8),transparent_20%,transparent_80%,rgba(0,0,0,0.8))]" />
      </div>

      {/* 2. Header / Navbar */}
      <header className="absolute top-0 left-0 w-full z-20 px-8 py-6 flex items-center justify-between border-b border-white/5 backdrop-blur-[4px]">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-500 bg-clip-text text-transparent">
            FRETE LINK
          </span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <nav className="hidden md:flex space-x-8 text-sm font-medium text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors duration-200">Soluções</a>
          <a href="#about" className="hover:text-white transition-colors duration-200">Tecnologia</a>
          <a href="#security" className="hover:text-white transition-colors duration-200">Segurança</a>
        </nav>
        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="text-xs tracking-wider uppercase border border-white/10 hover:border-white/30 px-4 py-2.5 rounded bg-white/5 hover:bg-white/10 transition-all duration-300"
          >
            Acessar Sistema
          </Link>
          <Link
            href="/cadastro"
            className="text-xs tracking-wider uppercase bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2.5 rounded shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300"
          >
            Criar Cadastro
          </Link>
        </div>
      </header>

      {/* 3. Hero Content */}
      <div className="relative z-10 flex flex-col justify-center items-center min-h-screen text-center px-4 max-w-5xl mx-auto">
        <span className="text-xs md:text-sm font-bold tracking-[0.25em] text-emerald-400 uppercase mb-4 opacity-80">
          SaaS Logístico Interestadual de Alta Precisão
        </span>
        
        {/* Título com Reveal Animado */}
        <h1
          ref={titleRef}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-4xl"
        >
          O elo definitivo entre a carga e o destino
        </h1>

        {/* Subtítulo */}
        <p
          ref={subtitleRef}
          className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 opacity-0 translate-y-6"
        >
          Conectamos Centros de Distribuição a motoristas interestaduais. Monitoramento inteligente em tempo real e rotas precisas até a doca de destino.
        </p>

        {/* CTAs */}
        <div
          ref={ctaRef}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto opacity-0 translate-y-6"
        >
          <Link
            href="/login"
            className="group relative flex items-center justify-center space-x-2 bg-white text-black font-bold px-8 py-4 rounded-md overflow-hidden transition-all duration-350 hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity duration-350" />
            <span>Área do CD (Lançar Cargas)</span>
            <svg
              className="h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center space-x-2 border border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-800/80 px-8 py-4 rounded-md backdrop-blur-sm transition-all duration-300"
          >
            <span>Área do Motorista (Buscar Fretes)</span>
          </Link>
        </div>
      </div>

      {/* 4. Scroll Indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center space-y-2 opacity-0 translate-y-6"
      >
        <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">Role para ver mais</span>
        <div className="h-9 w-5 rounded-full border-2 border-zinc-700 flex justify-center p-1.5">
          <div className="h-2 w-1 rounded-full bg-emerald-500 animate-bounce" />
        </div>
      </div>

      {/* Seção de Features apenas para dar contexto de Scroll e provar o Lenis */}
      <section id="features" className="relative z-10 min-h-screen bg-zinc-950 border-t border-white/5 py-32 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-lg bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm hover:border-emerald-500/20 transition-colors duration-300">
            <span className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 block">01 / RASTREAMENTO</span>
            <h3 className="text-xl font-bold mb-3 text-white">Tempo Real Preciso</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              O motorista compartilha sua geolocalização e as coordenadas são transmitidas via Supabase Realtime instantaneamente para o painel do CD.
            </p>
          </div>
          <div className="p-8 rounded-lg bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm hover:border-emerald-500/20 transition-colors duration-300">
            <span className="text-indigo-400 font-mono text-xs uppercase tracking-wider mb-2 block">02 / PARA O MOTORISTA</span>
            <h3 className="text-xl font-bold mb-3 text-white">Navegação até a Doca</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Interface mobile otimizada com Google Maps Directions guiando o caminhoneiro até a doca correta de destino.
            </p>
          </div>
          <div className="p-8 rounded-lg bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm hover:border-emerald-500/20 transition-colors duration-300">
            <span className="text-teal-400 font-mono text-xs uppercase tracking-wider mb-2 block">03 / CONEXÃO DIRETA</span>
            <h3 className="text-xl font-bold mb-3 text-white">Sem Intermediários</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Negociação de frete ágil diretamente com o Centro de Distribuição do estado de origem ao destino final.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
