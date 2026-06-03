# Frete Link - Regras do Jogo

Este arquivo define as regras inegociáveis para o desenvolvimento do Frete Link. Siga estas diretrizes em todos os momentos:

1. **Uso Restrito de Animações (Lenis/GSAP):**
   - **Toda animação da Landing Page** usa Lenis no scroll e GSAP no movimento.
   - O Dashboard do Centro de Distribuição (CD) e a tela do Caminhoneiro (Mobile) **NÃO usam Lenis** para evitar qualquer conflito com a API do Google Maps.

2. **Lógica Backend e Edge Functions:**
   - O backend para lógicas pesadas rodará em **Node.js** usando as **Edge Functions do Supabase**. Não concentre processamentos intensos nas rotas da API do Next.js se puderem ser otimizados via Edge Functions.

3. **Performance e Precisão:**
   - A Landing Page é um "show": as animações devem ser imersivas, cinematográficas e intencionalmente mais longas (mínimo de 0.6s de duração, eases como `power3` ou `expo`).
   - As interfaces logísticas (Dashboard do CD e Mobile do Caminhoneiro) são "ferramentas de precisão": zero distrações animadas que interfiram na usabilidade. A interface do mapa e rastreamento deve fluir perfeitamente sem travamentos.
