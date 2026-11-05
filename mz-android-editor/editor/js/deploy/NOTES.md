# Módulo deploy — Implantação (Deployment)

Equivale a Arquivo > Implantação do RPG Maker MZ (manual: `help-en/01_11_03.html`, "Output Formats").
Botão próprio na barra (`#btnDeploy`, ícone `deploy.svg`), inserido logo após "Testar jogo".

**Para ligar:** adicionar `"./deploy/index.js"` em `editor/js/modules.js` (não editado aqui).
No PC: `?modules=./deploy/index.js`.

## O que faz

Diálogo com Plataforma, Local de saída, Opções (Excluir arquivos não utilizados),
Criptografia (imagens / áudio + chave), barra de progresso, log e botão Cancelar.

| Plataforma | PC (devserver) | Aparelho (app Android) |
|---|---|---|
| Web — pasta | grava `deploy/<nome>/` no projeto; botão "Abrir no teste de jogo" | igual (via SAF) |
| Web — .zip | zip montado em JS (`zip.js`, STORED/DEFLATE via `CompressionStream`), download do navegador; entradas em `www/` | Java (`Deployer`) monta o zip e salva em `Download/MZEditor/<nome>.zip` |
| Android APK | indisponível (mensagem clara) | Java monta, assina e salva em `Download/MZEditor/<nome>.apk`; botão "Instalar" |

Pacote = projeto inteiro exceto `save/`, `*.rmmzproject`, pastas ocultas, `node_modules/` e a pasta de saída (`deploy/`).

### Criptografia (`crypto.js`, `Deployer.encrypt`)
- Chave = `md5(senha)` em hex (MD5 próprio em JS, conferido com vetores da RFC 1321),
  gravada como `encryptionKey` + `hasEncryptedImages`/`hasEncryptedAudio` no `System.json` **do pacote** (o do projeto não muda).
- Arquivo = cabeçalho `RPGMV\0\0\0\0\x03\x01\0\0\0\0\0` (16 bytes) + 16 primeiros bytes XOR chave + resto intacto;
  extensão ganha `_` (`.png_`, `.ogg_`, `.m4a_`). É exatamente o que `Utils.decryptArrayBuffer` desfaz.
- Criptografa `img/**.png` e `audio/**.ogg|m4a` (texturas de `effects/` não, o Effekseer as lê direto — como o MZ).
- A senha não é salva; as demais opções ficam em `localStorage` por projeto.

### Excluir arquivos não utilizados (`scan.js`)
Só exclui de `img/`, `audio/`, `effects/` (como o manual). Mantém um arquivo se o nome dele (sem extensão,
com ou sem pastas) aparece em: qualquer string de `data/*.json` (inclui JSON aninhado, `<tag:valor>` de notas,
literais entre aspas em scripts), parâmetros de plugins **ativos**, `@requiredAssets` e literais do código dos
plugins ativos, literais do runtime `js/rmmz_*.js` (nomes fixos como fundos de batalha automáticos).
`img/system/` sempre fica. Para cada `.efkefc` usado, lê as texturas/modelos citados (UTF-16) e mantém só esses.
Erra para o lado de manter. No testproject: 790 arquivos excluídos, 535 no pacote.

## Android (`android/`)

- `player/` — novo módulo Gradle: `PlayerActivity` (WebView tela cheia, paisagem, imersiva, tela sempre ligada).
  Serve `assets/www/**` interceptando `https://appassets.androidplatform.net/` (origem HTTPS **fixa** →
  saves do localforage/IndexedDB persistem; XHR funciona, ao contrário de `file://`; suporta `Range`).
  Voltar = Esc do jogo (menu/cancelar); na tela de título, sai. Lê `assets/www/app.json` (título).
  Desvio consciente da sugestão "servidor HTTP local": porta aleatória mudaria a origem e perderia os saves.
- `app/build.gradle`: tarefa `copyPlayerTemplate` (depende de `:player:assembleRelease`) copia o APK release
  **não assinado** para `build/playerAssets/player-template.apk` (asset gerado, não versionado); `preBuild` depende dela.
  Dependência `com.android.tools.build:apksig:8.7.3` (já estava no cache do Gradle; funciona offline).
- Personalização sem recompilar (`ApkBuilder`): o template tem marcadores longos de 100 caracteres
  (`applicationId` = `br.mzgame.zzz…`, `app_name` = `MZGAMELABEL___…`, definidos em `player/build.gradle`).
  São trocados **no lugar** nos pools de strings binários (manifest UTF-16, `resources.arsc` UTF-8 + nome do
  pacote no chunk `ResTable_package`) por texto ≤ 100 bytes, reescrevendo o prefixo de tamanho e zerando o resto.
  Assim cada jogo tem **pacote e nome próprios** (vários jogos instalados lado a lado). O ícone `res/*.png`
  do template é substituído por `icon/icon.png` do projeto. Verificado com `aapt2 dump badging`.
- `Signer`: RSA 2048 gerada no aparelho na 1ª exportação, certificado X.509 autoassinado montado em DER
  (o Android não tem API pública), guardado em `filesDir/deploy-keystore.p12` (alias `mzgame`, senha `mzeditor`).
  apksig assina v1+v2 pedidos; como minSdk do player é 26, o apksig omite a v1 sozinho (v2 basta).
  A chave é reutilizada → novas versões instalam por cima. **Desinstalar o MZ Editor apaga a chave** (o jogo
  já instalado continua, mas uma nova versão terá de ser instalada após desinstalar a antiga).
