---
name: video-falado
description: Edita um vídeo falado (talking head, pessoa falando para a câmera) no estilo do kit — corta pausas, sincroniza o áudio limpo, transcreve, monta card no canto, cenas claras e escuras, legendas animadas, transições, trilha e CTA com cursor. Use quando o usuário mandar uma filmagem de alguém falando para editar.
---

# Vídeo falado editado

Leia `CLAUDE.md`, o `MARCA.md` e o `ESTILO.md` (padrão `estilos/keyve/ESTILO.md`). O modelo comentado está em `videos/_modelo-falado/scene.html`.

## 1. Preparar (automático)
```bash
node ferramentas/preparar-falado.mjs <filmagem.mp4> videos/<slug> --marca <marca> [--audio <voz-limpa.wav>]
```
- `--audio`: áudio tratado (Adobe Podcast, gravador de lapela). O script mede o atraso, alinha e corta a voz limpa junto com a imagem. Sem ele, usa o som da câmera.
- O script faz: corte das pausas (≥ 0,25 s, respiro de 0,09 s) → `src/video-cortado.mp4` + `src/voz.wav` + `src/edl.json`; frames em `src/frames/` (+ `info.json`); `words.json` (whisper); e `scene.html` a partir do modelo, já com `DUR`, `T_FIM`, `fps` e a voz ligada.
- `--sem-cortes` mantém as pausas. Filmagem acima de 30 fps vira 30; filmagem a 24 fps continua a 24.
- Se a pessoa quiser trocar o cenário com IA (Flow, Omni), use a skill **trocar-cenario** antes de editar.

## 2. Conferir a transcrição
Abra `words.json` e corrija nomes próprios, marcas, preços e termos técnicos (confira com o `copy.json` da marca). Liste ao usuário os trechos duvidosos e pergunte numa mensagem só.

## 3. Storyboard
Em `storyboard.md`, uma linha por frase: tempo, fala, layout e o que acontece. Use o modelo da tabela em `videos/_modelo-falado/scene.html` e estas regras:
- **Abertura:** 0–2,5 s com tela CHEIA (gancho) e push lento.
- **Meio:** frases de dado/problema/solução viram cena com o falante no **CARD**, alternando cenas escuras e claras.
- **Virada da marca:** o falante sai (FORA), `Passagem` abre com o ponto, aparece a assinatura e o nome do produto.
- **Fala de impacto:** tela CHEIA com zoom suave (≤ 1,15×).
- **Fim:** CTA com `Encerramento` (botão → ponto → end card).
- **Proibido:** tela dividida, punch-in brusco, cena parada mais de ~4 s sem mudar algo.

## 4. Construir (`scene.html`)
- **Janelas:** `CARD_WIN` (falante no card), `DARK_WIN` (cenas escuras), `CAP_OFF` (sem legenda quando o grafismo repete a fala), nos tempos de `words.json`.
- **Filmagem:** `track(t, cam.CHEIA(1), moves)` com `cam.CHEIA(z)`, `cam.CARD` e `cam.FORA`; esconda com `cam.mostrar(false)` quando uma cena cobre tudo. Termine o render com `return cam.desenhar(t)`.
- **Cenas:** `.scene.dark` / `.scene.light` com `cenaFx(node, t, entra, sai, { entrada, saida })`.
- **Blocos prontos** (`engine/blocos.js`): `RolaTexto`, `RolaNumero` (preço), `Notificacao`, `Checklist`, `Escudo`, `Barras`, `ICONES`. Sincronize cada elemento com a palavra (tempo de `words.json`).
- **Legendas:** `Legendas(stage, words, { card, escuro, desligar, chaves })` → `leg.render(t)`. As chaves são 1–2 palavras fortes por frase.
- **Som:** `audio.bed.sections` (intensidade 1–3 por trecho) e `sfx`:
  - whoosh em cada transição, 0,06 s antes;
  - pop/tick quando um elemento de UI entra;
  - impact e riser nas viradas;
  - inclua `...S.fim.sfx` nos sfx (some só se o fecho mudar).
  `voice` já vem configurado: ducking da trilha e -14 LUFS.
- **Textos na tela:** só a fala ou o `copy.json`. Nunca números, clientes ou promessas inventadas.

## 5. Revisar e exportar
Skill **revisar-exportar**: `--beats --step 1` em todo o vídeo e `--frame` nas transições, depois `--final` (rápido).
