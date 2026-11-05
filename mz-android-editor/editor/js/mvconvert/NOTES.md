# Módulo mvconvert — conversão de dados do RPG Maker MV

`register(api)` roda a verificação ~300 ms depois do boot (o módulo só é carregado com projeto aberto) e
também em `api.on("project:opened")`, se a casca emitir esse evento. Expõe
`api.mvconvert = { detect(), convert(report?), check() }`. CSS: `editor/css/mvconvert.css`.

## O que o MZ faz (fonte: RPG.exe)

Os QML do editor estão compilados (cache QV4 do Qt 5.12.9) dentro do `RPG.exe`; o arquivo
`rea-extract/qrc/qml/Singletons/DataConverter.qml` extraído está vazio. `qv4strings.py` (nesta pasta) lista
as unidades `qv4cdata` do exe e despeja a tabela de strings de cada uma
(`python qv4strings.py RPG.exe convertBattleMessage`). Cabeçalho da unidade 5.12: `unitSize` em +24,
`flags, stringTableSize, offsetToStringTable` em +108; cada string = QArrayData (tamanho em +4, UTF-16 em +24).

- Unidade `0x5d0e80` (DataConverter, 47 strings): `convertSystem(system)`, `convertSkills(skills)`,
  `convertStates(states)`, `convertBattleMessage(object, key)`, `convertAniation(animation)`,
  `convertSystemTerms(terms)`, `convert(currentData, template)`; usa `JsonTemplates.newSystem`, `advanced`,
  `gameId`, `CommonUtils.generateUniqueId`, `messageType`, `message1..4`, `replace`, `"%1"`, `"%2"`,
  `NewDataMaker.newAnimation`, `NewDataMaker.systemMessages`, `DataManager.databaseModified`.
- Unidade `0x5a5900` (DataManager): `loadDatabase` → `convertDatabase` chama **só** `DataConverter.convertSystem`,
  `convertSkills` e `convertStates`. Ou seja: o MZ converte em silêncio ao carregar e marca o banco como
  modificado; `convertAniation` não entra na conversão automática.

O bytecode (Moth) não foi desmontado; a lógica abaixo foi reconstruída das strings + do runtime e
**conferida por ida e volta** (ver Teste):

| Função | Port |
|---|---|
| `convertSystem` | `fillMissing(system, template)` completa chaves ausentes (recursivo em objetos, nunca altera valores/arrays existentes) com o `System.json` do template do editor (= `newSystem` do MZ); sem `advanced` → `advanced` do modelo com `gameId = generateUniqueId()` (8 dígitos aleatórios, como os `gameId` dos projetos do MZ, ex. 66318641 nos dados do tutorial); `terms.messages` ganha as mensagens novas (autosave, touchUI...). |
| `convertSkills` | habilidade sem `messageType`: `message1/2 = "%1" + msg.replace("%1", "%2")` (MV: `nome + msg.format(item)`; MZ: `msg.format(nome, item)`), `messageType = 1`. |
| `convertStates` | estado sem `messageType`: `message1..4 = "%1" + msg`, `messageType = 1`. |
| animações | ficam como estão: `Spriteset_Base.isMVAnimation` (= tem `frames`) faz o runtime usar `Sprite_AnimationMV`. A aba Animações do banco mostra só o nome + aviso para elas (o MZ não as edita, manual 01_01_01_02). |

Evidência extra: no template do MZ `messageType` é a **última** chave das habilidades/estados — os dados de
exemplo do MZ passaram por esta conversão.

## Detecção (`detect`)

Convertível: `System.json` sem `advanced`; habilidades/estados sem `messageType`.
Só avisos (do manual, "MV Data Conversion"): animações com `frames`; `js/rpg_*.js`; `img/system/Damage.png`,
`Loading.png`, `MadeWithMv.png` e `ButtonSet.png` fora do tamanho do MZ (MV 240×48, MZ 528×96);
`fonts/gamefont.css`; plugins em `js/plugins/` com bloco `/*:` sem `@target MZ`.

## Interface (divergência consciente)

O MZ converte sem perguntar. Aqui aparece um diálogo listando o que será convertido e os avisos, com
Converter / Cancelar (o projeto pode ter sido aberto só para consulta no aparelho). Converter altera os dados
na memória e marca `System/Skills/States` com `api.markDirty` → entram no próximo "Salvar projeto" (como o
`databaseModified` do MZ). Cancelar não pergunta de novo na mesma sessão do navegador (sessionStorage).
Sem nada convertível (só sobras do MV), o aviso vai só para a barra de status.

## Limitações

- Projeto MV puro (sem `js/rmmz_*.js`): o `app.js` nem carrega os módulos (runtime ausente); o manual manda
  copiar os arquivos do MV para um projeto MZ novo, que é o caso tratado aqui.
- Plugins MV: só são contados; o aviso por plugin fica com o Gerenciador de plugins.

## Teste

Projeto MV sintético = cópia do testproject com `advanced`, `titleCommandWindow`, `itemCategories`,
`battleSystem`, `optAutosave`, `optKeyItemsNumber`, `optDrawTitle`, `terms.messages.autosave/touchUI` removidos;
mensagens de 235 habilidades e 30 estados no formato MV (`" attacks!"`, `" is poisoned!"`) sem `messageType`;
uma animação MV (`frames`, `animation1Name`, `timings`); `js/rpg_core.js`, `img/system/Damage.png`,
`fonts/gamefont.css`, um plugin sem `@target MZ`. Resultado (devserver, 1200×554): diálogo com 3 conversões e
5 avisos; Converter + Salvar → habilidades e estados **idênticos** aos do testproject original (0 diferenças em
`message1..4/messageType`), System com todas as chaves do original. Projeto MZ normal: nenhum diálogo.
