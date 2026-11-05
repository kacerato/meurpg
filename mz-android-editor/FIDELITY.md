# Auditoria de fidelidade: MZ Editor × RPG Maker MZ 1.1.1

- **Base:** master `75dfa6a` (2026-11-05), já com a correção das camadas de A1 tipos 1–3 e a infraestrutura de i18n.
  O idioma dos rótulos foi ignorado: só funções e comportamento contam.
- **Fontes:** manual oficial `RPG/help-en/`. Atenção à numeração real: `01_03`/`01_04` são os controles e a barra de menus,
  `01_05` as ferramentas, `01_06` jogar e implantar, `01_07*` o mapa, `01_08*` o **Banco de dados**, `01_09*` os **Eventos**,
  `01_10*` os **Comandos de evento** e `01_11*` recursos e plugins.
- **Comparado com:** o código real (`editor/index.html`, `editor/js/*.js`, `editor/js/<módulo>/*.js`, `android/**/*.java`), lido arquivo por arquivo,
  e não só os `NOTES.md`. Formatos de comando conferidos com `testproject/js/rmmz_objects.js`.
- **Caminhos:** em geral relativos a `mz-android-editor/editor/js/`. Exceções: tabelas de Banco de dados (relativos a `editor/js/database/`), tabelas de detalhe de Arquivo/Ferramentas/Jogo/Ajuda/Implantação (relativos a `mz-android-editor/`) e `index.html` (em `editor/`).
  Os números de linha valem para `75dfa6a`.
- **Legenda:** **OK** = presente e fiel · **Parcial** = existe, mas falta algo ou se comporta diferente · **Ausente** = não existe · **Extra** = não existe no MZ.

