# Módulo events — notas

Modo evento, editor de evento, todos os comandos de evento do MZ e Event Searcher.
Registro: `register(api)` em `index.js`; CSS em `editor/css/events.css` (injetado pelo módulo).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.js` | registro, CSS, botões `btnModeEvent` / `btnEventSearch`, troca de modo |
| `data.js` | cache do banco (`db`), modelos de página/evento (`TEMPLATE`) |
| `ui.js` | diálogos com Promise, campos, rádios no estilo MZ, seletores (switch/variável com renomear e "Change Maximum", banco, áudio com Play/Stop, imagem, gráfico de personagem com frame/direção e tiles B–E, rosto, tom de cor, mini-mapa de local) |
| `commands.js` | definição de **todos** os comandos (101…357): nome, texto na lista, diálogo, referências para o buscador; paleta "Event Commands" de 3 abas; prévia da mensagem (cores de `Window.png`, ícones de `IconSet.png`); guia de largura do Show Text; Plugin Command sobre o módulo plugins |
| `commandlist.js` | lista de conteúdo: texto igual ao MZ (`◆Text：…`, `：　　：…`, `：When …`, `：End`), recuo por `indent`, seleção por bloco, multi-seleção, novo/editar/recortar/copiar/colar/apagar, Select All, Copy as Text/HTML; reconstrução de ramos (Choices, If/Else, Battle) preservando os corpos |
| `moveroute.js` | editor de rota (45 comandos `ROUTE_*`, opções Repeat/Skip/Wait, alvo) com **prévia no mapa**: simulação da rota (`simulateRoute`) e desenho (`drawRoute`) |
| `minimap.js` | mini-visualizador de mapa (Tilemap do corescript) usado pela prévia da rota; `onTap(x, y)` |
| `routesim.js` | simulação portada do runtime: mundo inteiro quadro a quadro (`SimWorld`, `SimMap`, `SimChar`, `SimEvent`, `SimPlayer`, `SimFollower`, `runRoute`, `activePage`, `pageMoveProps`) |
| `simview.js` | sprites dos personagens do mundo simulado na prévia da rota (`CharSprites`) |
| `history.js` | histórico de desfazer/refazer persistente de `CommonEvents.json` e dos nomes de switches/variáveis (`System.json`); `persistDb` = cache + `api.markDirty` |
| `etest.js` | "Test" da lista: grava `data/Test_*.json` + `data/Test_Event.json` e abre `/project/index.html?etest` |
| `eventeditor.js` | Event Editor (nome, nota, páginas New/Copy/Paste/Delete/Clear, condições, imagem, movimento autônomo, opções, prioridade, trigger, conteúdo) e editor de lista de evento comum |
| `eventmode.js` | sobreposição PIXI em `api.view.world`, cursor, molduras, posições iniciais (azul), toque/arrasto/menu, barra flutuante e Event List |
| `quick.js` | Quick Event Creation: Transfer, Door, Treasure, Inn |
| `search.js` | Event Searcher (switch, variável, item, arma, armadura, evento comum, texto, nome de evento) em todos os mapas, eventos comuns e tropas |
| `preview.js` | prévias com as imagens do projeto e as contas do runtime: tom (`ColorFilter`), janela (`Window.png`), janela de mensagem (posição, fundo, nome, páginas), fundo de batalha com as 2 camadas; fonte do jogo (`loadGameFont`) |

## Controles (toque)

- Modo evento: botão `btnModeEvent` (volta com `btnModeMap`).
- **Toque**: seleciona o tile. **Duplo toque**: abre o editor (ou cria evento em tile vazio).
- **Toque longo e soltar**: menu de contexto (Edit/New, Cut, Copy, Paste, Delete, Quick Event Creation, Set Starting Position) — equivalente ao botão direito do MZ. Botão direito do mouse também funciona.
- **Arrastar um evento**: move (segurar e arrastar também move). Arrastar em área vazia rola o mapa (MapView); pinça continua dando zoom.
- Barra flutuante no rodapé do mapa com as mesmas ações + "☰ List" (Event List).
- **Desfazer/Refazer** (↶ Undo / ↷ Redo na barra flutuante, Ctrl+Z / Ctrl+Y ou Ctrl+Shift+Z, e o `btnUndo` da barra principal no modo evento): criar, editar, mover, apagar, recortar, colar, Quick Event e Set Starting Position. Histórico por mapa (até 100 passos), em memória.
- No modo evento, `btnCut`/`btnCopy`/`btnPaste`/`btnDelete` da barra principal agem sobre o evento selecionado (o maptools ignora o modo evento).
- Teclado no PC: setas movem o cursor, Enter edita, Delete, Ctrl+C/X/V, Ctrl+Z/Y.
- Lista de conteúdo: toque seleciona o bloco, duplo toque edita (ou insere na linha `◆` vazia), toque longo abre o menu; botão "Multi" = Shift+clique; botão/menu **Test** executa no jogo os comandos selecionados (ou a lista toda, se só a linha vazia estiver selecionada).

## Gravação

Nada grava na hora: tudo vai para o salvamento unificado (`api.markDirty`, contrato em `api.js`) e é gravado
no "Salvar projeto". Eventos do mapa: `markDirty(data/MapXXX.json)` + `map:changed {id}` +
`api.view.redrawOverlay()`. Set Starting Position, renomear switch/variável e o editor de evento comum (aberto
pelo buscador) usam `history.js persistDb(file, obj)`: põe o objeto no cache do Project (`readJson` devolve o
cache enquanto o arquivo estiver marcado, então o Banco de dados vê a alteração), `markDirty(file)` sem dados
(o Salvar grava o que estiver no cache, mesmo que o Banco de dados o tenha trocado) e emite `db:changed`.
Exceção: `etest.js` grava os `Test_*.json` do teste de evento (temporários).

## Integração com outros módulos

- Define `api.mode` (`"map"`/`"event"`) e emite `mode:changed {mode}`; escuta `mode:changed` de outros módulos.
  Sugestão ao maptools: só pintar quando `api.mode !== "event"`.
- Expõe `api.events` (instância de `EventMode`): `openEvent(id, page, row)`, `setMap`, `refresh`.
- Escuta `map:selected`, `map:changed` (redesenha se o mapa atual mudou) e `db:changed` (recarrega o arquivo no cache).

## Recursos desta rodada

- **Test** (`etest.js`): como o editor do PC, copia os 14 arquivos do banco para `data/Test_*.json`
  (`DataManager.loadDatabase` usa o prefixo `Test_` com `?etest`) e grava os comandos em
  `data/Test_Event.json`; abre `/project/index.html?etest` no `#playOverlay`. O runtime faz
  `DataManager.setupEventTest()` (mapa vazio -1, grupo inicial) e `Game_Map.setupTestEvent()` roda a
  lista. Ao fechar o teste os `Test_*.json` são apagados (`api.project.delete`).
