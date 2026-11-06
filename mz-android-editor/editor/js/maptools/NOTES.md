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
   - Autotile: o algoritmo do MZ (ver "Fidelidade do autotile"): o tile escrito e o
     anel de 8 vizinhos, só nas direções voltadas para o que mudou.
   - Sombra automática ao pintar a camada 0: metade esquerda (5) no chão (A1/A2/A5) à
     direita de A3/A4 com A3/A4 acima-à-esquerda; senão 0 (como o MZ, sobrescreve a
     sombra da caneta nas células recalculadas).
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

### Onde está o algoritmo do MZ

No `RPG.exe` 1.1.1 (x64), em C++, na classe `MapEditorBody` (item QML do módulo
`Tkool.core`; o `TilemapHelper` exposto ao QML só tem os predicados). Achado procurando
`lea reg, [reg-0x1700]` (id − TILE_ID_A4) com rizin e decompilando com Ghidra (REA). Funções
(endereços virtuais):

| endereço | papel |
|---|---|
| `0x140014780` | atualiza um retângulo alterado: percorre o retângulo expandido em 1; dentro máscara `0xff`, coluna à direita `0x19`, à esquerda `0x46`, linha de baixo `& 0x23`, de cima `& 0x8c` |
| `0x1400144d0` | atualiza uma célula com máscara: escolhe piso/parede/cachoeira e, na camada 0 com `mask & 0x19`, refaz a sombra |
| `0x140014b30` | piso: 8 bits de borda |
| `0x140014f90` | parede/telhado: varredura da coluna |
| `0x140019e20` | "vizinho diferente?" |
| `0x140019a30` | "mesmo tipo?" (paredes) |
| `0x140079510` / `0x1400795d0` | tabelas forma→bits (48) e bits→forma (256) do piso |
| `0x140010b90` | balde: cada célula da borda do preenchimento atualiza a si (0xff) e as 8 vizinhas como um retângulo 1×1 |
| `0x140012c20` / `0x140010460` | lápis (por carimbo) e retângulo/elipse (retângulo envolvente inteiro): chamam `0x140014780` só nas camadas que o pincel escreve |
| `0x140014450` | `updateAllAutotiles`: camadas 0 e 1 do mapa inteiro |
| `0x1400085b0` | Shift (`QGuiApplication::keyboardModifiers() & ShiftModifier`): com ele nada é recalculado (nem a sombra) |

### Como funciona (implementado em `autotile.js`, `updateAutotileId`/`updateCell`/`autoShadow`)

- Cada autotile tem 8 bits de borda (1 cima-esq., 2 cima-dir., 4 baixo-dir., 8 baixo-esq.,
  0x10 esq., 0x20 cima, 0x40 dir., 0x80 baixo). Ao atualizar, só os bits da máscara são
  recalculados; os outros vêm da forma atual (forma 47 = bits 0). Por isso o resultado
  depende do histórico só quando a pintura foi feita com Shift (ou, nas paredes, quando a
  coluna vizinha mudou de altura depois).
- **Vizinho diferente** (piso e cima/baixo de parede): fora do mapa nunca é diferente;
  não-autotile sempre é; entre água A1 (tipos 0, 1, 4–15) e cachoeira (tipos ímpares ≥ 5)
  qualquer cachoeira emenda (inclusive cachoeira com cachoeira de outro tipo); no resto,
  compara o tipo. Os tipos A1 2 e 3 não entram na regra da água.
- **Piso** (A1 não cachoeira, A2, teto A4): 8 bits pela regra acima → tabela bits→forma.
- **Cachoeira**: só esquerda/direita.
- **Parede/telhado** (todo A3 e a face A4): acha topo e base da coluna do mesmo tipo.
  Esquerda/direita (sempre recalculadas, ignoram a máscara): emenda se a coluna vizinha tem
  o mesmo tipo na linha, no topo e na base, e não tem acima do topo nem abaixo da base
  (mesma extensão). Na face de parede (tipo%16 ≥ 8) também emenda se esses 5 pontos da
  coluna vizinha (linha, topo, acima do topo, base, abaixo da base) forem quaisquer A3/A4.
  Fora do mapa = borda. Cima/baixo: borda se o vizinho é diferente ou está fora do mapa.
