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
| `common.js` | constantes, opções, escopo, curva de EXP, curvas de parâmetro exatas do MZ, dados em branco por tipo |
| `animpreview.js` | pré-visualização Effekseer da aba Animations |
| `pluginhelp.js` | "Plugin Help..." do campo Note |

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

## Rodada 2 (fidelidade)

### Curvas de parâmetro: valores exatos do RPG.exe
Os QML do editor estão compilados (cache QV4 do Qt 5.12.9) dentro de `RPG/RPG.exe`. Achei as
unidades (`qv4cdata`), li as tabelas de strings, lookups e constantes e desmontei o bytecode
Moth (tabela de opcodes do `qv4instr_moth_p.h` do Qt 5.12). Resultado:

- `Constants.paramMinArray = [1,0,0,0,0,0,0,0]`, `paramMaxArray = [9999,9999,999×6]`,
  `paramGraphMaxArray = [9999,2000,250,250,250,250,500,500]` (escala do gráfico).
- `generateParameters(v1, v99, growth)`: para L = 1..99,
  `lin = v1 + (v99−v1)(L−1)/98`, `quad = v1 + (L−1)·((L−1)(v99−v1))/98/98`,
  `valor = Math.ceil((quad·(growth−10) + lin·(20−growth)) / 10)`; slider Growth Type 0..20
  (Fast / Normal = 10 / Slow). O índice 0 não é alterado. Conferido: as 6336 posições das 8
  classes do template saem idênticas com growth = 10.
- `quickSetParameters(rank)`, com `rank = 4 − índice do botão` (A = 4 … E = 0):
  `v1 = (200 + 100·rank + 100·random) · G/10000` (+5 se o parâmetro for ATK em diante),
  `v99 = (4000 + 1000·rank + 1000·random) · G/10000`, ambos `Math.round`, com
  `G = paramGraphMaxArray[param]`, e depois `generateParameters(v1, v99, 10)`. "Quick Setting"
  é aleatório dentro da faixa, como diz a dica do original ("randomly within a predefined range").

### Bits de veículo dos tilesets
Recalculados depois de cada alteração de flags e ao trocar imagens (`recomputeVehicleBits`):
A1 bloco A (mar) e D (água) navegáveis por barco e navio; B (mar profundo) só por navio;
C e E (cachoeira) por nenhum; tile transitável bloqueia barco/navio; aeronave não pousa em
A1, A3, A4, nem em A2 intransitável ou com Bush. Só vale para folhas com imagem. Conferido com
os 6 tilesets do template: 34048/34048 tiles idênticos.
Bush em autotile A2 "tipo floresta" (pixel (8,8) do canto inferior direito transparente, manual
Asset Standards) não vale para as 8 formas da borda inferior (38–41, 43–46). Isso bate com
World/Dungeon do template; nos tilesets Outside do template o pixel é transparente, mas as formas
mantêm o Bush (dados antigos; a regra só é aplicada quando o Bush é editado).

### Pré-visualização de animações (Effekseer)
`animpreview.js` carrega `/project/js/libs/effekseer.min.js` + `effekseer.wasm` sob demanda,
cria UM contexto WebGL reaproveitado e reproduz `Sprite_Animation`: matrizes de projeção e
câmera, viewport 4096 centrado no alvo (displayType 2 = centro da tela; `alignBottom`),
escala/velocidade/rotação/offset, Sound Timings tocando os SE e Flash Timings com a cor
mesclada no alvo e decaimento (d−1)/d, a 60 quadros fixos. Botões Play, Stop, Change Target...
e Change BG... (fundo compartilhado com Troops em `System.battleback1Name/2Name`).

### Plugin Help... no Note
Botão abaixo de cada campo Note: lista os plugins ATIVOS de `js/plugins.js` (via
`plugins/store.js`), lê o `@help` com `plugins/parser.js` (importados do módulo plugins) e
extrai as tags de nota `<...>` citadas na ajuda, com "Insert" para colocá-las no Note.

### Seleção múltipla na lista
Shift + clique seleciona um intervalo (como no MZ); no toque, o botão "Multi" alterna itens.
Copy copia todos os selecionados; Paste cola em sequência a partir do item atual; Clear limpa
todos os selecionados.

## Gostaria de ver na API

- `api.openDialog` com callback `onClose` e opção de não fechar por `closeTopDialog`
  (hoje o "voltar" do Android fecha o Database sem perguntar sobre alterações).
- `api.project.writeJson` com formatação igual à do MZ (uma entrada por linha), para diffs menores.
- Um `api.playtest(url)` para o Battle Test não depender de `#playOverlay`.

## Fora do escopo / limitações

- Edição dos comandos de evento: feita pelo módulo events via `api.events.editCommandList`.
- Menu de contexto (substituído por botões).

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<cópia do testproject>" --port 8781
```

Abra `http://127.0.0.1:8781/?modules=./database/index.js`, toque no botão Banco de dados.
Use uma CÓPIA do testproject: OK/Apply gravam em `data/` de verdade.
Testado em 1280×600: as 16 abas, diálogos (Traits, Effects, curvas, EXP, Action Pattern,
Drop Item, Conditions, posição inicial, áudio, ícone, rosto), gravação de Actors/Items/
Tilesets/System conferida no disco, Battle Test chegando em `Scene_Battle`.
