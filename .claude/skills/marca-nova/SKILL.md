---
name: marca-nova
description: Cadastra a identidade visual de um cliente no kit (cores, fontes, logo, textos e imagens) em marcas/<slug>/ e gera o teste de marca. Use quando o usuário mandar um site, manual de marca, logo, paleta ou disser "novo cliente", "usar a marca do cliente X", "trocar a identidade".
---

# Cadastrar a marca de um cliente

Objetivo: `marcas/<slug>/` completa, para qualquer vídeo usar com `createVideo({ marca: '<slug>' })`.

## 1. Juntar o material
Use o que o usuário mandou (site, PDF do manual, SVG/PNG do logo, cores, fontes). Peça só o que faltar e não der para extrair. Prioridade das fontes de verdade: manual de marca > CSS do site > logo/arquivos > briefing.
- **Site:** baixe o HTML e os CSS (`curl -sL`). Cores: procure variáveis CSS (`--primary`, `--brand`, `--accent`) e as cores mais repetidas em botões e links. Fontes: `font-family` e os arquivos `@font-face` (`.woff2`). Textos: título principal, subtítulo, serviços/produtos, preços e CTAs exatamente como estão.
- **Imagens:** só as do próprio cliente (site, pasta enviada). Salve em `midia/` em `.webp` ou `.jpg`, com nomes curtos.

## 2. Montar a pasta
`cp -R marcas/_modelo marcas/<slug>` e preencha:
- `marca.json`
  - `cores.acento` = a cor de destaque da marca (uma só). `acento_claro` = versão mais clara para aparecer bem sobre fundo escuro.
  - `fundo_claro`, `fundo_escuro`, `tinta` (texto) e `muted` (texto secundário): tire do site. Se faltar, use neutros próximos aos da marca.
  - `fontes.texto` = fonte principal. `peso` 500–700. `tracking` −0.02 a −0.04 em fontes sans; 0 em fontes estreitas.
  - `fontes.cauda` = fonte de destaque (serifada, itálica ou script) se a marca tiver uma. Se não tiver, apague a chave e a cauda vira só a cor do acento.
  - Se a fonte não tiver arquivo livre, use a alternativa mais próxima do Google Fonts (baixe o `.woff2`) e avise o usuário.
  - `logo.wordmark` = SVG do logo horizontal. `recolorir: true` só para logo de uma cor (o kit pinta de tinta ou papel). Logo colorido = `false`.
  - `logo.ponto` = o "ponto" no acento depois do logo, que é o objeto-condutor. `usar: false` se não combinar com o logo. Ajuste `x` e `base` em unidades do viewBox se o ponto precisar encaixar num lugar exato.
  - Logo só em PNG: peça o SVG. Sem SVG, use `recolorir: false` e coloque o PNG dentro de um SVG com `<image>`.
- `copy.json`: só textos reais (nome, tagline e a continuação em `tagline_cauda`, produtos/serviços, preços, CTAs). Cite a fonte e a data em `_fonte`. **Nunca invente números, clientes ou promessas.**
- `MARCA.md`: regras em 6–10 linhas (acento, base, tipo, assinatura, objeto-condutor, tom, proibições).

## 3. Testar
```bash
node engine/render.mjs videos/_teste-marca --beats --at 1.3,3.4,5.3 --cols 3 --query marca=<slug>
```
Abra `videos/_teste-marca/out/beats.png` e confira:
- o logo aparece inteiro e nítido, e o ponto encaixa;
- o acento tem contraste sobre fundo claro e escuro;
- a fonte carregou (se aparecer a fonte do sistema, o caminho ou o nome da família está errado);
- a cauda aparece em destaque e o botão é legível.

Corrija e repita. Mostre a folha ao usuário antes de produzir vídeos com a marca.

## 4. Estilo
Por padrão a marca usa o estilo `keyve` (`"estilo"` no `marca.json`). Se o cliente quiser outro jeito de editar, use a skill **estilo-novo**.
