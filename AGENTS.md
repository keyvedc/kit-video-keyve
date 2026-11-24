# Instruções para agentes de IA

As instruções completas estão em **CLAUDE.md**. Leia esse arquivo primeiro.

As skills (fluxos passo a passo) ficam em `.claude/skills/<nome>/SKILL.md`. Se o seu agente não carrega skills sozinho, abra a que corresponde ao pedido:
- marca de cliente → `.claude/skills/marca-nova/SKILL.md`
- estilo a partir de referência → `.claude/skills/estilo-novo/SKILL.md`
- vídeo animado → `.claude/skills/video-motion/SKILL.md`
- vídeo falado → `.claude/skills/video-falado/SKILL.md`
- trocar cenário com IA de vídeo → `.claude/skills/trocar-cenario/SKILL.md`
- revisar e exportar → `.claude/skills/revisar-exportar/SKILL.md`

O agente precisa poder rodar comandos no terminal (Node, ffmpeg) e ler imagens PNG para revisar os quadros.
