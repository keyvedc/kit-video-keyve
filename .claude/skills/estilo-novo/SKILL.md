---
name: estilo-novo
description: Cria um estilo de edição novo (ritmo, legendas, layouts, transições) a partir de vídeos de referência ou de uma descrição, em estilos/<nome>/. Use quando o usuário mandar um vídeo de referência, disser "quero nesse estilo", "edita igual a esse" ou pedir um jeito de editar diferente do estilo Keyve.
---

# Criar um estilo de edição

O estilo é **como** o vídeo se move. A marca é **com o que** ele se veste. Um estilo serve para várias marcas.

1. **Analisar a referência** (se houver vídeo):
   ```bash
   node ferramentas/analisar-referencia.mjs <referencia.mp4> estilos/<nome>/referencia
   ```
   Leia `relatorio.json` (cortes, plano médio, loudness) e abra `quadros.png` e `paleta.png`. Descreva o que vê: layout do falante, tamanho, posição e animação da legenda, tipo de transição, densidade de grafismos e se há zoom no rosto. A paleta da referência é da marca **dela**: não copie as cores para o estilo.
2. **Escrever** `estilos/<nome>/` a partir de `estilos/_modelo/`:
   - `estilo.json`: `bpm` (plano médio ≈ 1–2 batidas), `mola` (mais dura = mais seco; mais mole = mais fluido), `legenda.cheia`/`legenda.card` (tamanho, y, palavras por grupo), `card` (posição e tamanho do falante), `transicao`, `pausas`.
   - `ESTILO.md`: as regras em tópicos, no formato de `estilos/keyve/ESTILO.md`, com o que é proibido.
   - Se a referência tiver algo que o motor ainda não faz (ex.: legenda em caixa, tela dividida), escreva o componente na cena ou em `engine/` e documente no ESTILO.md.
3. **Testar**: rode um vídeo de teste com `createVideo({ estilo: '<nome>' })` (ou `"estilo"` no `marca.json`) e revise com `--beats`. Compare lado a lado com `quadros.png`.
4. Não copie a referência literalmente (marca, textos, personagens, música). Extraia o **jeito** de editar.
