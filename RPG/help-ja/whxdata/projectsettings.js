// Publish project specific data
(function() {
rh = window.rh;
model = rh.model;
var defaultTopic = "01.html";
rh._.exports(defaultTopic);
rh.consts('DEFAULT_TOPIC', encodeURI("01.html"));
rh.consts('HOME_FILEPATH', encodeURI('index.html'));
rh.consts('START_FILEPATH', encodeURI('index.html'));
rh.consts('HELP_ID', '4587446c-9073-486f-a46b-063a3424941e' || 'preview');
rh.consts('LNG_SUBSTR_SEARCH', 0);

model.publish(rh.consts('KEY_LNG_NAME'), "ja");
model.publish(rh.consts('KEY_DIR'), "ltr");
model.publish(rh.consts('KEY_LNG'), {"Contents":"コンテンツ","Index":"索引","Search":"検索","Glossary":"用語集","Logo/Author":"Powered By","Show":"表示","Hide":"非表示","SyncToc":"目次を同期","Prev":"前へ","Next":"次へ","Disabled Prev":"<<","Disabled Next":">>","Separator":"|","OpenLinkInNewTab":"新しいタブで開く","SearchOptions":"検索オプション","Loading":"読み込み中...","UnknownError":"不明なエラー","Logo":"ロゴ","HomeButton":"ホーム","SearchPageTitle":"検索結果","PreviousLabel":"前へ","NextLabel":"次へ","TopicsNotFound":"結果が見つかりませんでした","JS_alert_LoadXmlFailed":"XML ファイルを読み込めませんでした","JS_alert_InitDatabaseFailed":"データベースの初期化に失敗しました","JS_alert_InvalidExpression_1":"入力した検索文字列は無効です。","Searching":"検索中...","Cancel":"キャンセル","Canceled":"キャンセル済み","ResultsFoundText":"%2 の結果が %1 個見つかりました","SearchResultsPerScreen":"ページあたりの検索結果数","Back":"戻る","TableOfContents":"目次","IndexFilterKewords":"キーワードでフィルタリング","GlossaryFilterTerms":"用語でフィルタリング","ShowAll":"すべて","HideAll":"すべて非表示","ShowHide":"表示 / 非表示","IeCompatibilityErrorMsg":"このページは、Internet Explorer 8 以前のバージョンでは表示できません。","NoScriptErrorMsg":"ブラウザーで Javascript サポートを有効にしてこのページを表示します。","EnableAndSearch":"検索にすべての単語を含める","HighlightSearchResults":"検索結果のハイライト","Print":"印刷","Filter":"フィルター","SearchTitle":"検索","ContentFilterChanged":"コンテンツフィルターが変更されています。再検索してください","EndOfResults":"検索結果の最後です。","Reset":"リセット","NavTip":"閉じる","ToTopTip":"トップへ移動","ApplyTip":"適用","SidebarToggleTip":"展開 / 折りたたむ","Copyright":"© Copyright 2019. All rights reserved.","FavoriteBoxTitle":"お気に入り","setAsFavorites":"お気に入りに追加","unsetAsFavorite":"お気に入りの設定解除","favoritesNameLabel":"名前","favoritesLabel":"お気に入り","setAsFavorite":"お気に入りとして設定","nofavoritesFound":"お気に入りとしてマークしたトピックがありません。","Welcome_header":"ヘルプセンターへようこそ","Welcome_text":"お問い合わせの内容","SearchButtonTitle":"検索...","ShowTopicInContext":"このページの全文を参照するには、ここをクリックしてください","TopicHiddenText":"このトピックは、選択したフィルターによって除外されます。"});

model.publish(rh.consts('KEY_HEADER_TITLE'), "RPGツクールMZ　ヘルプ");
model.publish(rh.consts('PDF_FILE_NAME'), "");
model.publish(rh.consts('MAX_SEARCH_RESULTS'), "20");
model.publish(rh.consts('KEY_SKIN_FOLDER_NAME'), "Azure_Blue");
model.publish(rh.consts('KEY_SUBSTR_SEARCH'), "");
})();
