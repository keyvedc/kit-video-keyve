---
name: revisar-exportar
description: Revisa um vídeo do kit quadro a quadro (folha por batida, frames, determinismo) e exporta o MP4 final no modo rápido, conferindo resolução, fps, duração e loudness. Use antes de entregar qualquer vídeo e quando o usuário pedir para exportar ou renderizar.
---

# Revisar e exportar

## Revisão (sempre antes do final)
```bash
node engine/render.mjs videos/<slug> --beats                  # 1 quadro por batida → out/beats.png
node engine/render.mjs videos/<slug> --beats --step 1 --cols 8  # vídeos longos: 1 quadro por segundo
node engine/render.mjs videos/<slug> --beats --at 2.4,2.6,2.8   # transições: tempos exatos
node engine/render.mjs videos/<slug> --frame 7.25             # 1 quadro em resolução cheia
node engine/render.mjs videos/<slug> --determinism            # seek fora de ordem = PNG idêntico
```
Abra a imagem e corrija até ficar limpo:
- texto fora da safe zone (topo 250, base 340, laterais 60);
- sobreposição, ou legenda em cima de grafismo;
- texto saindo e entrando ao mesmo tempo;
- batida sem mudança;
- cena poluída (mais de 1 ideia);
- cor fora da marca;
- legenda com palavra errada;
- logo cortado.

Em vídeo falado, confira a sincronia labial e as emendas dos cortes num `--preview --from a --to b`.

## Exportação
1. **Estime e avise antes:**
   ```bash
   node engine/render.mjs videos/<slug> --estimar
   ```
   Diga ao usuário numa linha a qualidade e o tempo aproximado (ex.: "Exportando em qualidade rápida, 47 s de vídeo: ~1 min 15 s."). Passou de ~2 min: rode em segundo plano.
2. **Exporte:**
   ```bash
   node engine/render.mjs videos/<slug> --final            # PADRÃO rápido: 1 captura/frame, JPEG q95, x264 veryfast CRF 15 → out/final.mp4
   node engine/render.mjs videos/<slug> --final --media    # +blur de movimento (2 subframes), ~+35% de tempo → out/final-media.mp4
   node engine/render.mjs videos/<slug> --final --max      # máximo (todos os subframes, PNG), ~3× mais lento → out/final-max.mp4
   node engine/render.mjs videos/<slug> --preview          # 540x960 rápido para aprovação
   ```
   O render mostra `⏱ tempo estimado`, o progresso a cada 10% com quanto falta e, no fim, o tempo real, o tamanho e a duração. Cada exportação calibra as próximas estimativas nessa máquina.
- Confira:
  ```bash
  ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,duration -of compact videos/<slug>/out/final.mp4
  ffmpeg -i videos/<slug>/out/final.mp4 -af ebur128 -f null - 2>&1 | grep "I:"
  ```
  Esperado: 1080x1920, 30 fps (ou 24), duração exata, faixa de áudio e cerca de -14 LUFS em vídeo falado.
- Entregue o caminho `videos/<slug>/out/final.mp4` com duração e tamanho.
