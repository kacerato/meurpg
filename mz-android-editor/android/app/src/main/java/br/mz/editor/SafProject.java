package br.mz.editor;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Projeto MZ aberto por uma árvore do Storage Access Framework.
 * Resolve caminhos relativos ("data/Map001.json") em documentos, com cache por pasta.
 */
public class SafProject {
    public static final class Entry {
        final String name;
        final Uri uri;
        final String documentId;
        final boolean isDir;
        final long size;

        Entry(String name, Uri uri, String documentId, boolean isDir, long size) {
            this.name = name;
            this.uri = uri;
            this.documentId = documentId;
            this.isDir = isDir;
            this.size = size;
        }
    }

    private final ContentResolver resolver;
    private final Uri treeUri;
    private final String rootDocId;
    private final Map<String, Map<String, Entry>> dirCache = new HashMap<>();

    public SafProject(ContentResolver resolver, Uri treeUri) {
        this.resolver = resolver;
        this.treeUri = treeUri;
        this.rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
    }

    public Uri getRootUri() {
        return treeUri;
    }

    public String getName() {
        String id = rootDocId;
        int slash = Math.max(id.lastIndexOf('/'), id.lastIndexOf(':'));
        return slash >= 0 ? id.substring(slash + 1) : id;
    }

    public void invalidate() {
        synchronized (dirCache) {
            dirCache.clear();
        }
    }

    /** Lista uma pasta (por caminho relativo) e guarda no cache. */
    private Map<String, Entry> children(String dirPath, String dirDocId) {
        synchronized (dirCache) {
            Map<String, Entry> cached = dirCache.get(dirPath);
            if (cached != null) {
                return cached;
            }
        }
        Map<String, Entry> map = new HashMap<>();
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, dirDocId);
        String[] cols = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE
        };
        try (Cursor c = resolver.query(childrenUri, cols, null, null, null)) {
            while (c != null && c.moveToNext()) {
                String id = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long size = c.isNull(3) ? 0 : c.getLong(3);
                boolean dir = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);
                Uri uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id);
                map.put(name, new Entry(name, uri, id, dir, size));
            }
        }
        synchronized (dirCache) {
            dirCache.put(dirPath, map);
        }
        return map;
    }

    private Entry rootEntry() {
        return new Entry("", DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocId), rootDocId, true, 0);
    }

    /** Resolve um caminho relativo; devolve null se não existir. */
    public Entry resolve(String relPath) {
        Entry cur = rootEntry();
        String path = "";
        for (String seg : relPath.split("/")) {
            if (seg.isEmpty() || seg.equals(".")) {
                continue;
            }
            if (!cur.isDir) {
                return null;
            }
            Map<String, Entry> kids = children(path, cur.documentId);
            Entry next = kids.get(seg);
            if (next == null) {
                return null;
            }
            cur = next;
            path = path.isEmpty() ? seg : path + "/" + seg;
        }
        return cur;
    }

    public InputStream open(Entry entry) throws IOException {
        InputStream in = resolver.openInputStream(entry.uri);
        if (in == null) {
            throw new IOException("não foi possível abrir " + entry.name);
        }
        return in;
    }

    /** Grava (cria se preciso) um arquivo no caminho relativo. */
    public void write(String relPath, byte[] data) throws IOException {
        int slash = relPath.lastIndexOf('/');
        String dirPath = slash >= 0 ? relPath.substring(0, slash) : "";
        String fileName = slash >= 0 ? relPath.substring(slash + 1) : relPath;
        Entry dir = mkdirs(dirPath);
        Entry file = children(dirPath, dir.documentId).get(fileName);
        if (file == null) {
            Uri created = DocumentsContract.createDocument(resolver, dir.uri, LocalServer.Mime.of(fileName).split(";")[0], fileName);
            if (created == null) {
                throw new IOException("não foi possível criar " + relPath);
            }
            synchronized (dirCache) {
                dirCache.remove(dirPath);
            }
            file = children(dirPath, dir.documentId).get(fileName);
            if (file == null) {
                throw new IOException("arquivo criado não encontrado: " + relPath);
            }
        }
        try (OutputStream out = resolver.openOutputStream(file.uri, "wt")) {
            if (out == null) {
                throw new IOException("não foi possível gravar " + relPath);
            }
            out.write(data);
        }
        synchronized (dirCache) {
            dirCache.remove(dirPath);
        }
    }

    private Entry mkdirs(String dirPath) throws IOException {
        Entry cur = rootEntry();
        String path = "";
        for (String seg : dirPath.split("/")) {
            if (seg.isEmpty()) {
                continue;
            }
            Map<String, Entry> kids = children(path, cur.documentId);
            Entry next = kids.get(seg);
            if (next == null) {
                Uri created = DocumentsContract.createDocument(resolver, cur.uri, DocumentsContract.Document.MIME_TYPE_DIR, seg);
                if (created == null) {
                    throw new IOException("não foi possível criar pasta " + seg);
                }
                synchronized (dirCache) {
                    dirCache.remove(path);
                }
                next = children(path, cur.documentId).get(seg);
            }
            cur = next;
            path = path.isEmpty() ? seg : path + "/" + seg;
        }
        return cur;
    }

    /** Apaga um arquivo do projeto; devolve false se não existir. */
    public boolean delete(String relPath) {
        Entry e = resolve(relPath);
        if (e == null || e.isDir) {
            return false;
        }
        try {
            boolean ok = DocumentsContract.deleteDocument(resolver, e.uri);
            int slash = relPath.lastIndexOf('/');
            String dirPath = slash >= 0 ? relPath.substring(0, slash) : "";
            synchronized (dirCache) {
                dirCache.remove(dirPath);
            }
            return ok;
        } catch (Exception ex) {
            return false;
        }
    }

    public String listJson(String dirPath) {
        Entry dir = resolve(dirPath);
        if (dir == null || !dir.isDir) {
            return "[]";
        }
        List<Entry> entries = new ArrayList<>(children(dirPath, dir.documentId).values());
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (Entry e : entries) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append("{\"name\":").append(LocalServer.Json.str(e.name)).append(",\"dir\":").append(e.isDir).append('}');
        }
        return sb.append(']').toString();
    }
}