- **Sombra automática**: refeita em cada célula da camada 0 atualizada com `mask & 0x19`
  (a própria célula pintada e as vizinhas da direita): 5 se o tile da camada 0 é A1, A2 ou
  A5 e os tiles à esquerda e acima-à-esquerda (camada 0) são A3 ou A4; senão 0 —
  sobrescreve a sombra da caneta. Face de parede A4 encostada em teto não recebe sombra
  automática (a dos mapas oficiais foi feita com a caneta).
- `editops.js` (`fixup`) aplica isso como o MZ: cada célula escrita (mesmo sem mudar)
  numa camada vira um retângulo 1×1 — a união das máscaras é igual à do retângulo do
  carimbo e à do balde —, e só o anel de 1 tile é recalculado (sem propagar pela coluna de
  parede). Na elipse entra o retângulo envolvente inteiro. Camadas 0–3, só as escritas.
  As regras de camada (decorações na camada 1, `repairDecorationLayers`) não mudaram.

### Números (`node editor/js/maptools/test-autotile.mjs "<...>/RPG/samplemaps"`)

O teste agora também simula 1500 traços aleatórios pelo `MapEdit` e exige que piso,
cachoeira e sombra fiquem iguais ao recálculo completo (propriedade do algoritmo sem
Shift): 100%.

| tipo (camada 0, salvo indicação) | antes | depois |
|---|---|---|
| água/piso A1 | 98,6% (camada 1: 99,8%) | 98,6% (99,8%) — já era o algoritmo |
| A2 | 93,8% (camada 1: 91,1%) | 93,8% (91,1%) — idem |
| teto A4 | 87,9% | 87,9% — idem |
| paredes/telhados A3 | 80,5% | 82,0% |
| faces de parede A4 | 80,7% | 87,2% |
| cachoeira | 94,1% | 94,1% |
| total | 92,6% | 93,2% |
| sombra | 67,7% (métrica antiga, contava face de parede) | 83,5% dos tiles em que o MZ põe 5 estão com 5 |

Os 9.322 tiles que ainda diferem (de 137.916) se dividem em: 5.881 piso e 17 cachoeira
que só Shift explica (o algoritmo sem Shift sempre chega ao recálculo completo — ver a
simulação); 1.401 com borda virada para fora do mapa, que o MZ nunca produz (mapa
redimensionado/deslocado depois, ou Shift); 1.396 paredes que diferem só em
esquerda/direita (Shift, ou coluna vizinha que mudou de altura depois — o MZ não atualiza
a coluna inteira); 627 paredes com cima/baixo diferente (andares empilhados feitos com
Shift). Sombra: 2.147 tiles com 5 onde o MZ daria 0 e 2.544 com outros valores são da
caneta; 397 com 0 onde daria 5 são Shift/caneta. Exemplo típico de Shift: no
`Essentials Set Z/.../Map003.json` uma faixa de estrada A5 cruza um campo A2 que ficou
com a forma 0 (sem borda) dos dois lados.

Validação com mapas que não são os de exemplo: `RPG/newdata` (mapa do projeto novo) e o
projeto do DLC 3D Particle: 100%; DLC Essentials Set Z: 7 dos 8 mapas 100% (o 8º é a faixa
acima); DLC Dark Fantasy: 96,6%. Os mapas de exemplo (`samplemaps`) vêm em boa parte do MV
e foram retocados à mão; 9 dos 104 batem 100%.

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
- Paredes A4 não são criadas automaticamente sob o teto ao pintar — o MZ também não cria (a atualização dele só muda a forma, ver "Fidelidade do autotile").
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

