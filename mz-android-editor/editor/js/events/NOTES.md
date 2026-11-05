# Módulo events — notas

Modo evento, editor de evento, todos os comandos de evento do MZ e Event Searcher.
Registro: `register(api)` em `index.js`; CSS em `editor/css/events.css` (injetado pelo módulo).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.js` | registro, CSS, botões `btnModeEvent` / `btnEventSearch`, troca de modo |
| `data.js` | cache do banco (`db`), modelos de página/evento (`TEMPLATE`) |
| `ui.js` | diálogos com Promise, campos, rádios no estilo MZ, seletores (switch/variável com renomear e "Change Maximum", banco, áudio com Play/Stop, imagem, gráfico de personagem com frame/direção e tiles B–E, rosto, tom de cor, mini-mapa de local) |
| `commands.js` | definição de **todos** os comandos (101…357): nome, texto na lista, diálogo, referências para o buscador; paleta "Event Commands" de 3 abas; prévia da mensagem (cores de `Window.png`, ícones de `IconSet.png`) |
| `commandlist.js` | lista de conteúdo: texto igual ao MZ (`◆Text：…`, `：　　：…`, `：When …`, `：End`), recuo por `indent`, seleção por bloco, multi-seleção, novo/editar/recortar/copiar/colar/apagar, Select All, Copy as Text/HTML; reconstrução de ramos (Choices, If/Else, Battle) preservando os corpos |
| `moveroute.js` | editor de rota (45 comandos `ROUTE_*`, opções Repeat/Skip/Wait, alvo) |
| `eventeditor.js` | Event Editor (nome, nota, páginas New/Copy/Paste/Delete/Clear, condições, imagem, movimento autônomo, opções, prioridade, trigger, conteúdo) e editor de lista de evento comum |
| `eventmode.js` | sobreposição PIXI em `api.view.world`, cursor, molduras, posições iniciais (azul), toque/arrasto/menu, barra flutuante e Event List |
| `quick.js` | Quick Event Creation: Transfer, Door, Treasure, Inn |
| `search.js` | Event Searcher (switch, variável, item, arma, armadura, evento comum, texto) em todos os mapas, eventos comuns e tropas |
| `plugincmd.js` | parse de `@command/@arg/@type/@option…` do bloco `/*:` dos arquivos em `js/plugins/` |

## Controles (toque)

- Modo evento: botão `btnModeEvent` (volta com `btnModeMap`).
- **Toque**: seleciona o tile. **Duplo toque**: abre o editor (ou cria evento em tile vazio).
- **Toque longo e soltar**: menu de contexto (Edit/New, Cut, Copy, Paste, Delete, Quick Event Creation, Set Starting Position) — equivalente ao botão direito do MZ. Botão direito do mouse também funciona.
- **Arrastar um evento**: move (segurar e arrastar também move). Arrastar em área vazia rola o mapa (MapView); pinça continua dando zoom.
- Barra flutuante no rodapé do mapa com as mesmas ações + "☰ List" (Event List).
- Teclado no PC: setas movem o cursor, Enter edita, Delete, Ctrl+C/X/V.
- Lista de conteúdo: toque seleciona o bloco, duplo toque edita (ou insere na linha `◆` vazia), toque longo abre o menu; botão "Multi" = Shift+clique.

## Gravação

Cada alteração grava `data/MapXXX.json` na hora e emite `map:changed {id}`; depois chama
`api.view._drawOverlay()` para atualizar as molduras do MapView. Set Starting Position grava
`data/System.json` e emite `db:changed`. Renomear switch/variável no seletor também grava `System.json`.
O editor de evento comum (aberto pelo buscador) grava `data/CommonEvents.json`.

## Integração com outros módulos

- Define `api.mode` (`"map"`/`"event"`) e emite `mode:changed {mode}`; escuta `mode:changed` de outros módulos.
  Sugestão ao maptools: só pintar quando `api.mode !== "event"`.
- Expõe `api.events` (instância de `EventMode`): `openEvent(id, page, row)`, `setMap`, `refresh`.
- Escuta `map:selected`, `map:changed` (redesenha se o mapa atual mudou) e `db:changed` (recarrega o arquivo no cache).

## Gostaria que fosse promovido à API

- `api.selectMap(id)` — o buscador hoje clica em `#mapTree div[data-id]` para trocar de mapa.
- `api.view.redrawOverlay()` público (hoje uso `_drawOverlay()`).
- `api.off(name, fn)` para remover ouvintes.
- Atualizar o texto "N eventos" da barra de status ao receber `map:changed`.
- `api.mode` e o evento `mode:changed` como contrato oficial entre maptools e events.

## Fora do escopo / limitações

- "Test" do menu da lista (executar comandos selecionados no jogo) não implementado.
- Preview da rota de movimento no mapa não implementado.
- Undo/redo de eventos não implementado (o `btnUndo` é do maptools).
- Plugin Command: args `struct<…>`/arrays editados como texto JSON; `@parent`, `@require`, `@dir` não usados.
- Troops: o buscador encontra referências nas páginas de tropas, mas a edição é do módulo database.
- Show Text: "Batch Entry" divide em blocos de 4 linhas; a guia vertical de largura é apenas visual.
- Textos da lista seguem o MZ em inglês; algumas variações de redação do editor original podem diferir em detalhes.

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<caminho absoluto>/testproject" --port 8782
```

Abra `http://127.0.0.1:8782/?modules=./events/index.js`, clique em Modo evento, dê duplo toque num tile,
adicione Show Text + Transfer Player, OK, e confira `data/Map001.json`. Teste de jogo pelo botão play.

Verificado em 1280×600: criar/editar/mover/copiar/colar/apagar, Quick Event (os 4 tipos), Set Starting
Position, Event List, Event Searcher (pula para a linha), todos os diálogos de comandos abrindo e gerando
parâmetros válidos, e execução no runtime real (`rmmz_objects.js`) de Show Text + Transfer, Treasure
(item + self switch + página 2), Inn (cobra e recupera) e Door (rotas + transfer).