- `Deployer` (rotas novas): `POST /api/deploy/start` `{kind:"apk"|"zip", outputName, appName, packageName,
  keyHex, icon, files:[{src,dst,enc}], inline:[{dst,text}]}` → `{id}`; `GET /api/deploy/status?id=`
  → `{state, done, total, message, log[], result{name,size,location,file,uri}}`; `POST /api/deploy/cancel?id=`.
  Lê arquivos via `SafProject`, escreve com `ZipOut` (zip próprio, STORED alinhado a 4 bytes), salva em
  `Download/MZEditor/` via `MediaStore` e mantém o APK em `filesDir/deploy/`.
- `ApkProvider` (equivalente ao FileProvider sem AndroidX) + `REQUEST_INSTALL_PACKAGES`;
  ponte `Android.installApk(file)` (abre a tela "instalar apps desconhecidos" se faltar permissão) e
  `Android.deployVersion()`.
- Adições em `LocalServer` (`getProject`, `setDeployer`, rotas `/api/deploy/*` no `default`) e `MainActivity`
  (cria o `Deployer`, métodos da ponte). Nada existente mudou de comportamento.

## Como testar

PC: `node devserver/server.mjs --project <testproject> --port 8793`, abrir
`http://127.0.0.1:8793/?modules=./deploy/index.js`, Implantação > Web > Pasta, marcar criptografia, chave,
OK → "Abrir no teste de jogo". Testado: chega à tela de título, `Ruins.png_` descriptografa (pixels reais),
`Theme4.ogg_` decodifica (88 s), `Utils.hasEncryptedImages/Audio() === true`. Zip JS validado com `zipfile.testzip()`.

Aparelho: `gradle assembleDebug`, instalar, Implantação > Android APK > OK. Testado no Xiaomi (Android 16):
1314 arquivos, APK de 97 MB em ~40 s, `apksigner verify` OK (v2), `aapt2 dump badging` →
`package br.mz.game.testproject`, label `testproject`, minSdk 26 / target 35.

## Fora / pendente

- APK com criptografia não foi exercitado no aparelho (mesmo formato do caminho web, que foi testado).
- Abrir o jogo instalado no aparelho depende de confirmar a instalação (MIUI pede toque em "Instalar via USB").
- Versão do app (versionCode/Name) fixa em 1 / "1.0"; plataformas Windows/macOS do MZ não se aplicam.
- Sem ZIP64 (pacotes > 4 GB ou > 65535 arquivos dão erro claro).
- Pedido de promoção à API: `api.deploy` já expõe `open()`, `md5`, `encryptAsset`, `decryptAsset`.

## Atualização (mz-shell, 2026-11-05)
- Salva o projeto (`api.saveAll`) antes de montar o pacote, como o MZ.
- .zip (JS e `Deployer.java`) com `index.html` na raiz, sem `www/` (estrutura do MZ).
- Formato "pasta" pode sair fora do projeto: botão "Escolher…" → SAF (`Android.pickDeployFolder`,
  job `kind:"folder"` com `outTree`, `Deployer.writeFolder`) ou `showDirectoryPicker` no PC (`runFolderHandle`).
- Senha de criptografia lembrada por projeto (`localStorage["mzDeploy:<projeto>"].password`).
- Windows/macOS aparecem desabilitados (precisam do runtime NW.js do editor de PC).
- `scan.js`: `@type file` + `@require 1` mantém `<@dir>/<valor>`; `@noteParam`/`@noteDir`(/`@noteType file`/`@noteData`)
  mantém `<@noteDir>/<valor>` das notas indicadas (`pluginAssetSpecs`).

## Tela cheia e Novo projeto em lote (mz-shell, 2026-11-05)
- **Tela cheia (extensão do port):** `editor/fitscreen.js` (ver comentário no arquivo). Teste de jogo: devserver e
  `LocalServer` injetam `<script src="/fitscreen.js">` antes do `main.js` de qualquer `index.html` do projeto; o
  script só age com `localStorage["mzEditor.fitScreen"]==="1"` (botão "Tela cheia" na barra do teste; padrão ligado
  no Android). APK: opção "Tela cheia (ajustar resolução à tela)" (padrão ligada) → `mz_fitscreen.js` vai no pacote,
  `app.json` ganha `"fit": true` e o `PlayerActivity` injeta o script. Também anula a reserva de 10% de altura que o
  runtime faz em celular (`Graphics._stretchHeight`). Verificado no Xiaomi/RedMagic (2772×1280): título e mapa
  ocupam a tela toda, inclusive o recorte da câmera; resolução 1474×624 no teste (janela 1200×508), sem distorção.
  Mapas mais estreitos que a tela (ex.: 17×13) ficam centralizados com preto em volta, como o runtime faz.
- **Saída em Download/MZEditor** substitui o arquivo anterior de mesmo nome (antes o MediaStore criava "nome (1)"
  e o log mostrava o nome errado); o log agora mostra o nome real.
- **Novo projeto em lote (`TemplateCopier.java`):** `POST /api/template/copy {title, dir?}` +
  `GET /api/template/status`. Medido no aparelho com o template atual (50 arquivos, `editor/template`):
  **1,6 s** em Java (6 threads, pastas criadas antes com Uri em cache) contra **8,4 s** arquivo a arquivo
  (`newproject.js` com PUT por arquivo) — ~5× mais rápido. Para o template completo (~1311 arquivos), a
  estimativa proporcional é ~42 s contra ~3,7 min.
