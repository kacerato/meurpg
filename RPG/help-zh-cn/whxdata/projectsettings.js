// Publish project specific data
(function() {
rh = window.rh;
model = rh.model;
var defaultTopic = "01.html";
rh._.exports(defaultTopic);
rh.consts('DEFAULT_TOPIC', encodeURI("01.html"));
rh.consts('HOME_FILEPATH', encodeURI('index.html'));
rh.consts('START_FILEPATH', encodeURI('index.html'));
rh.consts('HELP_ID', '831b89ce-98ec-48fe-ba89-0e147a28a7be' || 'preview');
rh.consts('LNG_SUBSTR_SEARCH', 0);

model.publish(rh.consts('KEY_LNG_NAME'), "zh");
model.publish(rh.consts('KEY_DIR'), "ltr");
model.publish(rh.consts('KEY_LNG'), {"Contents":"内容","Index":"索引","Search":"搜索","Glossary":"术语表","Logo/Author":"技术支持","Show":"显示","Hide":"隐藏","SyncToc":"同步目录","Prev":"上一步","Next":"下一步","Disabled Prev":"<<","Disabled Next":">>","Separator":"|","OpenLinkInNewTab":"在新的标签页中开启","SearchOptions":"搜索选项","Loading":"正在加载...","UnknownError":"未知的错误","Logo":"徽标","HomeButton":"首页","SearchPageTitle":"搜索结果","PreviousLabel":"上一步","NextLabel":"下一步","TopicsNotFound":"未找到结果","JS_alert_LoadXmlFailed":"加载 XML 文件失败","JS_alert_InitDatabaseFailed":"初始化数据库失败","JS_alert_InvalidExpression_1":"键入的搜索字符串无效。","Searching":"正在搜索...","Cancel":"取消","Canceled":"已取消","ResultsFoundText":"找到 %1 个关于 %2 的结果","SearchResultsPerScreen":"每页搜寻结果","Back":"返回","TableOfContents":"目录","IndexFilterKewords":"筛选关键字","GlossaryFilterTerms":"筛选术语","ShowAll":"全部","HideAll":"全部隐藏","ShowHide":"显示/隐藏","IeCompatibilityErrorMsg":"无法在 Internet Explorer 8 或更早版本中查看此页面。","NoScriptErrorMsg":"在浏览器中启用 JavaScript 支持以查看此页面。","EnableAndSearch":"在搜索中包含所有字词","HighlightSearchResults":"突出显示搜索结果","Print":"打印","Filter":"篩選器","SearchTitle":"搜索","ContentFilterChanged":"内容筛选器已更改，请重新搜索","EndOfResults":"搜索结果结束。","Reset":"重置","NavTip":"关闭","ToTopTip":"回到顶部","ApplyTip":"应用","SidebarToggleTip":"展开/折叠","Copyright":"© Copyright 2019. All rights reserved.","FavoriteBoxTitle":"收藏夹","setAsFavorites":"添加到收藏夹","unsetAsFavorite":"从我的最爱中移除","favoritesNameLabel":"名称","favoritesLabel":"收藏夹","setAsFavorite":"设置为收藏页面","nofavoritesFound":"您尚未将任何主题标记为收藏主题。","Welcome_header":"欢迎使用帮助中心","Welcome_text":"您需要哪方面的帮助?","SearchButtonTitle":"搜索...","ShowTopicInContext":"按一下此处即可查看此页面的完整内容","TopicHiddenText":"所选筛选器会筛选出此主题。"});

model.publish(rh.consts('KEY_HEADER_TITLE'), "RPG Maker MZ 帮助");
model.publish(rh.consts('PDF_FILE_NAME'), "");
model.publish(rh.consts('MAX_SEARCH_RESULTS'), "20");
model.publish(rh.consts('KEY_SKIN_FOLDER_NAME'), "Azure_Blue");
model.publish(rh.consts('KEY_SUBSTR_SEARCH'), "");
})();