## Atualização (mz-shell, 2026-11-05)
- Salvamento unificado: o maptools não grava mais. `updateButtons` marca `api.markDirty(MapXXX, map)` para mapas
  modificados; `api.on("saved")` limpa `MapEdit.modified`. Novo/Colar/Excluir mapa e mudanças em MapInfos
  (renomear, arrastar) ficam em memória até Salvar (exclusão = `markDirty(path, null, {del:true})`).
- Editar da barra (Recortar/Copiar/Colar/Excluir e Ctrl+X/C/V/Del) age no mapa selecionado quando a lista tem o foco
  (`S.focus`, classe `#sidebar.mtTreeFocus`).
- Menu de contexto da lista fecha com Esc e quando um diálogo abre (`api` emite `dialog:open`).
- Propriedades: largura/altura 0–256, peso de encontro 0–100, Copiar/Colar de encontros.
- Salvar como imagem: opção de compartilhar (Android) ou baixar (PC) depois de gravar.
- Conta-gotas exato também com o botão "A".
- A árvore (expandir/recolher, `MapInfos.expanded`) é desenhada em `app.js`.

## Atualização (mz-layout, 2026-11-05) — layout, Event List, Novo projeto, atalhos, panorama, DLC

Branch `claude/mz-layout-4ac057`. Testado no navegador (1200×554) e no aparelho (APK, RedMagic, Android 16).

**Coluna esquerda como no MZ (01_03, item 3/4).** `index.html` agora tem `#leftCol` = `#leftTop`
(paleta; no modo evento, Event List) + `#leftSplit` (divisória) + `#sidebar` (lista de mapas).
- `buildPanel` põe `#mtPanel` dentro de `#leftTop`; `Palette.setCellSize` ajusta a largura de `#leftCol`.
- Divisória: `app.js bindLeftColumn` (Pointer Events, mouse e toque; duplo clique volta a 55%);
  proporção em `localStorage["mzEditor.leftSplit"]` (12–88%). Testada por toque real no aparelho.
- Botões de ocultar mantidos e lembrados: `btnMaps` (`mzEditor.mapListHidden`) oculta a lista;
  `mtBtnPalette` (`mzEditor.paletteHidden`) oculta a metade de cima (paleta ou Event List). Só uma
  metade visível → ocupa a coluna; nenhuma → a coluna some (CSS `:has()` em `editor.css`).
- A faixa da paleta (Selecionar, Desfazer, Refazer, "A", Camada, −/+) ficou compacta para caber numa linha.

**Event List (01_09_02).** `events/eventmode.js` `_buildList/_renderList`: `#evList` dentro de `#leftTop`;
no modo evento `#leftTop.eventMode` esconde a paleta e mostra a lista (linhas "001  EV001", listradas).
Seleção sincronizada sempre (toque/clique na lista centraliza e seleciona; seleção no mapa marca e rola a
lista). Toque duplo abre o editor. Toque longo (500 ms) ou botão direito abre o mesmo menu de contexto do
mapa (Editar/Novo, Recortar, Copiar, Colar, Excluir, Criação rápida, Posição inicial). O painel flutuante
"☰ Eventos do mapa" e o botão da barra do modo evento foram removidos (CSS `.evListPanel` em
`events.css` ficou sem uso; não mexi por ser de outra sessão).

