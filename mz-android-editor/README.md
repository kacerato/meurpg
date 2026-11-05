# MZ Editor (port Android) — fase 1

Editor de projetos RPG Maker MZ que roda em um WebView Android e lê/grava o
mesmo formato de projeto do editor de PC (`data/*.json`, `js/plugins.js`, etc.).

O desenho de mapas usa o `Tilemap` do corescript do próprio projeto
(`js/rmmz_core.js`), então autotiles, camadas e animações saem iguais ao jogo.

## Pastas

- `editor/` — o editor web (HTML/CSS/JS puro, sem build). Usado tanto no PC
  quanto dentro do APK.
- `devserver/server.mjs` — servidor Node para desenvolver no PC. Define o
  contrato HTTP que a casca Android reproduz.
- `android/` — projeto Gradle (Java, sem dependências externas): `MainActivity`
  (WebView), `LocalServer` (HTTP em 127.0.0.1) e `SafProject` (acesso à pasta
  do projeto via Storage Access Framework).
- `testproject/` — projeto MZ de teste (template `newdata` + mapas de exemplo).

## Contrato HTTP (igual no PC e no Android)

| Rota | Função |
|---|---|
| `GET /` | estáticos do editor |
| `GET /project/<caminho>` | arquivos do projeto (serve também o jogo para teste) |
| `GET /api/project` | `{ name, root, platform }` ou 404 se nada aberto |
| `GET /api/file?path=` / `PUT` | ler / gravar arquivo do projeto |
| `GET /api/list?dir=` | listar pasta |

## Rodar no PC

```bash
node devserver/server.mjs --project testproject --port 8765
```

Abra `http://127.0.0.1:8765/`.

## Compilar o APK

Requer Android SDK e JDK 17+.

```bash
cd android && gradle assembleDebug
```

APK em `android/app/build/outputs/apk/debug/app-debug.apk`. No aparelho, toque
em "Abrir projeto" e escolha a pasta do projeto MZ.

## Fase 1 (feito)

- abrir projeto, árvore de mapas, visualizador de mapa com zoom/rolagem/pinça,
  grade, moldura de eventos, parallax de fundo;
- teste de jogo em iframe/WebView com o runtime do projeto.

## Próximas fases

2. banco de dados e editor de eventos; 3. pintura de mapas com autotile,
plugins, gerador de personagens; 4. exportação de APK no aparelho.

## Implantação: plataformas

Windows e macOS ficam fora por decisão de plataforma: exigem o runtime NW.js do editor de PC.
O diálogo de Implantação mostra as duas opções desabilitadas, com essa explicação. Web (pasta ou .zip) e APK Android funcionam.