- **Prévia da rota**: no diálogo Movement Route (página com movimento Custom e comando Set Movement
  Route) há um painel com o mapa do evento; a partir da posição/direção do alvo (evento, This Event ou
  jogador na posição inicial do mapa) desenha moldura azul no início, setas vermelhas por passo (o passo
  do comando selecionado em amarelo), arco para Jump, "?" para movimentos aleatórios/para o jogador,
  "…" para Wait, ponto para giros, moldura branca no fim e tracejado de volta ao início com Repeat (simulação real desde a rodada 4).
  "▶ Preview" anima um marcador pelo trajeto. (Rodada 4: passabilidade, velocidade e frequência simuladas, ver abaixo.)
- **Plugin Command** usa `plugins/commands.js` (`getEnabledPluginsWithCommands`, `getPluginCommands`,
  `defaultArgs`), `plugins/params.js` (`ParamTable`: árvore por `@parent`, editores por `@type`,
  `struct<…>` e arrays estruturados, `file` com `@dir`) e `plugins/store.js` (`listPluginFiles`).
  Lista os plugins ativos como o MZ; se nenhum estiver ativo, ou se o comando usa um plugin desativado,
  mostra-os com "(OFF)" para não perder dados. Grava `[plugin, comando, @text, args]` + linhas 657
  `Texto = valor`. `@require` só afeta a exportação (não há o que editar).
- **Show Text**: a caixa de texto usa a fonte do jogo (`advanced.mainFontFilename`) em escala; a guia
  vermelha marca a largura útil real da janela (`uiAreaWidth - 8 - 24`, menos 164 px com rosto, como
  `Window_Message.newLineX`). Cada linha é medida como no runtime (códigos de controle sem largura,
  `\I[n]` = 36 px, `\{ \}`, `\FS[n]`, `\PX[n]`, `\N[n]`/`\P[n]`/`\G` expandidos) e a parte que passa da
  janela aparece em vermelho; ao lado, "largura/limite px" por linha.
