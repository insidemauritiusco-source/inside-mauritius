package org.example.darkwebnavigator;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;

/**
 * Dark Web Navigator Pro v2.0
 *
 * A no-network-permission launcher for official Tor Browser, NOT a standalone
 * Tor client. Bookmarks are encrypted in Android Keystore and can only be
 * accessed after device PIN/password/fingerprint authentication.
 */
public final class MainActivity extends Activity {
    private static final String TOR = "org.torproject.torbrowser";
    private static final String TOR_STORE = "https://play.google.com/store/apps/details?id=" + TOR;
    private static final String PREFS = "local_private_settings";
    private static final String RECENT_KEY = "recent_opened_v1";
    private static final String RECENT_OPT_IN = "remember_opened";
    private static final String ENGINE = "search_provider_v2";
    private static final String DARK = "theme_dark_v2";
    private static final int MAX_RECENTS = 12;
    private static final int MAX_BOOKMARKS = 60;
    private static final int DEVICE_AUTH_REQUEST = 221;
    private static final long AUTH_WINDOW_MS = 115_000L;

    private SharedPreferences prefs;
    private BookmarkVault vault;
    private LinearLayout body;
    private TextView status;
    private EditText address;
    private String page = "home";
    private long unlockedUntil = 0L;
    private boolean authenticating = false;
    private Runnable pendingProtectedAction;
    private CancellationSignal cancelSignal;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        vault = new BookmarkVault(this);
        render();
    }

    @Override public void onResume() {
        super.onResume();
        if (status != null) {
            status.setText(installed() ? "● TOR BROWSER INSTALLED" : "● INSTALL TOR BROWSER");
        }
        if (!authenticating && "saved".equals(page) && !isUnlocked() && body != null) render();
    }

    @Override protected void onStop() {
        super.onStop();
        if (!authenticating) {
            unlockedUntil = 0L;
            if ("saved".equals(page)) render();
        }
    }

    private boolean isUnlocked() {
        return unlockedUntil > SystemClock.elapsedRealtime();
    }

    private boolean dark() {
        return prefs.getBoolean(DARK, true);
    }
    private int bg() { return dark() ? 0xFF0E1020 : 0xFFF6F5FB; }
    private int card() { return dark() ? 0xFF24243F : 0xFFFFFFFF; }
    private int elevated() { return dark() ? 0xFF333252 : 0xFFEDE9F9; }
    private int primary() { return dark() ? 0xFFAD94FF : 0xFF6540CB; }
    private int primaryText() { return dark() ? 0xFF17122B : Color.WHITE; }
    private int fg() { return dark() ? 0xFFF7F6FF : 0xFF21192D; }
    private int muted() { return dark() ? 0xFFBCB9D5 : 0xFF625A73; }
    private int good() { return dark() ? 0xFF88EDC7 : 0xFF08785B; }

    private void render() {
        int navcolor = bg();
        getWindow().setStatusBarColor(navcolor);
        getWindow().setNavigationBarColor(navcolor);
        int ui = dark() ? 0 :
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(ui);
        if ("saved".equals(page) && isUnlocked()) {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(bg());
        scroll.setFillViewport(true);
        LinearLayout root = vertical();
        root.setPadding(dp(18), dp(24), dp(18), dp(28));
        scroll.addView(root);
        setContentView(scroll);

        LinearLayout brand = horizontal();
        brand.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo = text("◆", 28, primary(), true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(round(elevated(), 16));
        brand.addView(logo, new LinearLayout.LayoutParams(dp(55), dp(55)));
        LinearLayout names = vertical();
        LinearLayout.LayoutParams namesLp = new LinearLayout.LayoutParams(0, -2, 1);
        namesLp.leftMargin = dp(12);
        brand.addView(names, namesLp);
        names.addView(text("DARK WEB NAVIGATOR", 20, fg(), true));
        names.addView(text("PRO 2.0  ·  PRIVACY COMPANION", 11, muted(), true));
        root.addView(brand);
        root.addView(space(15));
        status = text(installed() ? "● TOR BROWSER INSTALLED" :
                "● INSTALL TOR BROWSER", 12, good(), true);
        root.addView(status);
        root.addView(space(17));

        LinearLayout nav = horizontal();
        addTab(nav, "HOME", "home");
        addTab(nav, "SAVED", "saved");
        addTab(nav, "PRIVACY", "privacy");
        addTab(nav, "LEGAL", "legal");
        root.addView(nav);
        root.addView(space(19));
        body = vertical();
        root.addView(body);

        if ("saved".equals(page)) renderSaved();
        else if ("privacy".equals(page)) renderPrivacy();
        else if ("legal".equals(page)) renderLegal();
        else renderHome();

        body.addView(space(24));
        body.addView(text("Independent companion app · Not affiliated with the Tor Project or the Mauritius government. Sites open only inside the official Tor Browser.", 12, muted(), false));
    }

    private void addTab(LinearLayout container, String name, String target) {
        boolean current = target.equals(page);
        Button b = button(name, current ? primary() : card(),
                current ? primaryText() : muted(), 10);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(43), 1);
        lp.rightMargin = dp(4);
        container.addView(b, lp);
        b.setOnClickListener(v -> {
            if (!target.equals("saved")) unlockedUntil = 0L;
            address = null;
            page = target;
            render();
        });
    }

    private void renderHome() {
        LinearLayout hero = box(true);
        hero.addView(text("Secure starting point", 23, Color.WHITE, true));
        hero.addView(space(6));
        hero.addView(text("One place to open trusted websites and private .onion links through Tor Browser.", 14, 0xFFF1EAFF, false));
        hero.addView(space(15));
        Button tor = button("OPEN OFFICIAL TOR BROWSER  ↗", 0xFFE5D6FF, 0xFF2C1857, 13);
        hero.addView(tor);
        tor.setOnClickListener(v -> launchTor());
        body.addView(hero);
        body.addView(space(22));

        body.addView(text("Search or enter a link", 18, fg(), true));
        body.addView(space(9));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(15);
        address.setTextColor(fg());
        address.setHintTextColor(muted());
        address.setHint("Search or enter https:// or .onion");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setPadding(dp(14),dp(12),dp(14),dp(12));
        address.setBackground(round(card(), 14));
        body.addView(address, new LinearLayout.LayoutParams(-1, dp(56)));
        address.setOnEditorActionListener((field,action,event) -> {
            if (action == EditorInfo.IME_ACTION_GO) { openTyped(); return true; }
            return false;
        });
        body.addView(space(14));
        body.addView(text("Search engine", 15, fg(), true));
        body.addView(space(7));
        LinearLayout engines = horizontal();
        int current = prefs.getInt(ENGINE, 0);
        for (int i = 0; i < SearchProvider.NAMES.length; i++) {
            final int index = i;
            Button button = button(SearchProvider.NAMES[i],
                    current == i ? primary() : elevated(),
                    current == i ? primaryText() : fg(), 11);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(42), 1);
            lp.rightMargin = dp(5);
            engines.addView(button, lp);
            button.setOnClickListener(v -> { prefs.edit().putInt(ENGINE,index).apply(); render(); });
        }
        body.addView(engines);
        body.addView(space(12));
        Button go = button("SEARCH / OPEN LINK IN TOR", primary(), primaryText(), 13);
        body.addView(go);
        go.setOnClickListener(v -> openTyped());
        body.addView(space(9));
        Button save = button("☆  SAVE ADDRESS WITH PHONE LOCK", elevated(), fg(), 12);
        body.addView(save);
        save.setOnClickListener(v -> saveTyped());
        body.addView(space(12));
        body.addView(text("Searches run in Tor Browser. The selected provider may still record searches. No search traffic is sent directly from this app.", 12, muted(), false));

        body.addView(space(26));
        body.addView(text("Trusted Tor resources", 17, fg(), true));
        body.addView(space(9));
        addLink("Check Tor connection", "Verify Tor routing in the official browser",
                "https://check.torproject.org/");
        addLink("Tor Project", "Official Tor Browser downloads and news",
                "https://www.torproject.org/");
        addLink("Tor Browser security", "Official guidance on Safer and Safest levels",
                "https://support.torproject.org/tor-browser/features/security-levels/");

        body.addView(space(21));
        body.addView(text("Recent links from this launcher", 17, fg(), true));
        body.addView(space(7));
        if (!prefs.getBoolean(RECENT_OPT_IN, false)) {
            body.addView(text("Not recorded. Optional recent links are off by default.", 13, muted(), false));
        } else {
            JSONArray list = readRecents();
            if (list.length() == 0) body.addView(text("No recent links saved.", 13, muted(), false));
            for (int i = list.length() - 1; i >= 0; i--) {
                String url = list.optString(i);
                addLink("Recently opened", shorten(url), url);
            }
        }
    }

    private void renderSaved() {
        body.addView(text("Protected bookmarks", 23, fg(), true));
        body.addView(space(8));
        body.addView(text("Encrypted locally using Android Keystore. Unlock with your phone's fingerprint or screen-lock PIN/password.", 13, muted(), false));
        body.addView(space(19));
        if (!isUnlocked()) {
            LinearLayout lock = box(false);
            lock.addView(text("🔒  Bookmarks locked", 20, fg(), true));
            lock.addView(space(8));
            lock.addView(text("Your saved links remain hidden until device authentication succeeds. On Android, the system handles your credentials.", 13, muted(), false));
            if (vault.hasLegacyBookmarks()) {
                lock.addView(space(11));
                lock.addView(text("Older v1.1 bookmarks will be encrypted when you unlock successfully.", 12, muted(), false));
            }
            lock.addView(space(15));
            Button unlock = button("UNLOCK WITH DEVICE SECURITY", primary(), primaryText(), 13);
            lock.addView(unlock);
            unlock.setOnClickListener(v -> withVaultAccess(() -> render()));
            body.addView(lock);
            return;
        }

        try {
            JSONArray entries = vault.load();
            if (entries.length() == 0) {
                LinearLayout empty = box(false);
                empty.addView(text("Nothing saved yet", 18, fg(), true));
                empty.addView(space(7));
                empty.addView(text("In Home, enter a website address, then tap Save Address with Phone Lock.", 13, muted(), false));
                body.addView(empty);
                return;
            }
            for (int i = 0; i < entries.length(); i++) {
                final int index = i;
                String url = entries.optString(i);
                LinearLayout item = box(false);
                item.addView(text(shorten(url), 15, fg(), true));
                item.addView(space(6));
                item.addView(text(url, 12, muted(), false));
                item.addView(space(12));
                LinearLayout row = horizontal();
                Button open = button("OPEN IN TOR", primary(), primaryText(), 12);
                Button del = button("REMOVE", elevated(), fg(), 12);
                LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(43), 2);
                p.rightMargin = dp(7);
                row.addView(open, p);
                row.addView(del, new LinearLayout.LayoutParams(0, dp(43), 1));
                open.setOnClickListener(v -> openInTor(url));
                del.setOnClickListener(v -> new AlertDialog.Builder(this)
                        .setTitle("Remove bookmark?")
                        .setMessage("Delete this saved link from Dark Web Navigator?")
                        .setPositiveButton("REMOVE", (dialog, which) -> {
                            try {
                                JSONArray current = vault.load();
                                JSONArray updated = new JSONArray();
                                for (int j = 0; j < current.length(); j++) {
                                    if (j != index) updated.put(current.optString(j));
                                }
                                vault.persist(updated);
                                render();
                            } catch (Exception ex) { vaultError(ex); }
                        })
                        .setNegativeButton("CANCEL", null).show());
                item.addView(row);
                body.addView(item);
                body.addView(space(11));
            }
        } catch (Exception ex) { vaultError(ex); }
    }

    private void renderPrivacy() {
        body.addView(text("Privacy & Security Center", 22, fg(), true));
        body.addView(space(9));
        body.addView(text("On-device controls for Dark Web Navigator. Tor Browser has separate privacy settings and site data.", 13, muted(), false));
        body.addView(space(18));

        LinearLayout connection = box(false);
        connection.addView(text("Connection & security", 18, fg(), true));
        connection.addView(space(10));
        connection.addView(text(installed() ? "● Official Tor Browser detected" : "● Tor Browser not installed", 14, good(), true));
        connection.addView(space(8));
        connection.addView(text("Only the Tor Project check website can confirm your current Tor connection. This app cannot inspect connections.", 13, muted(), false));
        connection.addView(space(11));
        Button check = button("CHECK CONNECTION IN TOR", primary(), primaryText(), 12);
        connection.addView(check);
        check.setOnClickListener(v -> openInTor("https://check.torproject.org/"));
        connection.addView(space(9));
        Button security = button("TOR SECURITY LEVEL INSTRUCTIONS", elevated(), fg(), 12);
        connection.addView(security);
        security.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setTitle("Tor Browser security level")
            .setMessage("In Tor Browser, tap the three-dot menu, then Settings → Privacy and security → Security Level. Choose Standard, Safer or Safest and save. Higher levels may break websites.")
            .setPositiveButton("OPEN TOR", (dialog,which) -> launchTor())
            .setNegativeButton("CLOSE", null).show());
        body.addView(connection);
        body.addView(space(13));

        LinearLayout history = box(false);
        history.addView(text("Optional launcher recents", 17, fg(), true));
        history.addView(space(5));
        history.addView(text("Off by default. When enabled, only the last 12 links launched from this app are stored locally. This is NOT Tor Browser history.", 12, muted(), false));
        Switch remember = new Switch(this);
        remember.setText("Remember recently opened links");
        remember.setTextColor(fg());
        remember.setTextSize(13);
        remember.setChecked(prefs.getBoolean(RECENT_OPT_IN, false));
        history.addView(space(10));
        history.addView(remember);
        remember.setOnCheckedChangeListener((view, value) -> {
            SharedPreferences.Editor editor = prefs.edit().putBoolean(RECENT_OPT_IN,value);
            if (!value) editor.remove(RECENT_KEY);
            editor.apply();
            Toast.makeText(this, value ? "Launcher recents enabled" : "Launcher recents deleted and disabled", Toast.LENGTH_SHORT).show();
        });
        history.addView(space(9));
        Button clear = button("CLEAR LAUNCHER RECENTS", elevated(), fg(), 12);
        history.addView(clear);
        clear.setOnClickListener(v -> confirm("Clear launcher recents?", "Delete recent links stored only by this app?", () -> {
            prefs.edit().remove(RECENT_KEY).apply();
            Toast.makeText(this, "Launcher recents cleared", Toast.LENGTH_SHORT).show();
        }));
        body.addView(history);
        body.addView(space(13));

        LinearLayout appearance = box(false);
        appearance.addView(text("Appearance", 17, fg(), true));
        appearance.addView(space(7));
        Switch theme = new Switch(this);
        theme.setText("Dark theme");
        theme.setTextColor(fg());
        theme.setTextSize(13);
        theme.setChecked(dark());
        appearance.addView(theme);
        theme.setOnCheckedChangeListener((view, value) -> {
            prefs.edit().putBoolean(DARK,value).apply(); render();
        });
        body.addView(appearance);
        body.addView(space(13));

        LinearLayout bookmarks = box(false);
        bookmarks.addView(text("Protected bookmarks", 17, fg(), true));
        bookmarks.addView(space(6));
        bookmarks.addView(text("Bookmarks use AES-GCM encryption and Android Keystore. Device PIN, password or supported fingerprint is needed to unlock them.", 12, muted(), false));
        bookmarks.addView(space(10));
        Button lock = button("LOCK BOOKMARKS NOW", elevated(), fg(), 12);
        bookmarks.addView(lock);
        lock.setOnClickListener(v -> {
            unlockedUntil = 0L;
            Toast.makeText(this, "Bookmark view locked", Toast.LENGTH_SHORT).show();
        });
        bookmarks.addView(space(9));
        Button clearBookmarks = button("DELETE ALL BOOKMARKS", elevated(), fg(), 12);
        bookmarks.addView(clearBookmarks);
        clearBookmarks.setOnClickListener(v -> confirm("Delete protected bookmarks?", "This permanently deletes all bookmarks saved in this app.", () ->
            withVaultAccess(() -> {
                vault.deleteAllBookmarks();
                unlockedUntil=0L;
                Toast.makeText(this, "Protected bookmarks deleted", Toast.LENGTH_SHORT).show();
            })
        ));
        body.addView(bookmarks);
        body.addView(space(13));

        LinearLayout info = box(false);
        info.addView(text("Important privacy boundaries", 16, fg(), true));
        info.addView(space(8));
        info.addView(text("✓ This launcher has no Internet permission\n✓ All links launch official Tor Browser\n✓ Only optional launcher recents and protected bookmarks are stored here\n✕ Does not encrypt Tor traffic independently\n✕ Cannot clear Tor Browser cookies, tabs or history", 13, muted(), false));
        body.addView(info);
    }

    private void renderLegal() {
        body.addView(text("Mauritius legal research", 22, fg(), true));
        body.addView(space(7));
        body.addView(text("Official public-service and legal research links. These are normal HTTPS government websites, not anonymous document marketplaces.", 13, muted(), false));
        body.addView(space(19));
        addLink("Registrar-General e-Registry", "Registered deeds, mortgage searches and other property services",
                "https://registrar.govmu.org/rgd/index.php/online-services/");
        addLink("RGD forms and applications", "Official registrar forms and guidance",
                "https://registrar.govmu.org/rgd/index.php/forms/");
        addLink("Revised Laws of Mauritius", "Attorney-General's official legal portal",
                "https://lawsofmauritius.govmu.org/portal/");
        addLink("Supreme Court e-Judiciary", "Public judicial information and registered services",
                "https://ejudiciary.govmu.org/");
        addLink("Mauritius Assembly Hansard", "Official National Assembly debates and records",
                "https://mauritiusassembly.govmu.org/mauritiusassembly/index.php/hansard/");
        body.addView(space(14));
        body.addView(text("For a certified property deed or mortgage record, follow the Registrar-General's authorised application and search procedures. This app does not create or issue government documents.", 13, muted(), false));
    }

    private void openTyped() {
        String raw = address.getText().toString().trim();
        if (raw.isEmpty()) { alert("Enter a search or URL","Type an HTTPS website, full .onion address or search phrase."); return; }
        if (SearchProvider.isSearch(raw)) {
            try { openInTor(SearchProvider.build(prefs.getInt(ENGINE,0),raw)); }
            catch (IllegalArgumentException ex) { alert("Invalid search",ex.getMessage()); }
            return;
        }
        UrlPolicy.Result result = UrlPolicy.resolve(raw);
        if (!result.valid) { alert("Check address", result.error); return; }
        openInTor(result.url);
    }

    private void saveTyped() {
        String raw = address.getText().toString().trim();
        if (SearchProvider.isSearch(raw)) {
            alert("Bookmark a website", "Enter a complete website address to save, not a search phrase."); return;
        }
        UrlPolicy.Result result = UrlPolicy.resolve(raw);
        if (!result.valid) { alert("Check address",result.error); return; }
        withVaultAccess(() -> {
            try {
                JSONArray bookmarks = vault.load();
                if (BookmarkVault.includes(bookmarks, result.url)) {
                    toast("This website is already bookmarked"); return;
                }
                if (bookmarks.length() >= MAX_BOOKMARKS) {
                    alert("Bookmark limit", "You may save up to 60 bookmarks."); return;
                }
                bookmarks.put(result.url);
                vault.persist(bookmarks);
                toast("Protected bookmark saved");
            } catch (Exception ex) { vaultError(ex); }
        });
    }

    /** Always use the system biometric or phone lock prompt. Never ask for a PIN inside this app. */
    private void withVaultAccess(Runnable action) {
        if (isUnlocked()) { action.run(); return; }
        KeyguardManager manager = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (manager == null || !manager.isDeviceSecure()) {
            new AlertDialog.Builder(this)
                .setTitle("Set a phone screen lock first")
                .setMessage("Protected bookmarks require your Android PIN, password or supported fingerprint. Set a screen lock in Android Settings, then return.")
                .setPositiveButton("SETTINGS", (dialog,which) ->
                    startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS)))
                .setNegativeButton("CANCEL",null).show();
            return;
        }
        try {
            vault.prepareKey();
        } catch (Exception ex) {
            vaultError(ex); return;
        }
        pendingProtectedAction = action;
        authenticating = true;

        if (Build.VERSION.SDK_INT >= 29) {
            try {
                BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("Unlock protected bookmarks")
                    .setSubtitle("Fingerprint or phone screen lock")
                    .setDeviceCredentialAllowed(true)
                    .build();
                authenticate(prompt);
                return;
            } catch (RuntimeException ignored) {
                // OS biometrics unavailable. Fall back to Android device credential.
            }
        }
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("Unlock protected bookmarks")
                    .setSubtitle("Use fingerprint or your phone screen lock")
                    .setNegativeButton("USE PHONE PIN", getMainExecutor(),
                        (dialog,which) -> launchPhoneLock())
                    .build();
                authenticate(prompt);
                return;
            } catch (RuntimeException ignored) {
                // Use KeyguardManager fallback on older phones.
            }
        }
        launchPhoneLock();
    }

    private void authenticate(BiometricPrompt prompt) {
        cancelSignal = new CancellationSignal();
        prompt.authenticate(cancelSignal, getMainExecutor(),
            new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    completeUnlock();
                }
                @Override public void onAuthenticationError(int errorCode, CharSequence errString) {
                    if (authenticating) {
                        authenticating = false;
                        pendingProtectedAction = null;
                        toast("Authentication not completed");
                    }
                }
            });
    }

    private void launchPhoneLock() {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        Intent intent = km == null ? null :
            km.createConfirmDeviceCredentialIntent("Unlock protected bookmarks", "Confirm your phone screen lock");
        if (intent == null) {
            authenticating = false;
            pendingProtectedAction = null;
            alert("Screen lock unavailable", "Set a secure phone PIN or password in Android Settings.");
            return;
        }
        try { startActivityForResult(intent, DEVICE_AUTH_REQUEST); }
        catch (ActivityNotFoundException ex) {
            authenticating = false;
            pendingProtectedAction = null;
            alert("Screen lock unavailable", "Use your phone Settings to configure a secure screen lock.");
        }
    }

    @Override protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req,result,data);
        if (req == DEVICE_AUTH_REQUEST) {
            if (result == RESULT_OK) completeUnlock();
            else { authenticating = false; pendingProtectedAction = null; }
        }
    }

    private void completeUnlock() {
        authenticating = false;
        unlockedUntil = SystemClock.elapsedRealtime() + AUTH_WINDOW_MS;
        Runnable next = pendingProtectedAction;
        pendingProtectedAction = null;
        if (next != null) next.run();
    }

    private void vaultError(Exception e) {
        unlockedUntil = 0L;
        alert("Bookmark security issue", "Couldn't access the protected bookmark vault. Verify your device screen lock and try again. Existing encrypted bookmarks were not intentionally deleted.");
    }

    private void addLink(String title, String subtitle, String url) {
        LinearLayout card = box(false);
        card.addView(text(title, 15, fg(), true));
        card.addView(space(5));
        card.addView(text(subtitle, 12, muted(), false));
        card.setOnClickListener(v -> openInTor(url));
        body.addView(card);
        body.addView(space(9));
    }

    private void openInTor(String url) {
        UrlPolicy.Result valid = UrlPolicy.resolve(url);
        if (!valid.valid) { alert("Blocked address",valid.error); return; }
        if (!installed()) { offerInstall(); return; }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(valid.url));
        intent.setPackage(TOR);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
            if (prefs.getBoolean(RECENT_OPT_IN,false)) saveRecent(valid.url);
        } catch (ActivityNotFoundException | SecurityException ex) {
            new AlertDialog.Builder(this)
              .setTitle("Open Tor Browser manually")
              .setMessage("The installed Tor Browser did not accept this link. It was not sent to Chrome or another browser.")
              .setPositiveButton("OPEN TOR",(dialog,which)->launchTor())
              .setNegativeButton("CANCEL",null).show();
        }
    }

    private void saveRecent(String url) {
        JSONArray list = readRecents();
        JSONArray unique = new JSONArray();
        for (int i = 0; i < list.length(); i++)
            if (!url.equals(list.optString(i))) unique.put(list.optString(i));
        unique.put(url);
        JSONArray trimmed = new JSONArray();
        for (int i = Math.max(0, unique.length()-MAX_RECENTS); i < unique.length(); i++)
            trimmed.put(unique.optString(i));
        prefs.edit().putString(RECENT_KEY,trimmed.toString()).apply();
    }

    private JSONArray readRecents() {
        try { return new JSONArray(prefs.getString(RECENT_KEY,"[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    private void confirm(String title, String message, Runnable action) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(message)
            .setPositiveButton("DELETE",(d,w)->action.run())
            .setNegativeButton("CANCEL",null).show();
    }

    private boolean installed() {
        try { getPackageManager().getPackageInfo(TOR,0); return true; }
        catch (Exception ex) { return false; }
    }
    private void launchTor() {
        if (!installed()) { offerInstall(); return; }
        Intent i = getPackageManager().getLaunchIntentForPackage(TOR);
        if (i == null) { alert("Tor Browser", "Open Tor Browser from your app list."); return; }
        try { startActivity(i); }
        catch (ActivityNotFoundException | SecurityException e) {
            alert("Tor Browser", "Unable to launch Tor Browser.");
        }
    }
    private void offerInstall() {
        new AlertDialog.Builder(this).setTitle("Official Tor Browser required")
            .setMessage("Install the official Tor Browser for your private browsing and .onion access.")
            .setPositiveButton("PLAY STORE",(d,w)->{
                try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+TOR))); }
                catch (ActivityNotFoundException ex) {
                    startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(TOR_STORE)));
                }
            }).setNegativeButton("CANCEL",null).show();
    }

    private String shorten(String url) {
        try {
            String host=Uri.parse(url).getHost();
            if (host != null) {
                if (host.endsWith(".onion")) return "Private .onion address";
                return host;
            }
        } catch (Exception ignored) { }
        return url.length() <= 48 ? url : url.substring(0,48)+"…";
    }

    private void alert(String title,String msg) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(msg)
            .setPositiveButton("OK",null).show();
    }
    private void toast(String value) {
        Toast.makeText(this,value,Toast.LENGTH_SHORT).show();
    }
    private LinearLayout box(boolean hero) {
        LinearLayout b=vertical();
        b.setPadding(dp(16),dp(16),dp(16),dp(16));
        if(hero) {
            GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    new int[]{0xFF5430A2,0xFF28234B});
            g.setCornerRadius(dp(19));
            b.setBackground(g);
        } else b.setBackground(round(card(),15));
        return b;
    }
    private TextView text(String value,int size,int color,boolean bold) {
        TextView v=new TextView(this);
        v.setText(value);
        v.setTextSize(size);
        v.setTextColor(color);
        v.setLineSpacing(dp(3),1f);
        if(bold) v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return v;
    }
    private Button button(String text,int background,int foreground,int fontSize) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(fontSize);
        b.setTextColor(foreground);
        b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setBackground(round(background,12));
        b.setMinHeight(dp(47));
        return b;
    }
    private LinearLayout vertical() {
        LinearLayout v=new LinearLayout(this);
        v.setOrientation(LinearLayout.VERTICAL);
        return v;
    }
    private LinearLayout horizontal() {
        LinearLayout v=new LinearLayout(this);
        v.setOrientation(LinearLayout.HORIZONTAL);
        return v;
    }
    private View space(int size) {
        View v=new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1,dp(size)));
        return v;
    }
    private GradientDrawable round(int color,int radius) {
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        return d;
    }
    private int dp(int px) {
        return Math.round(px*getResources().getDisplayMetrics().density);
    }
}
