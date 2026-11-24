---
name: video-motion
description: Cria um criativo animado sem filmagem (anúncio, showreel, vídeo de serviço ou produto, Reels/Stories) com a marca e o estilo do kit. Use para pedidos de vídeo animado, motion, vinheta, showreel ou criativo com texto e grafismo.
---

# Vídeo motion (sem filmagem)

Leia `CLAUDE.md`, o `MARCA.md` da marca e o `ESTILO.md` do estilo antes de tudo. Decida pelo padrão e não pergunte o que o padrão resolve.

1. **Brief:** marca (`marcas/<slug>`), produto/serviço, duração (padrão 15 s = 30 batidas), formato (padrão 9:16) e CTA. Todo texto sai de `marcas/<slug>/copy.json`. Se faltar um fato (preço, número), pergunte; nunca invente.
2. **Criar a pasta:** `node ferramentas/novo-video.mjs <slug> --tipo motion --marca <marca>`.
3. **Objeto-condutor:** diga numa linha qual é. Padrão: o ponto da marca. Ele começa na UI ou numa palavra, muda de papel a cada cena e termina no ponto da assinatura (`BrandMark(...).dotRect`).
4. **Storyboard:** `storyboard.md` batida a batida (batida, t, o que acontece, o que o ponto vira). Estrutura:
   - compasso 1 = hook (o problema em 3–5 palavras);
   - meio = 1 ideia legível por compasso;
   - último compasso cheio = momento mais forte (riser);
   - meio compasso final = assinatura + tagline (frame final = frame inicial, para loop).
5. **Construir** em `scene.html`:
   - `setup()` cria o DOM e mede posições; `render(t)` define todos os estilos a partir de `t`;
   - o ponto é um único `#dot` movido por `track(t, inicio, moves)`;
   - componentes: `Headline`, `MaskLine`, `BrandMark`, `Phone`, `Bubble`, `ImageTile`, `shape` (`engine/components.js`) e os blocos de `engine/blocos.js`;
   - som: `audio: { hits, big, riser, ticks }`.
   Exemplo completo: `exemplos/showreel-keyve-15s/`.
6. **Revisar e exportar:** skill **revisar-exportar**.
