# Módulo tools

Resource Manager, Sound Test, Novo projeto, Opções e Ajuda/Sobre. Registro em
`index.js` (`register(api)`); CSS em `editor/css/tools.css` (injetado pelo módulo).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.js` | registro, botões `btnResources`/`btnSoundTest`/`btnNew`, botões extras na barra (`btnHelpContents`, `btnHelpAbout`, menu `☰` = `btnToolsMenu`), `api.tools` |
| `resources.js` | Resource Manager, importação/exportação, `pickResource`, "Importar recursos padrão" |
| `soundtest.js` | Sound Test (abas BGM/BGS/ME/SE) |
| `audio.js` | reprodução pelo `WebAudio` do runtime (rmmz_core.js da página); cai para `<audio>` sem runtime |
| `newproject.js` | diálogo Novo projeto + `createProject(writer)` e writers (`apiWriter`, `dirWriter`, `zipWriter`) |
| `options.js` | Opções persistidas em `localStorage["mzEditor.options"]` |
| `help.js` | Ajuda → Conteúdo (iframe com `editor/help/en/`) e Sobre |
| `ui.js` | helpers (`el`, `modal`, `confirmBox`, `alertBox`, `progressDialog`) |

## O que foi implementado

1. **Resource Manager** (fiel ao manual, 01_05 "Resource Manager"): lista de pastas na ordem
   do MZ (audio/bgm·bgs·me·se, effects, img/animations…titles2), lista de arquivos,
   pré-visualização (imagem com dimensões; áudio com Tocar/Parar; Effekseer só por nome),
   botões **Importar…** (`<input type="file" multiple>` → `api.project.writeBinary`, valida
   extensão, confirma sobrescrita), **Exportar…** (`window.Android.shareFile(relPath, mime)`
   se existir, senão `<a download>`), **Excluir** (`api.project.delete`, com confirmação),
   **DLC…** (escolhe uma pasta e importa só os arquivos da pasta atual), **Preview…**
   (janela grande, tamanho real) e **Importar recursos padrão…** (escolhe uma pasta, ex.
   `RPG/newdata`, e copia img/, audio/, effects/ sem sobrescrever o que já existe).
   Seleção múltipla: botão "☑ Seleção múltipla" (toque) ou Ctrl/Shift (mouse).
   Emite `resources:changed {folder}` depois de importar/excluir.
2. **Sound Test**: abas BGM/BGS/ME/SE, lista de `audio/<tipo>/`, Volume (0–100),
   Pitch (50–150), Pan (−100–100) com ajuste ao vivo, Play/Stop/Parar tudo. Usa
   `WebAudio` do runtime, então soa igual ao jogo (inclusive pan). Como no MZ, a música
   continua tocando depois de fechar a janela. ME interrompe a BGM; SEs se sobrepõem.
3. **Novo projeto** (`btnNew`): Nome, Título do jogo, Local.
   - Android com `window.Android.newProject(nome, titulo)` → delega à casca.
   - PC (Chrome/Edge): "Escolher…" usa `showDirectoryPicker`; cria `<local>/<nome>/` com o template.
   - Sem nenhum dos dois: gera `<nome>.zip` (zip "store" feito em JS) e explica como extrair/abrir.
   - Personaliza como o MZ: `System.json.gameTitle`, `versionId` aleatório, `<title>` do
     `index.html`, e cria `game.rmmzproject` ("RPGMZ 1.1.1").
   - Template em `editor/template/` (4,8 MB, 49 arquivos + `manifest.json`): cópia de
     `RPG/newdata/` com `data/*.json` (inclui Map001 e MapInfos), `index.html`,
     `css/game.css`, `js/*.js`, `js/libs/*`, `js/plugins.js` vazio, `js/plugins/*` (4 plugins
     oficiais), `img/system/*`, `fonts/*`, `icon/icon.png`. Para regenerar o manifest, ver abaixo.
4. **Opções** (menu ☰ → Opções): as do MZ — Cor transparente (fundo do `#viewport`),
   Grade do mapa (sincroniza com `btnGrid`), Tema (claro/escuro, por variáveis CSS em
   `html[data-theme]`), Seletor de objetos (dropdown/extended/smart, só guardado) — e as do
   port: tamanho dos ícones da barra, idioma (pt_BR/en/ja/zh, só guardado + `html[lang]`),
   confirmar ao sair (`beforeunload`), salvar automaticamente (1/5/10 min: clica `btnSave`
   quando ele tem `.mtModified`, marcação do maptools). Emite `options:changed`.
5. **Ajuda**: botão `help-contents` abre o manual oficial (`editor/help/en/`) num iframe com
   voltar/avançar/início e atalhos de tópico; `help-about` abre "Sobre" com versão e créditos.
6. **`api.tools`**: `importFiles(folder)` → nomes gravados; `pickResource(folder, {current, title, none})`
   → nome sem extensão, `""` (Nenhum) ou `null` (cancelado). Extras: `importFromFolder`,
   `listFolder`, `exportFile`, `folders`, `open*()`, `options.get/set`,
   `newProject.{createProject, apiWriter, dirWriter, zipWriter, loadManifest}`.

## Manual (editor/help/en)

Cópia de `RPG/help-en/` (50 MB originais). Para caber no APK, os 233 PNG de
`assets/img/` foram convertidos para **WebP** (ffmpeg, qualidade 78) e as referências
(`.html`, `.js`, `assets/css/style.min.css`) trocadas de `.png` para `.webp`: 15 MB no total.
O WebView do Android lê WebP nativamente.

## Ficou fora / pedidos à API ou à casca Android

- **Android**: o módulo chama, se existirem, `window.Android.shareFile(relPath, mimeType)`
  (exportar/compartilhar um arquivo do projeto) e `window.Android.newProject(name, title)`
  (escolher pasta via SAF, copiar `editor/template/` dos assets do APK, ajustar
  `System.json.gameTitle`/`index.html`/`game.rmmzproject` e abrir). Nenhuma das duas existe
  ainda em `MainActivity.Bridge`. Sem `newProject`, o Android recebe o `.zip`.
- `<input webkitdirectory>` (DLC / Importar recursos padrão) não é suportado pelo seletor de
  arquivos do WebView. Sugestão: `window.Android.pickFolderFiles()` ou uma rota
  `/api/import-from?uri=` na casca. No PC (Chrome) funciona.
- Um projeto novo **sem** o pacote opcional não roda ainda (título, tilesets e personagens
  do template apontam para img/titles1, img/tilesets, img/characters…): é preciso importar
  os recursos padrão. O diálogo avisa.
- No PC o devserver serve um projeto só; depois de criar, reinicie-o com `--project`.
- Idioma: só guarda a escolha; nenhum rótulo é traduzido ainda (`api.tools.options.get("lang")`).
- Seletor de objetos (dropdown/extended/smart): guardado, mas nenhum módulo o lê ainda.
- Manual só em inglês (help-ja / help-zh-cn não copiados).
- Tutorials (Ferramentas → Tutoriais) não implementado.
- Sugestão de promoção à API: `api.project.list` com tamanho/data dos arquivos; listas de
  `pickers.js` (database) têm cache — depois de importar por `api.tools`, ouça `resources:changed`.

## Como testar

```bash
node mz-android-editor/devserver/server.mjs --project "<CÓPIA do testproject>" --port 8786
```

Abra `http://127.0.0.1:8786/?modules=./tools/index.js` (ou todos os módulos:
`?modules=./maptools/index.js,./events/index.js,./database/index.js,./plugins/index.js,./generator/index.js,./tools/index.js`).

Testado (1280×600, Chrome): importar (com arquivo inválido ignorado), excluir, exportar
(download), pré-visualização de imagem/áudio, Sound Test tocando via WebAudio,
importar recursos padrão de uma pasta simulada (pula existentes e não-recursos),
`pickResource`, Opções (tema escuro, ícones grandes, persistência), Ajuda e Sobre,
`createProject` via `apiWriter` (arquivos idênticos a `RPG/newdata`, título aplicado) e
`.zip` validado com `unzip -t`. Não testado: `showDirectoryPicker` (precisa de gesto real) e Android.

Regenerar `editor/template/manifest.json` (dentro de `editor/template/`):

```bash
node -e 'const fs=require("fs"),p=require("path"),o=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else{const r=f.split(p.sep).join("/");if(r!=="manifest.json")o.push({path:r,size:fs.statSync(f).size})}}})(".");o.sort((a,b)=>a.path.localeCompare(b.path));fs.writeFileSync("manifest.json",JSON.stringify({source:"RPG Maker MZ 1.1.1 newdata",total:o.reduce((s,f)=>s+f.size,0),files:o}))'
```
