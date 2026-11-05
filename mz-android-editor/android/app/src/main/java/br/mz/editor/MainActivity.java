package br.mz.editor;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.provider.DocumentsContract;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;

public class MainActivity extends Activity {
    private static final String TAG = "MZ.Main";
    private static final int REQ_PICK_PROJECT = 1;
    private static final int REQ_NEW_PROJECT_PARENT = 2;
    private static final int REQ_FILE_CHOOSER = 3;
    private static final int REQ_FOLDER_CHOOSER = 4;
    private static final int REQ_DEPLOY_FOLDER = 5;
    /** FileChooserParams.MODE_OPEN_FOLDER (constante oculta do SDK): <input webkitdirectory>. */
    private static final int MODE_OPEN_FOLDER = 2;
    private static final String PREF_PROJECT = "projectTreeUri";
    /** Documento raiz do projeto dentro de PREF_PROJECT (Novo projeto: pasta filha da pasta-mãe). */
    private static final String PREF_PROJECT_DOC = "projectDocId";

    private LocalServer server;
    private WebView web;
    private String pendingNewName;
    private String pendingNewTitle;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        server = new LocalServer(getAssets());
        try {
            server.start();
        } catch (IOException e) {
            Toast.makeText(this, "Falha ao iniciar servidor local: " + e, Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        server.setDeployer(new Deployer(this, server));

        String saved = prefs().getString(PREF_PROJECT, null);
        if (saved != null) {
            openProject(Uri.parse(saved), prefs().getString(PREF_PROJECT_DOC, null));
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, "[web] " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }

            /** <input type=file> (Importar, DLC, Importar recursos padrão...): seletor do sistema. */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return showFileChooser(callback, params);
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        applyImmersive();
        web.loadUrl("http://127.0.0.1:" + server.getPort() + "/");
    }

    /** Tela cheia: esconde barra de status e de navegação; reaparecem com um deslize. */
    private void applyImmersive() {
        android.view.Window w = getWindow();
        w.setDecorFitsSystemWindows(false);
        android.view.WindowInsetsController c = w.getInsetsController();
        if (c != null) {
            c.hide(android.view.WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
        if (w.getAttributes() != null) {
            w.getAttributes().layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersive();
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("mz", MODE_PRIVATE);
    }

    private void openProject(Uri treeUri, String rootDocId) {
        try {
            server.setProject(new SafProject(getContentResolver(), treeUri, rootDocId));
        } catch (Exception e) {
            Log.e(TAG, "openProject", e);
            Toast.makeText(this, "Não foi possível abrir o projeto", Toast.LENGTH_LONG).show();
        }
    }

    private void pickProject() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i, REQ_PICK_PROJECT);
    }

    private boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
        }
        fileCallback = callback;
        try {
            Log.d(TAG, "fileChooser mode=" + params.getMode() + " accept=" + java.util.Arrays.toString(params.getAcceptTypes()));
            if (params.getMode() == MODE_OPEN_FOLDER) {
                // pasta inteira (webkitdirectory): SAF de pasta; o WebView lista o conteúdo da árvore
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(i, REQ_FOLDER_CHOOSER);
                return true;
            }
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            String[] mimes = mimeTypes(params.getAcceptTypes());
            i.setType(mimes.length == 1 ? mimes[0] : "*/*");
            if (mimes.length > 1) {
                i.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
            }
            if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            startActivityForResult(i, REQ_FILE_CHOOSER);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "fileChooser", e);
            fileCallback = null;
            return false;
        }
    }

    /** accept="image/png,.ogg" → tipos MIME para o seletor (extensões viram MIME; desconhecido = qualquer). */
    private static String[] mimeTypes(String[] accept) {
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        if (accept != null) {
            for (String a : accept) {
                for (String part : a.split(",")) {
                    String t = part.trim().toLowerCase(java.util.Locale.ROOT);
                    if (t.isEmpty()) {
                        continue;
                    }
                    if (t.startsWith(".")) {
                        String m = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(t.substring(1));
                        if (m == null) {
                            return new String[]{"*/*"};
                        }
                        out.add(m);
                    } else {
                        out.add(t);
                    }
                }
            }
        }
        return out.isEmpty() ? new String[]{"*/*"} : out.toArray(new String[0]);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER || requestCode == REQ_FOLDER_CHOOSER) {
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb == null) {
                return;
            }
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    result = new Uri[data.getClipData().getItemCount()];
                    for (int k = 0; k < result.length; k++) {
                        result[k] = data.getClipData().getItemAt(k).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            cb.onReceiveValue(result);
            return;
        }
        if (requestCode == REQ_DEPLOY_FOLDER) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                getContentResolver().takePersistableUriPermission(tree,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                String label = tree.getLastPathSegment();
                try {
                    label = new SafProject(getContentResolver(), tree).getName();
                } catch (Exception ignored) {
                    // fica o último segmento da URI
                }
                web.evaluateJavascript("window.mzDeployFolderPicked && window.mzDeployFolderPicked("
                    + LocalServer.Json.str(tree.toString()) + "," + LocalServer.Json.str(label) + ")", null);
            }
            return;
        }
        if (requestCode == REQ_PICK_PROJECT && resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri tree = data.getData();
            getContentResolver().takePersistableUriPermission(tree,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            prefs().edit().putString(PREF_PROJECT, tree.toString()).remove(PREF_PROJECT_DOC).apply();
            openProject(tree, null);
            web.loadUrl("http://127.0.0.1:" + server.getPort() + "/");
        } else if (requestCode == REQ_NEW_PROJECT_PARENT && resultCode == RESULT_OK && data != null && data.getData() != null) {
            createNewProjectIn(data.getData());
        }
    }

    /** Novo projeto: cria a pasta <nome> dentro da pasta escolhida, abre-a e manda o editor copiar o template. */
    private void createNewProjectIn(Uri parentTree) {
        String name = pendingNewName;
        String title = pendingNewTitle == null ? "" : pendingNewTitle;
        pendingNewName = null;
        pendingNewTitle = null;
        if (name == null || name.isEmpty()) {
            return;
        }
        try {
            getContentResolver().takePersistableUriPermission(parentTree,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            String parentDocId = android.provider.DocumentsContract.getTreeDocumentId(parentTree);
            Uri parentDoc = android.provider.DocumentsContract.buildDocumentUriUsingTree(parentTree, parentDocId);
            Uri created = android.provider.DocumentsContract.createDocument(getContentResolver(), parentDoc,
                android.provider.DocumentsContract.Document.MIME_TYPE_DIR, name);
            if (created == null) {
                Toast.makeText(this, "Não foi possível criar a pasta " + name, Toast.LENGTH_LONG).show();
                return;
            }
            // A pasta nova é aberta DENTRO da árvore da pasta-mãe (que tem a permissão persistente);
            // uma tree URI nova para a filha não tem permissão e toda gravação falharia (SecurityException).
            String childDocId = android.provider.DocumentsContract.getDocumentId(created);
            prefs().edit().putString(PREF_PROJECT, parentTree.toString()).putString(PREF_PROJECT_DOC, childDocId).apply();
            openProject(parentTree, childDocId);
            web.loadUrl("http://127.0.0.1:" + server.getPort() + "/?newProject=" + Uri.encode(title));
        } catch (Exception e) {
            Log.e(TAG, "newProject", e);
            Toast.makeText(this, "Novo projeto falhou: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /** Compartilha um arquivo do projeto (Resource Manager → Exportar). */
    private void shareFile(String relPath, String mime) {
        try {
            SafProject prj = server.getProject();
            SafProject.Entry entry = prj == null ? null : prj.resolve(relPath);
            if (entry == null || entry.isDir) {
                Toast.makeText(this, "Arquivo não encontrado: " + relPath, Toast.LENGTH_LONG).show();
                return;
            }
            java.io.File dir = new java.io.File(getCacheDir(), "share");
            dir.mkdirs();
            java.io.File out = new java.io.File(dir, entry.name);
            try (java.io.InputStream in = prj.open(entry); java.io.OutputStream os = new java.io.FileOutputStream(out)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) >= 0) {
                    os.write(buf, 0, n);
                }
            }
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
            i.putExtra(Intent.EXTRA_STREAM, ApkProvider.shareUriFor(entry.name));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, entry.name));
        } catch (Exception e) {
            Log.e(TAG, "shareFile", e);
            Toast.makeText(this, "Não foi possível compartilhar: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /** Arquivo > Fechar projeto: volta ao estado "sem projeto". */
    private void closeProject() {
        prefs().edit().remove(PREF_PROJECT).remove(PREF_PROJECT_DOC).apply();
        server.setProject(null);
        web.loadUrl("http://127.0.0.1:" + server.getPort() + "/");
    }

    /** Jogo > Abrir pasta: abre a pasta do projeto no app de arquivos (SAF). */
    private void openProjectFolder() {
        SafProject prj = server.getProject();
        if (prj == null) {
            return;
        }
        Uri tree = prj.getRootUri();
        try {
            Uri doc = prj.getRootDocumentUri();
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(doc, DocumentsContract.Document.MIME_TYPE_DIR);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivity(i);
        } catch (Exception e) {
            Log.w(TAG, "openFolder", e);
            Toast.makeText(this, Uri.decode(String.valueOf(tree.getLastPathSegment())), Toast.LENGTH_LONG).show();
        }
    }

    private void openUrl(String url) {
        try {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        } catch (Exception e) {
            Toast.makeText(this, url, Toast.LENGTH_LONG).show();
        }
    }

    private void launchNewProjectPicker() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i, REQ_NEW_PROJECT_PARENT);
    }

    @Override
    public void onBackPressed() {
        // o editor trata o botão voltar (fecha o teste de jogo, etc.)
        web.evaluateJavascript("window.mzBack ? window.mzBack() : false", result -> {
            if (!"true".equals(result)) {
                runOnUiThread(() -> moveTaskToBack(true));
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop();
        }
        super.onDestroy();
    }

    /** Implantação: instala um APK exportado (pede a permissão de fontes desconhecidas se faltar). */
    private void installApk(String fileName) {
        try {
            if (!getPackageManager().canRequestPackageInstalls()) {
                Toast.makeText(this, "Permita instalar apps do MZ Editor e toque em Instalar de novo", Toast.LENGTH_LONG).show();
                startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())));
                return;
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(ApkProvider.uriFor(fileName), "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Log.e(TAG, "installApk", e);
            Toast.makeText(this, "Não foi possível abrir o instalador: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /** Ponte exposta ao editor como window.Android. */
    private final class Bridge {
        @JavascriptInterface
        public void pickProject() {
            runOnUiThread(MainActivity.this::pickProject);
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        /** Presença da Implantação em Java (rotas /api/deploy/*). */
        @JavascriptInterface
        public int deployVersion() {
            return 1;
        }

        /** Abre o instalador para filesDir/deploy/<fileName> (APK exportado). */
        @JavascriptInterface
        public void installApk(String fileName) {
            runOnUiThread(() -> MainActivity.this.installApk(fileName));
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        /** Novo projeto: pede a pasta-mãe (SAF); o editor copia o template depois (?newProject=).
         *  Antes, o editor pergunta "Salvar as alterações no jogo?" (window.mzConfirmLeave → leaveConfirmed). */
        @JavascriptInterface
        public void newProject(String name, String title) {
            runOnUiThread(() -> {
                pendingNewName = name;
                pendingNewTitle = title;
                web.evaluateJavascript("(window.mzConfirmLeave ? (window.mzConfirmLeave('new'), true) : false)", r -> {
                    if (!"true".equals(r)) {
                        launchNewProjectPicker();
                    }
                });
            });
        }

        /** O editor confirmou que pode trocar de projeto (salvou ou descartou). */
        @JavascriptInterface
        public void leaveConfirmed(String kind) {
            runOnUiThread(() -> {
                if ("new".equals(kind) && pendingNewName != null) {
                    launchNewProjectPicker();
                }
            });
        }

        @JavascriptInterface
        public void closeProject() {
            runOnUiThread(MainActivity.this::closeProject);
        }

        /** Arquivo > Sair (o editor já perguntou se quer salvar). */
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(MainActivity.this::finishAndRemoveTask);
        }

        @JavascriptInterface
        public void openFolder() {
            runOnUiThread(MainActivity.this::openProjectFolder);
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> MainActivity.this.openUrl(url));
        }

        /** Implantação: pasta de saída fora do projeto (SAF); responde em window.mzDeployFolderPicked(uri, nome). */
        @JavascriptInterface
        public void pickDeployFolder() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(i, REQ_DEPLOY_FOLDER);
            });
        }

        /** Resource Manager → Exportar: compartilha um arquivo do projeto. */
        @JavascriptInterface
        public void shareFile(String relPath, String mime) {
            new Thread(() -> MainActivity.this.shareFile(relPath, mime), "mz-share").start();
        }
    }
}
