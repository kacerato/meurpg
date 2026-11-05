# Módulo maptools

Pintura de mapas do RPG Maker MZ 1.1.1: paleta, ferramentas com autotile, camadas,
regiões, seleção, área de transferência, desfazer/refazer, propriedades do mapa, novo
mapa e gravação. Textos em pt_BR tirados da tradução oficial do editor
(`rea-extract/qrc/translations/pt_BR.qm`; extração em texto nas notas compartilhadas
das sessões: `mz-strings-pt_BR.txt`).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.js` | `register(api)`: painel, barra, entrada (toque/mouse/teclado), sobreposição PIXI, salvar, menu da árvore de mapas |
| `autotile.js` | constantes/predicados do `Tilemap`, formas de piso (0–47), parede (0–15), cachoeira (0–3), sombra automática. Sem DOM (roda em Node) |
| `editops.js` | `MapEdit`: regras de camadas, carimbo/retângulo/elipse/preencher/sombra, traço com prévia e rollback, histórico por mapa, redimensionar |
| `palette.js` | paleta (abas A–E, R) em canvas 2D |
| `render.js` | desenho de tiles em canvas 2D com a mesma matemática de `_addAutotile`/`_addNormalTile` |
| `properties.js` | diálogos Propriedades do Mapa, áudio (BGM/BGS), imagem (fundo de batalha/panorama), Batalha (encontro) e dados de mapa novo |
| `test-autotile.mjs` | validação do algoritmo contra mapas do editor oficial |
| `../../css/maptools.css` | estilos (injetado pelo módulo com `<link>`) |

## O que foi implementado

1. **Paleta** (painel à esquerda do mapa, ao lado da árvore; botão novo na barra, ao lado
   de `btnMaps`, mostra/oculta): abas A, B, C, D, E e R embaixo, como no MZ. Aba A =
   A1 (2 linhas), A2 (4), A3 (4), A4 (6), A5 (16) na ordem do MZ, um tile por autotile
   (amostra: forma 47 para piso, 15 para parede, 3 para cachoeira), A1 animado como o
   Tilemap (quadros 0,1,2,1 a cada 0,5 s). B–E: 256 tiles em 8×32. R: IDs 0–255 com cor e
   número. Abas sem imagem no tileset ficam desabilitadas. Seleção retangular: arrastar
   com mouse; no toque, toque longo (350 ms) e arrastar (toque simples seleciona um tile,
   arrastar sem segurar rola a paleta). `−`/`+` mudam o tamanho dos tiles da paleta.
2. **Ferramentas** `btnPencil`, `btnRect`, `btnEllipse`, `btnFill`, `btnShadow` (alternam;
   tocar de novo na ativa desliga = modo rolar). Com ferramenta ativa, 1 dedo/botão
   esquerdo pinta; se um 2º dedo encosta, o traço é cancelado (sem entrar no histórico) e
   os dois dedos são devolvidos ao `mapview.js` (rolagem/pinça) com um `pointerdown`
   sintético do 1º dedo. Clique direito ou toque longo parado (500 ms) = conta-gotas;
   arrastar depois do clique direito/toque longo copia a área como pincel (como o MZ).
   Shift (ou o botão "A riscado" da faixa) desliga autotile e sombra automática; Shift no
   conta-gotas pega a forma exata.
   - Camadas como no MZ: A base → camada 0 (zera a 1); decoração (A1 tipos 2/3, A2
     colunas 5–8) → camada 1; no tileset tipo campo (mode 0) a decoração sobre base da
     2ª/4ª coluna troca a base pela 1ª/3ª (regra do manual). B–E → camadas 2/3: tile
     único vai na 3 (é o que os mapas oficiais têm), o novo empurra o anterior para a 2,
     o terceiro some, repetir o mesmo não muda nada, e o tile 0 de B apaga os dois.
     Sombra = camada 4 (bits 1,2,4,8 = quartos), região = camada 5.
   - Seletor de camada "Automático / Camada 1–4" (menu Camada do MZ) na faixa.
   - Autotile: recalcula o tile e os 8 vizinhos (e a coluna de parede abaixo).
   - Sombra automática ao pintar a camada 0: metade esquerda (5) no chão à direita de
     uma parede/telhado com parede acima-à-esquerda; sombras feitas à mão (≠ 0/5) são
     preservadas.
   - Pincel com vários tiles: padrão repetido ancorado no início do traço (lápis,
     retângulo, elipse e preencher).
3. **Seleção** (botão tracejado na faixa): arrastar marca uma área. `btnCut`/`btnCopy`/
   `btnDelete` agem nela (Ctrl+X/C, Delete), respeitando a camada escolhida e a aba R
   (só regiões). `btnPaste`/Ctrl+V transforma a cópia (6 camadas) em pincel e ativa o
   lápis: toque no mapa para colar. `btnUndo`/Ctrl+Z e Refazer (faixa)/Ctrl+Y ou
   Ctrl+Shift+Z, histórico separado por mapa (200 passos) que sobrevive à troca de mapa.
4. **Propriedades do Mapa** (clique direito / toque longo na árvore → Editar…): nome,
   nome de exibição, tileset, largura/altura (1–256, redimensiona preservando o canto
   superior esquerdo; eventos fora da área somem), tipo de deslocamento, passos, BGM/BGS
   automáticas (lista de `audio/bgm|bgs`, volume, intensidade, panning, ouvir), definir
   fundo de batalha (battlebacks1/2 com prévia), desativar corrida, panorama (imagem,
   loop H/V, velocidade −32..32, mostrar no editor), anotação e lista de encontros
   (tropa, frequência 1–100, mapa inteiro ou até 3 IDs de região). Mudança entra no
   desfazer. Menu da árvore também tem Novo… (filho do mapa clicado, ou raiz ao clicar no
   vazio; 17×13, tileset do mapa atual, como o MZ), Copiar, Colar e Excluir (com filhos).
   A árvore é atualizada só via DOM (linha nova/renomeada/removida) e `maps:changed`.
5. **Salvar** (`btnSave`, Ctrl+S): grava `data/MapXXX.json` de todos os mapas modificados
   e `MapInfos.json`; emite `map:changed {id}` por mapa e `maps:changed`. Indicador
   "● Modificado" na barra de status e sublinhado laranja no botão; aviso ao fechar a
   página com alterações.

## Fidelidade do autotile (medida)

`node editor/js/maptools/test-autotile.mjs "<...>/RPG/samplemaps"` recalcula todos os
autotiles dos ~100 mapas de exemplo do MZ e compara com o gravado. Resultado atual:
água/piso A1 98,6% (Map001 e Map002 = 100%), A2 ~93%, A4 teto ~88%, paredes A3/A4 ~81%,
total 92,6%; sombra automática 68%. A diferença restante é, em grande parte, ajuste
manual com Shift nos mapas de exemplo (há mapas com 0% de diferença nas paredes e outros
com 50%), mas as regras de parede do editor original podem ter casos que não descobri.
Regras derivadas dessa comparação:
- piso/cachoeira: fora do mapa conta como igual; parede: fora conta como diferente;
- água A1 emenda em cachoeira, e cachoeira não tem borda encostada em água;
- parede: vizinho lateral do mesmo tipo só emenda se a coluna começar na mesma linha; o
  teto A4 correspondente (tipo − 8) ao lado da face emenda.

## Fora do escopo / pendências

- Gerar masmorra, Carregar (mapas de exemplo), Deslocar, Salvar como imagem, arrastar
  mapas na árvore para reagrupar: não feitos.
- Excluir mapa não apaga `MapXXX.json` (a API não tem DELETE); só tira de `MapInfos`.
  Novo/Colar/Excluir gravam `MapInfos.json` na hora (o MZ só grava ao salvar).
- Camada escolhida: grava só nela, mas não faz o destaque visual das outras camadas.
- Paredes A4 não são criadas automaticamente sob o teto (não sei se o MZ faz).
- Cores das regiões são aproximadas (matiz por ID), não as do MZ.
- Pinça com dois dedos depende de o `mapview.js` aceitar o `pointerdown` sintético do
  1º dedo (funciona no Chrome; testado só com eventos sintéticos, não em aparelho).

## Pedidos para a API (promover)

- `api.selectMap(id)` e `api.refreshMapTree()` (hoje replico `selectMap` de `app.js` e
  mexo no DOM de `#mapTree`).
- `api.project.delete(path)` para excluir `MapXXX.json`.
- `api.mode` ("map"/"event") + evento `mode:changed` (hoje observo a classe de
  `btnModeEvent`).
- `api.view.onPointer` ou camada de entrada compartilhada para ferramentas no mapa.
- `api.status` com áreas separadas (hoje injeto `#mtModifiedFlag` no `#status`).

## Como testar

```
node devserver/server.mjs --project "<caminho>/testproject" --port 8783
```
Abra `http://127.0.0.1:8783/?modules=./maptools/index.js`. Em `window.mzMapTools` há
`state`, `setTool`, `save`, `undo`, `redo` para inspeção. Testado em 1280×600 e 780×360:
lagoa de água A1 no MAP001 com retângulo/elipse/lápis (bordas corretas), gravar e
recarregar, carimbo 2×2 da aba B, desfazer/refazer, preencher região (aba R), sombra,
conta-gotas, seleção+copiar+colar, Propriedades (redimensionar 20×15 + encontro, e
desfazer), Novo mapa e Excluir, e toque sintético (1 dedo pinta, 2º dedo cancela, toque
longo pega o tile).
