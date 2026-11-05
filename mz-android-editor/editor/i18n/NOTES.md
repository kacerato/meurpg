# i18n do MZ Editor

Todo texto visível do editor passa por `t()` (`editor/js/i18n.js`) e usa a **tradução oficial do RPG Maker MZ 1.1.1**,
extraída dos `.qm` do editor original. Padrão: **pt_BR**. Inglês = texto-fonte. Os outros idiomas do `.qm`
(ja_JP, zh_CN, zh_TW, ko_KR, de_DE, es_ES, fr_FR, it_IT, ru_RU) funcionam automaticamente.

## Arquivos
- `<locale>.json` — gerados por `node tools/qm2json.mjs [pastaQm] [saida]` (padrão:
  `rea-extract/qrc/translations/` do checkout principal → esta pasta). Formato `{ contexto: { fonte_en: tradução } }`,
  3599 textos em 255 contextos (contextos = classes Qt do editor: MainMenu, DatabaseMain, Edit_Actors, EventCommand111…).
  Não edite à mão: regenere.
- `extra.<locale>.json` — textos exclusivos do port (Android, avisos, mensagens de status), contexto `MZEditor`,
  fonte em inglês. Só existe `extra.pt_BR.json` (247 entradas); nos outros idiomas esses textos aparecem em inglês.
  Tem prioridade sobre o dicionário oficial, então nunca coloque aqui uma fonte que já existe no oficial.

## API (`editor/js/i18n.js`)
```js
import { t, fmt } from "../i18n.js";
t("Database")                               // procura em todos os contextos (MZEditor primeiro)
t("Edit", "StandardPopupMenu")              // contexto primeiro, depois todos
t("Delete %1?", "MapEditTreeBox", nome)     // args após o contexto → %1, %2…
fmt(textoTraduzido, a, b)                   // só substitui %n
```
- Top-level await: o dicionário já está carregado quando qualquer módulo que importa i18n.js roda.
- Aceleradores Qt (`&File`, `ファイル(&F)`) são removidos.
- `index.html`: atributos `data-i18n`, `data-i18n-title`, `data-i18n-ctx`, aplicados por `translateDom()` no boot.
- Idioma: `localStorage["mzEditor.options"].lang` (Opções → Idioma, lista `LANGUAGES`). Mudar emite
  `options:changed` → `bindOptions` recarrega a página. `?lang=ja_JP` na URL força um idioma (teste).
  Valores antigos `ja`/`zh` viram `ja_JP`/`zh_CN`.

## Ferramentas
- `node tools/i18n-find.mjs "<regex>" [locale]` — acha contexto/fonte/tradução (casa fonte ou tradução).
- `node tools/i18n-check.mjs editor/js editor/index.html` — toda chamada `t("literal")` tem tradução e o contexto
  informado contém a fonte. Estado no commit: 2555 chamadas, 0 sem tradução, 0 contexto errado.
  (`t(variavel)` não é verificado.)

## Regras para código novo
1. Fonte = string EXATA do `.qm`; prefira o texto do editor original ao inventado.
2. Fonte genérica com traduções diferentes por contexto → passe o contexto do diálogo original.
3. Sem equivalente oficial → fonte em inglês + entrada em `extra.pt_BR.json` (contexto MZEditor).
4. Não traduzir dados do projeto (nomes, termos de System.json), conteúdo de plugins, nomes de arquivo, console.*.
5. Não nomeie variáveis locais `t` (esconde a função).

## Verificado (navegador, testproject)
Barra, árvore, paleta, Banco de Dados (varredura automática das 16 abas: só sobram nomes vindos dos dados do
projeto), Atributos, editor de evento, Exibir Mensagem, seletor de comandos, Gerenciador de Plugin, Gerador,
Gerenciador de Recursos, Distribuição, Opções — tudo em pt_BR; troca para English nas Opções; japonês via `?lang=ja_JP`.

## Pendências / decisões em aberto
- Condições da página de evento: sufixos "is ON", "exists", "is present" não existem no MZ (estão no extra);
  talvez remover para fidelidade.
- Plugins: `plugins/parser.js` sempre usa o bloco de ajuda em inglês; o MZ escolhe `/*:ja` etc. pelo idioma.
- Deploy no Android: mensagens de progresso vindas do Java não são traduzidas.
- Eventos rápidos agora geram as frases oficiais (texto inserido no jogo depende do idioma do editor, como no MZ).
- Gerador: atribuição "Sub Color" vs "Sub Color 1/2…" das cores é aproximada.
- `extra.<locale>.json` só em pt_BR; outros idiomas mostram os textos do port em inglês.
