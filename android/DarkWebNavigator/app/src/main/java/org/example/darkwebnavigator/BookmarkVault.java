package org.example.darkwebnavigator;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * On-device encrypted storage for bookmarks.
 *
 * Android Keystore AES-GCM key requires a recent strong biometric or device
 * screen-lock authentication (120-second validity window). Never store a PIN
 * or raw encryption key. No backup or internet permission.
 */
public final class BookmarkVault {
    private static final String PREFS = "local_private_settings";
    private static final String CIPHER = "encrypted_bookmarks_v2";
    private static final String LEGACY = "bookmarks_v1";
    private static final String KEY_ALIAS = "darkwebnavigator_bookmarks_v2";
    private static final int AUTH_SECONDS = 120;
    private final SharedPreferences prefs;

    public BookmarkVault(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean hasLegacyBookmarks() {
        return prefs.contains(LEGACY);
    }

    public void prepareKey() throws Exception {
        getOrCreateKey();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            return (SecretKey) store.getKey(KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder builder =
            new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= 30) {
            builder.setUserAuthenticationParameters(AUTH_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(AUTH_SECONDS);
        }
        generator.init(builder.build());
        return generator.generateKey();
    }

    public JSONArray load() throws Exception {
        // Existing v1.1 bookmarks were plaintext. Migrate only AFTER device
        // authentication; delete legacy plaintext only when encryption succeeds.
        if (prefs.contains(LEGACY)) {
            JSONArray current = readCiphertext();
            JSONArray prior;
            try { prior = new JSONArray(prefs.getString(LEGACY, "[]")); }
            catch (JSONException e) { prior = new JSONArray(); }
            for (int i = 0; i < prior.length(); i++) {
                String u = prior.optString(i, "");
                if (!u.isEmpty() && !includes(current, u)) current.put(u);
            }
            persist(current);
            prefs.edit().remove(LEGACY).apply();
            return current;
        }
        return readCiphertext();
    }

    private JSONArray readCiphertext() throws Exception {
        String value = prefs.getString(CIPHER, null);
        if (value == null || value.isEmpty()) return new JSONArray();
        byte[] payload = Base64.decode(value, Base64.NO_WRAP);
        if (payload.length < 29) throw new SecurityException("Invalid protected bookmark data");
        byte[] iv = new byte[12];
        System.arraycopy(payload, 0, iv, 0, iv.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        byte[] decrypted = cipher.doFinal(payload, iv.length, payload.length - iv.length);
        return new JSONArray(new String(decrypted, StandardCharsets.UTF_8));
    }

    public void persist(JSONArray urls) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] encrypted = cipher.doFinal(urls.toString().getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        byte[] payload = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, payload, 0, iv.length);
        System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
        prefs.edit().putString(CIPHER, Base64.encodeToString(payload, Base64.NO_WRAP)).apply();
    }

    public void deleteAllBookmarks() {
        prefs.edit().remove(CIPHER).remove(LEGACY).apply();
    }

    public static boolean includes(JSONArray items, String query) {
        for (int i = 0; i < items.length(); i++)
            if (query.equals(items.optString(i))) return true;
        return false;
    }
}
