package br.mz.editor;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Provedor mínimo (equivalente ao FileProvider do AndroidX, sem dependência) que entrega ao
 * instalador de pacotes os APKs exportados em filesDir/deploy/.
 * URI: content://br.mz.editor.deploy/apk/<nome>.apk
 */
public class ApkProvider extends ContentProvider {
    static final String AUTHORITY = "br.mz.editor.deploy";

    static Uri uriFor(String fileName) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath("apk").appendPath(fileName).build();
    }

    /** URI para um arquivo copiado em cacheDir/share (Resource Manager → Exportar). */
    static Uri shareUriFor(String fileName) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath("share").appendPath(fileName).build();
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..")) {
            throw new FileNotFoundException(String.valueOf(uri));
        }
        java.util.List<String> segs = uri.getPathSegments();
        boolean share = segs.size() >= 2 && "share".equals(segs.get(0));
        File base = share ? new File(getContext().getCacheDir(), "share")
                          : new File(getContext().getFilesDir(), Deployer.OUT_DIR);
        File f = new File(base, name);
        if (!f.isFile()) {
            throw new FileNotFoundException(f.getPath());
        }
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) {
            throw new SecurityException("somente leitura");
        }
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        java.util.List<String> segs = uri.getPathSegments();
        if (segs.size() >= 2 && "share".equals(segs.get(0))) {
            return LocalServer.Mime.of(segs.get(1)).split(";")[0];
        }
        return "application/vnd.android.package-archive";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        try {
            File f = fileFor(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
