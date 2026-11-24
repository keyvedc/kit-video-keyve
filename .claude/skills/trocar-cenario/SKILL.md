---
name: trocar-cenario
description: Prepara uma filmagem para trocar o cenário/fundo em IA de vídeo (Google Flow, Omni, Veo, Runway) — corta pausas, divide em partes mudas de até 15 s — e depois junta as partes editadas de volta, mantendo a voz original. Use quando o usuário quiser mudar o fundo, o ambiente ou o cenário de um vídeo falado.
---

# Trocar o cenário com IA de vídeo

As IAs de vídeo aceitam clipes curtos (≈ 15 s) e costumam recusar ou alterar clipes com fala. Por isso: cortar as pausas, dividir em partes **mudas** e, na volta, usar só a imagem. A voz continua sendo a do corte original.

1. **Preparar** (corta as pausas, sincroniza a voz limpa, frames e transcrição):
   ```bash
   node ferramentas/preparar-falado.mjs <filmagem.mp4> videos/<slug> --marca <marca> [--audio voz-limpa.wav]
   ```
2. **Dividir** em partes ≤ 15 s, cortando nas emendas das pausas:
   ```bash
   node ferramentas/dividir-partes.mjs videos/<slug>/src/video-cortado.mp4 videos/<slug>/partes --edl videos/<slug>/src/edl.json
   ```
   Entregue ao usuário a pasta `partes/` (`parte-01-de-04.mp4`...) e diga para salvar os resultados numa pasta, **com os nomes na mesma ordem**. Dica para o prompt da IA: "mantenha a pessoa, a boca e os gestos idênticos; troque só o fundo por <cenário>; mesma duração; sem áudio".
3. **Juntar** quando voltarem:
   ```bash
   node ferramentas/juntar-partes.mjs <pasta-com-as-editadas> videos/<slug>/src/frames --partes videos/<slug>/partes/partes.json
   ```
   O áudio que a IA colocar é descartado. Sobras de 1–3 frames são aparadas e faltas repetem o último frame. Diferença maior que 3 frames aparece com ⚠: avise que aquela parte pode sair dessincronizada.
4. **Conferir a sincronia labial:** `--frame` nos inícios das partes e um `--preview` curto (`--from a --to b`) de cada emenda. Se um trecho ficar dessincronizado (a IA às vezes desloca a boca), cubra esse trecho com cena de grafismo ou motion (falante no FORA), como no vídeo da Blindagem.
5. Siga a skill **video-falado** a partir do passo 2.
