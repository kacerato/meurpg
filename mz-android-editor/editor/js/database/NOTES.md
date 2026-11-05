# Módulo database — Banco de dados do RPG Maker MZ

Diálogo "Database" com as 16 abas do MZ 1.1.1, rótulos em inglês como no editor
original, interface de toque em paisagem (controles ≥ 36 px, abas roláveis, cabe em
1280×600 CSS px). Habilita `btnDatabase` via `api.bindToolbar`. CSS próprio em
`editor/css/database.css`, injetado por `<link>` a partir do `index.js`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.js` | `register(api)`, diálogo principal, abas, lista à esquerda (Change Maximum / Copy / Paste / Clear, F4/F5), OK / Cancel / Apply, gravação |
| `tabs.js` | ordem das 16 abas |
| `tabs_actors.js` | Actors (equipamento inicial filtrado pelos traits de classe/ator, dual wield), Classes (EXP Curve com abas To Next Level/Total usando a fórmula do runtime, Parameter Curves com gráfico tocável, Quick Settings A–E, Generate Curve, Skills to Learn) |
| `tabs_items.js` | Skills, Items, Weapons, Armors (Scope em Faction/Number/Status → códigos 0–14 do `Game_Action`, Invocation, Damage, Message com "casts/does/uses *!", Required Weapon, Parameter Changes) |
| `tabs_battle.js` | Enemies (imagem com Hue, Drop Items, Action Patterns com as 7 condições), Troops (Placement View com fundo de batalha, arrastar inimigos, Add/Remove/Clear/Align, Appear Halfway, Auto-name, Change BG, Battle Test, Battle Event com páginas, Conditions e Span), States |
| `tabs_misc.js` | Animations (Effekseer só por nome do arquivo em `effects/`, Sound/Flash Timings), Tilesets (imagens A1–E, Tile List abas A–E com Passage, Passage (4 dir), Ladder, Bush, Counter, Damage Floor, Terrain Tag), Common Events |
| `tabs_system.js` | System 1 (Starting Party, Window Color, veículos, Starting Positions com mapa desenhado pelo `MapView`/Tilemap do runtime, Title Screen, Command Window, Battle Screen/System, Options, Music, Sounds), System 2 (Menu Commands, Item Categories, [SV] Attack Motions, [SV] Magic Skills, Advanced Settings), Types (5 listas com Change Maximum), Terms |
| `traits.js` | diálogo e lista de Traits (códigos 11–64 do `Game_BattlerBase`) e Effects (11–44 do `Game_Action`) |
| `pickers.js` | seletores com pré-visualização: imagem (com Hue), sprite sheet de character/face com índice, ícone (IconSet), áudio (volume/pitch/pan, tocar/parar), cor/tom |
| `ui.js` | widgets ligados a dados (`num`, `text`, `sel`, `chk`...), `tableList`, `modal`, `tabs` |
| `eventlist.js` | lista "Contents" (resumo textual dos comandos) para Troops e Common Events |
| `common.js` | constantes, opções, escopo, curva de EXP, dados em branco por tipo |

## Gravação

- Ao abrir, lê os 13 arquivos (`Actors` … `System`) com `readJson(..., {fresh:true})` e
  trabalha numa cópia (`structuredClone`): Cancel descarta de fato.
- Qualquer edição marca o arquivo da aba como alterado (título vira "Database *").
- **Apply** grava só os arquivos alterados; **OK** grava e fecha. Para cada arquivo:
  `api.project.writeJson("data/X.json", cópia)` e `api.emit("db:changed", {file})`.
- Campos desconhecidos dos JSON são preservados (edita-se o objeto original);
  bits de veículo dos flags de tileset (0x200/0x400/0x800) são preservados.
- Battle Test grava `data/Test_*.json` (como o editor do PC) e abre
  `/project/index.html?btest` no `#playOverlay` existente.

## Integração com outros módulos

- `api.database = { open(tabId) }` permite abrir o banco numa aba (`"actors"`, `"system1"`...).
- Editor de comandos (módulo events): `eventlist.js` usa `api.events.editCommandList(list, opts)`
  ou `api.editCommandList(list, opts)` se existir (recebe cópia, devolve `Promise<lista|null>`,
  `opts = {context: "troop"|"common", troopId?, commonEventId?, title}`). Sem ele, a lista é
  só leitura. Nota deixada na pasta compartilhada das sessões (`database-to-events.md`).
- `pickers.js` (pickImage, pickSheet, pickIcon, pickAudio, pickColor) pode ser reaproveitado.

## Gostaria de ver na API

- `api.openDialog` com callback `onClose` e opção de não fechar por `closeTopDialog`
  (hoje o "voltar" do Android fecha o Database sem perguntar sobre alterações).
- `api.project.writeJson` com formatação igual à do MZ (uma entrada por linha), para diffs menores.
- Um `api.playtest(url)` para o Battle Test não depender de `#playOverlay`.

## Fora do escopo / limitações

- Pré-visualização de animação Effekseer (o runtime Effekseer não é carregado no editor).
- Edição dos comandos de evento (pertence ao módulo events).
- Seleção múltipla com Shift no Copy da lista; menu de contexto (substituído por botões).
- Quick Settings A–E e Generate Curve usam curvas aproximadas (os valores exatos do MZ não
  estão no manual nem no runtime).
- Ao trocar imagens de tileset, os bits de passagem de veículos não são recalculados.
- "Plugin Help..." no campo Note.

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<cópia do testproject>" --port 8781
```

Abra `http://127.0.0.1:8781/?modules=./database/index.js`, toque no botão Banco de dados.
Use uma CÓPIA do testproject: OK/Apply gravam em `data/` de verdade.
Testado em 1280×600: as 16 abas, diálogos (Traits, Effects, curvas, EXP, Action Pattern,
Drop Item, Conditions, posição inicial, áudio, ícone, rosto), gravação de Actors/Items/
Tilesets/System conferida no disco, Battle Test chegando em `Scene_Battle`.
