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
| `equip.js` | Regras de equipamento e parâmetros do runtime (`equipSlots`, `canEquip`, `resolveEquips`, `actorParams`), usadas no Equipamento inicial e no Teste de batalha |
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
  `/project/index.html?btest` no `#playOverlay` existente. Editar o diálogo do teste não marca
  nenhum arquivo como alterado; `System.testBattlers/testTroopId` ficam na memória.
- Change Target da prévia de animação grava `System.battlerName/battlerHue` e marca System.

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
- Clipboards (lista de dados, linhas de tabela, páginas de Tropas) persistem no `localStorage`
  (`mzEditor.dbClipboard`), mas não usam a área de transferência do sistema.

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<cópia do testproject>" --port 8781
```

Abra `http://127.0.0.1:8781/?modules=./database/index.js`, toque no botão Banco de dados.
Use uma CÓPIA do testproject: OK/Apply gravam em `data/` de verdade.
Testado em 1280×600: as 16 abas, diálogos (Traits, Effects, curvas, EXP, Action Pattern,
Drop Item, Conditions, posição inicial, áudio, ícone, rosto), gravação de Actors/Items/
Tilesets/System conferida no disco, Battle Test chegando em `Scene_Battle`.

## Rodada 3 (FIDELITY.md: prioridades do banco)

- **Teste de batalha** (`tabs_battle.js` `battleTest`, `equip.js`): abas 1–4, Ator, Nível,
  Status Inicial (nível e equipamento iniciais do ator), Equipamento e área [Status].
  `equip.js` reproduz o runtime: `equipSlots` (Dual Wield = trait 55 com maior dataId 1 troca o
  2º espaço por arma), `canEquip` (traits 51/52 de tipo e 54 de selo), `resolveEquips` (o laço de
  `releaseUnequippableItems`, que descarta o que não serve) e `actorParams` (= `Game_Actor.param`
  sem estados/buffs: `max(0, base da classe + params dos equipamentos) × traits 21`, arredondado,
  mínimo 1 no HP). Conferido no `?btest`: valores iguais aos de `$gameParty.members()[i].param()`,
  inclusive com Dual Wield + Falchion no 2º espaço. O Equipamento inicial dos Atores usa o mesmo
  filtro (`equipSlotsBox`).
- **Tilesets** (`tabs_misc.js` `tilePalette`): clicar/tocar muda o valor; arrastar com o botão ou
  o dedo aplica o mesmo valor por onde passa; botão direito ou toque longo (500 ms parado) inverte
  o ciclo (passagem ○→☆→×, terreno 7→0). A lista rola com dois dedos ou pela faixa de 40 px à
  direita do canvas (`touch-action: none` no canvas). Passagem (4 dir.) só altera a célula tocada.
- **Tropas**: Lista de Inimigos à direita (toque duplo adiciona), Adicionar coloca o inimigo à
  direita do último sem realinhar, Limpar pede confirmação.
- **Fórmula de dano** (`tabs_items.js` `formulaField`): dica oficial (Group_Damage), botão "?" com
  as referências do manual que inserem `a.atk`, `b.def`, `v[1]`... e aviso de erro de sintaxe
  (compilada como no `eval` do runtime, com `item, a, b, v, sign`).
- **Sistema**: amostra da Cor da janela desenhada com o `Window.png` do projeto (fundo esticado,
  tom somado, opacidade 192, moldura 9-fatias); seletor de fontes (`pickFont`, lista de `fonts/`
  com prévia, grava o nome com extensão); posição inicial com marcador arrastável e Excluir/Del
  para veículos. As Imagens de veículos aparecem normalmente (o vazio da auditoria não se
  reproduziu).
- **Classes**: a tabela da Curva de EXP tem o gráfico de barras no fundo.
- **Limites**: Custo de MP 0–999; EXP de inimigo a partir de 1; Duração em turnos desativada com
  Timing = Nenhum.

Testado (devserver com cópia do testproject, 1200×554): Tropas (toque duplo, Adicionar, Teste de
batalha até `Scene_Battle`), Tilesets (arrasto, toque longo e dois dedos por PointerEvents de toque,
`Tilesets.json` conferido no disco), fórmula, EXP, Sistema 1/2, Alterar Alvo (System.json no disco).

## Rodada 4: Seletor de objetos (Opções) e animações do MV

- **Seletor de objetos** (Opções → Seletor de objetos, `localStorage["mzEditor.options"].objectSelector`):
  `common.js` marca as listas de objetos do jogo (`idOptions`, `switchOptions`, `asObjects`, com o tipo
  registrado por `registerKinds(db)` ao abrir o banco) e `ui.js sel()` escolhe o controle:
  Dropdown = `<select>`; Extended = campo com "…" que abre a janela **Seleção de Objeto**
  (`pickObject`, Dialog_GameObjectSelector: título do tipo — Personagens, Classes, Habilidades... —, Lista de
  Grupo com faixas de 20 IDs e Lista de Dados; valores especiais como Nenhum/Ataque normal num grupo próprio
  no topo; toque duplo confirma); Smart = Dropdown abaixo de 100 objetos (`api.tools.objectSelectorMode`).
  Interruptores (Tropas → Condições, Eventos comuns) abrem sempre o Seletor de Switch (campos "…" do MZ).
  Tipos (elementos, tipos de arma...) continuam listas suspensas, como no MZ. Vale para todos os formulários,
  Traits/Effects, equipamento inicial (lista filtrada mantém o tipo) e Ação/Drop de inimigos.
  Aproximação: faixas de 20 por grupo (as do Seletor de Variável do MZ); o tamanho exato da faixa do
  Dialog_GameObjectSelector não foi lido do bytecode.
- **Animações do MV** (`frames`): a aba Animações mostra só o nome e um aviso (o runtime as reproduz com
  `Sprite_AnimationMV`; o MZ não as edita). Antes o formulário MZ era montado sobre elas.
- Testado (1200×554): Extended em Classe/Equipamento/Animação de habilidade (grupo "Ataque Normal / Nenhum" +
  7 faixas), escolha por toque duplo grava e marca "Banco de Dados *"; Smart: Habilidades (235) → Extended,
  Classes (8) → Dropdown; Dropdown → `<select>`.
