# Contrato para módulos desenvolvidos em paralelo

Objetivo do projeto: port 100% fiel do editor RPG Maker MZ 1.1.1 para Android,
sem perder funções. Cada sessão entrega UM módulo. Leia `README.md` primeiro.

## Fontes de verdade (fidelidade)

- `../RPG/help-en/` — manual oficial do editor, tela por tela (campos, abas,
  comportamento). Replique a estrutura e os nomes exatos das telas.
- `testproject/js/rmmz_*.js` — runtime oficial (texto legível). Define o formato
  dos dados, códigos de comandos de evento (`Game_Interpreter.prototype.command###`),
  autotiles (`Tilemap.*_AUTOTILE_TABLE`), parser de plugins (`PluginManager`).
- `testproject/data/*.json` — exemplos reais de cada arquivo de dados.
- `../rea-extract/qrc/qml/Images/` — ícones originais; `editor/fonts/` — fonte M+.
- O editor original é Qt/QML; a lista de telas está em `../rea-extract/qrc/qml/**`
  (apenas nomes; o conteúdo QML não está disponível em texto).

## Regras de integração (para não colidir com outras sessões)

1. Crie seu código SOMENTE em `editor/js/<seu-modulo>/` (+ `editor/css/<seu-modulo>.css`
   se precisar; importe o CSS de dentro do módulo criando um `<link>`).
2. NÃO edite `index.html`, `app.js`, `api.js`, `modules.js`, `mapview.js`,
   `project.js`, `editor.css`, nem a pasta `android/`. Se precisar de algo da
   API que não existe, implemente localmente no seu módulo e anote em
   `editor/js/<seu-modulo>/NOTES.md` o que gostaria que fosse promovido à API.
3. Exporte `register(api)` em `editor/js/<seu-modulo>/index.js`. A sessão
   principal liga o módulo em `modules.js`.
4. Use `api.bindToolbar("btnDatabase", handler, "Banco de dados")` para habilitar
   o botão da barra que lhe pertence (ids em `index.html`).
5. Diálogos: `api.openDialog({title, width, height, buttons})` devolve
   `{root, body, close}`. Monte a UI dentro de `body`.
6. Dados: `api.project.readJson("data/Actors.json")`, `api.project.writeJson(...)`.
   Após gravar, `api.emit("db:changed", {file})`. Para mapas use
   `api.project.map(id)` e grave `data/MapXXX.json`; emita `map:changed`.
7. Eventos disponíveis: `api.on("map:selected", ({id, map, tileset}) => ...)`.
8. Interface pensada para toque em paisagem (tablet/celular): alvos ≥ 36px,
   sem hover obrigatório, sem menus de contexto exclusivos de mouse.
9. Sem frameworks nem build: JS ES2020 puro em módulos, CSS puro.
10. Teste no PC: `node devserver/server.mjs --project <caminho absoluto do testproject> --port <porta livre>`
    e abra `http://127.0.0.1:<porta>/?modules=./<seu-modulo>/index.js` no
    navegador: a query `modules` liga o seu módulo sem editar `modules.js`.
    Verifique visualmente (screenshot) antes de dar por pronto.
11. Ao terminar, escreva `editor/js/<seu-modulo>/NOTES.md` com: o que foi
    implementado, o que ficou fora, e como testar.

## Módulos planejados e donos

| Módulo | Pasta | Botão(ões) | Escopo |
|---|---|---|---|
| database | `editor/js/database/` | `btnDatabase` | Diálogo Banco de dados com TODAS as abas do MZ: Atores, Classes, Habilidades, Itens, Armas, Armaduras, Inimigos, Grupos, Estados, Animações, Tilesets, Eventos comuns, Sistema 1, Sistema 2, Tipos, Termos. Edição completa com gravação. |
| events | `editor/js/events/` | `btnModeEvent`, `btnEventSearch` | Modo evento no mapa (criar/mover/copiar/apagar eventos), editor de evento com páginas, condições, gráfico, movimento, opções, e TODOS os comandos de evento do MZ com seus diálogos de parâmetros; buscador de eventos. |
| maptools | `editor/js/maptools/` | `btnPencil`, `btnRect`, `btnEllipse`, `btnFill`, `btnShadow`, `btnUndo`, `btnCut`, `btnCopy`, `btnPaste`, `btnDelete`, `btnSave` | Paleta de tiles (abas A–E, R), ferramentas de desenho com autotile correto, camadas, regiões, seleção, undo/redo, propriedades do mapa, novo mapa, gravação. |
| plugins | `editor/js/plugins/` | `btnPlugins` | Gerenciador de plugins fiel: lista, ativar/desativar, parâmetros a partir dos comentários `@param/@type/@option/...`, gravação de `js/plugins.js`. |
| generator | `editor/js/generator/` | `btnGenerator` | Gerador de personagens com as partes de `../RPG/generator/` (Face/TV/SV/TVD/Variation), cores por gradiente, exportação de PNGs para `img/`. |
