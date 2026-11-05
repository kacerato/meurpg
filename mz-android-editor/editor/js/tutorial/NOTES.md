# Módulo tutorial — Ajuda → Tutorial…

`register(api)` expõe `api.tutorial = { open(), start(step), stop(), isRunning() }` e emite
`"tutorial:completed" {step}`. CSS: `editor/css/tutorial.css`. O item de menu (Ajuda → Tutorial… / Parar o
tutorial) é da sessão dona do `menubar.js`: ligar em `api.tutorial.open()` e `api.tutorial.stop()`.

## De onde vêm os dados (oficiais, não aproximados)

No MZ o tutorial é o `Tutorial.exe` (Qt; `TutorialManager`, `TutorialIndicator`, `TutorialTooltip`,
conectado ao RPG.exe por socket — no RPG.exe só existe o módulo `Tkool.tutorial` e o `Dialog_TutorialSelector`).
Os roteiros estão no qrc do `Tutorial.exe`, comprimidos com zlib (rcc: `u32 BE tamanho` + zlib):

- `qml/Tutorial/TutorialList.js` → 19 etapas, títulos `qsTr("#N")` (contexto `TutorialList`);
- `qml/Tutorial/TutorialStep1..19.js` → `var scenario = [...]`, 1 560 passos no total. Campos: `id`,
  `name` (texto japonês de trabalho), `folder`, `translationId`, `x`/`y` (posição do balão na janela do PC),
  `windowKey` (MainWindow, DatabaseMain, EventEditorMain, EventCommand, ImageSelector, MapEditTreeBox,
  Location, NewProject, Copying...), `condition` (ver abaixo), `hint: qsTr("#translationId")`, `icon`
  (eye, click, doubleClick, rightClick, keyboard, wait), `jump`/`jumpNo` (id do próximo passo; Sim/Não),
  `command` (`presetData,stepN`), `showArrow`, `prohibited`;
- traduções `ja_JP.qm`, `en_US.qm`, `zh_CN.qm` (contexto `TutorialStepN`, fonte `#id`).

`data/` foi gerado por `tools/`: extrair os fluxos zlib do exe para `tut/` (ver `buildtut.py`), decodificar os
`.qm` com `tools/qmdump.mjs` (usa `tools/qm2json.mjs` do repositório) e rodar
`python buildtut.py <tut> editor/js/tutorial/data`. A correspondência arquivo → etapa é feita comparando o
`name` japonês de cada passo com a tradução ja_JP de `TutorialStepK/#id` (todas as 19 batem).

Idiomas: o Tutorial.exe só tem en, ja e zh — pt_BR e os demais mostram o inglês oficial (o MZ faz o mesmo).
Textos de interface usam o .qm do editor: "Seletor de Tutorial", "Iniciar o Tutorial", "O tutorial foi
completado.", "Parar o tutorial"; "Próximo" e o aviso de dados de exemplo estão em `extra.pt_BR.json`.

## Execução (o que é fiel e o que é aproximação)

Fiel: ordem dos passos, textos, ícones, Sim/Não com `jump`/`jumpNo`, saltos de `jump` após cada passo,
mensagem final. `click` → botão "Próximo" (no MZ, clicar no balão).

Aproximações (o MZ usa coordenadas x/y da janela do PC e eventos dos widgets Qt):
- **Destaque**: `action,X` → botão da barra correspondente (fileNew→#btnNew, fileSave→#btnSave,
  gamePlaytest→#btnPlay, modeMap/modeEvent, zoom, editCopy/editPaste...); `windowState,X,open` vindo da janela
  principal → botão que abre X (DatabaseMain→#btnDatabase...); `list,N` no Banco de dados → N-ésima aba (a
  ordem das abas é a do MZ: `list,10` = Tilesets, conferido); MapEditTreeBox → árvore de mapas; eventos de
  mapa → `#viewport`; outras janelas → o diálogo do topo.
- **Avanço**: `windowState,X,open|close` → quando um diálogo abre/fecha (contagem de `.mzDialogBackdrop`);
  GamePlayer → `#playOverlay` visível/oculto; Copying/FileDialog (não existem aqui) → avançam sozinhos;
  `action,Project Loaded` → projeto aberto; `action,fileSave` → evento `saved`; demais `action` → clique no
  botão mapeado ou em item de menu; `list`, `tabView`, `spinBox`, `comboBox`, `checked`, `radioButton`, `popup`,
  `mouseEvent`, `pressed`, `menuEvent` → primeira interação (click/change/contextmenu) dentro da janela-alvo.
  Todo passo com condição tem também "Pular" (toque, ou quando a condição não tem equivalente aqui).
- `prohibited` (bloquear o resto da tela) não é aplicado.
- O balão fica perto do alvo (abaixo/acima, com seta quando `showArrow`) e pode ser arrastado pelo título.
- **Dados de exemplo** (`presetData,stepN`): o MZ grava em um projeto novo os dados prontos do início de cada
  etapa, de `RPG/resource/patch/stepN/data/*.json-patch`. Formato decodificado em parte (`tools/patchdec2.py`):
  `u32 LE tamanho final` + ops `0x00 n-1` (literal curto), `0x01 n16-1` (literal), `0xFF pos16 n-1` e
  `0xFE pos16 n16-1` (cópia da base), `0xFD/0xFC` (pos32). A base é o JSON do projeto novo com chaves ordenadas;
  com o `newdata` do MZ 1.1.1 só uma parte dos arquivos da etapa 2 reconstrói (os patches são de agosto de
  2020, MZ 1.0 — a base mudou). Por isso o port não aplica os dados de exemplo: o passo mostra um aviso e o
  usuário segue com o próprio projeto.

## Teste (devserver, 1200×554)

Seletor com as 19 etapas; etapa 1: aviso inicial, "Clique em Novo projeto" com destaque/seta no botão, "Clique
em Banco de dados" → abrir o banco avança, `list,10` destaca a aba Tilesets, tocar nela avança, OK do banco
(fechamento) avança; etapa 2: Sim/Não (Não → passo 6 via `jumpNo`); etapa 19 até o fim → "O tutorial foi
completado.".