- API oficial: `api.selectMap(id)` no buscador, `api.view.redrawOverlay()`, `api.mode`.

## Rodada 3 (fidelidade, FIDELITY.md Eventos P1–P3)

- **Aplicar** (`ui.js dialog({onApply})`): Event Editor e editor de evento comum têm OK / Cancelar / Aplicar.
  O Event Editor grava pelo `opts.onApply(ev)` se o chamador passar; senão direto em `api.events`
  (`record()` + `map.events[id] = ev` + `save()`). Depois de um Aplicar, o OK grava e devolve `null` ao
  chamador, para o `eventmode.js` não colocar o evento de novo (evento novo ganharia outro ID). Os
  diálogos de comando não têm Aplicar (como no MZ).
- **Ctrl+Enter = OK** em qualquer diálogo do módulo (keydown no `.mzDialogBackdrop`).
- **Páginas**: no máximo 20 (Nova/Colar desabilitam); Excluir desabilita com uma página; Limpar sem confirmação.
- **Seleção múltipla**: Shift+clique e Shift+↑/↓ na lista de conteúdo (`select(i, extend)`, `extendBy`) e
  na lista da rota (que agora tem Recortar, menu por botão direito/toque longo/☰, Ctrl+C/X/V/A, Delete, Enter
  e "Multi"; área de transferência de rota em `localStorage.mzRouteClip`). Script da rota em 1 linha.
- **Limites do Constant** (`RANGE` em `commands.js`): Gold 1–99 999 999, Items 1–9 999, HP/MP/Parâmetro
  1–9 999, TP 1–100, EXP 1–9 999 999, Nível 1–98, HP do inimigo 1–999 999; mínimo 1. Control
  Switches/Variables em intervalo: até o tamanho de `System.switches/variables`.
- **Buscador**: "Nome Evento" (`Dialog_EventSearcher`); refs de variável em 231/232; itens 605 da loja.
- **Prévias** (`preview.js`): Tint Screen/Picture tingem a imagem Título 1 do projeto (Tint Picture usa a
  imagem do último Show Picture com o mesmo número) com a conta do shader `ColorFilter`; Change Window
  Color desenha a janela com `Window.png` (fundo tingido, opacidade 192, moldura 9 partes); Change Battle
  Background virou um diálogo único com as duas listas e prévia composta (`Sprite_Battleback.adjustPosition`);
  Show Text mostra a tela com a janela na posição, fundo Janela/Escurecer/Transparente, caixa de nome e
  páginas (`needsNewPage`). `\V[n]` = 0, igual ao `text_preview.js` do editor MZ
  (`rea-extract/qrc/html/text_preview.js_`, referência útil para outras prévias).
- **Menu de texto** (`ui.js textMenu`, `commands.js withTextMenu`): botão direito (ou botão ⋯ no toque) com
  Recortar/Copiar/Colar/Selecionar tudo + "Inserir índice de cor/ícone" e "Ajuda do plugin"
  (`database/pluginhelp.js`, importado sob demanda) em Show Text, Scrolling Text (ícone), Comment,
  Script e Script do Conditional Branch.
- **Tropa**: com `ctx.troopId` (vem de `editCommandList`), listas e textos mostram "#1 Slime".
- **Plugin Command**: só plugins ativados; o já gravado e desativado aparece "(OFF)".
- **Show Choices**: Padrão/Cancelar para escolhas vazias ficam desabilitados.
- **Copy as HTML**: `rowsHtml` gera `<div>` monoespaçado com recuo e cor por categoria.

Verificado em 2026-11-05 no navegador (cópia do testproject, porta 8793): todos os itens acima, com
screenshots; no runtime (`?etest`, `SceneManager.isGameActive` forçado porque o painel estava oculto):
Show Text com rosto/nome/cores/ícones na mesma geometria da prévia; Tint Screen (`$gameScreen.tone()`),
Change Window Color (`$gameSystem.windowTone()`) e Change Battle Background (`battleback1/2Name`).

## Fora do escopo / limitações

