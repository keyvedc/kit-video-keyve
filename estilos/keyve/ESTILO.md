# Estilo Keyve — edição dinâmica e limpa

O estilo define **como o vídeo se move e é editado**. As cores, fontes e logo vêm da **marca** (`marcas/<cliente>/`), então este estilo serve para qualquer cliente. Valores ajustáveis em `estilo.json`.

## Ritmo
- 120 BPM (batida = 0,5 s). Algo muda em toda batida. Cena de motion = 1 compasso (2 s).
- Nenhum quadro parado por mais de 0,5 s. Em vídeo falado, a cena muda a cada frase.
- Exportação a 30 fps (24 se a filmagem for 24). Modo rápido por padrão.

## Movimento
- Tudo é função de `t` dentro de `render(t)`. Proibido: CSS animation/transition, timers, estado entre frames.
- Molas com overshoot pequeno (`E.mola`); expo para cortes rápidos. Nada aparece do nada: cresce, desdobra, é revelado por máscara ou vai do desfoque ao foco.
- **Objeto-condutor:** o ponto da marca (o "." da assinatura) atravessa o vídeo, muda de papel em cada cena e termina na assinatura.
- Câmera única: push 1,00→1,04 por cena (`cameraAt` com `cuts`). Zoom de foco suave via `focus`.
- Texto que sai e texto que entra têm tempos separados (`Headline`/`MaskLine` já fazem isso).
- **Proibido:** partículas, glow, lens flare, camera shake, RGB split, crossfade, bounce, cara de template.

## Vídeo falado (talking head)
- **Cortes de pausa:** remover pausas ≥ 0,25 s deixando 0,09 s de respiro (`ferramentas/preparar-falado.mjs`).
- **Layouts:** tela CHEIA (push lento, zoom máx. ~1,15×, nunca punch-in brusco) · **CARD** vertical no canto inferior direito com o grafismo ocupando a tela (nunca tela dividida) · GRÁFICO sem o falante (card desce para FORA).
- **Cenas:** alternar claras (`fundo_claro`) e escuras (`fundo_escuro` com luz do acento). Cada frase forte vira uma cena: número que rola, notificação, checklist que liga no tempo da fala, preço contador, escudo/ícone desenhado.
- **Transições:** zoom + desfoque (padrão) e push vertical. Nas viradas de marca, o ponto abre a tela (`Passagem`) e fecha no ponto da assinatura.
- **Legendas:** em tela cheia, até 3 palavras, palavra a palavra do desfoque ao foco, palavras-chave na fonte da cauda com sublinhado no acento. Com o card, bloco à esquerda que acende de apagado para cheio. Desligadas quando o grafismo já repete a fala.
- **Fecho:** botão de CTA no acento com seta, cursor de site clicando, o botão encolhe e vira o ponto, abre o end card claro com a assinatura, linha, botão, site e o cursor clica de novo (`Encerramento`).
- **Som:** trilha por seções + whoosh nas transições, pop/tick nos elementos de UI, impacto e riser nas viradas, voz limpa com ducking, normalizado a -14 LUFS.

## Formato e leitura (9:16)
- 1080x1920. Safe zones: topo 250 px, base 340 px, laterais 60 px.
- Headline: L1 92 px em y=290; L2 (cauda) 100 px em y=392; `maxWidth: 940` faz auto-ajuste.
- Legenda cheia em y=1268; legenda do card com base em y=1548; card em x=690, y=975, 330x586.

## Armadilhas
- Meça posições no `setup` (câmera em identidade) para match cuts; nunca chute coordenadas de texto.
- Forma que vira fundo passa dos 4 cantos (≥ 200 px de sobra) para aguentar o zoom.
- Nunca `will-change` em nada que a câmera escala (texto borra).
- Esconda grupos com `display: none`, nunca `visibility` (filhos com `visibility: visible` continuam aparecendo).
- Trocas 2D↔3D só no instante em que os dois coincidem exatamente.
- Em 3D, use `backface-visibility: hidden` em cards que giram (senão aparece texto espelhado).
