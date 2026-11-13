package org.example.darkwebnavigator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Companion Android interface for the official Tor Browser.
 * Has no INTERNET permission, does not load content, does not store browsing history.
 */
public class MainActivity extends Activity {
    private static final String TOR = "org.torproject.torbrowser";
    private static final String STORE = "https://play.google.com/store/apps/details?id=org.torproject.torbrowser";
    private static final int BG = Color.rgb(14, 13, 25);
    private static final int PANEL = Color.rgb(30, 29, 48);
    private static final int FG = Color.rgb(246, 243, 255);
    private static final int MUTED = Color.rgb(174, 169, 195);
    private static final int PURPLE = Color.rgb(153, 113, 243);
    private EditText address;
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        ScrollView scroller = new ScrollView(this);
        scroller.setFillViewport(true);
        scroller.setBackgroundColor(BG);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(32));
        scroller.addView(root);

        root.addView(label("◈  DARK WEB NAVIGATOR", 24, FG, true));
        root.addView(space(12));
        root.addView(label("A private browsing companion for Android", 15, MUTED, false));
        root.addView(space(25));

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(16), dp(16), dp(16), dp(16));
        panel.setBackground(round(PANEL, 16));
        root.addView(panel);
        status = label("Checking Tor Browser...", 16, FG, true);
        panel.addView(status);
        panel.addView(space(12));
        panel.addView(label("All websites open in the official Tor Browser. This app cannot itself connect to Tor.", 13, MUTED, false));
        panel.addView(space(12));
        Button open = button("OPEN TOR BROWSER", PURPLE, Color.WHITE);
        panel.addView(open);
        open.setOnClickListener(v -> launchTor());

        root.addView(space(24));
        root.addView(label("Website or .onion address", 17, FG, true));
        root.addView(space(10));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(15);
        address.setTextColor(FG);
        address.setHintTextColor(MUTED);
        address.setHint("https://example.org or v3 .onion");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setPadding(dp(14),dp(12),dp(14),dp(12));
        address.setBackground(round(PANEL,12));
        root.addView(address);
        address.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) { openAddress(); return true; }
            return false;
        });
        root.addView(space(10));
        Button go = button("OPEN SAFELY IN TOR", PURPLE, Color.WHITE);
        root.addView(go);
        go.setOnClickListener(v -> openAddress());
        root.addView(space(9));
        root.addView(label("HTTPS websites and 56-character v3 .onion URLs. Other text searches with DuckDuckGo in Tor Browser.", 12, MUTED, false));

        root.addView(space(26));
        root.addView(label("Official resources", 17, FG, true));
        root.addView(space(12));
        Button home = button("TOR PROJECT WEBSITE", PANEL, FG);
        root.addView(home);
        home.setOnClickListener(v -> openInTor("https://www.torproject.org/"));
        root.addView(space(10));
        Button help = button("TOR SAFETY & SUPPORT", PANEL, FG);
        root.addView(help);
        help.setOnClickListener(v -> openInTor("https://support.torproject.org/"));
        root.addView(space(24));
        root.addView(label("Tor reduces tracking but cannot guarantee anonymity. Avoid scams, suspicious downloads and sharing personal information.", 13, MUTED, false));
        setContentView(scroller);
    }

    @Override public void onResume() {
        super.onResume();
        if (status != null) status.setText(installed() ? "● Tor Browser installed" : "● Tor Browser not installed");
    }
    private void openAddress() {
        UrlPolicy.Result result = UrlPolicy.resolve(address.getText().toString());
        if (!result.valid) {
            alert("Check address", result.error);
            return;
        }
        openInTor(result.url);
    }
    private void openInTor(String url) {
        if (!installed()) { offerInstall(); return; }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setPackage(TOR);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try { startActivity(intent); }
        catch (ActivityNotFoundException | SecurityException ex) {
            new AlertDialog.Builder(this).setTitle("Open in Tor Browser")
                .setMessage("This Tor Browser version did not accept the link. Open Tor Browser and enter the address manually. It will not be sent to Chrome.")
                .setPositiveButton("OPEN TOR", (d,w) -> launchTor())
                .setNegativeButton("CANCEL", null).show();
        }
    }
    private boolean installed() {
        try { getPackageManager().getPackageInfo(TOR, 0); return true; }
        catch (Exception ex) { return false; }
    }
    private void launchTor() {
        if (!installed()) { offerInstall(); return; }
        Intent intent = getPackageManager().getLaunchIntentForPackage(TOR);
        if (intent == null) { alert("Tor Browser", "Open Tor Browser manually from your app list."); return; }
        try { startActivity(intent); }
        catch (ActivityNotFoundException | SecurityException ex) {
            alert("Tor Browser", "Could not open Tor Browser from this app.");
        }
    }
    private void offerInstall() {
        new AlertDialog.Builder(this).setTitle("Official Tor Browser required")
            .setMessage("Install the official Tor Browser for .onion and private browsing.")
            .setPositiveButton("PLAY STORE", (d,w) -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + TOR))); }
                catch (ActivityNotFoundException ex) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(STORE))); }
            })
            .setNegativeButton("CANCEL", null).show();
    }
    private void alert(String title, String msg) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(msg)
            .setPositiveButton("OK", null).show();
    }
    private TextView label(String value, int size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value); v.setTextSize(size); v.setTextColor(color);
        v.setLineSpacing(dp(2), 1f);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }
    private Button button(String text, int bg, int fg) {
        Button v = new Button(this);
        v.setText(text); v.setTextColor(fg); v.setTextSize(13);
        v.setAllCaps(false); v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setMinHeight(dp(52)); v.setBackground(round(bg, 13));
        return v;
    }
    private View space(int h) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(h)));
        return v;
    }
    private GradientDrawable round(int color, int radius) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color); g.setCornerRadius(dp(radius));
        return g;
    }
    private int dp(int px) {
        return Math.round(px * getResources().getDisplayMetrics().density);
    }
}
