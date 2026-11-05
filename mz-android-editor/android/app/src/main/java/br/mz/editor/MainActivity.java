package br.mz.editor;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;

public class MainActivity extends Activity {
    private static final String TAG = "MZ.Main";
    private static final int REQ_PICK_PROJECT = 1;
    private static final String PREF_PROJECT = "projectTreeUri";

    private LocalServer server;
    private WebView web;

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

        String saved = prefs().getString(PREF_PROJECT, null);
        if (saved != null) {
            openProject(Uri.parse(saved));
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

    private void openProject(Uri treeUri) {
        try {
            server.setProject(new SafProject(getContentResolver(), treeUri));
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_PROJECT && resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri tree = data.getData();
            getContentResolver().takePersistableUriPermission(tree,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            prefs().edit().putString(PREF_PROJECT, tree.toString()).apply();
            openProject(tree);
            web.loadUrl("http://127.0.0.1:" + server.getPort() + "/");
        }
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

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }
}
