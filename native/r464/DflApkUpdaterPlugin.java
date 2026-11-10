package __PACKAGE__;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * R464: atualização explícita do APK assinado. Sem tokens, sem armazenamento
 * público, sem instalação silenciosa. URL de distribuição é construída nativamente.
 */
@CapacitorPlugin(name = "DflApkUpdater")
public class DflApkUpdaterPlugin extends Plugin {
  private static final long MAX_BYTES = 150L * 1024L * 1024L;
  private static final String PREFS = "dfl_apk_update_r464";
  private static final String DIR = "dfl-apk-updates";
  private static final ExecutorService POOL = Executors.newSingleThreadExecutor();
  private final AtomicBoolean downloading = new AtomicBoolean(false);

  private int installedBuild() throws Exception {
    PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
    return (int) (Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
  }

  private File apkFor(int build) { return new File(new File(getContext().getFilesDir(), DIR), "DFL-Finance-" + build + ".apk"); }
  private static boolean validHash(String value) { return value != null && value.matches("[a-fA-F0-9]{64}"); }

  private static String hex(byte[] digest) {
    StringBuilder out = new StringBuilder(64);
    for (byte b : digest) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
    return out.toString();
  }

  private static boolean trustedDownloadHost(URL u) {
    String host = u.getHost().toLowerCase(Locale.ROOT);
    boolean hostAllowed = host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
      || host.equals("objects.githubusercontent.com") || host.equals("github-releases.githubusercontent.com");
    return u.getProtocol().equals("https") && hostAllowed &&
      (u.getPort() == -1 || u.getPort() == 443) && u.getUserInfo() == null;
  }

  private static HttpURLConnection openDownload(int build) throws Exception {
    URL current = new URL("https://github.com/alefe-redes-computadores/dfl-finance/releases/download/finance-android-"
      + build + "/DFL-Finance-" + build + ".apk");
    for (int redirects = 0; redirects <= 6; redirects++) {
      if (!trustedDownloadHost(current)) throw new SecurityException("Destino de download não autorizado.");
      HttpURLConnection connection = (HttpURLConnection) current.openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(15000);
      connection.setReadTimeout(30000);
      connection.setRequestProperty("Accept", "application/octet-stream");
      connection.setRequestProperty("User-Agent", "DFL-Finance-Android-Updater/1");
      int status = connection.getResponseCode();
      if (status == HttpURLConnection.HTTP_OK) return connection;
      if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
        String location = connection.getHeaderField("Location");
        if (location == null) { connection.disconnect(); throw new Exception("Redirecionamento inválido."); }
        URL next = new URL(current, location);
        connection.disconnect();
        current = next;
        continue;
      }
      connection.disconnect();
      throw new Exception("Arquivo da atualização indisponível (HTTP " + status + ").");
    }
    throw new SecurityException("Redirecionamentos excessivos.");
  }