Índice: [Resumo](#resumo) · [Verificação no editor](#verificação-no-editor-rodando) · [Observações transversais](#observações-transversais-afetam-várias-áreas) ·
[Tabelas por área](#tabelas-por-área) · [Prioridades](#prioridades) · [Divergências de comportamento](#divergências-de-comportamento)

## Resumo

| Área | OK | Parcial | Ausente | Situação |
|---|---|---|---|---|
| Banco de dados (16 abas, 25 traits, 13 effects) | 237 | 12 | 1 | Praticamente completo. Faltam a área [Status] do Teste de batalha e a pintura de tilesets por toque. |
| Comandos de evento (105 + 356) | 86 | 19 | 0 | Todos existem. Os parciais são ranges, prévias e menus de texto. |
| Rota de movimento (45 + diálogo) | 50 | 3 | 0 | — |
| Eventos (modo, editor, criação rápida, lista, busca) | 55 | 6 | 4 | Ausentes: Aplicar, busca por nome, Ctrl+Enter, desfazer em evento comum. |
| Mapa (design, paleta, lista, propriedades, masmorra, amostras, imagem) | quase tudo | poucos | 1 | Desenho completo. Falta expandir/recolher a árvore; há alguns limites diferentes. |
| Menus Arquivo / Editar / Modo / Desenho / Escala / Ferramentas / Jogo / Ajuda | — | — | barra de menus | **Não há barra de menus.** As ações ficam em ícones e no menu ☰. Fechar, Sair, Abrir pasta, Atualizar core script, Tutoriais e Site estão ausentes. |
| Ferramentas (Recursos, Teste de som, Opções) | maioria | vários | Tutoriais | Pasta `movies/` presente. No Android, Importar depende do file chooser do WebView (casca). |
| Jogo (teste de jogo, de batalha, de evento) | — | todos | modo `test` | Roda sem `?test` (sem F9 e sem atravessar obstáculos) e sem salvar antes. |
| Implantação | Web fiel | — | Windows/macOS | APK é extra. O .zip vem dentro de `www/`. |
| Plugins (gerenciador, tipos, comando 357) | quase tudo | poucos | Inserir ícone, texto livre | — |
| Gerador de personagens | todas as partes | poucos | — | Tamanhos de saída corretos. Importar/Exportar e Salvar/Carregar também em outro local. |

## Verificação no editor rodando

Devserver em `127.0.0.1:8788` com o `testproject`, tela de 1280×800. Todos os diálogos foram cancelados; `git status` ficou limpo depois.

- **Tela principal:** a barra de ferramentas tem todos os ícones do MZ, na mesma ordem.
  - Abrir fica desabilitado no PC (só a casca Android abre projeto).
  - Desfazer/Recortar/Copiar/Colar/Excluir ficam desabilitados até haver seleção.
  - **Não existe barra de menus.** O menu ☰ tem só Novo projeto, Resource Manager, Sound Test, Opções, Conteúdo da ajuda e Sobre.
  - A lista de mapas fica à esquerda e a paleta (abas A–E/R, Selecionar, Desfazer/Refazer, "A" sem autotile, Camada, −/+) no meio.
    No MZ as duas ficam empilhadas na coluna esquerda.
- **Lista de mapas:** o menu de contexto tem Editar, Novo, Carregar, Copiar, Colar, Excluir, Deslocar, Gerar masmorra e Salvar como imagem.
  - **Bug visto:** o menu de contexto não fecha com Esc e continua por cima do diálogo que se abre em seguida (aconteceu com o Gerador).
- **Banco de dados:** as 16 abas existem, com OK/Cancelar/Aplicar e os botões Alterar máximo, Multi, Copiar, Colar e Limpar.
  - Em Sistema 1, as caixas de **Imagens de veículos aparecem vazias** no testproject. Precisa conferir se o projeto não tem os gráficos ou se é bug de exibição.
  - A Cor da janela aparece como texto "0, 0, 0", sem a amostra de janela.
- **Modo evento:** barra inferior com Novo, Desfazer/Refazer, Recortar, Copiar, Colar, Excluir, Rápido ▸, Início ▸ e Lista.
  - Duplo clique em tile vazio abre o editor de um evento novo, como no MZ.
  - O editor de evento tem todas as seções, mas **não tem o botão Aplicar**.
- **Gerenciador de plugins:** Adicionar, Editar, Excluir, Copiar, Colar, Subir, Descer, Atualizar, Ativar todos, Desativar todos e OK/Cancelar/Aplicar.
- **Gerador:** abas Homem/Mulher/Criança, partes, Variação, Cor, Ajustar, Aleatório/Redefinir, 4 exportadores e Salvar/Carregar configurações.
- **Implantação:** plataformas Web/Android/iOS (HTML5) e APK, pasta e nome de saída, pasta ou .zip, excluir não usados e criptografia com chave.

## Observações transversais (afetam várias áreas)

1. **Sem projeto aberto, nenhum módulo carrega:** `app.js:152-161` retorna antes de `loadModules` (`app.js:197`).
   No primeiro uso do Android só "Abrir projeto" funciona; Novo projeto, Ajuda e Opções ficam inacessíveis.
2. **WebView sem `onShowFileChooser`** (`android/.../MainActivity.java:62-68`): nenhum `<input type=file>` funciona no aparelho.
   Isso afeta Importar e DLC do Gerenciador de recursos, "Importar recursos padrão" e `pickResource → Importar…`.
3. **Modelo de gravação diferente do MZ:** o MZ mantém tudo em memória até "Salvar projeto". Aqui:
   - Banco de dados, Plugins e eventos gravam na hora (OK/Aplicar);
   - só os tiles esperam o Salvar;
   - `events/eventmode.js:72` grava o `MapXXX.json` inteiro e provavelmente leva junto edições de tiles ainda não salvas (confirmar).
4. **Teste de jogo** (`app.js:93-98`): roda sem `?test` e sem salvar antes. Isso vale também para `?btest` e `?etest`.

## Tabelas por área

### Arquivo

#### Itens de menu (visão geral)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Novo Projeto | 01_04 | OK | `btnNew` ligado em `tools/index.js:75` → `openNewProject`; também no menu ☰ (`tools/index.js:35`); criação via `?newProject` (`app.js:163-179`) | Atalho de teclado; não pergunta se quer salvar o projeto aberto |
| Abrir Projeto | 01_04 | Parcial | `app.js:129-135` (`android.pickProject()` só na casca Android; no PC o botão fica desabilitado) | Atalho; no PC/navegador não há seletor; não confirma alterações não salvas antes de trocar |
| Fechar Projeto | 01_04 | Ausente | — | Item inexistente; sem confirmação "salvar antes de fechar?" (só o `beforeunload` genérico em `maptools/index.js:875-880`) |
| Salvar Projeto | 01_04 | Parcial | `btnSave` → `doSave` (`maptools/index.js:302-319, 841`); Ctrl+S em `maptools/index.js:793` | Grava só os mapas editados pelo maptools. O banco de dados grava no próprio diálogo (`database/index.js:63`) e os eventos gravam na hora (`events/eventmode.js:72`). Não há "salvar tudo" unificado; Ctrl+S é ignorado em modo evento e com diálogo aberto (`maptools/index.js:783`) |
| Implantação (Deployment) | 01_04 | OK (existência) | `btnDeploy` criado em `deploy/index.js:42-51` | Detalhe auditado por outra frente |
| Fechar RPG Maker MZ | 01_04 | Ausente | Só o botão Voltar do Android (`window.mzBack`, `app.js:137-150`), que fecha diálogos e o overlay | Sem item "Sair" nem confirmação de dados não salvos |

#### Detalhe

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Novo projeto: botão na barra / menu Arquivo | 01_02 (1), 01_04 | Parcial | `index.html:15` (`btnNew`); `tools/index.js:75` (`bindToolbar`), `:35` (item do menu ☰) | Só fica ativo **com um projeto já aberto** (ver observação transversal). No primeiro uso não há como criar projeto. Não existe menu "Arquivo" (só a barra e o ☰). |
| Novo projeto: campo Nome (pasta) | 01_02 (2) | OK | `tools/newproject.js:153`, validação `:146`/`:193` | Não mostra a recomendação de usar caracteres alfanuméricos. |
| Novo projeto: campo Título | 01_02 (2) | OK | `newproject.js:154`; aplicado a `System.json.gameTitle` e ao `<title>` em `:117-125` | — |
| Novo projeto: Local + botão "Escolher…" | 01_02 (2) | Parcial | `newproject.js:155-175`. Android: `MainActivity.java:262-273` (SAF) e `:135-163` | No Android o local só é escolhido **depois** do OK (não aparece no diálogo). No PC depende de `showDirectoryPicker`; sem ele, baixa um .zip. |
| Novo projeto: criar "projeto de exemplo" com todos os recursos | 01_02 (2) | OK | `tools/newproject.js` (`loadTemplate`, `createProject`); `android/app/template.gradle` (copia o `newdata` completo para `assets/editor/template-full/` + `manifest.json`); `app.js` (`?newProject`) | No APK o projeto novo é o `newdata` inteiro (1310 arquivos, 100 MB) e roda até o título e o MAP001 (testado no aparelho; cópia de ~8 min). **Bug da casca:** `MainActivity.createNewProjectIn` abre a pasta nova sem permissão (`buildTreeDocumentUri`), então hoje o Novo projeto falha no Android até a correção; no teste a pasta foi aberta por "Abrir projeto". No PC sem `editor/template-full/` cai para o template mínimo e avisa. Se a pasta já existir, o SAF cria "Nome (1)" sem avisar (`MainActivity.java:148`). |
| Novo projeto fecha o projeto atual | 01_04 | Parcial | Android: `MainActivity.java:157-158` (`loadUrl` com o novo projeto) | Não pergunta se deseja salvar: as alterações de mapa não salvas são perdidas sem aviso (`beforeunload` não dispara em `loadUrl` no WebView). |
| Gera `game.rmmzproject` | 01_02 | OK | `newproject.js:130` ("RPGMZ 1.1.1") | — |
| Abrir projeto | 01_02, 01_04 | Parcial | `app.js:129-135` → `Android.pickProject()` → `MainActivity.java:111-131` (SAF de pasta, persistido em `:45-48`) | No PC fica desabilitado (só via `--project` em `server.mjs:25`). Escolhe uma **pasta**, não o arquivo `game.rmmzproject`, e não valida se a pasta é um projeto MZ (`project.js:12-20`). Não confirma o descarte de alterações não salvas antes de trocar de projeto. |
| Salvar projeto | 01_02, 01_04 | Parcial | `maptools/index.js:302-319` (`doSave`), `:841` (bind), `:793` (Ctrl+S) | Grava **só os mapas modificados**. Banco de dados, plugins etc. gravam por conta própria ao confirmar o diálogo, então funciona na prática, mas "Salvar" não é um salvamento global. Não há cópia de segurança. |
| Fechar projeto (com "Salvar? Sim/Não") | 01_04 | Ausente | — | Não existe ação de fechar o projeto nem volta ao estado "sem projeto". |
| Implantação (Deployment) | 01_04, 01_11_03 | Parcial | `deploy/index.js:41-58` (botão `btnDeploy` após Testar jogo) | Ver a tabela de Implantação abaixo. |
| Sair do RPG Maker MZ (com confirmação) | 01_04 | Parcial | `maptools/index.js:875-880` e `options.js:63-65,71` (`beforeunload`) | No Android, o botão Voltar com `mzBack()` falso fecha a Activity (`MainActivity.java:196-…`) **sem** perguntar sobre alterações não salvas. Não há item "Sair". |
| Abrir pasta (Jogo → Abrir pasta) | 01_04 | Ausente | — | Sem equivalente; nem um "Compartilhar/abrir no gerenciador de arquivos" pelo SAF. |
| Conversão de dados MV | 01_01_01_02 | Ausente | Nenhuma ocorrência em `editor/js` | No MZ a conversão roda ao abrir um projeto com dados MV copiados. Aqui não há detecção nem conversão. Um JSON de MV aberto passa sem aviso. Prioridade baixa. |

### Editar


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Desfazer | 01_04 | OK | `btnUndo` → `doUndo` (`maptools/index.js:243-247, 836`); Ctrl+Z em `maptools/index.js:788`; no modo evento: `events/eventmode.js:51-53, 336, 488` | O manual fala em até 20 ações; aqui são 200 por mapa (`editops.js:99`) |
| Refazer | — (não existe no MZ 1.1.1) | Extra | Botão na faixa (`maptools/index.js:72`); Ctrl+Y / Ctrl+Shift+Z (`maptools/index.js:789`) | — |
| Recortar | 01_04 | Parcial | `btnCut` → `doCut` (`maptools/index.js:283-287, 837`) | Em modo mapa age só na área de tiles selecionada (ferramenta Selecionar). Não recorta **dados de mapa** da lista, como o manual descreve |
| Copiar | 01_04 | Parcial | `btnCopy` → `doCopy` (`maptools/index.js:262-270, 838`); copiar mapa só pelo menu de contexto (`maptree.js:191-196`) | O botão e o atalho não copiam o mapa selecionado na lista |
| Colar | 01_04 | Parcial | `btnPaste` → `doPaste` (`maptools/index.js:289-298, 839`) transforma a área copiada em pincel; colar mapa só pelo menu de contexto (`maptree.js:197`) | Não cola dados de mapa pela barra |
| Excluir | 01_04 | Parcial | `btnDelete` → `doDelete` (`maptools/index.js:272-281, 840`); tecla Del em `maptools/index.js:794` | Não exclui mapa pela barra nem pela tecla (só pelo menu de contexto, `maptree.js:198`) |
| Selecionar área | — | Extra | Ferramenta "Selecionar" na faixa (`maptools/index.js:70`) | Necessária no toque. No MZ a área vem do arrastar com botão direito, que também funciona aqui (`maptools/index.js:690-697`) |

### Modo


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Mapa | 01_04, 01_07_01 | OK | `btnModeMap` (`index.html:35`) é ouvido em `events/index.js:51`; `setMode` em `events/index.js:43-49`; o maptools reage a `mode:changed` (`maptools/index.js:858-868`) | Atalho de teclado |
| Evento | 01_04 | OK | `bindToolbar("btnModeEvent")` em `events/index.js:50` | Atalho de teclado |
| Região (aba R) | 01_04, 01_07_03 | OK | Aba "R" da paleta (`palette.js:10, 134-141`); sobreposição numerada em `maptools/index.js:349-412` | — |

### Desenho (e Camada)


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Lápis | 01_04, 01_07_01 | OK (ligado) | `TOOLS.btnPencil` + `bindToolbar` (`maptools/index.js:12, 832-835`) | Atalho de teclado |
| Retângulo | idem | OK (ligado) | idem | idem |
| Elipse | idem | OK (ligado) | idem | idem |
| Preencher | idem | OK (ligado) | idem | idem |
| Caneta de sombra | idem | OK (ligado) | idem | idem |
| Camada: Automático / Camada 1–4 | 01_04 (menu Layer), 01_07_01 | OK | `<select class="mtLayer">` na faixa (`maptools/index.js:77-88`); destaque da camada em `maptools/index.js:424-486` | Fica na faixa da paleta, não num menu; sem atalhos |
| Nenhuma ferramenta (rolar) | — | Extra | Tocar de novo na ferramenta ativa a desliga (`maptools/index.js:834`) | Necessário no toque (arrastar = rolar) |

### Escala


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Aumentar zoom | 01_04 | OK | `app.js:116` (×1,25, máx. 4×, `mapview.js:80`) | Passo contínuo de ×1,25 em vez de níveis fixos (os níveis do MZ precisam ser confirmados); sem atalho |
| Diminuir zoom | 01_04 | OK | `app.js:117` (mín. 0,125×) | idem |
| Tamanho real | 01_04 | OK | `app.js:136` | — |
| Pinça / Ctrl+roda do mouse | — | Extra | `mapview.js:210-268` | — |
| Grade (#) | — | Extra | `app.js:118-123`, `mapview.js:183-191` | No MZ a grade só aparece no modo evento |

### Ferramentas (inclui Opções, Gerenciador de recursos e Teste de som)

#### Itens de menu (visão geral)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Banco de dados | 01_04 | OK (ligado) | `database/index.js:21` | Atalho de teclado |
| Gerenciador de plugins | 01_04 | OK (ligado) | `plugins/index.js:30` | Atalho |
| Teste de som | 01_04 | OK (ligado) | `tools/index.js:74`; também no ☰ (`tools/index.js:37`) | Atalho |
| Buscador de eventos | 01_04 | OK (ligado) | `events/index.js:53` | Atalho |
| Gerador de personagem | 01_04 | OK (ligado) | `generator/index.js:56` | Atalho |
| Gerenciador de recursos | 01_04 | OK (ligado) | `tools/index.js:73`; também no ☰ (`tools/index.js:36`) | Atalho |
| Opções | — | Extra | ☰ em `tools/index.js:39` | — |

#### Detalhe

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Banco de dados (botão) | 01_04 | OK (existência) | `database/index.js:21` (`bindToolbar("btnDatabase")`) | Conteúdo coberto por outra auditoria. |
| Gerenciador de plugins (botão) | 01_04, 01_05 | OK (existência) | `plugins/index.js:30` | Conteúdo coberto por outra auditoria. |
| Buscador de eventos | 01_04, 01_05 | OK | `events/index.js:53`; `events/search.js:79-110` (Switch, Variable, Item, Weapon, Armor, Common Event, Text) | Já vai além do manual (switch, variável, nome). |
| Gerador de personagens (existência) | 01_04, 01_05 | OK (existência) | `generator/index.js:56` | Detalhes em outra auditoria. |
| **Gerenciador de recursos**: lista de pastas | 01_05 | OK | `tools/resources.js:8-17` (`FOLDERS`) | Ordem do MZ, com `movies/` (.webm/.mp4, prévia em `<video>`); `img/animations` (pasta do MV) saiu. |
| Gerenciador de recursos: lista de arquivos | 01_05 | OK | `resources.js:35-42` (`listFolder`, filtro por extensão), `:247-277` | Arquivos `.png_`/`.ogg_` (já criptografados) não aparecem, o que é coerente com "arquivos criptografados não podem ser usados no projeto". |
| Gerenciador de recursos: Pré-visualização | 01_05 | OK+ | `resources.js:175-205` (imagem com dimensões; áudio com Tocar/Parar; efkefc só o nome); `:207-215` (janela grande) | Extra fiel. Effekseer sem pré-visualização. |
| Gerenciador de recursos: Importar (vários arquivos) | 01_05 | Parcial | `resources.js:87-105`, `:46-56` (`<input type=file multiple>`) | **Não funciona no Android**: o WebView não tem `onShowFileChooser` (`MainActivity.java:62-68`). No PC está OK, valida extensão e confirma a sobrescrita. Não valida tamanho/formato pelos padrões de 01_11_01 (ex.: face 144×144). |
| Gerenciador de recursos: Exportar | 01_05 | OK | `resources.js:156-171`; Android `MainActivity.java:166-193,276-279` (`ACTION_SEND`) | No Android "Exportar" vira "Compartilhar" (um arquivo por vez, um seletor por arquivo). |
| Gerenciador de recursos: Excluir (vários com Shift) | 01_05 | OK | `resources.js:301-316`; seleção múltipla `:228-235,256-265`; `LocalServer.java:229` (DELETE) | — |
| Gerenciador de recursos: DLC | 01_05 | Parcial | `resources.js:317-320` → `importFromFolder` `:109-152` (`webkitdirectory`) | Não existe pasta DLC fixa (escolhe-se uma pasta). **Inoperante no Android** (`webkitdirectory` e file chooser ausentes). |
| (extra) Importar recursos padrão | — | OK | `resources.js` (`importDefaultResources`, `copyMissing`) | Usa o template completo do editor (o mesmo do Novo projeto) sem pedir pasta; só copia o que falta. Sem o template completo (PC), pede a pasta do `newdata`. |
| **Teste de som**: abas BGM/BGS/ME/SE | 01_05 | OK | `tools/soundtest.js:7,75-79` | — |
| Teste de som: lista de arquivos | 01_05 | OK | `soundtest.js:13-24,53-66` | — |
| Teste de som: Volume 0–100 % | 01_05 | OK | `soundtest.js:88`; `audio.js:54,75` | — |
| Teste de som: Pitch 50–150 % | 01_05 | OK | `soundtest.js:89` | No modo de reserva `<audio>` o pitch altera a velocidade (`audio.js:34`), igual ao WebAudio. |
| Teste de som: Balanço (Pan) −100–100 | 01_05 | OK | `soundtest.js:90`; aviso no modo de reserva `:96` | — |
| Teste de som: Tocar / Parar | 01_05 | OK | `soundtest.js:47-52,91-93` (+ "Parar tudo" `:94`) | — |
| Teste de som: barra de espaço toca | 01_05 | OK | `soundtest.js` (`onKey`) | Espaço toca o selecionado; ↑/↓ mudam a seleção. ME interrompe a BGM e ela volta do mesmo ponto quando o ME termina (`audio.js`, `resumeBgm`). |
| Teste de som: música continua após fechar | 01_05 | OK | `soundtest.js:1-3` (nada é parado ao fechar) | — |
| **Opções**: Cor transparente | 01_05 | OK | `tools/options.js` (R/G/B 0–255 + amostra, `--mz-transparent`); `css/tools.css` | Vale como fundo dos visualizadores de imagem (Resource Manager e seletores de imagem do banco, eventos, mapa e plugins), não do mapa. |
| Opções: Grade do mapa "Mostrar" | 01_05 | OK | `options.js:9,48-49,72-82,109` (sincroniza com `btnGrid`) | — |
| Opções: Tema | 01_05 | OK | `options.js:10,39,111` (claro/escuro) | — |
| Opções: Seletor de objetos (Dropdown/Extended/Smart) | 01_05 | Parcial | `options.js` (`objectSelectorMode`); `api.tools.objectSelectorMode(n)`; `html[data-object-selector]` | O valor já decide "dropdown"/"extended" (Smart: lista suspensa abaixo de 100). Falta os seletores de objetos de `events/ui.js` (`dataPick`) e `database/pickers.js` consultarem a função. |
| (extras) Ícones, Idioma, Confirmar ao sair, Salvar automaticamente | — | Extra | `options.js:12-15,113-117,50-60` | O idioma não traduz nada. O salvamento automático clica `btnSave` (só mapas). |
| Tutoriais | 01_04, 01_05 | Ausente | — | Não implementado (declarado em NOTES.md). |
| Gerar masmorra | 01_05 | Fora do escopo | (maptools / `afterBulkEdit`) | Coberto pela auditoria de mapas. |

### Jogo

#### Itens de menu (visão geral)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Testar jogo (Playtest) | 01_04 | Parcial | `btnPlay` → `openPlay` (`app.js:93-103, 124`), iframe com `/project/index.html` | **Não salva antes de testar** (o MZ salva sozinho): mapas com tiles não salvos rodam desatualizados. Sem atalho; não passa `?test` (modo de teste/depuração) |
| Abrir pasta | 01_04 | Ausente | — | Poderia usar a ponte Android (abrir no gerenciador de arquivos) |
| Atualizar script principal (Update Core Script) | 01_04 | Ausente | — | — |

#### Detalhe

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Teste de jogo (botão) | 01_04, 01_05 | Parcial | `index.html:45,67-76`; `app.js:93-103,124-126` (iframe `/project/index.html` em sobreposição, ↻ reinicia, ✕ fecha; Voltar do Android fecha em `app.js:141-144`) | **Abre sem `?test`** (`app.js:95`), então `$gameTemp.isPlaytest()` é falso no runtime. Isso desativa F9/depuração, Ctrl para atravessar obstáculos e os demais recursos de playtest. **Não salva antes**: mapas modificados e não salvos não aparecem no teste (no MZ, o teste de jogo salva o projeto antes). |
| Depuração F9 (switches/variáveis) | 01_05, 01_06 | Ausente | — | Depende de `?test`, e além disso o Android não tem tecla F9. Falta um botão "Depurar" na `#playBar` que chame `SceneManager.push(Scene_Debug)` no iframe. |
| Ctrl + direção atravessa obstáculos | 01_05, 01_06 | Ausente | — | Mesmo motivo (`?test`). No toque, falta um botão de alternância. |
| F8 Ferramentas de desenvolvedor | 01_05, 01_06 | Ausente (N/A) | — | Específico do NW.js. No Android poderia usar `WebView.setWebContentsDebuggingEnabled`; no PC há o DevTools do navegador. |
| F2/F3/F4/F5 (FPS, esticar, tela cheia, recarregar) | 01_06 | Parcial | ↻ = F5 (`app.js:126`) | F2–F4 só funcionam com teclado físico. Não há botão de tela cheia: o iframe permite `fullscreen` (`index.html:75`), mas falta o controle. |
| Sair do teste (X da janela) | 01_05 | OK | `app.js:100-103,125` | — |
| Teste de batalha (Banco de dados → Tropas) | 01_08 (outra área) | OK | `database/tabs_battle.js:301-326` (grava `Test_*.json` e `System.testBattlers/testTroopId`, abre `?btest`) | Não remove os `Test_*.json` ao fechar (o `etest` remove). Não passa `test`, então sem depuração. |
| Teste de evento (lista de comandos → Test) | — | OK | `events/etest.js:13-53` (`?etest`, limpeza ao fechar) | Sem `test` (sem depuração). |
| Abrir pasta | 01_04 | Ausente | — | Ver Arquivo. |
| Atualizar core script | 01_04 | Ausente | — | Não há como copiar `js/rmmz_*.js`/`libs` da versão do editor para o projeto (o template em `editor/template/js/` poderia servir de fonte). |
| Console / Exibir console | — | N/A | — | Não existe no MZ 1.1.1. |

### Ajuda

#### Itens de menu (visão geral)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Conteúdo (abre o manual) | 01_04 | OK | `btnHelpContents` → `openHelp` (`tools/help.js:9-30`, `tools/index.js:29`); manual em `editor/help/en/` | Atalho de teclado |
| Sobre | — (janela "Sobre" do MZ) | OK | `btnHelpAbout` → `openAbout` (`tools/index.js:31`) | — |
| Site do RPG Maker | 01_04 | Ausente | — | Não há link externo |
| Tutoriais | 01_04 | Ausente | — | — |

#### Detalhe

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Ajuda → Conteúdo (manual) | 01_04 ("About = Help window") | OK | `tools/help.js:9-34` (iframe `editor/help/en/`, voltar/avançar/início, tópicos); botão `tools/index.js:29`, menu `:41` | Só inglês. A lista rápida de tópicos (`help.js:19-22`) não inclui 01_06 (Jogar), 01_11_03 (Formatos de saída) nem 01_01_*; chega-se a eles pela navegação. Sem atalho F1. |
| Sobre | 01_04 | OK | `help.js:36-56` | Mostra a versão do port (0.4.0) e a do core script do projeto. |
| Site do RPG Maker | 01_04 | Ausente | — | Falta um link (trivial). |
| Tutoriais | 01_04 | Ausente | — | — |
| Menu "Ajuda" como menu | 01_04 | Parcial | Botões soltos + menu ☰ (`tools/index.js:26-65`) | Não há barra de menus (Arquivo/Editar/Modo/…/Ajuda). É uma escolha consciente para o celular, mas os itens só de menu (Fechar, Abrir pasta, Atualizar core script, Sair) ficaram sem lugar. |

---

### Atalhos de teclado


O manual (01_03/01_04) não lista teclas. A coluna "Manual" indica onde a ação é descrita. As teclas do editor nativo (Ctrl+N/O, F5/F6, F9 etc.) não aparecem no manual; os valores precisam ser confirmados no próprio MZ.

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Ctrl+Z (desfazer) | 01_04 | OK | `maptools/index.js:788`; `events/eventmode.js:488` | — |
| Ctrl+X / Ctrl+C / Ctrl+V | 01_04 | Parcial | `maptools/index.js:790-792` (só com área selecionada ou tiles copiados); `events/eventmode.js:485-487` | Não atuam na lista de mapas |
| Delete | 01_04 | Parcial | `maptools/index.js:794`; `events/eventmode.js:484` | idem |
| Ctrl+S (salvar) | 01_04 | Parcial | `maptools/index.js:793` | Bloqueado em modo evento e com diálogo aberto (`maptools/index.js:783`) |
| Ctrl+N / Ctrl+O | 01_04 | Ausente | — | — |
| Teclas de modo (Mapa/Evento), das ferramentas de desenho, das Ferramentas (BD, plugins…), do Playtest e da Ajuda | 01_04 | Ausente | Não há `keydown` global além de `maptools/index.js:782` e `events/eventmode.js:474`. F4/F5 do banco de dados só navegam na lista interna (`database/index.js:103`) | Mapear os atalhos do MZ |
| Shift ao desenhar = sem autotile | 01_07_01 | OK | `strokeStart` em `maptools/index.js:549`; no toque, botão "A" (`maptools/index.js:73-76`) | — |
| Shift + conta-gotas = tile exato | 01_07_01 | OK | `maptools/index.js:695, 762`; `editops.js:437-460` | Sem equivalente de toque: o toque longo não consulta o botão "A" |
| Esc limpa a seleção | — | Extra | `maptools/index.js:795` | — |
| Ctrl+Y / Ctrl+Shift+Z (refazer) | — | Extra | `maptools/index.js:789` | — |

### Mapa

#### Mapa (editor de design + paleta)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Layout: barra, paleta, lista de mapas, vista e status | 01_03 | Parcial | `index.html:22-75`; a paleta é inserida após a lista (`maptools/index.js:94-96`) | No MZ a paleta fica em cima e a lista embaixo, na coluna esquerda. Aqui são painéis lado a lado que se ocultam (`btnMaps`, `mtBtnPalette`) |
| Barra de status: função, nome do mapa, coordenadas | 01_03, 01_07 | Parcial | `app.js:75-79` (`Mapa 001 · L×A · tileset · n eventos`); coordenadas em `app.js:108-110` | Mostra o ID e não o **nome** do mapa; não descreve a ferramenta sob o cursor |
| Abas A–E e R | 01_07_01, 01_03 | OK | `palette.js:10, 74-97`; abas sem folha ficam desabilitadas | — |
| Aba A com A1–A5 | 01_07_01 | OK | `palette.js:108-133` | — |
| Seleção múltipla na paleta (arrastar) | 01_07_01 | OK | `palette.js:240-305` (mouse: arrastar; toque: toque longo de 350 ms + arrastar) | — |
| Moldura branca no tile selecionado | 01_07_01 | OK | `palette.js:211-223` | — |
| Lápis | 01_07_01 | OK | `strokeStart/strokeMove` em `maptools/index.js:554-596`; `editops.js:308-321` (padrão ancorado, interpolação de Bresenham) | — |
| Retângulo | 01_07_01 | OK | `maptools/index.js:558-603`; `editops.js:323-345` | — |
| Elipse | 01_07_01 | OK | idem, com `ellipse=true` | Fórmula própria; tamanhos pequenos podem diferir do MZ por alguns tiles (não verificado) |
| Preencher | 01_07_01 | OK | `editops.js:347-395` (4 vizinhos; compara por tipo de autotile e camada) | — |
| Caneta de sombra (¼ de tile, alterna) | 01_07_01 | OK | `maptools/index.js:567-573, 605-611`; `editops.js:397-401` | — |
| Apagar com o tile transparente (canto superior esquerdo de B) | 01_07_01 | OK | `editops.js:170-173` | — |
| Autotile A1–A4 | 01_07_01 | OK | `editops.js:239-283`, `autotile.js` | — |
| Sombra automática | 01_07_01 | OK | `editops.js:285-305` (preserva a sombra manual) | — |
| Camada superior: 2 tiles; o 3º expulsa o 1º; se o 3º for igual ao 2º, nada muda | 01_07_01 | OK | `editops.js:167-183` | — |
| Decoração A2 (colunas 5–8) sobre a base | 01_07_01 | OK | `editops.js:184-200` | — |
| Tipo campo: decoração sobre base das colunas 2/4 troca para 1/3 | 01_07_01 | OK | `editops.js:193-199` (`tileset.mode === 0`) | — |
| A1 tipos 1–3 sobre água rasa | (comportamento do MZ) | OK | `editops.js:187-191` (correção recente) | — |
| Seleção de camada (Auto / 1–4) com destaque | 01_07_01 | OK | `maptools/index.js:77-88, 424-486`; `placeTile`, `clearArea` e `pick` respeitam `layer` | — |
| Clique direito = conta-gotas; arrastar = copiar área | 01_07_01 | OK | `maptools/index.js:641-656, 690-697`; toque longo em `maptools/index.js:711-723` | — |
| Seleção / copiar / colar / excluir área | (MZ: arrastar com botão direito + menu Editar) | OK | `maptools/index.js:257-298`; o colar vira pincel e é posicionado com um toque | Ao colar, só aparece a moldura, sem prévia dos tiles |
| Regiões 1–255 (uma por tile) | 01_07_03 | OK | Aba R em `palette.js:134-141` (0–255; o 0 apaga); escrita na camada 5 em `editops.js:159-161` | — |
| Prévia do cursor (moldura do pincel) | — | OK | `drawOverlay` em `maptools/index.js:503-516` | Só aparece com mouse (hover) |
| Parallax "Mostrar no editor" | 01_07_03 | Parcial | `mapview.js:104-134` | Não aplica o scroll automático Sx/Sy (o manual avisa que a exibição pode diferir; aceitável) |
| Loop (tipo de rolagem) na vista | 01_07 | OK | `mapview.js:63-64` | — |
| Busca pelo menu de contexto | 01_03 | (fora do escopo) | Buscador de eventos em `events/index.js:53` | Auditado na frente de eventos |

#### Lista de mapas

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Árvore com raiz = nome do projeto | 01_07_02 | OK | `app.js:16-46, 198`; `index.html:62` | — |
| Clique seleciona e abre o mapa | 01_07_01 | OK | `app.js:34, 48-73` | — |
| Expandir/recolher nós | (MZ) | Ausente | `buildTree` ignora `info.expanded` e sempre mostra todos os filhos (`app.js:26-41`) | Setas de expandir/recolher; `moveInfo` grava `expanded`, mas a interface não usa |
| Menu de contexto (clique direito / toque longo de 550 ms) | 01_07_02 | OK | `maptree.js:177-238, 330-343, 393-396` | — |
| Editar… | 01_07_02 | OK | `editMapProperties` em `maptree.js:102-128` (desfazível via `recordFull`) | Renomear não entra no desfazer |
| Novo… | 01_07_02 | OK | `createMap` em `maptree.js:66-100` (abre Propriedades; padrão 17×13, `properties.js:374-387`) | — |
| Carregar… (mapas de exemplo) | 01_07_02 | OK | `sampleloader.js` (tabela própria abaixo) | — |
| Copiar | 01_07_02 | OK | `maptree.js:191-196` (área de transferência interna `S.mapClipboard`) | A cópia se perde ao recarregar a página |
| Colar | 01_07_02 | OK | `maptree.js:197` → `createMap(id, clipboard)` (vira filho do mapa clicado) | — |
| Excluir (com confirmação; inclui os filhos) | 01_07_02 | OK | `deleteMap` em `maptree.js:142-164` | Não desfazível (como no MZ) |
| Deslocar (Shift) | 01_07_02 | OK | `openShiftDialog/shiftMap` em `mapimage.js:29-93` (X/Y, desfazível) | O conteúdo dá a volta (módulo) e os eventos acompanham; confirmar se o MZ descarta em vez de rotacionar |
| Gerar Masmorra | 01_07_02 | OK | `maptree.js:204-207` → `dungeon.js` | Tabela própria abaixo |
| Salvar como Imagem | 01_07_02 | OK | `maptree.js:208-211` → `mapimage.js` | Tabela própria abaixo |
| Arrastar para agrupar (soltar em cima = vira último filho) | 01_07_02 | OK | `bindDrag` em `maptree.js:270-382`; `moveInfo` em `maptree.js:244-268` | Extra: também reordena (soltar antes/depois de um irmão) |
| Arrastar para a raiz (pasta do projeto) | 01_07_02 | OK | `maptree.js:306-308, 320` | Vai para o **fim** da raiz. O manual diz "move it to the top", ou seja, para o nível de cima da hierarquia; o efeito é equivalente |
| Toque: arrastar após toque longo | — | OK | `maptree.js:357-364` | O toque longo abre o menu e também inicia o arrasto; o menu fecha em `start` |

#### Propriedades do mapa

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Nome | 01_07_03 | OK | `properties.js:212, 339` → `MapInfos.name` (`maptree.js:118-121`) | — |
| Nome exibido | 01_07_03 | OK | `properties.js:213, 310` | — |
| Tileset | 01_07_03 | OK | `properties.js:214-220, 311`; a vista é recarregada em `maptree.js:122-125` | — |
| Largura / Altura (0–256) | 01_07_03 | Parcial | `properties.js:221-222, 328-329` limita a **1–256**; `resizeMapData` corta o excedente e anula eventos fora da área (`editops.js:463-481`) | O manual permite 0 |
| Tipo de rolagem (sem loop / vertical / horizontal / ambos) | 01_07_03 | OK | `properties.js:223-225, 312` | — |
| Definir fundo de batalha (2 imagens) | 01_07_03 | OK | `properties.js:232-239, 316` + `openImageDialog` (`properties.js:106-145`) | — |
| Passos de encontro (1–999) | 01_07_03 | OK | `properties.js:226, 313` | — |
| BGM / BGS automáticos (seletor com volume, tom e pan, e prévia) | 01_07_03 | OK | `properties.js:228-231, 314-315`; `openAudioDialog` (`properties.js:50-103`) | — |
| Desativar corrida | 01_07_03 | OK | `properties.js:240, 317` | — |
| Parallax: imagem […] | 01_07_03 | OK | `properties.js:250-256` | — |
| Parallax: loop horizontal / vertical | 01_07_03 | OK | `properties.js:257-258, 318-319` | — |
| Parallax: scroll X/Y (−32 a 32, só com loop) | 01_07_03 | OK | `properties.js:259-265, 320-321` | — |
| Parallax: mostrar no editor | 01_07_03 | OK | `properties.js:261, 322`; usado em `mapview.js:110` | — |
| Notas (Memo) | 01_07_03 | OK | `properties.js:266-267, 323` | — |
| Encontros: lista; duplo clique na linha vazia adiciona | 01_07_03 | OK | `properties.js:270-297` | — |
| Encontros: tropa | 01_07_03 | OK | `openEncounterDialog` em `properties.js:148-190` | — |
| Encontros: peso (0–100) | 01_07_03 | Parcial | `properties.js:158, 174` limita a **1–100** | O manual permite 0 |
| Encontros: área (mapa inteiro / até 3 IDs de região) | 01_07_03 | OK | `properties.js:159-173` | — |
| Encontros: menu de contexto Copiar/Excluir | 01_07_03 | Parcial | Botões Novo/Editar/Excluir (`properties.js:298-301`) | Faltam **Copiar/Colar** de encontro e o menu de contexto (toque longo) |
| OK / Cancelar | 01_03 | OK | `properties.js:303-335` | Sem "Aplicar" (o diálogo do MZ também não tem) |

#### Gerar masmorra

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Tipo: salas e passagens / labirinto | 01_07_02 → Aid Tools | OK | `dungeon.js:24-133, 259-262` | — |
| Opções: adicionar margens / passagens largas | idem | OK | `dungeon.js:263-265` | — |
| Escolha de parede (A4) e piso (A5) com miniaturas | idem | OK | `dungeon.js:192-199, 269-271` | Paredes limitadas aos tetos de A4 das linhas pares; pisos só de A5 (não de A1–A3) |
| Exige tileset com A4 e A5 | — | OK | `dungeon.js:186-189` (mensagem na barra de status) | — |
| Aplicação com autotile e sombra, desfazível | — | OK | `applyDungeon` em `dungeon.js:135-163` | Limpa as camadas 1–4 e mantém os eventos (confirmar com o MZ) |

#### Mapas de exemplo

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Diálogo "Carregar" com lista, prévia e OK | 01_07_02 | OK | `sampleloader.js:17-79` | — |
| Conteúdo (104 mapas do MZ) | 01_07_02 | OK | `editor/samplemaps/manifest.json` (104 entradas, igual a `RPG/samplemaps`) | — |
| Cria um mapa novo com o nome do exemplo, filho do mapa clicado | 01_07_02 | OK | `maptree.js:186-189` → `createMap` | Não abre Propriedades depois de carregar; o MZ também cria direto |

#### Salvar imagem do mapa

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Salvar como imagem (PNG) | 01_07_02 | Parcial | `openSaveImageDialog/save` em `mapimage.js:136-185`; desenho em `mapimage.js:95-134` | Grava num caminho **dentro da pasta do projeto**, sem seletor de arquivo e sem compartilhar via `Android.shareFile` (a ponte existe, ver `tools/resources.js:158`). Reduz mapas maiores que 4096² px. Não desenha parallax nem eventos. A1 animado sai só no quadro 0 |

### Eventos


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Entrar no modo evento (botão / Mode→Events) | 01_09, 01_09_02 | OK | index.js (`btnModeEvent`), eventmode.js | — |
| Criar evento por duplo clique em tile vazio | 01_09_02 | OK | eventmode.js:449-457, `editAt` 138-149 | ID = primeiro buraco livre (`newId` 77-82), como o MZ. |
| Reeditar por duplo clique no ícone | 01_09_02 | OK | eventmode.js:452-456 | — |
| Mover evento arrastando | 01_09_02 | OK | eventmode.js:419-446, `moveEvent` 196-203 | Bloqueia tile ocupado/fora do mapa. |
| Ícone = imagem da 1ª página, moldura branca | 01_09_02 | OK | eventmode.js:235, 296 | — |
| Event List (substitui a paleta de tiles) | 01_09_02 | Parcial | eventmode.js:327, 352-371 | Painel flutuante opcional ("☰ List"), não substitui a paleta; sincronização mapa→lista só quando o painel está aberto; sem menu de contexto na lista. |
| Duplo clique na Event List abre o editor | 01_09_02 | OK | eventmode.js:361-364 | — |
| Menu de contexto: Edit / New | 01_09_02 | OK | eventmode.js:206-219 | Botão direito ou toque longo. |
| Menu de contexto: Cut | 01_09_02 | OK | eventmode.js:160, 210 | — |
| Menu de contexto: Copy | 01_09_02 | OK | eventmode.js:159, 211 | Clipboard também em localStorage. |
| Menu de contexto: Paste | 01_09_02 | OK | eventmode.js:161-169, 212 | Novo ID; desabilitado em tile ocupado. |
| Menu de contexto: Delete | 01_09_02 | OK | eventmode.js:170-176, 213 | — |
| Menu de contexto: Quick Event Creation | 01_09_02 | OK | eventmode.js:215-217 | Submenu com os 4 tipos (desabilitado em tile ocupado). |
| Quick Event: Transfer | 01_09_02 | OK | quick.js:34-37, 62-64 | Local + Direção (+ Fade extra). SE Move1, Player Touch, Below characters. |
| Quick Event: Door | 01_09_02 | OK | quick.js:38-42, 65-71 | Imagem + Local (+ Fade extra); rotas de abrir porta/entrar/fechar. |
| Quick Event: Treasure | 01_09_02 | OK | quick.js:43-49, 72-86 | Imagem + Conteúdo (Gold/Item/Weapon/Armor); página 2 com Self Switch A e baú aberto. |
| Quick Event: Inn | 01_09_02 | OK | quick.js:50-55, 87-111 | Imagem + Preço. Textos fixos em inglês. |
| Set Starting Position: Player | 01_09_02 | OK | eventmode.js:186-195, 206 | Grava System.json. |
| Set Starting Position: Boat / Ship / Airship | 01_09_02 | OK | eventmode.js:190-191, 206 | — |
| Moldura azul nas posições iniciais | 01_09_02 | OK | eventmode.js:277-299 | Mostra também o gráfico do líder/veículo. |
| Teclado no mapa (setas, Enter, Delete, Ctrl+C/X/V, Ctrl+Z/Y) | — | OK | eventmode.js:474-490 | Extra: desfazer/refazer (100 passos por mapa). |
| Barra principal Cut/Copy/Paste/Delete/Undo no modo evento | — | OK | eventmode.js:336 | — |
| Editor: ID na barra de título | 01_09_03 | OK | eventeditor.js:25 | — |
| Editor: Name | 01_09_03 | OK | eventeditor.js:29-31 | Nome automático "EV###". |
| Editor: Memo/Note | 01_09_03 | OK | eventeditor.js:30-32 | Campo de 1 linha. |
| Editor: abas de páginas | 01_09_03 | OK | eventeditor.js:46-56 | — |
| New Event Page | 01_09_03 | Parcial | eventeditor.js:39 | Insere após a atual; **não limita a 20 páginas**. |
| Copy Event Page | 01_09_03 | OK | eventeditor.js:40 | Clipboard só em memória. |
| Paste Event Page | 01_09_03 | Parcial | eventeditor.js:41 | Sem limite de 20 páginas. |
| Delete Event Page | 01_09_03 | OK | eventeditor.js:42 | Não apaga a única página. |
| Clear Event Page | 01_09_03 | OK | eventeditor.js:43 | Pede confirmação (MZ não pede). |
| Condições: Switch ×2, Variable ≥, Self Switch, Item, Actor | 01_09_03 | OK | eventeditor.js:59-82 | — |
| Imagem (arquivo, índice, direção/padrão, tiles B–E, (None)) | 01_09_03 | OK | eventeditor.js:84-92; ui.js `characterDialog` 413+ | — |
| Movimento autônomo: Type | 01_09_03 | OK | eventeditor.js:94-104 | — |
| Movimento autônomo: Speed 1–6 / Frequency 1–5 | 01_09_03 | OK | eventeditor.js:105-106 | — |
| Movimento autônomo: Custom → rota (com prévia) | 01_09_03 | OK | eventeditor.js:95-102 | Botão "Route…" só em Custom. |
| Opções: Walking, Stepping, Direction Fix, Through | 01_09_03 | OK | eventeditor.js:109-110 | — |
| Prioridade (Below/Same/Above) | 01_09_03 | OK | eventeditor.js:111 | — |
| Gatilho (5 tipos) | 01_09_03 | OK | eventeditor.js:112 | — |
| Botão Apply do diálogo | (diálogos MZ: OK/Cancel/Apply) | Ausente | ui.js `dialog` 32-55 | Só OK/Cancel. |
| Contents: linha ◆ vazia + duplo clique insere/edita | 01_09_03 | OK | commandlist.js:317-327, `edit` 224-241 | — |
| Contents: New | 01_09_03 | OK | commandlist.js:207-223 | Paleta de 3 abas (`pickCommand`, cmd.js:1461). |
| Contents: Edit | 01_09_03 | OK | commandlist.js:224-241, `applyEdit` 106-128 | Reconstrói ramos de Choices/If/Battle preservando corpos. |
| Contents: Cut | 01_09_03 | OK | commandlist.js:243 | — |
| Contents: Copy | 01_09_03 | OK | commandlist.js:242 | Clipboard compartilhado entre listas (+localStorage). |
| Contents: Paste | 01_09_03 | OK | commandlist.js:244-253 | Reajusta indent. |
| Contents: Delete | 01_09_03 | OK | commandlist.js:254-260 | — |
| Contents: Select All | 01_09_03 | OK | commandlist.js:261 | — |
| Contents: Copy as Text | 01_09_03 | OK | commandlist.js:262-268 | — |
| Contents: Copy as HTML Tags | 01_09_03 | Parcial | commandlist.js:269-275 | Só escapa `&`/`<` e junta com `<br>`; o MZ gera HTML com cores/recuo. Sem fallback se `navigator.clipboard` falhar. |
| Contents: Test | 01_09_03 | OK | commandlist.js:277-281; etest.js | Roda os selecionados (ou tudo) em mapa vazio com `?etest`. |
| Contents: seleção por bloco (◆ + linhas ：) | 01_09_03 | OK | commandlist.js:37-52 | — |
| Contents: seleção múltipla com **Shift+clique** | 01_09_03 | Parcial | commandlist.js:185-197, 317-327, 346-348 | Só via botão "Multi"; `e.shiftKey` não é lido no clique; sem Shift+setas. Restrição "mesmo ramo" aplicada (mesmo indent). |
| Contents: teclado (Enter/Espaço, Delete, Ctrl+C/X/V/A, setas) | — | OK | commandlist.js:330-340 | — |
| Contents: ativar/desativar comando | (não existe no MZ) | OK | — | Corretamente ausente. |
| Paleta Event Commands (3 abas, grupos, ordem) | 01_10 | OK | cmd.js:1452-1479 | Idêntica ao manual (36/34/35); lembra a última aba. |
| Editor de evento comum (via buscador) | 01_09 | OK | eventeditor.js:127-149 | — |
| Event Searcher: abrir | 01_05 | OK | search.js:79; index.js (`btnEventSearch`) | — |
| Event Searcher: por Switch | 01_05 | OK | search.js:31-37, 51-53, 63, 71 | Condições de página, rotas, gatilho de evento comum, tropas, comandos. |
| Event Searcher: por Variable | 01_05 | Parcial | search.js:31-37; `refs` em cmd.js | Sem `refs` em 231/232 (posição por variável), 111 aba 2/3, condição de variável de tropa não verificada (search.js:70-71), Plugin Command; Control Variables com Game Data não indexa ator/inimigo. |
| Event Searcher: por **nome** de evento | 01_05 ("switches, variables, or names") | Ausente | search.js:107-111 | "Text" busca só no texto dos comandos, não no nome do evento. |
| Event Searcher: Item/Weapon/Armor/Common Event/Texto | — (extra) | OK | search.js:107-111 | Itens 605 da loja não indexados (só o 1º). |
| Event Searcher: resultado leva ao evento/página/linha | 01_05 | OK | search.js:91-98 | Tropas só mostram alerta. |
| Desfazer de evento comum / renomear switch-variável | — | Ausente | NOTES.md "Fora do escopo" | — |
| Atalho Ctrl+Enter = OK nos diálogos (Show Text) | 01_10_01 Remarks | Ausente | ui.js `dialog` 32-55 (sem keydown) | — |

### Comandos de evento


#### 01_10_01 — Mensagens (aba 1)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Show Text (101/401) | 01_10_01 | Parcial | cmd.js:217-256 (`def(101)`), `messageTextEditor` 166-210, `renderMessagePreview` 1526, `colorPicker`/`iconPicker` 1497-1525 | Rosto, Nome, Fundo, Posição, Prévia, Batch Entry, guia de largura, inserir cor/ícone: OK. Falta: atalho **Ctrl+Enter = OK**; menu de contexto do texto (**Plugin Help**); `\PX[n]`, `\PY[n]`, `\FS[n]` sem botão (só digitando). Prévia não mostra a posição (Top/Middle/Bottom) nem o fundo (Dim/Transparent) e corta em 4 linhas; `\V[n]` aparece como "0". |
| Show Choices (102/402/403/404) | 01_10_01 | OK | cmd.js:257-293 | 6 escolhas, Fundo, Posição (Left/Middle/Right), Default (None/#1-6), Cancel (Branch/Disallow/#1-6). Sem códigos de controle auxiliares (só digitando). Cancel/Default além do nº de escolhas viram -1 silenciosamente (MZ desabilita as opções). |
| Input Number (103) | 01_10_01 | OK | cmd.js:294-306 | Variável + dígitos 1–8. |
| Select Item (104) | 01_10_01 | OK | cmd.js:307-321 | Variável + tipo (Regular/Key/Hidden A/B); padrão Key Item (2) como no MZ. |
| Show Scrolling Text (105/405) | 01_10_01 | Parcial | cmd.js:322-335 | Texto, Velocidade 1–8, No Fast Forward OK. Falta menu de contexto (Plugin Help, **Icon Set Viewer**) e prévia. |

#### 01_10_02 — Progressão do jogo (aba 1)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Control Switches (121) | 01_10_02 | OK | cmd.js:338-357 | Single (seletor com nome) / Range; ON/OFF. |
| Control Variables (122) | 01_10_02 | OK | cmd.js:405-461, `gameDataDialog` 378-404 | Single/Range; Set/Add/Sub/Mul/Div/Mod; Constant/Variable/Random/Game Data/Script. Game Data: Item, Weapon, Armor, Actor (Level, EXP, HP, MP, 8 parâmetros, TP), Enemy (HP, MP, 8 parâm., TP), Character (Map X/Y, Direction, Screen X/Y), Party (#1–8), Other (10 itens: Map ID…Escape Count), Last (6 itens) — índices conferem com `gameDataOperand` (rmmz_objects.js:10169). Script é campo de 1 linha (MZ igual). |
| Control Self Switch (123) | 01_10_02 | OK | cmd.js:462-473 | A–D, ON/OFF. |
| Control Timer (124) | 01_10_02 | OK | cmd.js:474-487 | Start (0–99 min, 0–59 s) / Stop. |

#### 01_10_03 — Controle de fluxo (aba 1)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Conditional Branch (111/411/412) | 01_10_03 | OK | cmd.js:524-626, `condText` 493-523 | Aba 1: Switch, Variable (6 comparações, Constant/Variable), Self Switch, Timer (≥/≤, min/s). Aba 2: Actor (In the Party, Name, Class, Skill, Weapon, Armor, State). Aba 3: Enemy (Appeared/State), Character (direção), Vehicle. Aba 4: Gold (≥/≤/<), Item, Weapon/Armor (+Include Equipment), Button (9 botões × pressed/triggered/repeated), Script. "Create Else Branch". Falta só o menu Plugin Help no Script. |
| Loop (112/413) | 01_10_03 | OK | cmd.js:629-630 | Sem parâmetros; gera Loop + Repeat Above (ver commandlist.js). |
| Break Loop (113) | 01_10_03 | OK | cmd.js:631 | — |
| Exit Event Processing (115) | 01_10_03 | OK | cmd.js:632 | — |
| Common Event (117) | 01_10_03 | OK | cmd.js:633-641 | Seletor de evento comum. |
| Label (118) | 01_10_03 | OK | cmd.js:642-645 | — |
| Jump to Label (119) | 01_10_03 | OK | cmd.js:646-659 | Campo texto com `datalist` dos labels da lista (MZ: combo). |
| Comment (108/408) | 01_10_03 | Parcial | cmd.js:660-670 | Texto multilinha OK; falta menu Plugin Help. |

#### 01_10_04 — Grupo (aba 1)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change Gold (125) | 01_10_04 | Parcial | cmd.js:673-678, `operandUI` 65-74 | Increase/Decrease, Constant/Variable OK. Range do Constant 0–9 999 999 (MZ: 1–99 999 999?); mínimo aceito 0 em vez de 1. |
| Change Items (126) | 01_10_04 | Parcial | cmd.js:679-697 | Item, operação, operando OK. Range do Constant genérico (0–9 999 999), MZ limita (1–9 999). |
| Change Weapons (127) | 01_10_04 | Parcial | cmd.js:679-697 | Idem + Include Equipment OK. |
| Change Armors (128) | 01_10_04 | Parcial | cmd.js:679-697 | Idem + Include Equipment OK. |
| Change Party Member (129) | 01_10_04 | OK | cmd.js:698-710 | Ator, Add/Remove, Initialize (só no Add). |

#### 01_10_05 — Ator (aba 1)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change HP (311) | 01_10_05 | Parcial | cmd.js:713-739 (`actorValueCmd`), `actorTargetUI` 76-81 | Fixed (com Entire Party)/Variable, operação, operando, Allow Death OK. Range do Constant 0–9 999 999 (manual: 1–9 999). |
| Change MP (312) | 01_10_05 | Parcial | idem | Range (manual 1–9 999). |
| Change TP (326) | 01_10_05 | Parcial | idem | Range (manual 1–100). |
| Change State (313) | 01_10_05 | OK | cmd.js:745-757 | Ator Fixed/Variable, Add/Remove, State. |
| Recover All (314) | 01_10_05 | OK | cmd.js:758-761 | — |
| Change EXP (315) | 01_10_05 | Parcial | cmd.js:742 | Show Level Up OK; mínimo 0 (manual 1–9 999 999). |
| Change Level (316) | 01_10_05 | Parcial | cmd.js:743 | Show Level Up OK; range (manual 1–98). |
| Change Parameter (317) | 01_10_05 | Parcial | cmd.js:744 | Parâmetro (8) OK; range (manual 1–9 999). |
| Change Skill (318) | 01_10_05 | OK | cmd.js:762-774 | Fixed/Variable, Learn/Forget, Skill. |
| Change Equipment (319) | 01_10_05 | OK | cmd.js:775-798 | Ator, Tipo de equip., item filtrado por etype (lista não filtra pelo que o ator pode equipar, como o MZ faz). |
| Change Name (320) | 01_10_05 | OK | cmd.js:799-813 | — |
| Change Class (321) | 01_10_05 | OK | cmd.js:816-827 | Ator, Classe, "Save EXP" (manual chama "Save Level"). |
| Change Nickname (324) | 01_10_05 | OK | cmd.js:814 | — |
| Change Profile (325) | 01_10_05 | OK | cmd.js:815 | Multilinha (3 linhas). |

#### 01_10_06 — Movimento (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Transfer Player (201) | 01_10_06 | OK | cmd.js:830-849, `designationUI` 83-96, `locationPick` ui.js:730 | Direta (mini-mapa com troca de mapa) / por variáveis (ID, X, Y), Direção (Retain/4 dir), Fade (Black/White/None). |
| Set Vehicle Location (202) | 01_10_06 | OK | cmd.js:850-863 | Boat/Ship/Airship + designação. |
| Set Event Location (203) | 01_10_06 | OK | cmd.js:864-891 | Evento (This Event + eventos), Direta/Variáveis/Exchange with another event, Direção. |
| Scroll Map (204) | 01_10_06 | OK | cmd.js:892-905 | Direção, Distância 1–100, Velocidade 1–6, Wait. |
| Set Movement Route (205/505) | 01_10_06, 01_10_06_01 | OK | cmd.js:906-922, `moveRouteDialog` (moveroute.js) | Ver tabela "Rota de movimento". |
| Get on/off Vehicle (206) | 01_10_06 | OK | cmd.js:936 | — |

#### 01_10_07 — Personagem (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change Transparency (211) | 01_10_07 | OK | cmd.js:939-942 | — |
| Change Player Followers (216) | 01_10_07 | OK | cmd.js:943-946 | — |
| Gather Followers (217) | 01_10_07 | OK | cmd.js:947 | — |
| Show Animation (212) | 01_10_07 | OK | cmd.js:948-959 | Personagem (Player/This Event/eventos), Animação, Wait. Sem prévia da animação. |
| Show Balloon Icon (213) | 01_10_07 | OK | cmd.js:960-972 | 15 balões (10 + 5 definidos pelo usuário). Sem prévia gráfica do balão. |
| Erase Event (214) | 01_10_07 | OK | cmd.js:973 | — |

#### 01_10_08 — Imagem (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Show Picture (231) | 01_10_08 | OK | cmd.js:996-1007, `pictureUI` 979-994 | Número 1–100, Imagem (com prévia), Origem (Upper Left/Center), Direta (−9999..9999)/Variáveis, Escala −2000..2000 %, Opacidade 0–255, Blend (4). |
| Move Picture (232) | 01_10_08 | OK | cmd.js:1008-1020 | Idem + Duração 1–999, Wait, Easing (4). |
| Rotate Picture (233) | 01_10_08 | OK | cmd.js:1021-1027 | Velocidade −90..90. |
| Tint Picture (234) | 01_10_08 | Parcial | cmd.js:1028-1038, `tonePick` ui.js:610-633 | R/G/B −255..255, Gray 0–255, presets, duração, wait OK. "Prévia" é só um quadrado cinza tingido, não a imagem de amostra do MZ. |
| Erase Picture (235) | 01_10_08 | OK | cmd.js:1039-1042 | — |

#### 01_10_09 — Tempo (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Wait (230) | 01_10_09 | OK | cmd.js:1045-1048 | 1–999 frames. |

#### 01_10_10 — Tela (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Fadeout Screen (221) | 01_10_10 | OK | cmd.js:1049 | — |
| Fadein Screen (222) | 01_10_10 | OK | cmd.js:1050 | — |
| Tint Screen (223) | 01_10_10 | Parcial | cmd.js:1051-1057 | Normal/Dark/Sepia/Sunset/Night, duração, wait OK. Prévia é só amostra de cor (MZ mostra imagem de amostra tingida). |
| Flash Screen (224) | 01_10_10 | OK | cmd.js:1058-1064 | R/G/B 0–255, Intensity, amostra RGBA, duração, wait. |
| Shake Screen (225) | 01_10_10 | OK | cmd.js:1065-1075 | Power/Speed 1–9 (sliders), duração, wait. |
| Set Weather Effect (236) | 01_10_10 | OK | cmd.js:1076-1089 | None/Rain/Storm/Snow, Power 1–9, duração, wait. |

#### 01_10_11 — Áudio e vídeo (aba 2)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Play BGM (241) | 01_10_11 | OK | cmd.js:1092, `audioCmd` 105-114, `audioDialog` ui.js:377-391 | Lista com (None), Play/Stop, Volume 0–100, Pitch 50–150, Pan −100..100 (rótulo "Pan", manual "Balance"). |
| Fadeout BGM (242) | 01_10_11 | OK | cmd.js:1093-1096 | 1–60 s. |
| Save BGM (243) | 01_10_11 | OK | cmd.js:1097 | — |
| Resume BGM (244) | 01_10_11 | OK | cmd.js:1098 | Rotulado "Replay BGM" (manual MZ: "Resume BGM"). |
| Play BGS (245) | 01_10_11 | OK | cmd.js:1099 | idem Play BGM. |
| Fadeout BGS (246) | 01_10_11 | OK | cmd.js:1100-1103 | — |
| Play ME (249) | 01_10_11 | OK | cmd.js:1104 | — |
| Play SE (250) | 01_10_11 | OK | cmd.js:1105 | — |
| Stop SE (251) | 01_10_11 | OK | cmd.js:1106 | — |
| Play Movie (261) | 01_10_11 | OK | cmd.js:1107-1118 | Lista `movies` (webm/mp4, sem duplicar extensão). Sem prévia/Play. |

#### 01_10_12 — Controle de cena (aba 3)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Battle Processing (301/601/602/603/604) | 01_10_12 | OK | cmd.js:1121-1139 | Direta / Variável / Same as Random Encounter; Can Escape; Can Lose (ramos If Win/Escape/Lose reconstruídos em commandlist.js). |
| Shop Processing (302/605) | 01_10_12 | Parcial | cmd.js:1141-1187 | Lista Merchandise/Price, diálogo Item/Weapon/Armor + Standard/Specify, Purchase Only OK. Edição por botões Edit/Add/Delete (duplo clique também); falta reordenar/copiar linhas e menu de contexto da lista. |
| Name Input Processing (303) | 01_10_12 | OK | cmd.js:1188-1194 | Ator, 1–16 caracteres. |
| Open Menu Screen (351) | 01_10_12 | OK | cmd.js:1195 | — |
| Open Save Screen (352) | 01_10_12 | OK | cmd.js:1196 | — |
| Game Over (353) | 01_10_12 | OK | cmd.js:1197 | — |
| Return to Title Screen (354) | 01_10_12 | OK | cmd.js:1198 | — |

#### 01_10_13 — Configurações do sistema (aba 3)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change Battle BGM (132) | 01_10_13 | OK | cmd.js:1201 | — |
| Change Victory ME (133) | 01_10_13 | OK | cmd.js:1202 | — |
| Change Defeat ME (139) | 01_10_13 | OK | cmd.js:1203 | — |
| Change Vehicle BGM (140) | 01_10_13 | OK | cmd.js:1204-1210 | Veículo + BGM (Play/Stop/Vol/Pitch/Pan). |
| Change Save Access (134) | 01_10_13 | OK | cmd.js:1211-1217 | Disable/Enable. |
| Change Menu Access (135) | 01_10_13 | OK | cmd.js:1218 | — |
| Enable/Disable Encounters (136) | 01_10_13 | OK | cmd.js:1219 | Rotulado "Change Encounter". |
| Change Formation Access (137) | 01_10_13 | OK | cmd.js:1220 | — |
| Change Window Color (138) | 01_10_13 | Parcial | cmd.js:1221-1224 | R/G/B −255..255 OK; prévia é amostra de cor, não janela com o `Window.png` tingido. |
| Change Actor Images (322) | 01_10_13 | OK | cmd.js:1225-1235 | Face, Character, [SV] Battler. |
| Change Vehicle Image (323) | 01_10_13 | OK | cmd.js:1236-1242 | — |

#### 01_10_14 — Mapa (aba 3)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change Map Name Display (281) | 01_10_14 | OK | cmd.js:1245-1248 | — |
| Change Tileset (282) | 01_10_14 | OK | cmd.js:1249-1252 | — |
| Change Battle Background (283) | 01_10_14 | Parcial | cmd.js:1253-1256 | Dois seletores separados (Battlebacks 1/2) com prévia individual; MZ usa um diálogo único com prévia composta das duas camadas. |
| Change Parallax (284) | 01_10_14 | OK | cmd.js:1257-1268 | Imagem, Loop H/V, Scroll −32..32. |
| Get Location Info (285) | 01_10_14 | OK | cmd.js:1269-1292 | Variável, Info Type (Terrain Tag, Event ID, Tile ID camadas 1–4, Region ID), Direta/Variáveis/Personagem. |

#### 01_10_15 — Batalha (aba 3)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Change Enemy HP (331) | 01_10_15 | OK | cmd.js:1295-1310 | Inimigo (Entire Troop/#1–8), operação, operando, Allow Death. Range genérico. |
| Change Enemy MP (332) | 01_10_15 | OK | cmd.js:1311 | — |
| Change Enemy TP (342) | 01_10_15 | OK | cmd.js:1312 | — |
| Change Enemy State (333) | 01_10_15 | OK | cmd.js:1313-1319 | — |
| Enemy Recover All (334) | 01_10_15 | OK | cmd.js:1320-1323 | — |
| Enemy Appear (335) | 01_10_15 | OK | cmd.js:1324-1327 | Rótulo "Enemy Appear" (manual "Enemy Appearance"). Lista "#1..#8" sem nome do inimigo da tropa (MZ mostra "#1 Slime" no contexto de tropa). |
| Enemy Transform (336) | 01_10_15 | OK | cmd.js:1328-1331 | — |
| Show Battle Animation (337) | 01_10_15 | OK | cmd.js:1332-1342 | Inimigo, "Target All Enemies", Animação. |
| Force Action (339) | 01_10_15 | OK | cmd.js:1343-1357 | Enemy/Actor, Skill, Last Target/Random/Index 1–8. |
| Abort Battle (340) | 01_10_15 | OK | cmd.js:1358 | — |

#### 01_10_16 — Avançado (aba 3)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Script (355/655) | 01_10_16 | Parcial | cmd.js:1361-1371 | Texto multilinha OK; falta menu Plugin Help. |
| Plugin Command (357/657) | 01_10_16 | OK | cmd.js:1390-1440, `pluginCommandSources` 1376 | Plugin Name, Command Name, descrição, Arguments (ParamTable com struct/array/@parent). Plugins OFF mantidos com "(OFF)". |
| Plugin Command MV (356) | — (legado) | OK (extra) | cmd.js:1372-1373 | Só edição de existentes; fora da paleta (correto). |



#### Rota de movimento (01_10_06_01)

Arquivo: `editor/js/events/moveroute.js` (`ROUTE_NAMES` 12-25, `BUTTONS` 28-32, `routeText` 37-54, `paramDialog` 56-80, `moveRouteDialog` 87-200, `simulateRoute`/`drawRoute` 209+). Códigos = `Game_Character.ROUTE_*`.

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Move Down (1) | 01_10_06_01 | OK | moveroute.js:13 | — |
| Move Left (2) | 01_10_06_01 | OK | moveroute.js:13 | — |
| Move Right (3) | 01_10_06_01 | OK | moveroute.js:13 | — |
| Move Up (4) | 01_10_06_01 | OK | moveroute.js:13 | — |
| Move Lower Left (5) | 01_10_06_01 | OK | moveroute.js:14 | — |
| Move Lower Right (6) | 01_10_06_01 | OK | moveroute.js:14 | — |
| Move Upper Left (7) | 01_10_06_01 | OK | moveroute.js:14 | — |
| Move Upper Right (8) | 01_10_06_01 | OK | moveroute.js:14 | — |
| Move at Random (9) | 01_10_06_01 | OK | moveroute.js:15 | — |
| Move toward Player (10) | 01_10_06_01 | OK | moveroute.js:15 | — |
| Move away from Player (11) | 01_10_06_01 | OK | moveroute.js:15 | — |
| 1 Step Forward (12) | 01_10_06_01 | OK | moveroute.js:16 | — |
| 1 Step Backward (13) | 01_10_06_01 | OK | moveroute.js:16 | — |
| Jump (14) | 01_10_06_01 | OK | moveroute.js:62-66 | X/Y −100..100. |
| Wait (15) | 01_10_06_01 | OK | moveroute.js:68 | 1–999 frames. |
| Turn Down (16) | 01_10_06_01 | OK | moveroute.js:17 | Manual: "Face Down" (o editor MZ usa "Turn Down"). |
| Turn Left (17) | 01_10_06_01 | OK | moveroute.js:17 | idem |
| Turn Right (18) | 01_10_06_01 | OK | moveroute.js:17 | idem |
| Turn Up (19) | 01_10_06_01 | OK | moveroute.js:17 | idem |
| Turn 90° Right (20) | 01_10_06_01 | OK | moveroute.js:18 | — |
| Turn 90° Left (21) | 01_10_06_01 | OK | moveroute.js:18 | — |
| Turn 180° (22) | 01_10_06_01 | OK | moveroute.js:18 | — |
| Turn 90° Right or Left (23) | 01_10_06_01 | OK | moveroute.js:18 | — |
| Turn at Random (24) | 01_10_06_01 | OK | moveroute.js:19 | — |
| Turn toward Player (25) | 01_10_06_01 | OK | moveroute.js:19 | — |
| Turn away from Player (26) | 01_10_06_01 | OK | moveroute.js:19 | — |
| Switch ON (27) | 01_10_06_01 | OK | moveroute.js:69 | Seletor de switch com nome. |
| Switch OFF (28) | 01_10_06_01 | OK | moveroute.js:69 | — |
| Change Speed (29) | 01_10_06_01 | OK | moveroute.js:70 | 1–6. |
| Change Frequency (30) | 01_10_06_01 | OK | moveroute.js:71 | 1–5. |
| Walking Animation ON (31) | 01_10_06_01 | OK | moveroute.js:21 | — |
| Walking Animation OFF (32) | 01_10_06_01 | OK | moveroute.js:21 | — |
| Stepping Animation ON (33) | 01_10_06_01 | OK | moveroute.js:21 | — |
| Stepping Animation OFF (34) | 01_10_06_01 | OK | moveroute.js:21 | — |
| Direction Fix ON (35) | 01_10_06_01 | OK | moveroute.js:22 | — |
| Direction Fix OFF (36) | 01_10_06_01 | OK | moveroute.js:22 | — |
| Through ON (37) | 01_10_06_01 | OK | moveroute.js:22 | — |
| Through OFF (38) | 01_10_06_01 | OK | moveroute.js:22 | — |
| Transparent ON (39) | 01_10_06_01 | OK | moveroute.js:23 | — |
| Transparent OFF (40) | 01_10_06_01 | OK | moveroute.js:23 | — |
| Change Image (41) | 01_10_06_01 | OK | moveroute.js:72 (`charIndexPick`) | Nome + índice (ROUTE_CHANGE_IMAGE usa 2 parâmetros). |
| Change Opacity (42) | 01_10_06_01 | OK | moveroute.js:73 | 0–255. |
| Change Blend Mode (43) | 01_10_06_01 | OK | moveroute.js:74 | 4 modos. |
| Play SE (44) | 01_10_06_01 | OK | moveroute.js:75 | Play/Stop/Vol/Pitch/Pan. |
| Script (45) | 01_10_06_01 | Parcial | moveroute.js:76 | Usa área **multilinha**; o MZ usa campo de 1 linha e a lista de rota mostra uma linha só (quebras ficam no texto e quebram a exibição). |
| Diálogo: alvo (Player/This Event/eventos) | 01_10_06_01 "Player" | OK | moveroute.js:161-165; cmd.js:916 | Só no Set Movement Route (correto). |
| Diálogo: Preview no mapa | 01_10_06_01 "Preview" | Parcial | moveroute.js:111-143, 209+; minimap.js | Desenha e anima o trajeto, mas não simula passabilidade/eventos nem a velocidade real; random/toward player viram "?". |
| Diálogo: inserir na posição selecionada | 01_10_06_01 | OK | moveroute.js:144-153 | — |
| Diálogo: reeditar (duplo clique) | 01_10_06_01 | OK | moveroute.js:103, 154-159 | — |
| Diálogo: menu de contexto da lista (re-editar, copiar…) | 01_10_06_01 | Parcial | moveroute.js:166-171 | Só botões Edit/Copy/Paste/Delete/Clear; falta **Cut**, menu por botão direito/toque longo, atalhos de teclado, **seleção múltipla** (copiar/apagar vários). |
| Opção Repeat Movements | 01_10_06_01 | OK | moveroute.js:172 | — |
| Opção Skip If Cannot Move | 01_10_06_01 | OK | moveroute.js:173 | — |
| Opção Wait for Completion | 01_10_06_01 | OK | moveroute.js:174-176 | Oculta no movimento autônomo (correto, eventeditor.js:98). |

### Banco de dados

#### Visão geral e controles comuns (01_08)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| 16 abas (Actors … Terms) na ordem do MZ | 01_08 | OK | tabs.js:8 | — |
| Abrir pelo botão Database da barra de ferramentas | 01_08 | OK | index.js:21 (`bindToolbar("btnDatabase")`) | Não há entrada no menu Tools (o port não tem esse menu) |
| Lista de dados à esquerda com ID "0001 Nome" | 01_08 | OK | index.js:152-185 | — |
| Change Maximum (limite de 2000 para Skills/Items/Weapons/Enemies/Troops e 1000 para os demais) | 01_08 | OK | index.js:221-240; `max` em tabs_items.js:83,116,140,158, tabs_battle.js:96,330 | — (ao reduzir, pede confirmação e apaga, como no manual) |
| F4 / F5 (item anterior/próximo) | 01_08 | OK | index.js:100-110 | — |
| Menu de contexto: Copy | 01_08 | OK | index.js:247 (botão, sem menu de contexto) | Usa um clipboard interno da sessão (não o da área de transferência do sistema) |
| Copy múltiplo com Shift | 01_08 | OK | index.js:170-175 e botão "Multi" | — |
| Paste (sobrescreve) | 01_08 | OK | index.js:253-265 | — |
| Clear | 01_08 | OK | index.js:267-273 (`BLANK`) | — |
| OK / Cancel / Apply | 01_08 | OK | index.js:72-80 | O botão "voltar" do Android fecha sem perguntar (NOTES.md:99) |
| Campo Notes (Actors/Classes/Skills/Items/Weapons/Armors/Enemies/States/Tilesets) | 01_08 | OK | tabs_actors.js:15 `noteGroup`, usado em todas as 9 abas | — |
| Plugin Help... no Notes | 01_08_01 etc. | OK | pluginhelp.js; botão em tabs_actors.js:17 | É botão, não item de clique direito (adaptação ao toque) |
| Listas de Traits/Effects/etc.: menu de contexto copiar/colar/excluir | 01_08_15/16 | OK | ui.js:229 `tableList` (New/Edit/Copy/Paste/Delete/▲/▼) | É barra de botões, não menu de contexto; ▲/▼ é um extra |
| Duplo clique em linha vazia para criar / em linha para editar | 01_08_15 | OK | ui.js `tableList` (toque duplo < 450 ms; linha vazia) | — |

#### Atores (01_08_01)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_01 | OK | tabs_actors.js:77 | — |
| Nickname | 01_08_01 | OK | tabs_actors.js:78 | — |
| Class | 01_08_01 | OK | tabs_actors.js:79 | — |
| Initial Level / Max Level (1–99) | 01_08_01 | OK | tabs_actors.js:81-82 | Não impede Inicial > Máximo |
| Profile | 01_08_01 | OK | tabs_actors.js:83 | Não limita a 2 linhas |
| Face (com índice) | 01_08_01 | OK | tabs_actors.js:85-88; pickers.js `pickSheet` | — |
| Walking Character (com índice) | 01_08_01 | OK | tabs_actors.js:89-92 | — |
| [SV] Battler | 01_08_01 | OK | tabs_actors.js:93-96 | — |
| Initial Equipment (filtrado pelo que a classe pode equipar, [None]) | 01_08_01 | OK | tabs_actors.js:40-68 (traits 51/52 de ator + classe, Dual Wield 55) | — |
| Traits | 01_08_01 | OK | tabs_actors.js:98 | — |
| Notes + Plugin Help | 01_08_01 | OK | tabs_actors.js:100 | — |

#### Classes (01_08_02)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_02 | OK | tabs_actors.js:247 | — |
| EXP Curve [...] com Base/Extra/Acceleration A/B | 01_08_02 | OK | tabs_actors.js:198-224 (10–50/0–40/10–50/10–50) | — |
| Aba "To Next Level" e "Total" | 01_08_02 | OK | tabs_actors.js:213-214; fórmula em common.js:87 `expForLevel` | — |
| Gráfico de fundo da tabela de EXP | 01_08_02 | Ausente | — | Só lista numérica; sem o gráfico de fundo |
| Parameter Curves (miniaturas de 8 gráficos) | 01_08_02 | OK | tabs_actors.js:126-131, 249-259 | — |
| Janela Parameter Curves com abas por parâmetro, OK/Cancel | 01_08_02 | OK | tabs_actors.js:150-196 | — |
| Quick Settings A–E | 01_08_02 | OK | tabs_actors.js:177-181; common.js:116-127 (fórmula do RPG.exe, aleatória) | — |
| Level / Value (HP 1–9999, MP 0–9999, demais 0–999) | 01_08_02 | OK | tabs_actors.js:163-166; common.js PARAM_MIN/MAX | — |
| Generate Curve (Level 1/Level 99 + slider de crescimento) | 01_08_02 | OK | tabs_actors.js:133-148; common.js:103 `generateCurve` | Mínimo de "outros" é 0 (manual diz 1–999 nessa janela) |
| Gráfico: clicar/arrastar seleciona o nível | 01_08_02 | OK | tabs_actors.js:168-176 | — |
| Skills to Learn (Level, Skill, Note) | 01_08_02 | OK | tabs_actors.js:226-236, 260-267 | — |
| Traits | 01_08_02 | OK | tabs_actors.js:268 | — |
| Notes + Plugin Help | 01_08_02 | OK | tabs_actors.js:269 | — |

#### Habilidades (01_08_03)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_03 | OK | tabs_items.js:88 | — |
| Icon (seletor do IconSet) | 01_08_03 | OK | tabs_items.js:8-17; pickers.js:212 | — |
| Description | 01_08_03 | OK | tabs_items.js:90 | Não limita a 2 linhas nem mostra pré-visualização |
| Skill Type (com None) | 01_08_03 | OK | tabs_items.js:91 | — |
| MP Cost (0–999) | 01_08_03 | Parcial | tabs_items.js:93 | Máximo 9999 em vez de 999 |
| TP Cost (0–100) | 01_08_03 | OK | tabs_items.js:94 | — |
| Occasion (Always/Battle/Menu/Never) | 01_08_03 | OK | common.js:12 `OCCASIONS`; tabs_items.js:96 | — |
| Scope: Faction (Enemy/Ally/Enemy & Ally/User/None) | 01_08_03 | OK | tabs_items.js:20-42; common.js:59-84 | — |
| Scope: Number (Single/All/Random 1–4) | 01_08_03 | OK | tabs_items.js:28-35 | — |
| Scope: Status (Alive/Dead/Unconditional, só aliados) | 01_08_03 | OK | tabs_items.js:37-38 | — |
| Speed (−2000 a 2000) | 01_08_03 | OK | tabs_items.js:50 | — |
| Success (0–100%) | 01_08_03 | OK | tabs_items.js:51 | — |
| Repeat (1–9) | 01_08_03 | OK | tabs_items.js:52 | — |
| TP Gain | 01_08_03 | OK | tabs_items.js:53 (0–100) | — |
| Hit Type (Certain/Physical/Magic) | 01_08_03 | OK | common.js:13; tabs_items.js:54 | — |
| Animation (inclui Normal Attack) | 01_08_03 | OK | tabs_items.js:44-46, 55 | — |
| Message (2 linhas, %1/%2) | 01_08_03 | OK | tabs_items.js:98-103 | — |
| Botões "casts *!", "does *!", "used *!" | 01_08_03 | OK | tabs_items.js:103 | — |
| Required Weapon: Weapon Type 1/2 | 01_08_03 | OK | tabs_items.js:104-106 | — |
| Damage: Type (None + 6 tipos) | 01_08_03 | OK | common.js:14; tabs_items.js:66 | — |
| Damage: Element (inclui Normal Attack) | 01_08_03 | OK | tabs_items.js:62, 67 | — |
| Damage: Formula | 01_08_03 | Parcial | tabs_items.js:59-61, 68 | Sem ajuda/lista de referências (a.atk, v[n]...) nem validação |
| Damage: Variance (0–100%) | 01_08_03 | OK | tabs_items.js:69 | — |
| Damage: Critical Hits (Yes/No) | 01_08_03 | OK | tabs_items.js:70 | — |
| Desativar campos de dano quando Type = None | 01_08_03 | OK | tabs_items.js:63-71 | — |
| Effects | 01_08_03 | OK | tabs_items.js:108; traits.js:217 | — |
| Notes + Plugin Help | 01_08_03 | OK | tabs_items.js:109 | — |

#### Itens (01_08_04)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name / Icon / Description | 01_08_04 | OK | tabs_items.js:121-123 | — |
| Price (0 = não vendável) | 01_08_04 | OK | tabs_items.js:126 (0–999999) | — |
| Consumable (Yes/No) | 01_08_04 | OK | tabs_items.js:127 | — |
| Occasion | 01_08_04 | OK | tabs_items.js:129 | — |
| Item Type (Regular/Key/Hidden A/Hidden B) | 01_08_04 | OK | common.js:15; tabs_items.js:124 | — |
| Scope (Faction/Number/Status) | 01_08_04 | OK | tabs_items.js:128 | — |
| Speed / Success / Repeat / TP Gain / Hit Type / Animation | 01_08_04 | OK | tabs_items.js:130 → `invocationGroup` 48-56 | — |
| Damage (Type/Element/Variance/Critical/Formula) | 01_08_04 | Parcial | tabs_items.js:131 | A mesma falta de ajuda/validação da fórmula |
| Effects | 01_08_04 | OK | tabs_items.js:132 | — |
| Notes + Plugin Help | 01_08_04 | OK | tabs_items.js:133 | — |

#### Armas / Armaduras (01_08_05)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name / Icon / Description | 01_08_05 | OK | tabs_items.js:145-147, 163-165 | — |
| Weapon Type / Armor Type | 01_08_05 | OK | tabs_items.js:148, 166 | — |
| Price | 01_08_05 | OK | tabs_items.js:149, 167 | — |
| Animation (só armas) | 01_08_05 | OK | tabs_items.js:150 | — |
| Equipment Type (só armaduras; sem "Weapon") | 01_08_05 | OK | tabs_items.js:168 | — |
| Parameter Changes (HP/MP ±5000, demais ±500) | 01_08_05 | OK | tabs_items.js:75-78 | — |
| Traits | 01_08_05 | OK | tabs_items.js:152, 170 | — |
| Notes + Plugin Help | 01_08_05 | OK | tabs_items.js:153, 171 | — |
| Traits padrão de arma nova (Attack Element Physical, Hit +0%) | — | OK | common.js:164-165 (BLANK.Weapons) | — |

#### Inimigos (01_08_06)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_06 | OK | tabs_battle.js:102 | — |
| Image + Hue (pasta enemies/sv_enemies) | 01_08_06 | OK | tabs_battle.js:100-106; pickers.js:141-162 | — |
| 8 parâmetros (HP 1–999999, MP 0–9999, demais 0–999) | 01_08_06 | OK | tabs_battle.js:107 | — |
| Rewards: EXP (1–9999999) / Gold (0–9999999) | 01_08_06 | Parcial | tabs_battle.js:108-110 | EXP aceita 0 (mínimo do manual é 1) |
| Drop Items (3 linhas; None/Item/Weapon/Armor; 1/1–1/1000) | 01_08_06 | OK | tabs_battle.js:65-93, 111-118 | — |
| Action Patterns: Skill + Rating | 01_08_06 | OK | tabs_battle.js:27-63, 119-126 | — |
| Condição Always | 01_08_06 | OK | tabs_battle.js:12 | — |
| Condição Turn (A + B*X) | 01_08_06 | OK | tabs_battle.js:42 | — |
| Condição HP % (faixa) | 01_08_06 | OK | tabs_battle.js:43 | — |
| Condição MP % (faixa) | 01_08_06 | OK | tabs_battle.js:44 | — |
| Condição State | 01_08_06 | OK | tabs_battle.js:45 | — |
| Condição Party Level | 01_08_06 | OK | tabs_battle.js:46 | — |
| Condição Switch | 01_08_06 | OK | tabs_battle.js:47 | — |
| Traits | 01_08_06 | OK | tabs_battle.js:127 | — |
| Notes + Plugin Help | 01_08_06 | OK | tabs_battle.js:128 | — |

#### Grupos / Troops (01_08_07)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_07 | OK | tabs_battle.js:333 | — |
| Auto-name | 01_08_07 | OK | tabs_battle.js:137-144, 344 | — |
| Change Battle Background (fundo 1 e 2, compartilhado) | 01_08_07 | OK | tabs_battle.js:254-263, 345 (grava System.battleback1/2Name) | São dois seletores em sequência, não uma janela com os dois campos lado a lado |
| Battle Test: abas 1–4, ator, nível, equipamento | 01_08_07 | Parcial | tabs_battle.js:265-300 | Falta a área [Status] com os parâmetros calculados; o equipamento não é filtrado pelos traits do ator/classe e ignora Dual Wield |
| Battle Test: executar (grava Test_*.json e abre ?btest) | 01_08_07 | OK | tabs_battle.js:301-326 | — |
| Placement View com fundo de batalha | 01_08_07 | OK | tabs_battle.js:179-240 | — |
| Até 8 inimigos | 01_08_07 | OK | tabs_battle.js:351 | — |
| Arrastar inimigo para mudar posição | 01_08_07 | OK | tabs_battle.js:206-227 | — |
| Appear Mid-Battle (clique direito) | 01_08_07 | OK | tabs_battle.js:336-341 (caixa "Appear Halfway") | É caixa de seleção, não menu de contexto |
| Add (e duplo clique na lista de inimigos) | 01_08_07 | Parcial | tabs_battle.js:349-354 | A lista é um `<select>`; não existe a lista com duplo clique; Add realinha todos |
| Delete (Remove) | 01_08_07 | OK | tabs_battle.js:355-358 | — |
| Clear | 01_08_07 | OK | tabs_battle.js:359 | Não pede confirmação |
| Align | 01_08_07 | OK | tabs_battle.js:242-252, 360 | — |
| Páginas: New / Copy / Paste / Clear Event Page (+ Delete) | 01_08_07 | OK | tabs_battle.js:383-388 | — |
| Contents (editor de comandos de evento, incluindo os de batalha) | 01_08_07 | OK | eventlist.js:69-95 → events/index.js:27-37 (`editCommandList`; categoria "Battle" em events/commands.js:1458) | A lista na aba só mostra um resumo; a edição acontece num diálogo separado |
| Conditions: Turn End | 01_08_07 | OK | tabs_battle.js:167 | — |
| Conditions: Turn (A + B*X) | 01_08_07 | OK | tabs_battle.js:168 | — |
| Conditions: Enemy HP (inimigo + %) | 01_08_07 | OK | tabs_battle.js:169 | Mostra sempre 8 posições, mesmo vazias |
| Conditions: Actor HP (ator + %) | 01_08_07 | OK | tabs_battle.js:170 | — |
| Conditions: Switch | 01_08_07 | OK | tabs_battle.js:171 | — |
| Página sem condição = "Don't Run" | 01_08_07 | OK | tabs_battle.js:153 | — |
| Span: Battle / Turn / Moment | 01_08_07 | OK | tabs_battle.js:393 | — |

#### Estados (01_08_08)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name / Icon | 01_08_08 | OK | tabs_battle.js:408-409 | — |
| Restriction (5 opções) | 01_08_08 | OK | common.js:16; tabs_battle.js:410 | — |
| Priority (0–100) | 01_08_08 | OK | tabs_battle.js:411 | — |
| [SV] Motion | 01_08_08 | OK | common.js:17; tabs_battle.js:412 | — |
| [SV] Overlay | 01_08_08 | OK | common.js:18-19; tabs_battle.js:413 | — |
| Remove at Battle End | 01_08_08 | OK | tabs_battle.js:415 | — |
| Remove by Restriction | 01_08_08 | OK | tabs_battle.js:415 | — |
| Auto-removal Timing (None/Action End/Turn End) | 01_08_08 | OK | common.js:20; tabs_battle.js:417 | — |
| Duration in Turns (mín.–máx., 0–9999) | 01_08_08 | OK | tabs_battle.js:418 | Não desativa os campos quando Timing = None |
| Remove by Damage (0–100%) | 01_08_08 | OK | tabs_battle.js:419 | — |
| Remove by Walking (0–9999 passos) | 01_08_08 | OK | tabs_battle.js:420 | — |
| 4 mensagens (ator, inimigo, persiste, removido) | 01_08_08 | OK | tabs_battle.js:421-425 | — |
| Traits | 01_08_08 | OK | tabs_battle.js:426 | — |
| Notes + Plugin Help | 01_08_08 | OK | tabs_battle.js:427 | — |

#### Animações (01_08_09, 01_08_09_01)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_09 | OK | tabs_misc.js:69 | — |
| Display Type (alvo / centro / tela) | 01_08_09 | OK | tabs_misc.js:70 | — |
| Particle Effect: File Name (.efkefc em effects/) | 01_08_09, 01_08_09_01 | OK | tabs_misc.js:12-29, 71-76 | — |
| Scale | 01_08_09 | OK | tabs_misc.js:77 | — |
| Speed | 01_08_09 | OK | tabs_misc.js:78 | — |
| Rotation (X/Y/Z) | 01_08_09 | OK | tabs_misc.js:80-82 | — |
| Offset X / Offset Y | 01_08_09 | OK | tabs_misc.js:83-84 | — |
| Preview: Play | 01_08_09 | OK | animpreview.js:250 | (há também Stop) |
| Preview: Change Target | 01_08_09 | Parcial | animpreview.js:252-256 | Não grava em `System.battlerName/battlerHue` (o MZ grava) e não oferece Hue; o alvo volta ao padrão ao reabrir |
| Preview: Change Battle Background | 01_08_09 | OK | tabs_misc.js:85-89 → tabs_battle.js:254 | — |
| Sounds: Frames + File (SE) | 01_08_09 | OK | tabs_misc.js:31-38, 90-97 | — |
| Flash: Frames / Duration / Color | 01_08_09 | OK | tabs_misc.js:40-59, 98-109; pickers.js:315 | — |

#### Tilesets (01_08_10)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_10 | OK | tabs_misc.js:392 | — |
| Mode (World / Area / VX Compatible) | 01_08_10 | OK | tabs_misc.js:393 | — |
| Images A1–A5, B–E | 01_08_10 | OK | tabs_misc.js:394-404 | — |
| Tile List com abas A–E | 01_08_10 | OK | tabs_misc.js:184-222, 364-368 | — |
| Passage (○ / × / ☆; ☆ só fora da aba A) | 01_08_10 | OK | tabs_misc.js:224-226, 311-316 | — |
| Passage (4 dir) | 01_08_10 | OK | tabs_misc.js:273-281, 317-322 | Arrastar não pinta neste modo |
| Ladder | 01_08_10 | OK | tabs_misc.js:119, 229 | — |
| Bush (com a regra de autotile "floresta") | 01_08_10 | OK | tabs_misc.js:162-181, 298-303 | — |
| Counter | 01_08_10 | OK | tabs_misc.js:119 | — |
| Damage Floor | 01_08_10 | OK | tabs_misc.js:119 | — |
| Terrain Tag (0–7) | 01_08_10 | OK | tabs_misc.js:227, 323-326 | — |
| Botão direito inverte o ciclo (passagem/terreno) | 01_08_10 | Parcial | tabs_misc.js:375 (caixa "Reverse") | Substituído por uma caixa de seleção persistente |
| Arrastar com o botão pressionado para pintar | 01_08_10 | Parcial | tabs_misc.js:341-356 | Só com mouse/caneta; no toque, cada toque alterna um tile (o arrasto rola a lista) |
| Bits de veículo (barco/navio/aeronave) | 01_08_10 | OK | tabs_misc.js:122-160 | — |
| Notes + Plugin Help | 01_08_10 | OK | tabs_misc.js:405 | — |

#### Eventos comuns (01_08_11)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Name | 01_08_11 | OK | tabs_misc.js:419 | — |
| Trigger (None/Autorun/Parallel) | 01_08_11 | OK | tabs_misc.js:420 | — |
| Switch (desativado quando Trigger = None) | 01_08_11 | OK | tabs_misc.js:417, 421 | — |
| Contents (editor de comandos) | 01_08_11 | OK | tabs_misc.js:422 → eventlist.js → events/index.js:27 | Edição num diálogo separado, não direto na aba |

#### Sistema 1 (01_08_12_01)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Game Title | 01_08_12_01 | OK | tabs_system.js:115 | — |
| Starting Party (adicionar/trocar/excluir) | 01_08_12_01 | OK | tabs_system.js:117-124 | — |
| Currency | 01_08_12_01 | OK | tabs_system.js:116 | — |
| Window Color (R/G/B de −255 a 255) | 01_08_12_01 | OK | tabs_system.js:125-136; pickers.js:315-347 | — |
| Vehicle Images (Boat/Ship/Airship, com None) | 01_08_12_01 | OK | tabs_system.js:137-141 | — |
| Starting Positions: Player / Boat / Ship / Airship | 01_08_12_01 | OK | tabs_system.js:29-101, 142-161 | — |
| Posição: arrastar ícone e apagar com Del | 01_08_12_01 | Parcial | tabs_system.js:78-86 | Define por toque; veículo vai para "(None)" pela lista; não é possível deixar o jogador sem posição (proposital) |
| Title Screen: imagens 1 e 2 | 01_08_12_01 | OK | tabs_system.js:163 | — |
| Draw Game Title | 01_08_12_01 | OK | tabs_system.js:164 | — |
| Command Window (fundo e posição) | 01_08_12_01 | OK | tabs_system.js:165-169 | — |
| Battle Screen: Front-view / Side-view | 01_08_12_01 | OK | tabs_system.js:170 | — |
| Battle System: Turn-Based / Active / Wait | 01_08_12_01 | OK | tabs_system.js:171 | — |
| Option: Start Transparent | 01_08_12_01 | OK | tabs_system.js:173 | — |
| Option: Show Player Followers | 01_08_12_01 | OK | tabs_system.js:174 | — |
| Option: Death by Slip Damage | 01_08_12_01 | OK | tabs_system.js:175 | — |
| Option: Death by Floor Damage | 01_08_12_01 | OK | tabs_system.js:176 | — |
| Option: Show TP in Window | 01_08_12_01 | OK | tabs_system.js:177 | — |
| Option: EXP for Reserve Members | 01_08_12_01 | OK | tabs_system.js:178 | — |
| Option: Show Key Item Quantities | 01_08_12_01 | OK | tabs_system.js:179 | — |
| Option: Enable Autosave | 01_08_12_01 | OK | tabs_system.js:180 | — |
| Music: Title / Battle / Victory / Defeat / Game Over / Boat / Ship / Airship | 01_08_12_01 | OK | tabs_system.js:104-105, 181-182 | — |
| Sounds: os 24 SEs (Cursor … Use Skill) | 01_08_12_01 | OK | tabs_system.js:106-108, 183-184 | — |
| Áudio: volume / pitch / pan / tocar / parar | 01_08_12_01 | OK | pickers.js:255-312 | — |

#### Sistema 2 (01_08_12_02)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Menu Commands (Item/Skill/Equip/Status/Formation/Save) | 01_08_12_02 | OK | tabs_system.js:201-203 | — |
| Item Categories (Item/Weapon/Armor/Key Item) | 01_08_12_02 | OK | tabs_system.js:204-206 | — |
| [SV] Attack Motions (tipo + imagem de arma por tipo de arma) | 01_08_12_02 | OK | tabs_system.js:190-216 | Imagem da arma só pelo nome/índice, sem pré-visualização |
| [SV] Magic Skills | 01_08_12_02 | OK | tabs_system.js:217-225 | — |
| Game ID | 01_08_12_02 | OK | tabs_system.js:228 | — |
| Screen Width / Screen Height | 01_08_12_02 | OK | tabs_system.js:229-230 | — |
| UI Area Width / UI Area Height | 01_08_12_02 | OK | tabs_system.js:231-232 | — |
| Main Font Filename | 01_08_12_02 | Parcial | tabs_system.js:234 | Campo de texto livre; não há seletor de arquivos de fonts/ |
| Number Font Filename | 01_08_12_02 | Parcial | tabs_system.js:235 | Idem |
| Fallback Font | 01_08_12_02 | OK | tabs_system.js:236 | — |
| Font Size | 01_08_12_02 | OK | tabs_system.js:233 | — |

#### Tipos (01_08_13)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Elements (lista + Name + Change Maximum) | 01_08_13 | OK | tabs_system.js:246-277, 283 | — |
| Skill Types | 01_08_13 | OK | tabs_system.js:284 | — |
| Weapon Types | 01_08_13 | OK | tabs_system.js:285 | — |
| Armor Types | 01_08_13 | OK | tabs_system.js:286 | — |
| Equipment Types | 01_08_13 | OK | tabs_system.js:287 | — |

#### Termos (01_08_14)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Basic Statuses (Level/HP/MP/TP/EXP + abreviações) | 01_08_14 | OK | tabs_system.js:293, 310 | — |
| Parameters (8 + Hit + Evasion) | 01_08_14 | OK | tabs_system.js:294, 311 | — |
| Equipment Type | 01_08_14 | OK | Editado na aba Types (tabs_system.js:287); o MZ 1.1.1 também guarda em `equipTypes` | — |
| Commands (24 usados; índices 20 e 23 vazios, como no MZ) | 01_08_14 | OK | tabs_system.js:295-297, 312 | — |
| Messages (todas as chaves de `terms.messages`, %1/%2) | 01_08_14 | OK | tabs_system.js:298-313 | A lista sai do JSON: se faltar uma chave no projeto, ela não aparece para edição |

#### Traits (01_08_15) — 25 tipos

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Janela com abas Rate/Param/Attack/Skill/Equip/Other | 01_08_15 | OK | traits.js:32-44, 95-125 | — |
| Rate: Element Rate (0–1000%) | 01_08_15 | OK | traits.js:33, 53 | — |
| Rate: Debuff Rate (0–1000%) | 01_08_15 | OK | traits.js:33 | — |
| Rate: State Rate (0–1000%) | 01_08_15 | OK | traits.js:34 | — |
| Rate: State Resist | 01_08_15 | OK | traits.js:34 | — |
| Param: Parameter (0–1000%) | 01_08_15 | OK | traits.js:35 | — |
| Param: Ex-Parameter (10 itens, −100 a 100%) | 01_08_15 | OK | traits.js:35, 54; common.js:5-6 | — |
| Param: Sp-Parameter (10 itens, 0–1000%) | 01_08_15 | OK | traits.js:35; common.js:7-8 | — |
| Attack: Attack Element | 01_08_15 | OK | traits.js:36 | — |
| Attack: Attack State (0–1000%) | 01_08_15 | OK | traits.js:36, 55 | — |
| Attack: Attack Speed (−999 a 999) | 01_08_15 | OK | traits.js:37, 56 | — |
| Attack: Attack Times + | 01_08_15 | OK | traits.js:37, 57 (0–9) | — |
| Attack: Attack Skill | 01_08_15 | OK | traits.js:37 | — |
| Skill: Add Skill Type | 01_08_15 | OK | traits.js:38 | — |
| Skill: Seal Skill Type | 01_08_15 | OK | traits.js:38 | — |
| Skill: Add Skill | 01_08_15 | OK | traits.js:39 | — |
| Skill: Seal Skill | 01_08_15 | OK | traits.js:39 | — |
| Equip: Equip Weapon | 01_08_15 | OK | traits.js:40 | — |
| Equip: Equip Armor | 01_08_15 | OK | traits.js:40 | — |
| Equip: Lock Equip | 01_08_15 | OK | traits.js:41 | — |
| Equip: Seal Equip | 01_08_15 | OK | traits.js:41 | — |
| Equip: Slot Type (Dual Wield) | 01_08_15 | OK | traits.js:21, 41 | — |
| Other: Action Times + (%) | 01_08_15 | OK | traits.js:42, 58 | — |
| Other: Special Flag (Auto Battle/Guard/Substitute/Preserve TP) | 01_08_15 | OK | common.js:9; traits.js:42 | — |
| Other: Collapse Effect (Normal/Boss/Instant/No Disappear) | 01_08_15 | OK | common.js:10; traits.js:43 | Não restringe a inimigos |
| Other: Party Ability (6 opções) | 01_08_15 | OK | common.js:11; traits.js:43 | — |

#### Effects (01_08_16) — 13 tipos

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Janela com abas Recover/State/Param/Other | 01_08_16 | OK | traits.js:154-161, 202-215 | — |
| Recover HP (−100 a 100% + −999999 a 999999) | 01_08_16 | OK | traits.js:166 | — |
| Recover MP (−100 a 100% + −9999 a 9999) | 01_08_16 | OK | traits.js:167 | — |
| Gain TP (0–100) | 01_08_16 | OK | traits.js:168 | — |
| Add State (0–1000%; inclui Normal Attack) | 01_08_16 | OK | traits.js:27, 156, 169 | — |
| Remove State (0–1000%) | 01_08_16 | OK | traits.js:156 | — |
| Add Buff (turnos 1–1000) | 01_08_16 | OK | traits.js:157, 170 | — |
| Add Debuff (turnos 1–1000) | 01_08_16 | OK | traits.js:157 | — |
| Remove Buff | 01_08_16 | OK | traits.js:158 | — |
| Remove Debuff | 01_08_16 | OK | traits.js:158 | — |
| Special Effect (Escape) | 01_08_16 | OK | traits.js:26, 159 | — |
| Grow (1–1000) | 01_08_16 | OK | traits.js:159, 171 | — |
| Learn Skill | 01_08_16 | OK | traits.js:160 | — |
| Common Event | 01_08_16 | OK | traits.js:160 | — |

### Gerador


Cobertura de partes (conferida com script: todos os arquivos de `RPG/generator/{Face,TV,TVD,SV,Variation}/{Male,Female,Kid}` estão no `editor/generator/manifest.json`, com as mesmas contagens, por exemplo Male/Face 473, Kid/SV 260). Todas as camadas encontradas estão em `LAYER_ORDERS`/`LAYERGROUP_LIST` (`generator/data.js:5-30`):
- Face: acca, accb, beard (só Male), beastears, body, cloak1/2, clothing1/2, ears, eyebrows, eyes, face, facialmark, fronthair, glasses, mouth, nose, rearhair1/2.
- TV: acca, accb, beard1, beastears, body, cloak1/2, clothing1/2, ears, facialmark, fronthair1/2, glasses, rearhair1/2, tail1/2, wing1/2.
- TVD: acca, accb, beard, beastears, body, cloak, clothing, ears, facialmark, fronthair, glasses, rearhair, tail, wing.
- SV: acca, accb, beard, beastears, body, cloak1/2, clothing1/2, ears, facialmark, fronthair, glasses, rearhair1, tail, wing.
- Variation: as 18 categorias de `LAYERGROUP_LIST`.

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Abrir por Ferramentas → Gerador de Personagem | 01_05 | OK | `generator/index.js:53-57` | — |
| Abas Homem / Mulher / Criança (estado próprio por aba) | 01_05 | OK | `index.js:31-48, 91-99`; `data.js:134-138` | — |
| Lista de peças (18 categorias, textos pt_BR oficiais) | 01_05 / Layout_CharacterGenerator | OK | `index.js:102-116`; `data.js:5-16` | — |
| Variação (ícones de `Variation/`, vazio permitido exceto nas partes essenciais) | 01_05 / Group_CharacterPatterns | OK | `index.js:119-144`; `data.js:103-105` | — |
| Cor por camada / máscara (24 cores-chave, nomes por parte, indisponíveis em cinza) | 01_05 / Group_CharacterColors | OK | `index.js:151-235`; `data.js:33-100`; `composer.js:265-346` | "Disponível" considera rosto, andando, caído e SV. |
| Paletas `grad_hair/eyes/skin/common` (comum: cor 0 = original) | Group_CharacterColors | OK | `composer.js:103-134`; `index.js:173-218` | — |
| Algoritmo de colorização (255 − qGray → gradiente, alfa preservado) | ImageComposer (C++) | OK (empírico) | `composer.js:142-176` | Conferido apenas com screenshot do manual (NOTES.md) |
| Deslocamento (Ajustar, −8..+8) | 01_05 ("offset") | OK | `index.js` (`refreshOffset`, `partShifts`); aplicado só ao rosto (`composer.js:290-293`) | Botões desabilitados para partes sem imagem no rosto (cauda, asa) ou sem variação. |
| Pré-visualização (rosto + andando + caído + SV) | 01_05 ("Preview") | OK | `index.js:284-308` | — |
| Prévia animada (andar 4 direções, 18 movimentos SV) | — | Extra | `index.js:311-370` | Loop 0-1-2-1; movimentos únicos tocam 0-1-2 uma vez (`Sprite_Actor.MOTIONS`). |
| Aleatório (probabilidade de vazio, orelhas 90% p01, pele 70% ≤12, comum 50% original) | 01_05 "Randomize" | OK | `index.js:387-411`; `data.js:113-120` | — |
| Redefinir | — | Extra | `index.js:413-417` | — |
| Imagem do rosto… → `img/faces`, célula 144×144, folha 576×288 | 01_05 "Face Image" | OK | `data.js:128`; `composer.js:20` | — |
| Personagem Andando… → `img/characters`, 144×192, folha 576×384 ou `$` único | 01_05 "Walking Character" | OK | `data.js:129`; `exporter.js:45-61, 153` | — |
| Personagem Caído… → `img/characters`, 144×48, folha 576×384 (4×8) | 01_05 "Damaged Character" | OK | `data.js:130` | Tamanho da janela tirado do RTP, não do QML (NOTES.md) |
| Personagem Lutando… → `img/sv_actors`, 576×384 (9×6 = 54 quadros de 64×64) | 01_05 "Battler", 01_11_02 | OK | `data.js:131`; `composer.js:22` | — |
| Exportador: Importar (imagem base) | 01_05 "Import" ("from a file") | OK | `exporter.js:115-150`; `ui.js` (`pickFile` com `accept`, `chooseLocalFile`) | Lista os PNG da pasta de destino e tem "Outro local…" (arquivo do PC/aparelho). No Android depende do file chooser do WebView. |
| Exportador: escolher a célula de destino | Dialog_CharacterExporter | OK | `exporter.js:105-113` | — |
| Exportador: Exportar (nome, confirmação de sobrescrita, PNG sem perdas) | 01_05 "Export" | OK | `exporter.js:152-200`; `png.js`; `ui.js` (`saveOutside`) | "Outro local…": PC = `showSaveFilePicker`; Android = grava no projeto e compartilha (`Android.shareFile`). |
| Salvar Configurações (JSON `CharacterGeneratorSettings` 2.0.0) | 01_05 "Save Settings" | OK | `index.js` (botão `save`); `ui.js` (`saveOutside`) | Na raiz do projeto ou em "Outro local…" (mesmo esquema do Exportar). |
| Carregar Configurações | 01_05 "Load Settings" | OK | `index.js` (botão `load`) | `.json` da raiz do projeto ou "Outro local…" (arquivo do PC/aparelho). Não há validação de versão. |
| Aplicar ao ator (gravar faceName/characterName/battlerName) | não existe no MZ 1.1.1 | N/A | — | Não é requisito de fidelidade. Hoje o usuário escolhe a imagem exportada no ator (o módulo emite `resource:changed`, `exporter.js:173`) |

### Plugins

#### Gerenciador de plugins

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Abrir por Ferramentas → Gerenciador de plugins | 01_05, 01_11_04 | OK | `plugins/index.js:426` (`bindToolbar("btnPlugins")`) | — |
| Lista Nome / Status / Descrição, na ordem de carga | 01_11_04 | OK | `manager.js:119-154` `render()` | — |
| Duplo clique em linha vazia adiciona | 01_11_04 (passo 1) | OK (adaptado ao toque) | `manager.js:146-151` (linha vazia, toque); `add()` `manager.js:220` | — |
| Clicar no plugin abre o diálogo (ON/OFF e parâmetros) | 01_05 | OK | `manager.js:136-142` (toque na linha já selecionada chama `edit`) | No toque precisa de dois toques, por desenho |
| Interruptor ON/OFF direto na lista ("check button") | 01_11_04 | OK | `manager.js:123-130` | — |
| Reordenar (arrastar) | prática do MZ | OK | `manager.js:157-218` `bindDrag`, mais ▲/▼ em `move()` `manager.js:256` | — |
| Menu de contexto Editar / Copiar / Colar / Excluir | Dialog_PluginManager (inferido) | Parcial | Botões na barra `manager.js:355-369`; `copy`/`paste` `manager.js:293-310` | Não há "Recortar" nem menu de contexto (pressionar e segurar). Não há atalhos de teclado (Del, Ctrl+C/V) |
| Atualizar (relê o .js: descrição e parâmetros, mantendo valores) | 01_11_04 "Refreshing Plugins" | OK | `manager.js:276-291` + `store.js:127-135` `mergeParameters` | — |
| Atualizar vários com Shift (seleção múltipla) | 01_11_04 | Ausente | Seleção única (`selected`), `manager.js:65` | Seleção múltipla e Atualizar em lote |
| Ativar todos / Desativar todos | — | Extra | `manager.js:269-273` | — |
| Avisos de `@base` (ausente, OFF, abaixo) | spec MZ | OK | `manager.js:33-41` `computeWarnings` | — |
| Avisos de `@orderAfter` / `@orderBefore` | spec MZ | OK | `manager.js:42-51` | — |
| Aviso de plugin sem `@target MZ` (MV) / arquivo ausente | spec MZ | OK | `manager.js:23-29`; `plugindlg.js:101-105` | — |
| OK / Cancelar / Aplicar | Dialog_PluginManager | OK | `manager.js:325-349` | — |
| Gravação de `js/plugins.js` no formato do MZ | runtime `rmmz_managers.js` (PluginManager) | OK | `store.js:35-48` `serializePluginsJs`; `savePluginList` `store.js:61` | Grava na hora (OK/Aplicar). No MZ a gravação acompanha o projeto (ver Divergências) |
| Leitura tolerante de `plugins.js` editado à mão | — | OK | `store.js:11-30` | — |
| Diálogo Plugin: Nome (lista de `js/plugins/*.js`) | 01_11_04 (passo 2: "[Name]") | OK | `plugindlg.js:116-127`; `store.js:75-87` | Lista em `<select>`, não em Dialog_PluginSelector. Marca "(já na lista)" |
| Diálogo Plugin: Status ON/OFF | 01_05 | OK | `plugindlg.js:129-131` | — |
| Diálogo Plugin: Descrição (`@plugindesc`), Autor (`@author`) | spec MZ | OK | `plugindlg.js:96-97` | — |
| Diálogo Plugin: Ajuda (`@help`) | spec MZ | OK | `plugindlg.js:100`, `parser.js:47` (preserva quebras) | — |
| `@url` | spec MZ | Extra/OK | `plugindlg.js:98-99` | — |
| Tabela de parâmetros com árvore por `@parent` | spec MZ | OK | `params.js:28-53` `buildTree`, `params.js:79-131` | — |
| `@text` como rótulo e `@desc` do selecionado embaixo | spec MZ | OK | `params.js:9`, `plugindlg.js:150` | — |
| Edição de parâmetro com abas [File] e [Text] | 01_05 | Parcial | Campo "Texto:" nos seletores (`pickers.js:14-19`, usado em DB, arquivo, cor, ícone) | Não há abas. Em `select`/`boolean`/`number` não se digita texto livre (por exemplo `\V[n]`) |
| Clique direito → "Insert Icon Number" (IconSet Viewer) nos campos de valor | 01_05 | Ausente | NOTES.md:106 confirma. O seletor existe só em eventos (`events/commands.js:1511` `iconPicker`) | Menu de contexto ou botão nos editores `string`/`multiline` |
| Bloco de idioma (`/*:en`, `/*:`, `@target MZ`) | spec MZ | OK | `parser.js:137-186` | Não usa o idioma da interface (pt) para `/*:ja` etc. (fixo `["en",""]`) |
| Editar mantém parâmetros que não existem mais, até "Atualizar" | comportamento MZ | OK | `plugindlg.js:81-91` | — |
| Aba "Comandos" (somente leitura) no diálogo Plugin | — | Extra | `plugindlg.js:9-45` | — |
| Dialog_PluginSettings / PluginSettingBox | QML (só nome) | Indeterminado | — | Não se sabe pelo nome o que é. Não há equivalente evidente |
| Plugins oficiais (AltMenuScreen, AltSaveScreen, ButtonPicture, EventCommandByCode, ExtraImage, ExtraWindow, MaterialBase, OverpassTile, PluginCommonBase, RegionBase, TextPicture, TextScriptBase, UniqueDataLoader) | 01_11_05 | OK (genérico) | Não há código específico. Funcionam pelo parser genérico (NOTES.md:129-145 relata testes com 10 deles) | Os plugins só ficam disponíveis se o projeto os tiver em `js/plugins/`. Não há importação da pasta DLC (é do Gerenciador de recursos) |

#### Tipos de parâmetro

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| `@param` / `@text` / `@desc` / `@default` | spec MZ | OK | `parser.js:53-71`, `parser.js:91-94` | — |
| `string` (e tipos desconhecidos) | spec | OK | `params.js:454` `textEditor` | — |
| `multiline_string` | spec | OK | `params.js:434` | — |
| `note` (grava `JSON.stringify(texto)`) | spec / ParameterEditorNote | OK | `params.js:435-439` | — |
| `number` + `@min` / `@max` / `@decimals` | spec / ParameterEditorNumber | OK | `params.js:193-231` (aplica limites, `toFixed`) | Sem `@min` não há limite (ver Divergências) |
| `boolean` + `@on` / `@off` | spec / ParameterEditorBoolean | OK | `params.js:260-287` | — |
| `select` + `@option` / `@value` | spec / ParameterEditorSelect | OK | `params.js:442`, `parser.js:73-79` | Valor desconhecido é mantido (`params.js:244-247`). Não há digitação livre |
| `combo` (texto livre + opções) | spec | OK | `params.js:289-309` | Grava o texto da opção, como no MZ |
| `file` + `@dir` | spec / ParameterEditorFile | OK | `pickers.js:73-207` (subpastas, prévia de imagem e áudio, "(Nenhum)" = "") | Padrão `img` quando falta `@dir` (confirmar no MZ) |
| `@require` | spec | Parcial | Lido em `parser.js:67`, mas nunca usado | Não marca o arquivo como obrigatório no "Excluir arquivos não utilizados" (`deploy/scan.js` usa outra heurística: valores e `@requiredAssets`) |
| `actor`, `class`, `skill`, `item`, `weapon`, `armor`, `enemy`, `troop`, `state`, `tileset`, `common_event` | spec / ParameterEditorObject | OK | `parser.js:190-203`, `pickers.js:21-59` (`0001 Nome`, "(Nenhum)" = "0") | — |
| `animation` | spec / ParameterEditorAnimation | Parcial | Tratado como lista de banco (`pickers.js`) | O QML próprio sugere um seletor com prévia da animação |
| `switch` / `variable` | spec / ParameterEditorSwitch/Variable | OK | `params.js:447-449`, `pickers.js:22-26` | Não é possível renomear switches/variáveis nesse seletor (o seletor de eventos do MZ permite; aqui não verificado) |
| `color` / `icon` | spec | OK | `pickers.js:220-322` | — |
| `struct<Nome>` + bloco `/*~struct~Nome:` | spec / ParameterEditorStruct | OK | `parser.js:120-135, 166-184`; `params.js:311-335` | Struct não declarado vira JSON em texto (`params.js:313-315`) |
| Arrays `tipo[]`, inclusive `struct<X>[]` e `number[][]` | spec / ParameterEditorList | OK | `params.js:363-424`; `parser.js:209-210` | — |
| `@parent` (árvore, inclusive dentro de struct e de args) | spec | OK | `params.js:28-53` | — |
| `@base` / `@orderAfter` / `@orderBefore` | spec | OK | `parser.js:7, 107-108`; `manager.js:33-51` | — |
| `@command` / `@arg` (+ `@text`, `@desc`, `@type` nos args) | spec | OK | `parser.js:95-112` | — |
| `@noteParam` / `@noteDir` / `@noteType` / `@noteData` / `@noteRequire` | spec (distribuição) | Ausente | NOTES.md:110-111 (ignorados) | Afeta só "Excluir arquivos não utilizados" do deploy |
| Coluna Valor | Dialog_PluginParameter | Parcial | `params.js:20-23` `displayValue` mostra o texto cru | Ver Divergências (rótulos de `select`/`boolean`/banco) |

#### Comando de plugin (357) e MV (356)

| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Comando na paleta (aba 3, Avançado) | 01_10_16 | OK | `events/commands.js:1458` | — |
| [Plugin Name]: plugins ativos no Gerenciador | 01_10_16 | OK | `events/commands.js:1376-1389` → `plugins/commands.js:29-42` | Se nenhum estiver ativo, lista todos os arquivos (ver Divergências) |
| Plugin já usado, mas OFF ou ausente: preservado com "(OFF)" | — | Extra (protege dados) | `events/commands.js:1381-1388` | — |
| [Command Name]: lista de `@command` (`@text`) | 01_10_16 | OK | `events/commands.js:1404-1409` | — |
| Descrição do comando (`@desc`) | spec | OK | `events/commands.js:1411-1413` | — |
| Arguments: tabela com os mesmos editores por tipo (struct, arrays, `@parent`) | 01_10_16 | OK | `events/commands.js:1401-1418` (ParamTable) | — |
| Formato gravado `[plugin, comando, texto, {args}]` + continuações 657 `"Texto = valor"` | formato de dados MZ | OK | `events/commands.js:1424-1433` | — |
| Texto na lista de eventos "Plugin Command: Plugin, Texto" | MZ | OK | `events/commands.js:1392`; `database/eventlist.js:52` | — |
| Plugin Command (MV, 356), só leitura/compatibilidade | — | Extra/OK | `events/commands.js:1373-1374` | Não aparece na paleta (correto para MZ) |
| [Plugin Help] no menu de clique direito do Script (355) | 01_10_16 | Ausente | `events/commands.js:1361-1371` (só área de texto) | Existe "Plugin Help…" apenas no campo Nota do banco de dados (`database/pluginhelp.js`) |
| API pública para outros módulos | — | OK | `plugins/commands.js`, `plugins/index.js:417-425` | — |

### Implantação


| Item | Manual (página) | Estado | Onde no código | O que falta |
|---|---|---|---|---|
| Diálogo Implantação (OK/Cancelar, progresso, log) | 01_04, 01_11_03 | OK+ | `deploy/index.js:157-330` | Cancelar no meio do processo funciona (`:176,446-447,525-527`). |
| Plataforma Windows | 01_11_03 | Ausente (N/A) | `deploy/index.js:119-122` | Não oferecida: exigiria o runtime NW.js. Não há nem um aviso no diálogo explicando isso. |
| Plataforma macOS | 01_11_03 | Ausente (N/A) | idem | idem |
| Plataforma Navegadores web (Android/iOS) | 01_11_03 | OK | `deploy/index.js:120`; pasta `:458-482`; .zip em JS `:484-503`; .zip no Android `Deployer.java:162-167` | O .zip coloca tudo sob `www/` (`index.js:491`, `Deployer.java:167`). O MZ exporta a pasta do jogo com `index.html` na raiz; para web é preciso extrair e subir o conteúdo de `www/`. |
| (extra) Android APK instalável | — | Extra | `deploy/index.js:121,506-553`; `Deployer`/`ApkBuilder`/`Signer` | Versão fixa em 1/"1.0" (NOTES). Só funciona dentro do app. |
| Local de saída (Escolher…) | 01_11_03 | Parcial | `deploy/index.js:198-199,233-237,259-267` | Pasta **dentro do projeto** (`deploy/`) ou Download/MZEditor; não se escolhe um destino arbitrário. |
| Nome de saída | pedido | OK | `deploy/index.js:130,199,304` | — |
| Excluir arquivos não utilizados | 01_11_03 | OK | `deploy/index.js:204,371-379`; `deploy/scan.js:97-186` (só img/, audio/, effects/; mantém img/system; plugins ativos; `@requiredAssets`) | Não lê `movies/` (é mantido inteiro, o que é seguro). A exclusão configurável via plugin "MaterialBase" é coberta indiretamente pelos parâmetros dos plugins ativos. |
| Criptografar arquivos de imagem | 01_11_03 | OK | `deploy/index.js:205,392,406`; `crypto.js:69-78,96-105` (.png_ com cabeçalho RPGMV) | — |
| Criptografar arquivos de áudio | 01_11_03 | OK | idem (.ogg_/.m4a_) | — |
| Chave de criptografia | 01_11_03 | OK | `deploy/index.js:207-209,253,333-335,381,395` (MD5 da senha → `System.json.encryptionKey` só do pacote) | A senha não é lembrada entre sessões (o MZ guarda). |
| Exclui save/, .rmmzproject, saída anterior | — | OK | `deploy/index.js:110-114,362-367` | — |
| Salvar antes de implantar | (comportamento do MZ) | Ausente | — | Mapas não salvos ficam fora do pacote sem aviso. |
| Testar o pacote | — | Extra | `deploy/index.js:469-480` (abre o pacote no overlay de teste) | — |

### Opções

As linhas de Opções estão na tabela **Ferramentas → Detalhe** acima (Cor transparente, Grade, Tema, Seletor de objetos e extras).
Desde a auditoria, o i18n passou a usar o Idioma; o resto continua valendo.

## Prioridades

Ordem pelo impacto num usuário real do MZ, agrupada por módulo para virar tarefas de sessão.
**P0** impede o uso ou perde dados · **P1** fluxo comum quebrado ou incompleto · **P2** fidelidade de detalhe · **P3** cosmético ou raro.

### Casca e app (`app.js`, `api.js`, `android/`)

1. **P0** — Carregar os módulos sem projeto aberto, para que Novo projeto, Ajuda e Opções funcionem no primeiro uso.
   Hoje `app.js:152-161` retorna antes de `loadModules`.
2. **P0** — Implementar `WebChromeClient.onShowFileChooser` (e `webkitdirectory` ou SAF de pasta) em `MainActivity.java`.
   Sem isso, nenhum Importar funciona no Android.
3. **P0** — Testar jogo deve salvar tudo antes e abrir `index.html?test` (também `?btest&test` e `?etest&test`).
   Na `#playBar`, pôr equivalentes de toque para F9 (Depurar) e Ctrl (atravessar).
4. **P0** — Unificar o salvamento num "projeto modificado" único:
   - Salvar grava mapas, banco, plugins e eventos;
   - confirmar ao abrir ou criar outro projeto (`MainActivity.java:128,158`) e ao sair pelo Voltar.
   - Decidir se o modelo "grava na hora" fica; se ficar, documentar. Ver Divergências.
5. **P1** — Corrigir a gravação imediata de eventos (`events/eventmode.js:72`), que leva junto tiles não salvos e não limpa a flag `modified` do maptools.
6. **P1** — Barra de menus em texto (Arquivo/Editar/Modo/Desenhar/Escala/Ferramentas/Jogo/Ajuda) ou um menu ☰ completo com todos os itens de `01_04`.
   Incluir Fechar projeto, Abrir pasta (compartilhar/mostrar caminho), Atualizar core script, Sair, Site e Tutoriais.
7. **P1** — Atalhos de teclado do `01_04` para teclado físico/DeX: Ctrl+N/O, F1, F5–F8 (modos), ferramentas de desenho, F9–F11 (Ferramentas) e Ctrl+R (teste).
8. **P2** — Barra de status com o nome do mapa (`app.js:78`). Menu de contexto da lista de mapas deve fechar com Esc e com a abertura de diálogos (bug visto).

### Novo projeto e recursos (`tools/`)

1. ~~**P0** — Novo projeto com os recursos padrão~~ — **OK**: `android/app/template.gradle` empacota o `newdata` completo em `assets/editor/template-full/`; o Novo projeto e o "Importar recursos padrão" usam essa fonte.
2. ~~**P1** — Gerenciador de recursos com a pasta `movies/`~~ — **OK**.
3. **P2** — Opções:
   - "Cor transparente" nos visualizadores de imagem — **OK**;
   - "Seletor de objetos" — **Parcial**: `api.tools.objectSelectorMode(n)` pronto; falta events e database usarem.
4. ~~**P3** — Barra de espaço no Teste de som; ME retoma a BGM~~ — **OK**.

### Mapa (`maptools/`)

1. **P1** — Expandir/recolher nós na lista de mapas (`app.js:26-41`). Em projeto grande, a árvore fica inviável no celular.
2. **P1** — Botões Editar (Recortar/Copiar/Colar/Excluir) devem agir no mapa selecionado na lista quando o foco está nela, como no MZ.
3. **P2** — Limites das Propriedades do mapa iguais ao manual: largura/altura a partir de 0 e peso de encontro a partir de 0. Copiar/Colar nos encontros.
4. **P2** — Salvar como imagem com compartilhar (`Android.shareFile`) ou escolha do destino.
5. **P3** — Conta-gotas "exato" (Shift) por toque. O botão "A" poderia valer também para ele.

### Eventos (`events/`)

1. **P1** — Seleção múltipla por Shift+clique na lista de conteúdo (`commandlist.js:317-327`) e na lista da rota (`moveroute.js:102`).
2. **P1** — Ranges do operando por comando em `operandUI` (`commands.js:65-74`).
   - HP, MP e Parâmetro: 1–9 999; TP: 1–100; Nível: 1–98; EXP: 1–9 999 999.
   - Mínimo 1 em todos.
   - Control Switches/Variables limitados ao tamanho real da lista do System.
3. **P1** — Botão Aplicar no Editor de evento e nos diálogos de comando (`ui.js:32-55`); Ctrl+Enter = OK.
4. **P1** — Buscador de eventos:
   - busca por nome de evento;
   - referências de variável que faltam: 231/232 com posição por variável, abas 2 e 3 do 111, condição de variável das tropas e itens da loja (605).
5. **P2** — Limite de 20 páginas por evento (`eventeditor.js:39-41`).
6. **P2** — Prévias que faltam:
   - Tint Screen, Tint Picture e Change Window Color com a cena ou janela de verdade (`ui.js:610-633`);
   - Battle Background com as duas camadas (`commands.js:1253`);
   - Show Text com posição, fundo e `\V`.
7. **P2** — Menus dos campos de texto: Plugin Help em Show Text/Comment/Script/Script de condição, e Icon Set Viewer em Scrolling Text.
   O código já existe em `database/pluginhelp.js` e `commands.js:1511`.
8. **P2** — Lista de comandos de tropa deve mostrar "#1 Slime", e não só "#1" (`commands.js:39`).
9. **P3** — Copy as HTML Tags com as cores e a estrutura do MZ (`commandlist.js:269-275`).
   Lista da rota com Recortar, menu de contexto e Script multilinha. Event List deve substituir a paleta e sincronizar (`eventmode.js:352-371`).

### Banco de dados (`database/`)

1. **P1** — Teste de batalha (`tabs_battle.js:265-300`):
   - área [Status] com os parâmetros calculados;
   - equipamento filtrado pelo que ator e classe podem equipar;
   - Dual Wield;
   - não marcar System como alterado.
2. **P1** — Tilesets: marcar vários tiles arrastando no toque (`tabs_misc.js:340-375`). Reverse deve ser um gesto (toque longo), não um estado.
3. **P1** — Troops, botão Adicionar:
   - lista de inimigos com toque duplo, em vez de `<select>`;
   - sem realinhar o grupo (`tabs_battle.js:349-354`).
4. **P2** — Change Target da prévia de animação deve gravar `System.battlerName/battlerHue` e ter ajuste de Hue (`animpreview.js:252-256`).
5. **P2** — Fórmula de dano com ajuda e validação de sintaxe (`tabs_items.js:59-61`).
6. **P2** — Seletor de arquivo para Main/Number Font (`tabs_system.js:234-235`). Posição inicial arrastável e apagável (`tabs_system.js:78-86`).
7. **P2** — Conferir as Imagens de veículos vazias em Sistema 1 e pôr a amostra de janela na Cor da janela (visto no editor).
8. **P3** — Gráfico de fundo da tabela de EXP (`tabs_actors.js:198-224`), único item Ausente do banco. Outros ajustes:
   - limites: MP Cost até 999, EXP de inimigo a partir de 1;
   - confirmação no Limpar de Troops;
   - Duração em turnos desativada com Timing = Nenhum;
   - clipboard persistente.

### Plugins (`plugins/`)

1. **P1** — Abas [Arquivo]/[Texto] nos editores de parâmetro: texto livre como `\V[n]` em `select`, `boolean` e `number`.
   Os plugins oficiais PluginCommonBase, ExtraWindow e ExtraImage dependem disso.
2. **P1** — "Inserir número de ícone" nos editores de texto de parâmetro (`params.js:173`).
3. **P2** — Comando de plugin deve listar só plugins ativados (`events/commands.js:1383`); coluna Valor com rótulos amigáveis (`params.js:20-23`).
4. **P2** — `@require` e `@noteParam`/`@noteDir` no "Excluir arquivos não utilizados" da Implantação, para não apagar arquivos que plugins usam.
5. **P3** — Atualizar vários plugins de uma vez, menu de contexto do gerenciador, seletor próprio para `@type animation` e bloco de idioma pela interface.

### Gerador (`generator/`)

1. ~~**P2** — Importar/Exportar e Salvar/Carregar configurações também fora da pasta do projeto~~ — **OK** ("Outro local…").
2. ~~**P3** — Prévia SV com movimentos únicos uma vez; cores "disponíveis" com SV e TVD; Ajustar desabilitado onde não desloca~~ — **OK**.

### Implantação (`deploy/`)

1. **P1** — Salvar o projeto antes de implantar.
2. **P2** — .zip web com a mesma estrutura do MZ (sem a pasta `www/` na raiz); saída fora do projeto via SAF.
3. **P3** — Lembrar a senha de criptografia. Windows/macOS ficam fora por decisão de plataforma (registrar no README).

## Divergências de comportamento

Itens que existem, mas funcionam diferente do original. Os marcados "(a confirmar)" precisam ser comparados no MZ de PC.

### Geral

- **Sem barra de menus:** as ações são ícones, o menu ☰ e menus de contexto. Equivalentes de toque:
  - toque longo = clique direito (lista 550 ms, mapa 500 ms);
  - pinça = zoom;
  - botão "A" = Shift.
- **Gravação:** Banco, Plugins (`plugins.js` no OK/Aplicar, `manager.js:312-323`) e Eventos gravam na hora.
  No MZ, tudo fica em memória até "Salvar projeto"; aqui, "não salvar" não desfaz essas mudanças.
- **Abrir projeto** escolhe uma pasta (SAF), e não o `game.rmmzproject`. Não valida se é projeto MZ nem a versão.
- **Novo projeto** gera o `newdata` completo no APK (template mínimo só no PC sem `template-full`). No Android, a pasta-mãe é escolhida depois do OK, e um nome repetido vira "Nome (1)" sem aviso.
- **Teste de jogo** roda em iframe sem `test`, então o jogo se comporta como versão final.
- **Layout:** lista de mapas e paleta em colunas separadas e ocultáveis; no celular (≤ 700 px) as duas começam ocultas.

### Mapa

- Histórico de 200 passos com Refazer (`editops.js:97-126`). O MZ 1.1.1 guarda 20 passos e não refaz.
- Editar no modo mapa age sobre uma área de tiles, com a ferramenta Selecionar (extra), e não sobre dados de mapa.
- Zoom contínuo de ×1,25 (0,125× a 4×) mais pinça, em vez de níveis fixos.
- Grade disponível e ligada por padrão também no modo mapa.
- Deslocar faz o conteúdo dar a volta no mapa e move os eventos (a confirmar).
- Arrastar para a raiz coloca o mapa no fim; Novo mapa herda o tileset do mapa atual (`maptree.js:82`).

### Eventos e comandos

- **Rótulos** diferentes do manual:
  - "Replay BGM" / Resume BGM;
  - "Change Encounter" / Enable/Disable Encounters;
  - "Enemy Appear" / Enemy Appearance;
  - "Save EXP" / Save Level;
  - "Pan" / Balance;
  - "Turn Down…" / Face Down…
  - Vários seguem a lista do editor real, e não o manual.
- **Duplo clique** numa linha com comando edita, como no MZ real; o manual 01_09_03 diz "insere".
- **Show Choices:** Cancelar/Padrão apontando para escolha vazia viram −1 sem aviso (`commands.js:282-285`). No MZ essas opções ficam desabilitadas.
- **Padrões a conferir:**
  - Change Party Member com Initialize marcado;
  - Control Timer com 1 min;
  - Change Window Color partindo do tom atual do System.
- **Texto da lista:**
  - Conditional Branch de ator e Control Variables (Game Data) usam frases próprias;
  - Show Text acrescenta o nome do falante no fim;
  - itens do banco aparecem sem o "0001".
- **Páginas:** Limpar página pede confirmação; Excluir página recusa a única página (no MZ o botão fica desabilitado).
- **Criação rápida:** Transfer e Door têm campo Fade extra; textos de Tesouro/Pousada fixos.
- **Extras:** Desfazer/Refazer no modo evento; Multi; ▲/▼ nas tabelas.

### Banco de dados

- **Limites:**
  - MP Cost 0–9999 (manual: 0–999);
  - EXP de inimigo a partir de 0 (manual: 1);
  - Gerar curva com mínimo 0 nos parâmetros "outros" (manual: 1);
  - mínimos de Configurações avançadas (640×360, fonte 12–128) são escolha do port.
- **Troops:** Adicionar realinha o grupo inteiro.
- **Colar:** com vários itens copiados, cola em sequência e descarta o que passar do fim.
- **Teste de batalha:** grava `testBattlers` e os `Test_*.json` mesmo sem Aplicar.
- **Contents de Troops e Eventos comuns:** a aba mostra um resumo só de leitura e a edição abre num diálogo. No MZ, a lista é editável na própria janela.
- **Tilesets:** Reverse é uma caixa persistente; no MZ é o botão direito, por clique.
- **Clipboards** (páginas de Troops, linhas de tabela) são internos e se perdem ao recarregar.
- **Rótulos:**
  - "Magical Attack" / Magic Attack;
  - "Encounter Half" / Half Encounters;
  - "Knockout by…" / Death by…;
  - "Ally Collapse" / Ally Death;
  - "Invocation" / Activation;
  - "World Type" / Field Type;
  - lista completa na tabela.

### Plugins e Gerador

- Plugin Command sem plugins ativos lista todos os arquivos de `js/plugins/`; o MZ só oferece os ativados.
- `number` sem `@min`/`@max` fica sem limite; `file` sem `@dir` abre `img/` (padrões do MZ a confirmar).
- **Extras do port:** Redefinir no Gerador; Ativar/Desativar todos; aba Comandos e campo URL no Gerenciador.
- **Gerador:**
  - Ajustar só desloca o rosto (fiel ao bytecode, segundo o NOTES); os botões ficam desabilitados nas partes sem rosto;
  - "Outro local…" no Android grava no projeto e compartilha (não há "Salvar como" do sistema);
  - o exportador de Caído usa `Damage1.png` do RTP.

### Ferramentas e Implantação

- Exportar recurso no Android = compartilhar, um arquivo por vez. DLC pede uma pasta qualquer.
- Recursos criptografados (`.png_`/`.ogg_`) não aparecem no Gerenciador de recursos, o que é coerente com 01_11_03.
- **Implantação:**
  - sem Windows/macOS; APK extra;
  - saída dentro do projeto ou em Download/MZEditor;
  - .zip sob `www/`;
  - senha não guardada;
  - chave = MD5 da senha, compatível com o runtime (autoteste em `deploy/index.js:382-390`).
- Teste de batalha não limpa os `data/Test_*.json`.