**Atalhos (01_04).** O manual não lista teclas; li a tabela do `MainMenu.qml` compilado dentro do
`RPG.exe` (strings UTF-16): New=Ctrl+N, Open=Ctrl+O, Save=Ctrl+S, Editar mapa=Espaço, Novo mapa=Enter,
Deslocar=Ctrl+T, Gerar masmorra=Ctrl+D, Mapa=F5, Evento=F6, camada seguinte/anterior=Ctrl+Tab /
Ctrl+Shift+Tab, Zoom=Ctrl++ / Ctrl+- (StandardKey), Tamanho real=Ctrl+0, Banco de dados=F9,
Plugins=F10, Teste=Ctrl+R, Conteúdo=F1, Evento rápido Transferência/Porta/Tesouro/Pousada=Ctrl+1…4.
**Ferramentas de desenho, Teste de som, Buscador, Gerenciador de recursos e Gerador não têm tecla no MZ.**
- Novos: Ctrl++/Ctrl+-/Ctrl+0 (`app.js`), Ctrl+Tab, Ctrl+T, Ctrl+D, Espaço/Enter com a lista em foco
  (`maptools/index.js bindKeys` → `maptree.js runTreeAction`), Ctrl+1…4 no modo evento (`eventmode.js`).
- Removido F11 = Teste de som (não existe no MZ); `menubar.js` deixou de mostrar F11 e passou a mostrar
  Ctrl++/Ctrl+-/Ctrl+0.
- Teste de jogo: botão "FPS" na `#playBar` chama `Graphics._switchFPSCounter()` (= F2; FPS → ms → oculto).

**Panorama "Mostrar no editor" (01_07_03).** `mapview.js _scrollParallax`: com Repetir horizontal/vertical
e Sx/Sy ≠ 0, o panorama anda `sx/2` px por quadro (60 fps), como `Game_Map.updateParallax`. Sem
Repetir continua parado (no jogo ele acompanha a câmera a meia velocidade; no editor fica preso ao mapa).

**Novo projeto no Android (01_02).** Local escolhido no diálogo: "Escolher…" → `Android.pickNewProjectLocation()`
(SAF, permissão persistente) → `window.mzNewProjectLocationPicked(uri, "/sdcard/…")`; o caminho aparece
no campo (`<local>/<nome>`). O último Local fica lembrado (`Android.newProjectLocation()`). No OK,
`Android.newProjectExists(uri, nome)` → "O projeto já existe." no diálogo (sem criar "Nome (1)"); depois
`Android.newProjectIn(uri, nome, título)` pergunta "Salvar as alterações?" e cria direto, sem abrir o SAF de
novo. `createNewProjectIn` também recusa pasta existente. Testado: aviso com Project1 existente; criação
de /sdcard/MZProjects/LayoutTest (cópia do template em ~1 min) e abertura do MAP001.

**Gerenciador de recursos no aparelho (01_05).**
- Importar (vários arquivos): OK com `MainActivity.onShowFileChooser` (2 PNG → img/parallaxes).
- DLC e "Importar recursos padrão" sem template: **falhava** — o WebView entrega `mode=1` (vários
  arquivos) para `webkitdirectory`, então abria o seletor de arquivos e os arquivos vinham sem caminho.
  Agora `resources.js chooseFiles({directory})` usa `Android.pickFolder()` (SAF de pasta) e o servidor
  local expõe a pasta: `GET /api/extfolder/list` (lista recursiva) e `/api/extfolder/file?path=`
  (`LocalServer.java`, `SafProject.listRecursiveJson`). Os arquivos são lidos só na cópia. Testado:
  DLC/img/pictures/DlcPic.png → projeto (304 559 bytes).

**Ficou de fora / observações**
- Ctrl+F / F3 / Shift+F3 (Localizar no mapa) existem no MZ e não foram mapeados (não há busca no mapa).
- "Salvar como imagem" e Fechar projeto não têm tecla no MZ (confirmado na tabela).
- Ctrl+Tab e Ctrl+T não chegam à página num navegador de PC (o navegador reserva); no WebView funcionam.
- Numa tentativa do Novo projeto apareceram dois "Salvar as alterações?" empilhados; não reproduzi
  (instrumentado, `mzConfirmLeave` é chamado uma vez). Se voltar, ver `Bridge.newProjectIn`/`leaveConfirmed`.
- Telas < 700 px: a coluna inteira vira gaveta sobre o mapa (antes eram dois painéis separados).
