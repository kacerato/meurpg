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
| `minimap.js` | mini-visualizador de mapa (Tilemap do corescript) usado pela prévia da rota |
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

Cada alteração grava `data/MapXXX.json` na hora e emite `map:changed {id}`; depois chama
`api.view.redrawOverlay()` para atualizar as molduras do MapView. Set Starting Position grava
`data/System.json` e emite `db:changed`. Renomear switch/variável no seletor também grava `System.json`.
O editor de evento comum (aberto pelo buscador) grava `data/CommonEvents.json`.

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
  "…" para Wait, ponto para giros, moldura branca no fim e tracejado de volta ao início com Repeat.
  "▶ Preview" anima um marcador pelo trajeto. Passabilidade não é simulada.
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
- Show Scrolling Text ainda sem prévia.
- A prévia da rota não testa passabilidade nem eventos no caminho.
- Desfazer não cobre renomear switches/variáveis nem edições de evento comum.
- Textos da lista seguem o MZ em inglês; algumas variações de redação do editor original podem diferir em detalhes.

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
