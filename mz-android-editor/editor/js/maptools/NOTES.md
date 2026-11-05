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
| `maptree.js` | menu da lista de mapas (Editar, Novo, Carregar, Copiar, Colar, Excluir, Deslocar, Gerar Masmorra, Salvar como Imagem) e arrastar para reagrupar |
| `dungeon.js` | Gerar Masmorra: layout de salas/labirinto e aplicação no mapa |
| `sampleloader.js` | Carregar (Modelos de Mapas) a partir de `editor/samplemaps/` |
| `mapimage.js` | Deslocar e Salvar como Imagem (render 2D do mapa inteiro) |
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
   A árvore é redesenhada com `api.refreshMapTree()` e é emitido `maps:changed`.
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

## Rodada 2 (após a integração no master)

- Usa a API promovida: `api.selectMap`, `api.refreshMapTree` (a árvore é redesenhada por
  app.js depois de gravar `MapInfos.json`), `api.mode` + `mode:changed` (em vez de observar
  `btnModeEvent`), `api.project.delete`, `api.project.writeBinary`. O `map:changed` faz o
  app.js atualizar a barra de status.
- **Gerar Masmorra** (menu da lista): diálogo do MZ (Tipo Salas/Labirinto, Opções Adic.
  Margens/Passagens Largas, Parede = tetos de A4, Piso = tiles de A5). Os scripts
  originais (`Dungeon*.js`) estão compilados no RPG.exe, então o gerador é equivalente,
  não idêntico: salas aleatórias sem sobreposição ligadas por árvore geradora mínima com
  corredores em L (+1 ciclo), ou labirinto por backtracking com ~8% de atalhos; margem de
  2 tiles; passagens de 1 ou 2 tiles. Teto em todo o sólido e face de parede (tipo + 8)
  com 2 tiles de altura acima do chão — a altura que aparece em quase todos os mapas
  de masmorra oficiais (tileset 4: 1022 de ~1150 colunas). Substitui as camadas 0–4,
  mantém regiões e eventos, recalcula autotile e sombra automática, entra no desfazer.
  Precisa de A4 e A5 no tileset.
- **Carregar…** (Modelos de Mapas): os 104 mapas de `RPG/samplemaps` foram copiados para
  `editor/samplemaps/` (JSON + PNG) com `manifest.json` (`id, file, image, name, namePt,
  width, height, tilesetId`); os nomes em português são os da tradução oficial
  (contexto `Dialog_MapLoader`; 3 sem tradução ficam em inglês: Bar, Castle B1F, Hotel).
  O mapa vira filho do mapa clicado, com o nome do modelo.
- **Deslocar…**: X/Y (−256..256), desloca todas as camadas e os eventos dando a volta nas
  bordas; entra no desfazer.
- **Salvar como Imagem…**: "Local de Saída" = caminho dentro do projeto (padrão
  `MapXXX.png`), grava com `writeBinary`. Desenha camadas 0–1, sombras e 2–3 em canvas 2D
  (mesma matemática do Tilemap). Mapas acima de 4096×4096 px são reduzidos para caber no
  canvas do Android.
- **Arrastar na lista**: mouse arrasta direto; no toque, toque longo abre o menu e, se o
  dedo andar, vira arrasto. Soltar no quarto de cima/baixo de uma linha = antes/depois
  (irmão); no meio = último filho; na área vazia = fim da raiz. Não deixa soltar dentro
  dos próprios descendentes. Grava `parentId`/`order` (renumerados em profundidade).
- **Excluir** agora apaga `MapXXX.json` (e os dos filhos) com `api.project.delete`.
- **Destaque de camada**: com "Camada N" escolhida, o mapa fica escurecido e um segundo
  `Tilemap` do runtime desenha só aquela camada por cima (sincronizado com rolagem/zoom e
  animação).

## Fora do escopo / pendências

- Novo/Carregar/Colar/Excluir/arrastar gravam `MapInfos.json` na hora (o MZ só grava ao
  salvar).
- Salvar como Imagem não desenha a borda das mesas (A2 com flag 0x80) nem o panorama, e os
  tiles ☆ não sobem acima dos superiores (só importa na ordem de desenho).
- Paredes A4 não são criadas automaticamente sob o teto ao pintar (não sei se o MZ faz).
- Cores das regiões são aproximadas (matiz por ID), não as do MZ.
- O arrasto por toque na lista foi testado só com mouse; a pinça com dois dedos já foi
  confirmada no aparelho pela sessão principal.

## Como testar

```
node devserver/server.mjs --project "<caminho>/testproject" --port 8783
```
Abra `http://127.0.0.1:8783/` (o módulo já está em `modules.js`). Em `window.mzMapTools` há
`state`, `setTool`, `save`, `undo`, `redo` para inspeção. Testado em 1280×600 e 780×360:
lagoa de água A1 no MAP001 com retângulo/elipse/lápis (bordas corretas), gravar e
recarregar, carimbo 2×2 da aba B, desfazer/refazer, preencher região (aba R), sombra,
conta-gotas, seleção+copiar+colar, Propriedades (redimensionar 20×15 + encontro, e
desfazer), Novo mapa e Excluir, e toque sintético (1 dedo pinta, 2º dedo cancela, toque
longo pega o tile).
Rodada 2 (1280×600): destaque da Camada 4, Carregar "Cidade Normal", Salvar como Imagem
(1680×1920, conferido), Novo 40×30 com tileset Dungeon + Gerar Masmorra (Salas; e
Labirinto com margens e passagens largas), Deslocar X=5 com desfazer, arrastar para
dentro de outro mapa e para antes de um irmão (MapInfos conferido), Excluir com os
arquivos apagados (404).
