/*:
 * @target MZ
 * @plugindesc Teste de todos os tipos de parâmetro (MZ Editor Android).
 * @author MZ Editor
 * @url https://example.com/typetest
 * @base PluginCommonBase
 * @orderAfter PluginCommonBase
 *
 * @param Basic
 * @text Básicos
 *
 * @param str
 * @parent Basic
 * @text Texto
 * @desc Um texto de uma linha.
 * @type string
 * @default olá
 *
 * @param ml
 * @parent Basic
 * @text Multilinha
 * @type multiline_string
 * @default linha 1
 *
 * @param num
 * @parent Basic
 * @text Número
 * @desc Entre 1 e 99, 2 casas.
 * @type number
 * @min 1
 * @max 99
 * @decimals 2
 * @default 1.50
 *
 * @param bool
 * @parent Basic
 * @text Booleano
 * @type boolean
 * @on Mostrar
 * @off Esconder
 * @default true
 *
 * @param sel
 * @text Select
 * @type select
 * @option Esquerda
 * @value left
 * @option Direita
 * @value right
 * @default left
 *
 * @param cmb
 * @text Combo
 * @type combo
 * @option alpha
 * @option beta
 * @default alpha
 *
 * @param pic
 * @text Imagem
 * @type file
 * @dir img/pictures
 * @require 1
 * @default
 *
 * @param se
 * @text Som
 * @type file
 * @dir audio/se
 * @default Cursor1
 *
 * @param Db
 * @text Banco de dados
 *
 * @param actor
 * @parent Db
 * @type actor
 * @default 1
 * @param class
 * @parent Db
 * @type class
 * @default 0
 * @param skill
 * @parent Db
 * @type skill
 * @default 0
 * @param item
 * @parent Db
 * @type item
 * @default 0
 * @param weapon
 * @parent Db
 * @type weapon
 * @default 0
 * @param armor
 * @parent Db
 * @type armor
 * @default 0
 * @param enemy
 * @parent Db
 * @type enemy
 * @default 0
 * @param troop
 * @parent Db
 * @type troop
 * @default 0
 * @param state
 * @parent Db
 * @type state
 * @default 0
 * @param animation
 * @parent Db
 * @type animation
 * @default 0
 * @param tileset
 * @parent Db
 * @type tileset
 * @default 0
 * @param ce
 * @parent Db
 * @type common_event
 * @default 0
 * @param sw
 * @parent Db
 * @type switch
 * @default 0
 * @param var
 * @parent Db
 * @type variable
 * @default 0
 *
 * @param note
 * @text Nota
 * @type note
 * @default "a\nb"
 *
 * @param color
 * @text Cor
 * @type color
 * @default 2
 *
 * @param icon
 * @text Ícone
 * @type icon
 * @default 64
 *
 * @param pos
 * @text Posição (struct)
 * @type struct<Pos>
 * @default {"x":"10","y":"20","visible":"true"}
 *
 * @param nums
 * @text Números
 * @type number[]
 * @default ["1","2","3"]
 *
 * @param poses
 * @text Posições
 * @type struct<Pos>[]
 * @default []
 *
 * @command show
 * @text Mostrar
 * @desc Mostra algo.
 * @arg id
 * @text ID
 * @type number
 * @default 1
 * @arg where
 * @type struct<Pos>
 * @default {}
 *
 * @help
 * Plugin de teste. Não faz nada além de registrar o comando "show".
 *
 *   Linha com recuo.
 */
/*~struct~Pos:
 * @param x
 * @text X
 * @type number
 * @min -9999
 * @default 0
 * @param y
 * @text Y
 * @type number
 * @default 0
 * @param visible
 * @text Visível
 * @type boolean
 * @default true
 */
/*:ja
 * @target MZ
 * @plugindesc 日本語ブロック（使われないはず）
 */
(() => {
    const params = PluginManager.parameters("MZEditorTypeTest");
    window.__typeTest = params;
    PluginManager.registerCommand("MZEditorTypeTest", "show", args => console.log("show", args));
})();
