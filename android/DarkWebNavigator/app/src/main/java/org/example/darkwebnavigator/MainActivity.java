package org.example.darkwebnavigator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONException;
import java.util.Locale;

/**
 * Dark Web Navigator v1.1: launcher to the official Tor Browser, not a Tor client.
 * No INTERNET permission. No WebView. No analytics. No automatic browsing history.
 * Bookmarks and opt-in launcher recents remain in private Android app storage.
 */
public final class MainActivity extends Activity {
    private static final String TOR_PACKAGE = "org.torproject.torbrowser";
    private static final String PLAY_STORE = "https://play.google.com/store/apps/details?id=" + TOR_PACKAGE;
    private static final String PREFS_NAME = "local_private_settings";
    private static final String KEY_BOOKMARKS = "bookmarks_v1";
    private static final String KEY_RECENTS = "recent_opened_v1";
    private static final String KEY_REMEMBER = "remember_opened";
    private static final int BG = Color.rgb(12, 13, 25);
    private static final int SURFACE = Color.rgb(29, 30, 49);
    private static final int SURFACE_LIGHT = Color.rgb(39, 40, 66);
    private static final int WHITE = Color.rgb(247, 246, 255);
    private static final int MUTED = Color.rgb(188, 186, 212);
    private static final int ACCENT = Color.rgb(169, 133, 255);
    private static final int ACCENT_DARK = Color.rgb(79, 57, 137);
    private static final int GREEN = Color.rgb(134, 226, 184);
    private static final int MAX_BOOKMARKS = 60;
    private static final int MAX_RECENTS = 12;
    private SharedPreferences prefs;
    private LinearLayout body;
    private ScrollView scrollView;
    private TextView torIndicator;
    private EditText address;
    private String tab = "home";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        render();
    }

    @Override public void onResume() {
        super.onResume();
        if (torIndicator != null) torIndicator.setText(installed()
                ? "● TOR BROWSER INSTALLED" : "● TOR BROWSER REQUIRED");
    }

    private void render() {
        scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(BG);
        LinearLayout root = vertical();
        root.setPadding(dp(19), dp(24), dp(19), dp(24));
        scrollView.addView(root);
        setContentView(scrollView);

        LinearLayout titleRow = horizontal();
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView emblem = label("◈", 35, ACCENT, true);
        titleRow.addView(emblem);
        LinearLayout brand = vertical();
        LinearLayout.LayoutParams brandParams = new LinearLayout.LayoutParams(-1, -2);
        brandParams.leftMargin = dp(13);
        titleRow.addView(brand, brandParams);
        brand.addView(label("DARK WEB", 22, WHITE, true));
        brand.addView(label("NAVIGATOR  •  v1.1", 12, MUTED, true));
        root.addView(titleRow);
        root.addView(space(17));

        torIndicator = label(installed() ? "● TOR BROWSER INSTALLED" : "● TOR BROWSER REQUIRED",
                12, GREEN, true);
        root.addView(torIndicator);
        root.addView(space(19));

        LinearLayout nav = horizontal();
        addTab(nav, "HOME", "home");
        addTab(nav, "BOOKMARKS", "bookmarks");
        addTab(nav, "PRIVACY", "privacy");
        root.addView(nav);
        root.addView(space(24));

        body = vertical();
        root.addView(body);
        if ("bookmarks".equals(tab)) renderBookmarks();
        else if ("privacy".equals(tab)) renderPrivacy();
        else renderHome();

        body.addView(space(20));
        body.addView(label("Tor Browser handles network connections. This app does not make you anonymous on its own.",
                12, MUTED, false));
    }

    private void addTab(LinearLayout container, String caption, String selected) {
        boolean active = selected.equals(tab);
        Button button = button(caption, active ? ACCENT_DARK : SURFACE,
                active ? WHITE : MUTED, 11);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(44), 1);
        lp.rightMargin = dp(5);
        container.addView(button, lp);
        button.setOnClickListener(v -> { tab = selected; address = null; render(); });
    }

    private void renderHome() {
        LinearLayout hero = panel(true);
        hero.addView(label("Your private starting point", 22, WHITE, true));
        hero.addView(space(6));
        hero.addView(label("Open trusted HTTPS and .onion links through the official Tor Browser.",
                14, MUTED, false));
        hero.addView(space(18));
        Button openTor = button("OPEN TOR BROWSER  ↗", ACCENT, BG, 14);
        hero.addView(openTor);
        openTor.setOnClickListener(v -> launchTor());
        body.addView(hero);
        body.addView(space(21));

        body.addView(label("Enter an address", 17, WHITE, true));
        body.addView(space(9));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(15);
        address.setTextColor(WHITE);
        address.setHintTextColor(MUTED);
        address.setHint("https:// or 56-character .onion");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setPadding(dp(14), dp(13), dp(14), dp(13));
        address.setBackground(round(SURFACE, 13));
        body.addView(address, new LinearLayout.LayoutParams(-1, dp(57)));
        address.setOnEditorActionListener((v, id, event) -> {
            if (id == EditorInfo.IME_ACTION_GO) { openTyped(); return true; }
            return false;
        });
        body.addView(space(10));
        Button open = button("OPEN LINK IN TOR", ACCENT, BG, 14);
        body.addView(open);
        open.setOnClickListener(v -> openTyped());
        body.addView(space(8));
        Button bookmark = button("☆  SAVE THIS ADDRESS AS BOOKMARK", SURFACE_LIGHT, WHITE, 13);
        body.addView(bookmark);
        bookmark.setOnClickListener(v -> bookmarkTyped());
        body.addView(space(10));
        body.addView(label("Plain search words open DuckDuckGo in Tor. Invalid or unsafe URL schemes are blocked.",
                12, MUTED, false));

        body.addView(space(24));
        body.addView(label("Trusted starting links", 17, WHITE, true));
        body.addView(space(9));
        addLinkRow("Tor Project", "torproject.org", "https://www.torproject.org/");
        addLinkRow("Tor support", "support.torproject.org", "https://support.torproject.org/");
        addLinkRow("Check your Tor connection", "check.torproject.org", "https://check.torproject.org/");

        body.addView(space(22));
        body.addView(label("Recently opened from this app", 17, WHITE, true));
        body.addView(space(8));
        if (!prefs.getBoolean(KEY_REMEMBER, false)) {
            body.addView(label("Off by default. Enable optional launcher recents under Privacy.",
                    13, MUTED, false));
        } else {
            JSONArray recents = getArray(KEY_RECENTS);
            if (recents.length() == 0) {
                body.addView(label("No addresses saved yet.", 13, MUTED, false));
            } else {
                for (int i = recents.length() - 1; i >= 0; i--) {
                    addLinkRow(shorten(recents.optString(i)), "Saved locally · tap to open",
                            recents.optString(i));
                }
            }
        }
    }

    private void renderBookmarks() {
        body.addView(label("☆  Saved bookmarks", 23, WHITE, true));
        body.addView(space(7));
        body.addView(label("Only addresses you deliberately bookmark are stored on this phone.",
                13, MUTED, false));
        body.addView(space(19));
        JSONArray list = getArray(KEY_BOOKMARKS);
        if (list.length() == 0) {
            LinearLayout empty = panel(false);
            empty.addView(label("No bookmarks yet", 18, WHITE, true));
            empty.addView(space(7));
            empty.addView(label("Go to Home, enter an address and tap Save as Bookmark.",
                    13, MUTED, false));
            body.addView(empty);
        }
        for (int i = 0; i < list.length(); i++) {
            final int index = i;
            String url = list.optString(i);
            LinearLayout card = panel(false);
            card.addView(label(shorten(url), 15, WHITE, true));
            card.addView(space(5));
            card.addView(label(url, 12, MUTED, false));
            card.addView(space(10));
            LinearLayout actions = horizontal();
            Button go = button("OPEN IN TOR", ACCENT_DARK, WHITE, 12);
            Button remove = button("REMOVE", SURFACE_LIGHT, WHITE, 12);
            LinearLayout.LayoutParams lp1 = new LinearLayout.LayoutParams(0, dp(42), 2);
            lp1.rightMargin = dp(7);
            actions.addView(go, lp1);
            actions.addView(remove, new LinearLayout.LayoutParams(0, dp(42), 1));
            go.setOnClickListener(v -> openInTor(url));
            remove.setOnClickListener(v -> new AlertDialog.Builder(this)
                    .setTitle("Remove bookmark?")
                    .setMessage(url)
                    .setPositiveButton("REMOVE", (dialog, which) -> { removeIndex(KEY_BOOKMARKS,index); render(); })
                    .setNegativeButton("CANCEL", null).show());
            card.addView(actions);
            body.addView(card);
            body.addView(space(10));
        }
    }

    private void renderPrivacy() {
        body.addView(label("Privacy controls", 23, WHITE, true));
        body.addView(space(7));
        body.addView(label("You control what this launcher remembers. Tor Browser maintains its own separate data.",
                13, MUTED, false));
        body.addView(space(18));

        LinearLayout prefCard = panel(false);
        prefCard.addView(label("Save recent links opened from this app", 16, WHITE, true));
        prefCard.addView(space(8));
        prefCard.addView(label("Off by default. When enabled, remembers at most 12 addresses opened using this launcher. Turning it off erases those addresses.",
                13, MUTED, false));
        Switch toggle = new Switch(this);
        toggle.setText("Remember launched addresses");
        toggle.setTextColor(WHITE);
        toggle.setTextSize(13);
        toggle.setChecked(prefs.getBoolean(KEY_REMEMBER, false));
        prefCard.addView(space(10));
        prefCard.addView(toggle);
        toggle.setOnCheckedChangeListener((buttonView, enabled) -> {
            SharedPreferences.Editor e = prefs.edit().putBoolean(KEY_REMEMBER, enabled);
            if (!enabled) e.remove(KEY_RECENTS);
            e.apply();
            Toast.makeText(this, enabled ? "Launcher recents enabled" : "Launcher recents disabled and cleared",
                    Toast.LENGTH_SHORT).show();
        });
        body.addView(prefCard);
        body.addView(space(14));

        LinearLayout tools = panel(false);
        tools.addView(label("Delete local app data", 16, WHITE, true));
        tools.addView(space(9));
        Button clearRecent = button("CLEAR LAUNCHER RECENTS", SURFACE_LIGHT, WHITE, 12);
        tools.addView(clearRecent);
        clearRecent.setOnClickListener(v -> confirmClear(KEY_RECENTS, "recently opened addresses"));
        tools.addView(space(10));
        Button clearSaved = button("CLEAR ALL BOOKMARKS", SURFACE_LIGHT, WHITE, 12);
        tools.addView(clearSaved);
        clearSaved.setOnClickListener(v -> confirmClear(KEY_BOOKMARKS, "bookmarks"));
        tools.addView(space(10));
        Button reset = button("RESET ALL APP DATA", ACCENT_DARK, WHITE, 12);
        tools.addView(reset);
        reset.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("Reset this app?")
                .setMessage("Remove all bookmarks and recent addresses, and turn off history saving? This cannot be undone.")
                .setPositiveButton("RESET", (dialog, which) -> { prefs.edit().clear().apply(); render(); })
                .setNegativeButton("CANCEL", null).show());
        body.addView(tools);

        body.addView(space(18));
        LinearLayout note = panel(false);
        note.addView(label("What this app can and cannot clear", 16, WHITE, true));
        note.addView(space(7));
        note.addView(label("✓ Bookmarks and optional recently launched addresses in Dark Web Navigator\n" +
                        "✓ Stored only locally in this app's private storage, with Android backup disabled\n" +
                        "✕ Cannot see or erase browsing history, cookies or open tabs inside Tor Browser\n" +
                        "✕ Does not inspect Tor network traffic or store visited pages",
                13, MUTED, false));
        note.addView(space(12));
        Button launch = button("OPEN TOR BROWSER SETTINGS", SURFACE_LIGHT, WHITE, 12);
        note.addView(launch);
        launch.setOnClickListener(v -> launchTor());
        body.addView(note);
    }

    private void openTyped() {
        UrlPolicy.Result result = UrlPolicy.resolve(address.getText().toString());
        if (!result.valid) { alert("Check the address", result.error); return; }
        openInTor(result.url);
    }

    private void bookmarkTyped() {
        String typed = address.getText().toString().trim();
        if (!typed.contains(".")) { alert("Add a website", "Enter an HTTPS or .onion website address to bookmark."); return; }
        UrlPolicy.Result result = UrlPolicy.resolve(typed);
        if (!result.valid) { alert("Check the address", result.error); return; }
        JSONArray old = getArray(KEY_BOOKMARKS);
        for (int i = 0; i < old.length(); i++) {
            if (result.url.equals(old.optString(i))) {
                Toast.makeText(this, "Bookmark already saved", Toast.LENGTH_SHORT).show(); return;
            }
        }
        if (old.length() >= MAX_BOOKMARKS) { alert("Bookmarks full", "You can save up to 60 bookmarks."); return; }
        old.put(result.url);
        saveArray(KEY_BOOKMARKS, old);
        Toast.makeText(this, "Bookmark saved on this phone", Toast.LENGTH_SHORT).show();
    }

    private void addLinkRow(String title, String subtitle, String url) {
        LinearLayout box = panel(false);
        box.addView(label(title, 15, WHITE, true));
        box.addView(space(5));
        box.addView(label(subtitle, 12, MUTED, false));
        box.setOnClickListener(v -> openInTor(url));
        body.addView(box);
        body.addView(space(8));
    }

    private void openInTor(String url) {
        UrlPolicy.Result validated = UrlPolicy.resolve(url);
        if (!validated.valid) { alert("Blocked address", validated.error); return; }
        if (!installed()) { offerInstall(); return; }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(validated.url));
        intent.setPackage(TOR_PACKAGE);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
            if (prefs.getBoolean(KEY_REMEMBER, false)) remember(validated.url);
        } catch (ActivityNotFoundException | SecurityException ex) {
            new AlertDialog.Builder(this).setTitle("Open Tor Browser manually")
                    .setMessage("Your Tor Browser did not accept the direct link. Copy the URL and open it manually. The link will not be sent to another browser.")
                    .setPositiveButton("OPEN TOR", (dialog,which) -> launchTor())
                    .setNegativeButton("CANCEL", null).show();
        }
    }

    private void remember(String url) {
        JSONArray old = getArray(KEY_RECENTS);
        JSONArray next = new JSONArray();
        for (int i = 0; i < old.length(); i++) if (!url.equals(old.optString(i))) next.put(old.optString(i));
        next.put(url);
        JSONArray last = new JSONArray();
        for (int i = Math.max(0, next.length() - MAX_RECENTS); i < next.length(); i++) last.put(next.optString(i));
        saveArray(KEY_RECENTS, last);
    }

    private void confirmClear(String key, String label) {
        new AlertDialog.Builder(this).setTitle("Clear " + label + "?")
            .setMessage("Delete these addresses stored by Dark Web Navigator? This does not affect Tor Browser data.")
            .setPositiveButton("CLEAR", (dialog,which) -> { prefs.edit().remove(key).apply(); render(); })
            .setNegativeButton("CANCEL", null).show();
    }

    private JSONArray getArray(String key) {
        try { return new JSONArray(prefs.getString(key, "[]")); }
        catch (JSONException ex) { return new JSONArray(); }
    }

    private void saveArray(String key, JSONArray list) { prefs.edit().putString(key, list.toString()).apply(); }

    private void removeIndex(String key, int index) {
        JSONArray before = getArray(key), after = new JSONArray();
        for (int i = 0; i < before.length(); i++) if (i != index) after.put(before.optString(i));
        saveArray(key, after);
    }

    private String shorten(String url) {
        try {
            Uri uri = Uri.parse(url);
            String host = uri.getHost();
            if (host != null) {
                if (host.endsWith(".onion")) return "Private .onion site";
                return host;
            }
        } catch (Exception ignored) { }
        return url.length() > 45 ? url.substring(0, 45) + "…" : url;
    }

    private boolean installed() {
        try { getPackageManager().getPackageInfo(TOR_PACKAGE, 0); return true; }
        catch (Exception ex) { return false; }
    }

    private void launchTor() {
        if (!installed()) { offerInstall(); return; }
        Intent intent = getPackageManager().getLaunchIntentForPackage(TOR_PACKAGE);
        if (intent == null) { alert("Tor Browser", "Open the official Tor Browser from your app list."); return; }
        try { startActivity(intent); }
        catch (ActivityNotFoundException | SecurityException ex) {
            alert("Tor Browser", "Unable to open Tor Browser. Try launching it from your phone's apps.");
        }
    }

    private void offerInstall() {
        new AlertDialog.Builder(this).setTitle("Official Tor Browser required")
            .setMessage("Install the official Tor Browser from Google Play to use .onion websites.")
            .setPositiveButton("PLAY STORE", (dialog,which) -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + TOR_PACKAGE))); }
                catch (ActivityNotFoundException ex) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE)));
                }
            })
            .setNegativeButton("CANCEL", null).show();
    }

    private void alert(String title, String text) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(text)
            .setPositiveButton("OK", null).show();
    }

    private LinearLayout panel(boolean gradient) {
        LinearLayout view = vertical();
        view.setPadding(dp(16), dp(17), dp(16), dp(17));
        if (gradient) {
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    new int[]{Color.rgb(66, 44, 116), Color.rgb(29, 30, 54)});
            bg.setCornerRadius(dp(18));
            view.setBackground(bg);
        } else {
            view.setBackground(round(SURFACE, 15));
        }
        return view;
    }
    private TextView label(String text, int size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(size);
        v.setTextColor(color);
        v.setLineSpacing(dp(3), 1.0f);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }
    private Button button(String title, int background, int foreground, int textSize) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(title);
        b.setTextColor(foreground);
        b.setTextSize(textSize);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackground(round(background, 12));
        b.setMinHeight(dp(48));
        return b;
    }
    private LinearLayout vertical() {
        LinearLayout v = new LinearLayout(this);
        v.setOrientation(LinearLayout.VERTICAL);
        return v;
    }
    private LinearLayout horizontal() {
        LinearLayout v = new LinearLayout(this);
        v.setOrientation(LinearLayout.HORIZONTAL);
        return v;
    }
    private View space(int height) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(height)));
        return v;
    }
    private GradientDrawable round(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        return drawable;
    }
    private int dp(int px) { return Math.round(px * getResources().getDisplayMetrics().density); }
}