  private String sha256(File file) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    try (InputStream input = new BufferedInputStream(new java.io.FileInputStream(file))) {
      byte[] buffer = new byte[65536]; int n;
      while ((n = input.read(buffer)) != -1) md.update(buffer, 0, n);
    }
    return hex(md.digest());
  }

  private Signature[] signers(PackageInfo info) {
    if (Build.VERSION.SDK_INT >= 28) {
      if (info.signingInfo == null) return null;
      return info.signingInfo.getApkContentsSigners();
    }
    return info.signatures;
  }

  private void verifyPackage(File file, int targetBuild) throws Exception {
    PackageManager pm = getContext().getPackageManager();
    int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
    if (archive == null || !getContext().getPackageName().equals(archive.packageName))
      throw new SecurityException("O APK não pertence ao DFL Finance.");
    long archiveVersion = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
    if (archiveVersion != targetBuild || archiveVersion <= installedBuild())
      throw new SecurityException("Versão do APK incompatível ou anterior à instalada.");
    PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
    Signature[] current = signers(installed), candidate = signers(archive);
    if (current == null || candidate == null || current.length != 1 || candidate.length != 1 ||
        !Arrays.equals(current[0].toByteArray(), candidate[0].toByteArray()))
      throw new SecurityException("Assinatura do APK não corresponde ao aplicativo instalado.");
  }

  @PluginMethod
  public void downloadVerified(PluginCall call) {
    Integer build = call.getInt("build");
    String expected = call.getString("sha256");
    long bytes = call.getData().optLong("bytes", 0L);
    if (build == null || build <= 0 || !validHash(expected) || bytes < 100000L || bytes > MAX_BYTES) {
      call.reject("Metadados de atualização inválidos."); return;
    }
    try {
      if (build <= installedBuild()) { call.reject("Esta versão já está instalada."); return; }
    } catch (Exception e) { call.reject("Não foi possível conferir a versão instalada."); return; }
    if (!downloading.compareAndSet(false, true)) { call.reject("Download já em andamento."); return; }

    POOL.execute(() -> {
      File temp = null;
      HttpURLConnection connection = null;
      try {
        File target = apkFor(build);
        File directory = target.getParentFile();
        if (directory == null || (!directory.isDirectory() && !directory.mkdirs()))
          throw new Exception("Não foi possível criar o diretório privado.");
        temp = new File(directory, "download-" + build + ".partial");
        if (temp.exists() && !temp.delete()) throw new Exception("Download anterior não pôde ser limpo.");
        connection = openDownload(build);
        long total = connection.getContentLengthLong();
        if (total > MAX_BYTES || (total > 0 && total != bytes))
          throw new SecurityException("Tamanho de download inesperado.");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long received = 0, lastEvent = 0;
        try (InputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(temp)) {
          byte[] buffer = new byte[65536]; int n;
          while ((n = input.read(buffer)) != -1) {
            received += n;
            if (received > MAX_BYTES || received > bytes) throw new SecurityException("Tamanho excedido.");
            output.write(buffer, 0, n);
            digest.update(buffer, 0, n);
            if (received - lastEvent >= 262144 || received == bytes) {
              lastEvent = received;
              JSObject progress = new JSObject();
              progress.put("build", build);
              progress.put("received", received);
              progress.put("total", bytes);
              progress.put("percent", (int) Math.min(100, received * 100 / bytes));
              notifyListeners("downloadProgress", progress);
            }
          }
          output.getFD().sync();
        }
        if (received != bytes || !hex(digest.digest()).equalsIgnoreCase(expected))
          throw new SecurityException("Falha na integridade SHA-256 do APK.");
        if (target.exists() && !target.delete()) throw new Exception("APK anterior não pôde ser substituído.");
        if (!temp.renameTo(target)) throw new Exception("Falha ao finalizar download.");
        temp = null;
        verifyPackage(target, build);
        getContext().getSharedPreferences(PREFS, 0).edit()
          .putInt("build", build).putString("sha256", expected.toLowerCase(Locale.ROOT))
          .putLong("size", bytes).apply();
        JSObject response = new JSObject(); response.put("verified", true); response.put("build", build);
        call.resolve(response);
      } catch (Exception e) {
        getContext().getSharedPreferences(PREFS, 0).edit().clear().apply();
        call.reject("Atualização não verificada: " + e.getMessage());
      } finally {
        if (connection != null) connection.disconnect();
        if (temp != null && temp.exists()) temp.delete();
        downloading.set(false);
      }
    });
  }

  @PluginMethod
  public void installVerified(PluginCall call) {
    Integer build = call.getInt("build");
    String hash = call.getString("sha256");
    if (build == null || build <= 0 || !validHash(hash)) { call.reject("Atualização inválida."); return; }
    POOL.execute(() -> {
      try {
        android.content.SharedPreferences pref = getContext().getSharedPreferences(PREFS, 0);
        File file = apkFor(build);
        if (pref.getInt("build", 0) != build ||
            !hash.equalsIgnoreCase(pref.getString("sha256", "")) ||
            !file.isFile() || file.length() != pref.getLong("size", -1L) ||
            !sha256(file).equalsIgnoreCase(hash))
          throw new SecurityException("O arquivo não passou na nova conferência de integridade.");
        verifyPackage(file, build);
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
          JSObject result = new JSObject(); result.put("permissionRequired", true);
          call.resolve(result); return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".dflapkprovider", file);
        getActivity().runOnUiThread(() -> {
          try {
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.setClipData(ClipData.newUri(getContext().getContentResolver(), "Atualização DFL Finance", uri));
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(install);
            JSObject result = new JSObject(); result.put("opened", true);
            call.resolve(result);
          } catch (Exception e) { call.reject("O instalador do Android não pôde ser aberto."); }
        });
      } catch (Exception e) { call.reject("Instalação bloqueada: " + e.getMessage()); }
    });
  }

  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT < 26) { call.resolve(); return; }
    getActivity().runOnUiThread(() -> {
      try {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
      } catch (Exception e) { call.reject("Não foi possível abrir as permissões de instalação."); }
    });
  }
}