- Troops: o buscador encontra referências nas páginas de tropas, mas a edição é do módulo database.
- Show Text: "Batch Entry" divide em blocos de 4 linhas; `\V[n]` é medido como "0" (como na prévia do MZ).
- Prévia da rota (rodada 5): o estado é o de um jogo novo (switches OFF, variáveis 0, sem itens, grupo inicial);
  não roda eventos comuns paralelos/automáticos nem inicia eventos por toque (Event Touch/Player Touch) ou
  Autorun durante a prévia; o jogador parado não anda por entrada; embarcar em veículo não é simulado (os
  veículos só bloqueiam). Script (45) vê `this` (o personagem), `$gameSwitches`, `$gameVariables`,
  `$gameSelfSwitches`, `$gameMap` (eventos, passabilidade, refresh) e `$gamePlayer`; o resto (`$gameParty`,
  `AudioManager`, `requestBalloon`…) é um objeto inerte. Um Script que trava (laço infinito) trava a prévia,
  como travaria o jogo.
- Desfazer da lista de comandos vale enquanto o diálogo está aberto (o OK vira um passo do histórico do mapa
  ou do evento comum). Eventos comuns editados pela ponte do Banco de dados (`editCommandList`) ficam no
  histórico do módulo database, não neste.
- Textos da lista seguem o MZ em inglês; algumas variações de redação do editor original podem diferir em detalhes.

## Rodada 4 (FIDELITY.md: Scrolling Text, prévia de rota, Shop, desfazer, Seletor de objetos)

- **Show Scrolling Text (105/405)**: botão "Visualização…" no diálogo (`commands.js scrollTextPreview` →
  `preview.js playScrollText`). Igual a `Window_ScrollText`: janela sem moldura do tamanho da área de UI
  (`uiAreaWidth/Height`, centrada na tela), padding 12, texto em `x = 8` (`baseTextRect`), começa com
  `origin.y = -altura` e sobe `velocidade / 2` px por quadro a 60 quadros/s; acaba quando `origin.y` passa a
  altura do texto (`textSizeEx`, `\{ \}`/`\FS` aumentam a linha). Segurar o dedo/mouse na prévia = ×3
  (`fastForwardRate`), exceto com "Sem Avanço Rápido". Códigos de controle, cores do `Window.png`, ícones e
  fonte do jogo como na prévia do Show Text. "↻ Repetir" reinicia; o rodapé mostra tempo e px.
- **Prévia de rota** (`routesim.js`, usada por `moveroute.js`): port de `Game_Map.checkPassage/isPassable/
  roundX/deltaX/isLadder`, `Game_CharacterBase.canPass/canPassDiagonally/isMapPassable/isCollidedWith*/
  moveStraight/moveDiagonally/jump/update*`, `Game_Character.processMoveCommand/updateRoutineMove/
  advanceMoveRouteIndex/moveRandom/moveToward…/turn…` e `Game_Event.updateSelfMovement` (frequência:
  `30 * (5 - freq)`), quadro a quadro. Passabilidade = flags do tileset + eventos de tile; colisão com os
  eventos do mapa (página ativa num jogo novo: `activePage`; sem página = atravessável), barco/navio na
  posição inicial do System e o jogador. Set Movement Route = rota forçada (um comando por quadro parado,
  velocidade da página do evento ou 4 do jogador); página Custom = frequência da página. Jogador de
  referência = posição inicial do System (moldura verde "P"); **toque no mapa da prévia** muda a posição.
  Sorteios (9, 23, 24) usam semente fixa (resultado = um dos possíveis; 🎲 sorteia de novo); passos sorteados
  ou para/longe do jogador ficam em laranja. Bloqueio = ✕ na borda do tile; sem "Ignorar se Intransponível"
  a rota para ali (✕ grande no fim). Rodapé: início → fim, quadros e segundos. "▶ Visualização" anda o
  marcador quadro a quadro com a mesma simulação (velocidade, espera, salto com `jumpHeight`).
  Conferido contra o runtime (`rmmz_objects.js` carregado em `/project/index.html`, `Game_Event.update()`
  quadro a quadro): rota forçada com bloqueio, Approach Player, Wait 45 e Jump — mesmas posições nos mesmos
  quadros (448 quadros); rota Custom com Repeat e frequência 3 — idem (61, 153, 245, … 705).
- **Shop Processing (302/605)**: lista com alça ⠿ para **arrastar** e reordenar, ▲/▼ (Alt+↑/↓), Recortar/Copiar/
  Colar (área própria + `localStorage.mzShopClip`, cola antes da linha selecionada), Excluir, ☰, **menu de
  contexto** por toque longo ou botão direito (Editar, Recortar, Copiar, Colar, Excluir, Para Cima, Para
  Baixo), duplo toque = editar (linha vazia = nova), Enter/Delete/Ctrl+C/X/V. A ordem sai no formato do
  runtime (302 = 1ª mercadoria, 605 = as demais), que é a ordem da loja no jogo (`command302`).
