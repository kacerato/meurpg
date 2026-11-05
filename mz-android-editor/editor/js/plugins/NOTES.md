# Módulo plugins — Gerenciador de plugins

Botão `btnPlugins`. CSS em `editor/css/plugins.css` (injetado por `index.js`).

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.js` | `register(api)`: injeta o CSS, liga `btnPlugins` e expõe `api.plugins` |
| `parser.js` | Parser das anotações (`/*:`, `/*:en`, `/*~struct~Nome:`), tipos e padrões |
| `store.js` | Ler/gravar `js/plugins.js` (formato byte a byte do MZ), listar `js/plugins/`, cache de cabeçalhos |
| `manager.js` | Diálogo **Gerenciador de plugins** (Plugin Manager) |
| `plugindlg.js` | Diálogo **Plugin** (adicionar/editar) |
| `params.js` | Tabela de parâmetros (árvore por `@parent`) e editores por `@type` |
| `pickers.js` | Seletores: banco de dados, switch/variável, arquivo, cor, ícone |
| `commands.js` | API pública de Plugin Commands para outros módulos |
| `ui.js` | Diálogo com Promise, lista de toque, helpers |

## Implementado

**Gerenciador de plugins**
- Lista Nome / Status / Descrição, na ordem de carga. A última linha vazia adiciona
  (no MZ: duplo clique numa linha vazia).
- Tocar seleciona; tocar de novo na linha selecionada abre a edição (equivale ao duplo clique).
- O botão ON/OFF na coluna Status liga e desliga o plugin direto na lista.
- Para reordenar, arraste pela alça `≡` (pointer events, toque e mouse, com rolagem automática)
  ou use ▲ Subir / ▼ Descer.
- Botões: Adicionar, Editar, Excluir, Recortar, Copiar, Colar, Subir, Descer, Atualizar (relê o
  arquivo: descrição + parâmetros, mantendo os valores dos parâmetros que ainda existem), Múltipla,
  Ativar todos, Desativar todos.
- Seleção múltipla: Shift + clique (intervalo, como no MZ) ou o botão Múltipla no toque.
  Atualizar, Recortar, Copiar e Excluir valem para todos os selecionados.
- Menu de contexto (clique direito; toque longo de 550 ms): Editar, Recortar, Copiar, Colar,
  Excluir, Atualizar. Atalhos: Del, Ctrl+X/C/V, Enter.
- Avisos (painel amarelo e ⚠ na linha):
  - arquivo inexistente;
  - plugin sem `@target MZ` (MV);
  - `@base` ausente, desativado ou abaixo;
  - `@orderAfter` / `@orderBefore` violados.
- OK grava e fecha, Aplicar grava sem fechar e Cancelar descarta (pede confirmação se houve
  mudança).

**Diálogo Plugin**
- Nome: lista de `js/plugins/*.js`, marcando os que já estão na lista.
- Campos: Status ON/OFF, Descrição (`@plugindesc`), Autor, URL (`@url`, se houver) e Ajuda (`@help`).
  Aviso de plugin MV ou de arquivo ausente.
- Aba **Parâmetros**: tabela em árvore (`@parent`) com rótulo `@text` (ou o nome) e valor.
  O `@desc` do parâmetro selecionado aparece embaixo.
- Aba **Comandos**: os `@command` com `@text` e `@desc` e a tabela de `@arg` (tipo, opções,
  padrão, descrição), somente leitura.
- Escolher outro arquivo recarrega os padrões. Ao editar uma entrada, os valores gravados são
  mantidos, inclusive os de parâmetros que não existem mais, até usar "Atualizar".

**Bloco de idioma** (`parser.js` `preferredLangs`): idioma da interface primeiro (`/*:ja_JP`,
`/*:ja`; em pt_BR, `/*:pt_BR`, `/*:pt`), depois `/*:` sem sufixo, depois `/*:en`, depois qualquer
bloco, sempre preferindo os que têm `@target MZ`. Para structs vale o mesmo idioma do cabeçalho.

**Editores por tipo** (todos gravam string):
- Abas [Tipo]/[Texto] (Dialog_PluginParameter, `params.js` `typedDialog`): `number` (Número),
  `boolean` (Booleano) e `select` (Opção) têm uma segunda aba Texto que aceita qualquer valor, como
  `\V[n]`/`\S[n]` (usado por PluginCommonBase, ExtraWindow, ExtraImage). Um valor que não cabe no
  tipo abre direto na aba Texto. Os seletores de arquivo/banco/cor/ícone mantêm o campo "Texto:".
- "Insira Índice de Ícone" / "Insira Índice de Cor" (TextEditPopupMenuEx): botões abaixo dos
  campos de texto (string, multiline, note, combo e aba Texto); inserem o número no cursor.
- Listas (`tipo[]`): "Editar como texto" edita o JSON da lista inteira.
- `string` (e tipos desconhecidos, como `text`): campo de uma linha.
- `multiline_string`: área de texto.
- `note`: área de texto; o valor é gravado como `JSON.stringify(texto)`, como no MZ.
- `number`: aceita `@min`, `@max` e `@decimals` (`toFixed`), com botões −/+. O valor é limitado
  ao intervalo ao confirmar.
- `boolean`: dois botões com `@on` / `@off` (padrão ON/OFF); grava `"true"` / `"false"`.
- `select`: lista das `@option`; grava o `@value` (ou o texto da opção).
- `combo`: texto livre mais a lista de opções.
- `file`: navegador de `@dir` (padrão `img`), com subpastas e pré-visualização de imagem ou
  botões tocar/parar para áudio. Grava sem extensão, e com `sub/nome` quando está numa subpasta.
  "(Nenhum)" grava `""`.
- Tipos de banco de dados: `actor`, `class`, `skill`, `item`, `weapon`, `armor`, `enemy`, `troop`,
  `state`, `tileset`, `common_event`. Lista `0001 Nome` lida de `data/*.json`;
  "(Nenhum)" grava `"0"`.
- `switch` / `variable`: nomes de `System.json`.
- `color`: paleta 0–31 lida dos pixels de `img/system/Window.png`.
- `icon`: grade de `IconSet.png`.
- `animation`: lista com prévia Effekseer (Reproduzir/Parar), reaproveitando
  `database/animpreview.js` (alvo = `System.battlerName`).
- Coluna Valor (`displayValue`): `select` mostra o texto da `@option`, `boolean` o `@on`/`@off`,
  banco/switch/variável "0001 Nome" (nomes lidos uma vez por abertura); o resto aparece cru.
- `struct<Nome>`: sub-diálogo com a tabela dos campos de `~struct~Nome`; grava JSON (só os
  campos declarados, na ordem). Se o struct não estiver declarado, edita o JSON como texto.
- `tipo[]`: editor de lista (Adicionar, Editar, Excluir, Subir, Descer); grava JSON de um array
  de strings. Elementos struct ficam duplamente codificados, igual ao MZ. Funciona aninhado
  (`struct<X>[]` dentro de struct etc.).
- Pickers e listas têm um campo "Texto:" para digitar o valor à mão (a aba [Text] do MZ).

**Gravação**: `js/plugins.js` tem o cabeçalho `// Generated by RPG Maker.` e
`// Do not edit this file directly.`, depois `var $plugins =`, `[`, um objeto JSON compacto
por linha (`name, status, description, parameters`, nessa ordem; parâmetros na ordem de
declaração), separados por `,\n`, e `];\n` no fim (LF, sem BOM). Foi conferido contra
`RPG/newdata/js/plugins.js` e um projeto de exemplo da DLC. A gravação usa
`PUT /api/file?path=js/plugins.js` e emite `api.emit("plugins:changed", {list})`.

## API para outros módulos (eventos: comando 357 "Plugin Command")

```js
import { getPluginCommands, getEnabledPluginsWithCommands, editPluginCommandArgs, defaultArgs }
    from "../plugins/commands.js";
await getPluginCommands("PictureAnimation");
// -> [{name, text, desc, args:[{name,text,desc,type,default,min,max,decimals,on,off,dir,options:[{text,value}]}], structs}]
await getEnabledPluginsWithCommands();       // plugins ON com comandos, na ordem do gerenciador
await editPluginCommandArgs(api, plugin, command, args);  // abre os mesmos editores; -> objeto args | null
```

Também ficam disponíveis em `api.plugins` depois do `register`: `open`, `list`, `info`,
`getPluginCommands`, `getEnabledPluginsWithCommands`, `defaultArgs` e
`editCommandArgs(plugin, command, args)`.

## Fora do escopo / diferenças conhecidas

- O manual local não traz a página de referência das anotações. A semântica segue a
  especificação pública do MZ e o comportamento observado nos plugins oficiais.
- Valores padrão de `@min` / `@max` sem anotação: sem limite.
- `@type location` e `@type map` (versões > 1.1.1) são tratados como `string`.
- `@noteParam` / `@noteDir` / `@noteType` / `@noteData` / `@noteRequire` são ignorados. Servem
  à exclusão de arquivos não usados na distribuição, que não existe neste editor.
- "Insira Índice de Ícone/Cor" insere só o número (não `\I[n]`); confirmar no MZ de PC.
- `\V[n]` dentro de struct não é convertido pelo PluginCommonBase (ele devolve structs crus):
  comportamento do plugin, igual no MZ.

## Sugestões para a API (promover para api.js)

- `api.project.readText(path)` / `writeText(path, text)`: hoje o módulo usa `fetch` direto em
  `/api/file`.
- `openDialog` devolver uma Promise ou ter `onClose`: o fechamento por Esc/`closeTopDialog` é
  detectado aqui com `MutationObserver` (`ui.js`).

## Como testar

```bash
node devserver/server.mjs --project "<abs>/mz-android-editor/testproject" --port 8784
```
Abra `http://127.0.0.1:8784/?modules=./plugins/index.js` e toque no botão do Plugin Manager.

O `testproject/js/plugins/` (fora do git) recebeu cópias de plugins oficiais da DLC
(`PluginCommonBase`, `TextScriptBase`, `ExtraWindow`, `UniqueDataLoader`, `RegionBase`,
`MaterialBase`, `EventCommandByCode`, `TemplateEvent`, `PictureAnimation`,
`MessageWindowPopup`) e `MZEditorTypeTest.js`, que declara um parâmetro de cada tipo, um
struct, listas e um comando. O `plugins.js` do testproject foi devolvido ao estado vazio
original depois do teste.

Testado em 1280×600, no navegador do app:
- adicionar 8 plugins;
- editar todos os tipos;
- struct dentro de lista dentro de plugin;
- arrastar e ▲/▼;
- avisos de `@base` / `@orderAfter`;
- Atualizar;
- gravar e conferir o `plugins.js`.

No jogo de teste, título → mapa → menu rodaram sem erro. O comando
`MZEditorTypeTest/show` funcionou e a janela do ExtraWindow apareceu no mapa com o texto
editado.

Obs.: o MZ pausa o jogo quando a janela não tem foco (`SceneManager.isGameActive`). No pane
oculto do navegador de teste foi preciso avançar os quadros à mão.

Rodada 3 (2026-11-05, cópia do testproject com PluginCommonBase, ExtraWindow e ExtraImage):
Atualizar em lote (Shift) preencheu os três; ExtraWindow → Window List → X = `\V[1]` pela aba
Texto, "Abrir/Fechar" = `\S[1]`, texto com "Insira Índice de Ícone"; `plugins.js` gravado e o
jogo chegou ao título com a janela extra criada, sem erro. Seletor de `@type animation` com prévia.
