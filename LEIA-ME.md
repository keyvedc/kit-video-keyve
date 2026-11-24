# Kit de vídeo Keyve

Um editor de vídeo sem painel: você conversa com a IA e ela monta, revisa e exporta o vídeo. Ele faz criativos animados e edita vídeos de alguém falando para a câmera, com o estilo de edição da Keyve:
- corte das pausas;
- falante num card no canto;
- cenas claras e escuras;
- legendas que vão do desfoque ao foco;
- trilha e efeitos sonoros;
- botão de CTA com cursor clicando.

Você troca a **marca** (cores, fontes, logo, textos) e, se quiser, o **estilo** de edição. O resto é igual para qualquer cliente.

---

## 1. O que você precisa

| Item | Para quê | Como instalar |
|---|---|---|
| Uma IA que roda comandos | ser o editor | [Claude Code](https://claude.com/claude-code) (recomendado), ou Codex / Cursor |
| Node.js 18+ | motor | https://nodejs.org |
| ffmpeg | vídeo e áudio | macOS: `brew install ffmpeg` · Windows: `winget install Gyan.FFmpeg` · Linux: `sudo apt install ffmpeg` |
| whisper.cpp *(opcional)* | legendas de vídeo falado | macOS: `brew install whisper-cpp` + o modelo (o `checar` mostra o comando) |

## 2. Instalar (uma vez)

Descompacte a pasta, abra um terminal dentro dela e rode:

```bash
npm run instalar
```

```bash
npm run checar
```

O `checar` mostra ✓ ou ✗ para cada item e o comando que resolve o que faltar.

## 3. Usar

Abra a pasta do kit no Claude Code (ou na sua IA) e peça em português. A IA lê as instruções (`CLAUDE.md`) e as skills sozinha. Exemplos:

- **Marca de um cliente:** "Cadastra a marca da Padaria Pão Bom. O site é padariapaobom.com.br e o logo está em ~/Downloads/logo.svg."
- **Vídeo animado:** "Faz um criativo de 15 s para Reels da Padaria Pão Bom divulgando o café da manhã."
- **Vídeo falado:** "Edita esse vídeo no estilo Keyve: ~/Downloads/gravacao.mp4. O áudio tratado está em ~/Downloads/voz.wav."
- **Trocar o cenário:** "Quero trocar o fundo desse vídeo no Flow. Prepara as partes."
- **Estilo novo:** "Quero editar parecido com esse vídeo de referência: ~/Downloads/referencia.mp4."
- **Exportar:** "Exporta o final."

Antes de exportar, a IA sempre gera uma folha com um quadro por batida (`out/beats.png`) e corrige o que estiver errado. O vídeo final sai em `videos/<nome>/out/final.mp4` (1080x1920, 30 fps, pronto para Reels, TikTok e Shorts).

## 4. Como a identidade do cliente entra

Cada cliente é uma pasta em `marcas/`:

```
marcas/padaria-pao-bom/
  marca.json    cores, fontes, logo, raio
  copy.json     textos permitidos (a IA não inventa nada fora daqui)
  MARCA.md      regras e tom da marca
  fontes/       arquivos .woff2
  logos/        wordmark.svg
  midia/        fotos e imagens do cliente
```

Você não precisa preencher à mão: mande à IA o site, o manual de marca, o logo e as fotos, e peça "cadastra a marca". Ela monta a pasta e gera um **teste de marca** (`videos/_teste-marca`) para você aprovar antes do primeiro vídeo.

## 5. Estilos de edição

`estilos/keyve/` é o estilo aprovado da Keyve. Para editar de outro jeito, mande um vídeo de referência e peça um estilo novo. A IA analisa os cortes, o ritmo, as legendas e os layouts e cria `estilos/<nome>/`. Marca e estilo são independentes: qualquer marca funciona com qualquer estilo.

## 6. Estrutura

```
CLAUDE.md / AGENTS.md   instruções para a IA
.claude/skills/         fluxos: marca-nova, estilo-novo, video-motion, video-falado, trocar-cenario, revisar-exportar
engine/                 motor (render, componentes, legendas, filmagem, áudio)
ferramentas/            preparo: sincronia, corte de pausas, transcrição, frames, partes para IA de vídeo
marcas/                 keyve (exemplo completo) e _modelo (em branco)
estilos/                keyve (padrão) e _modelo
videos/                 seus vídeos + modelos (_modelo-motion, _modelo-falado, _teste-marca)
exemplos/               showreel-keyve-15s
```

## 7. Perguntas comuns

- **Quanto tempo leva para exportar?** Antes de exportar, a IA avisa o tempo aproximado, e durante a exportação aparece quanto falta. Num Mac de 8 núcleos, no modo rápido (padrão): um vídeo falado de 60 s leva cerca de 1 min 45 s e um animado de 15 s, uns 20 s. A estimativa aprende com o seu computador a cada exportação. Para ver sem exportar: `node engine/render.mjs videos/<nome> --estimar`.
- **Qual qualidade sai?** A rápida, a mesma dos criativos da Keyve: 1080x1920, 30 fps, H.264 CRF 15, visualmente igual à qualidade média e cerca de 35% mais rápida. `--media` e `--max` existem para quem quiser mais desfoque de movimento.
- **Funciona no Windows?** Sim, com Node, ffmpeg e Chromium (o `npm run instalar` baixa o Chromium).
- **Meus vídeos saem da minha máquina?** Não. Tudo roda localmente. Só a IA que você usa recebe o que você conversa com ela.
- **Posso usar a marca da Keyve nos meus vídeos?** Não. Ela está no kit como exemplo. Veja `LICENCAS.md`.

Feito pela [Keyve](https://keyve.io): tecnologia que abre portas.
