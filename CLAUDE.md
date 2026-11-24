# Kit de vídeo Keyve — instruções para a IA

Este kit é um editor de vídeo **sem painel**: a IA escreve cada vídeo em código (uma cena HTML onde tudo é função do tempo `t`) e o motor renderiza MP4s determinísticos com Playwright + ffmpeg. Três camadas, sempre separadas:

| Camada | Pasta | O que define |
|---|---|---|
| **Motor** | `engine/`, `ferramentas/` | renderização, componentes, preparo de filmagem. Não muda por cliente. |
| **Marca** | `marcas/<cliente>/` | cores, fontes, logo, textos permitidos (`copy.json`), imagens (`midia/`), regras (`MARCA.md`). |
| **Estilo** | `estilos/<nome>/` | jeito de editar: ritmo, molas, legendas, card, transições (`estilo.json` + `ESTILO.md`). |

Cada vídeo escolhe as duas: `createVideo({ marca: 'cliente', estilo: 'keyve', ... })`. O estilo padrão é `estilos/keyve` (o aprovado da Keyve).

## Skills (siga a que couber)
- `marca-nova`: cadastrar a identidade visual de um cliente.
- `estilo-novo`: criar um estilo a partir de um vídeo de referência.
- `video-motion`: criativo animado sem filmagem.
- `video-falado`: editar uma filmagem de alguém falando.
- `trocar-cenario`: partes mudas de até 15 s para IA de vídeo (Flow/Omni) e a volta.
- `revisar-exportar`: revisão quadro a quadro e exportação.

Antes de qualquer vídeo leia: o `MARCA.md` da marca, o `ESTILO.md` do estilo e este arquivo. Decida pelo padrão e não pergunte o que o padrão já resolve.

## Estrutura
```
engine/
  runtime.js      seek(t), spring, track (molas aditivas), keys, expo, motionBlur, cameraAt/applyCamera, createVideo; reexporta M, C, E
  marca.js        carrega marca (M; cores em C) e estilo (E); injeta @font-face e variáveis CSS (--acento, --tinta, --claro, --escuro...)
  base.css        classes: .scene .dark .light .tail .key .cta .capF .capC .notif .row .panel .pill .dotb
  components.js   BrandMark (logo + ponto), Logo, MaskLine, Headline, Phone, Bubble, ImageTile, shape, rectMix
  falado.js       Filmagem, Legendas, cenaFx, Botao, Cursor, Encerramento, Passagem, entra/sai/blurIn/mostra/dentro
  blocos.js       RolaTexto, RolaNumero, Notificacao, Checklist, Escudo, Barras, ICONES
  audio.js        trilha sintetizada (motion: kick/baixo/impactos; falado: bed por seções + sfx)
  render.mjs      renderizador
ferramentas/      checar, novo-video, preparar-falado, sincronizar, cortar-pausas, transcrever, extrair-frames,
                  dividir-partes, juntar-partes, analisar-referencia
videos/_modelo-motion, videos/_modelo-falado, videos/_teste-marca      modelos
exemplos/showreel-keyve-15s                                           exemplo completo de motion
```

## Comandos
```bash
node ferramentas/checar.mjs                                   # confere Node, ffmpeg, Chromium, whisper
node ferramentas/novo-video.mjs <slug> --tipo motion|falado --marca <marca>
node ferramentas/preparar-falado.mjs <filmagem.mp4> videos/<slug> --marca <marca> [--audio voz-limpa.wav]
node engine/render.mjs videos/<slug> --beats        # 1 quadro por batida → out/beats.png (SEMPRE revisar antes do final)
node engine/render.mjs videos/<slug> --frame 7.25   # 1 quadro em resolução cheia
node engine/render.mjs videos/<slug> --preview      # 540x960, rápido
node engine/render.mjs videos/<slug> --estimar      # tempo aproximado de exportação (não renderiza)
node engine/render.mjs videos/<slug> --final        # PADRÃO rápido → out/final.mp4   (--media / --max: mais blur, mais lento)
```
Prévia ao vivo: sirva a raiz do kit (`npx http-server`) e abra `videos/<slug>/scene.html?play` ou `?t=3.2`.

## Contrato da cena (obrigatório)
- Tudo é função de `t` dentro de `render(t)`. Proibido: CSS animation/transition, `setTimeout`/`requestAnimationFrame` para animar, estado entre frames. `render` pode devolver uma Promise (frame de filmagem).
- `setup()` cria o DOM uma vez e mede posições (as fontes já carregaram). `M`, `C` e `E` já estão prontos no setup. Não use no topo do módulo.
- Cores só via `C.*` ou variáveis CSS (`var(--acento)` etc.). Nunca hex fixo de outra marca na cena.
- Texto só da fala (`words.json`) ou de `marcas/<marca>/copy.json`. **Nunca invente números, clientes, depoimentos, preços ou features.**
- Imagens só de `marcas/<marca>/midia/` (via `M.asset('midia/x.webp')`).
- Formato principal 9:16 1080x1920; safe zones topo 250, base 340, laterais 60 (`FORMATS` em `engine/config.js`).
- 30 fps para redes sociais (24 se a filmagem for 24). Exportar no modo rápido salvo pedido contrário.
- Esconda grupos com `display: none`, nunca `visibility`.

## Exportação (sempre assim)
1. **Qualidade padrão = rápida** (`--final`): 1 captura por frame, JPEG q95, x264 veryfast CRF 15, 30 fps, áudio AAC 256k. É a configuração usada nos criativos da Keyve. Comparada ao modo médio, a diferença visual é mínima (SSIM 0,985) e ela é cerca de 35% mais rápida. Use `--media` ou `--max` só se o usuário pedir.
2. **Antes de exportar, informe o tempo aproximado.** Rode `node engine/render.mjs videos/<slug> --estimar` e diga ao usuário numa linha, por exemplo: "Exportando em qualidade rápida, 60 s de vídeo: deve levar ~1 min 55 s." O render também mostra a estimativa (`⏱`) e o progresso com quanto falta. A estimativa se calibra sozinha a cada exportação nessa máquina (`engine/.tempos.json`).
3. Se a estimativa passar de ~2 min, rode a exportação em segundo plano e avise quando terminar.
4. Ao concluir, informe o caminho, a duração, o tamanho e o tempo real (a última linha do render traz tudo).

## Privacidade
Filmagens, vozes e transcrições de clientes ficam em `videos/<slug>/src/` e não devem ir para fora do computador. Não suba essas pastas em repositórios públicos.