- **Desfazer/Refazer na lista de comandos** (`commandlist.js`): ↶/↷ na barra da lista, no menu (topo) e
  Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z), até 100 passos, para Novo/Editar/Colar/Excluir/Recortar. Vale em toda
  lista: evento comum aberto pelo buscador, ponte do Banco de dados (`api.events.editCommandList`, Tropas e
  Eventos comuns) e páginas do Event Editor.
- **Desfazer ao renomear switches/variáveis** (`ui.js listDialog editNames`): ↶/↷ e Ctrl+Z/Ctrl+Y no seletor;
  cada renomeação (digitação seguida no mesmo ID = 1 passo) e cada "Escolher Limite" é um passo.
- **Seletor de objetos** (Opções → Dropdown/Extended/Smart): `db.options()` marca a lista (`objectList`) e
  `ui.js sel()` consulta `objectSelectorMode(n)` (`api.tools.objectSelectorMode`, ou o `localStorage` das
  Opções): "dropdown" = lista suspensa; "extended" = campo "0001 Nome" com "…" que abre a janela "Seleção de
  Objeto" (com filtro). Smart = lista suspensa abaixo de 100 objetos. Vale para todos os seletores de banco
  do módulo (34 lugares: comandos, condições de página, Quick Event, buscador) e `dataPick`. A opção é lida
  ao abrir cada diálogo. Listas montadas à mão (ex.: equipamento filtrado por tipo no 319) seguem suspensas.

Verificado em 2026-11-05 a 1200×554 (cópia do testproject, porta 8794), com capturas: rolagem (velocidade 4
= 2 px/quadro), prévia de rota com bloqueio, jogador "P", toque para mover o jogador, animação; loja (▲,
arrastar, copiar/colar, recortar, menu, parâmetros devolvidos na nova ordem); undo/redo da lista pela ponte do
Banco de dados; ↶/↷ no seletor de switches; os três modos do Seletor de objetos (Show Animation abre a janela
de seleção em Extended).

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<caminho absoluto>/testproject" --port 8782
```

Abra `http://127.0.0.1:8782/` (todos os módulos) ou `?modules=./events/index.js`, clique em Modo evento, dê duplo toque num tile,
adicione Show Text + Transfer Player, OK, e confira `data/Map001.json`. Teste de jogo pelo botão play.

Verificado em 1280×600: criar/editar/mover/copiar/colar/apagar, Quick Event (os 4 tipos), Set Starting
Position, Event List, Event Searcher (pula para a linha), todos os diálogos de comandos abrindo e gerando
parâmetros válidos, e execução no runtime real (`rmmz_objects.js`) de Show Text + Transfer, Treasure
(item + self switch + página 2), Inn (cobra e recupera) e Door (rotas + transfer).

Rodada 2 (verificado em 1280×600): Test de Show Text pela lista (mensagem com rosto aparece no jogo
com `?etest`; `Test_*.json` removidos ao fechar), prévia da rota com passos, salto, aleatório e
repetição, undo/redo (botões, Ctrl+Z/Y e `btnUndo` da barra principal), Plugin Command com a tabela
do módulo plugins (editor de `multiline_string[]` do EventCommandByCode), guia de largura do Show Text
com a fonte do jogo.

## Rodada 5 (pendências de eventos: prévia de rota completa, desfazer persistente)

- **Prévia de rota com o mapa vivo** (`routesim.js SimWorld`): o mundo roda quadro a quadro na ordem de
  `Scene_Map.updateMain` (`Game_Map.update`: `refreshIfNeeded` e eventos por ID; `Game_Player.update` +
  seguidores). Os **outros eventos** usam a página ativa (`findProperPageIndex/meetsConditions` com o estado
  simulado) e executam o **próprio movimento autônomo**: Random (`moveTypeRandom`), Approach
  (`moveTypeTowardPlayer`, `isNearThePlayer` < 20), Custom (rota da página) com velocidade, frequência
  (`30 * (5 - freq)`) e `isNearTheScreen` (câmera centrada no jogador, `screenWidth/Height` do System).
  **Colisão** entre todos (eventos, jogador e seguidores via `Game_Player.isCollided`, barco/navio).
  **Switch ON/OFF (27/28)** e **Script (45, `eval` com `this` = personagem)** alteram um estado simulado
  (switches/variáveis/self switches de um jogo novo, nada é gravado) e pedem `refresh` como
  `Game_Switches.onChange`: eventos trocam de página no meio da prévia (imagem, velocidade, tipo de
  movimento, rota). O evento que roda o Set Movement Route fica **travado** (`lock`: vira para o jogador e
  para o movimento próprio) se o gatilho for 0–2, como `Game_Event.start`. "Este Evento" usa a página em
  edição (dados ainda não gravados) como página ativa.
