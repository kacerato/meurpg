# Módulo generator — Gerador de Personagem

Botão `btnGenerator`. Registro em `index.js` (`register(api)`), CSS em `editor/css/generator.css`
(injetado pelo módulo). Assets do gerador copiados de `RPG/generator/` para `editor/generator/`
(Face, TV, TVD, SV, Variation, `grad_*.png`; o `generator.7z` não foi copiado) e um
`editor/generator/manifest.json` com a lista dos arquivos (o navegador não lista pastas; o MZ usa
`CoreAPI.searchFiles`). Se os assets mudarem: `node editor/js/generator/tools/build-manifest.mjs`.

## Arquivos

| arquivo | conteúdo |
|---|---|
| `index.js` | diálogo principal, estado por aba, Aleatório, Salvar/Carregar Configurações |
| `data.js` | tabelas do MZ (ordem de camadas, máscaras, paletas, probabilidades, textos pt_BR oficiais) |
| `composer.js` | montagem das imagens e colorização (equivalente ao `ImageComposer` C++ do MZ) |
| `exporter.js` | janela de exportação (Importar…/Exportar…, célula de destino, sobrescrita) |
| `png.js` | decodificador/codificador PNG próprio (valores exatos, sem gestão de cor nem pré-multiplicação) |
| `ui.js` | diálogos pequenos (nome de arquivo, lista de arquivos, mensagem, confirmação) |

## Como os dados foram obtidos (fidelidade)

Os QML do gerador estão compilados dentro do `RPG.exe` (Qt 5.12.9, unidades `qv4cdata`; os arquivos
em `rea-extract/qrc/qml/CharacterGenerator/` estão vazios). Decodifiquei a tabela de strings e o
bytecode V4 (Moth) das unidades `CharacterGeneratorData.qml`, `Layout_CharacterGenerator.qml`,
`Group_CharacterColors.qml` e `Dialog_CharacterExporter.qml`. Daí vieram, sem chute:

- `layergroupList`, `layerOrders` (face/tv/tvd/sv), `maskIDList` (24 cores-chave; `_m001`…`_m024`
  são índices nessa lista), `colorTextTable`, `layergroupToMaskIDs`, `layergroupToPaletteType`,
  `maskIDToPaletteType`, `isEssential`, `isDefaultSet`, `blankProbability` (0,8 / 0,9 / 0,95);
- `makeDefaultData`: partes `isDefaultSet` (rosto, orelhas, olhos, sobrancelhas, nariz, boca, franja,
  cabelo, vestimenta) com a 1ª variação, demais vazias; todas as cores = 0; deslocamentos 0;
- `refreshComposer`: arquivos `_c1.._cN` de cada parte desenhados em ordem reversa; na paleta comum
  (tipo 3) cor 0 = **cores originais** (não colore); pele/cabelo/olhos sempre colorem; olhos dentro de
  outras partes (corpo) usam `grad_eyes`; camadas de sobrancelha com máscara de pele usam a cor da pele;
  deslocamento (Ajustar) só no rosto;
- `randomize`: vazio com `blankProbability`; orelhas 90% na variação 1; pele 70% limitada às 12
  primeiras cores; paleta comum 50% sem colorir;
- Ajustar: limites −8..+8 (botões habilitados enquanto `offset > -8` / `< 8`); texto `X+0,Y+0`;
- Salvar Configurações: JSON `{identity:"CharacterGeneratorSettings", version:"2.0.0", gender,
  patterns, colors, offsets}` (mesmo formato do MZ, intercambiável).
- textos: tradução pt_BR oficial do MZ (`mz-strings-pt_BR.txt` das notas compartilhadas).

A colorização em si é C++ (`ImageComposer.drawImage/drawImageWithMask`); a regra foi descoberta
empiricamente e confere **exatamente** com o screenshot do manual (`help-en/assets/img/01_05_img05.png`,
pele 246,212,190 → 255,221,194 e cabelo idem):

    índice = 255 − qGray(r,g,b)      qGray = (r*11 + g*16 + b*5) >> 5   (fórmula do Qt)
    cor    = gradiente[linha escolhida][índice]   (alfa original preservado)

Gradientes: faixas de 4 px (`grad_skin` 24, `grad_hair` 24, `grad_eyes` 12, `grad_common` 18 — a
linha 0 da comum é branca e aparece como xadrez = "original"). Cada quadrado da paleta mostra o trecho
16..143 do gradiente em 26 px, como no MZ.

## Validação contra os atores padrão

- Composição padrão (Homem, tudo p01) = o personagem do screenshot do manual (cabelo loiro, pele e
  olhos com os mesmos valores RGB). O screenshot está reescalado, então só as cores foram comparadas.