- **Rota do jogador**: o jogador parte da posição inicial do System, com **seguidores** (`optFollowers`, grupo
  inicial até 4: `chaseCharacter` a cada passo, `jumpAll` no salto, transparência `optTransparent`) e os
  **veículos** na posição inicial (barco/navio bloqueiam; `Game_Vehicle.pos` só no mapa deles).
- **Desenho** (`simview.js`, camada `MiniMap.charLayer`): todos os personagens com o gráfico real (quadro por
  padrão/direção, `$`, `!`, tiles B–E, `shiftY`, altura do salto, opacidade, transparência, blend), parados no
  quadro 0 sob a rota desenhada; "▶ Visualização" anima o mundo inteiro (a rota fica esmaecida ao fundo) e
  redesenha no fim. O personagem da rota tem anel amarelo. Rodapé: outros eventos com movimento, seguidores,
  switches alterados ("simulados, não gravados") e execuções/erro de Script. Rota bloqueada só é dada como
  travada depois de 60 tentativas quando há eventos andando (o caminho pode abrir), senão 3.
- **Desfazer persistente** (`history.js`): OK/Aplicar do editor de evento comum (buscador) e cada OK do
  seletor de switches/variáveis que renomeia ou muda o máximo viram passos de um histórico que continua
  depois de fechar o diálogo. Todos os passos (os do mapa no `eventmode.js` e estes) levam um número de
  sequência; **Ctrl+Z / Ctrl+Y**, ↶/↷ da barra flutuante e o `btnUndo` da barra principal desfazem o mais
  recente. No **modo mapa** (maptools), Ctrl+Z/Ctrl+Y e o `btnUndo` desfazem o passo do banco quando ele é
  mais recente que o último passo de tiles do mapa atual (o topo da pilha do maptools não mudou desde
  então); o `btnUndo` é reabilitado por um `MutationObserver` nesse caso. Até 100 passos.
- Lista da rota: linhas longas (Script) cortadas com "…" e dica com o texto inteiro (não empurram mais a grade
  de comandos).

Verificado em 2026-11-06 (cópia do testproject, porta 8796, 1200×554):
- **Contra o runtime**: mapa de teste 20×15 com 7 eventos (Random freq 5/3/4, Approach, Custom com Repeat,
  página 2 por switch 5 com outra rota/velocidade/imagem, evento parado) e rota forçada com Move, Switch ON 5,
  Script (`setMoveSpeed`, `$gameVariables.setValue`, `turnTowardPlayer`), Jump, Approach Player, Wait, Turn
  Random, Move Random, Switch OFF; o mesmo mapa em `/project/index.html` (`DataManager.setupNewGame`,
  `$gameMap.setup`, interpretador marcado como rodando, `Math.random` com o mesmo gerador com semente) e
  `$gameMap.update(false)` + `$gamePlayer.update(false)` por quadro: **0 quadros diferentes** em posição real,
  direção e página de todos os eventos, jogador e seguidores, em 5 sementes (1500 e 3000 quadros), com e sem
  "Ignorar se Intransponível", e com a rota no jogador (3 seguidores). Switch 5 e variável 3 iguais no fim.
- Interface: prévia com sprites, rodapé, ▶ animando os eventos (EV005 muda de página pelo Script), rota da
  página (Custom) pelo botão "Rota…", lista com Script longo.
- Desfazer: evento comum (OK → Ctrl+Z / Ctrl+Y no modo evento, status "Desfazer: Evento comum 0001"),
  renomear switch (OK → modo mapa → `btnUndo` habilitado e desfaz), Ctrl+Z no modo mapa desfaz o evento
  comum; nada gravado no disco antes do Salvar; `api.saveAll()` grava `CommonEvents.json`/`System.json` com o
  estado desfeito/refeito correto.