- `img/characters/Actor1.png`, personagem 1 (Reid), ajuste automático de partes/cores: **64,3% dos
  pixels visíveis fora do cabelo idênticos byte a byte** (corpo, pele, olhos, roupa); cabelo 0,1%.
  O cabelo do Actor1 segue um gradiente limpo (cada índice → uma cor: 18→199,132,98; 75→130,77,49;
  145→81,43,25…), mas esse gradiente **não existe** em `grad_hair.png` do MZ 1.1.1 (a linha mais
  próxima difere ~25 por canal) — os atores do RTP foram colorizados com uma paleta que não vem no
  gerador. As demais diferenças são da capa/acessório, desenhados à mão no RTP.
- `img/faces/Actor1.png` rosto 1: não reproduzível — os rostos do RTP são ilustrações próprias,
  não montagens do gerador (penteado e traço diferentes).
- Exportação: `GenTest.png` gravado sobre a base `Actor1.png` → as 7 células não tocadas ficaram
  idênticas byte a byte; a célula escolhida recebeu o rosto gerado (PNG RGBA sem perdas).

## Interface (toque, paisagem 1280×600)

Abas Homem/Mulher/Criança (cada aba guarda seu próprio personagem, como no MZ), Lista de Peças,
Variação (ícones de `Variation/`, primeiro quadro vazio = sem a parte, exceto partes essenciais),
Cor (lista de cores da parte — as que a variação atual não usa em nenhuma imagem, rosto, andando,
caído ou SV, aparecem em cinza — e paleta), Ajustar (△◁▷▽; desabilitado para partes sem imagem no
rosto, como cauda e asa, ou sem variação escolhida, porque o deslocamento só vale no rosto),
Pré-visualização igual à do MZ (rosto + andando + caído à esquerda, battler SV à direita) e, extra,
modo **Animação** (andando com direção, battler SV com os 18 movimentos do `Sprite_Actor.MOTIONS`:
os em loop fazem 0-1-2-1; os únicos — dano, esquiva, estocada, golpe, projétil, habilidade, magia,
item — tocam 0-1-2 uma vez e param no último quadro; toque no battler toca de novo; caído). Botões: Aleatório, **Redefinir** (extra: o MZ não tem; volta ao
padrão), Imagem do rosto…, Personagem Andando…, Personagem Caído…, Personagem Lutando…,
Salvar Configurações…, Carregar Configurações…  Alvos ≥ 36 px (quadros da paleta: 26×30, como no MZ).

Exportação (mesmo esquema do `Dialog_CharacterExporter`): folha de destino com cursor; toque numa
célula para escolher onde entra a imagem; Importar… carrega um PNG da pasta do projeto como base;
Exportar… pede o nome e avisa se o arquivo existe ("Sobrescrever?").

**Outro local** (como os diálogos de arquivo do MZ, que aceitam qualquer pasta): Importar… e
Carregar Configurações… têm o botão "Outro local…" (`<input type=file>`: arquivo do PC ou, no
Android, do seletor de arquivos do WebView); Exportar… e Salvar Configurações… têm "Outro local…",
que grava fora do projeto (`saveOutside` em `ui.js`): no PC (Chrome/Edge) `showSaveFilePicker`;
no Android grava no caminho do projeto e abre o compartilhamento (`Android.shareFile`) para
mandar a Arquivos/Drive/outro app; sem nenhum dos dois, download do navegador.

| botão | pasta | folha | célula |
|---|---|---|---|
| Imagem do rosto | `img/faces` | 576×288 (4×2) | 144×144 |
| Personagem Andando | `img/characters` | 576×384 (4×2) ou **Único ($)** 144×192 | 144×192 |
| Personagem Caído | `img/characters` | 576×384 (4×8, como `Damage1.png`) | 144×48 |
| Personagem Lutando | `img/sv_actors` | 576×384 | 576×384 |

Gravação: `PUT /api/file?path=img/...png` com corpo binário. Configurações: JSON na raiz do projeto
(o MZ propõe a pasta do projeto por padrão); a lista de "Carregar" mostra os `.json` da raiz.

## Fora do escopo / pendências

- Os tamanhos das janelas de exportação vêm de vínculos numéricos do QML que não decodifiquei; usei
  os tamanhos do RTP (conferidos com `Actor1.png`, `Damage1.png`, `sv_actors/*.png`).
- Android: "Outro local…" para abrir arquivo depende do file chooser do WebView
  (`onShowFileChooser`, da casca); para gravar, usa `Android.shareFile` (o arquivo também fica
  no projeto, porque a ponte só compartilha arquivos do projeto).
- Não há botão "Redefinir" no MZ; mantido como extra.
- Gostaria na API: `api.project.writeBinary(path, blob)` e um evento `resource:changed` oficial
  (o módulo já emite `api.emit("resource:changed", {path})` após exportar).

## Testar

    node mz-android-editor/devserver/server.mjs --project "<caminho>/testproject" --port 8785
    http://127.0.0.1:8785/?modules=./generator/index.js

Abra o gerador pelo ícone da barra, monte um personagem, troque cores, use Imagem do rosto… /
Personagem Andando… → Exportar…, e confira o PNG em `img/faces` / `img/characters` do projeto.
