package org.example.darkwebnavigator;

import java.net.IDN;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/** Pure-Java URL validation; intentionally allows no custom schemes or local files. */
public final class UrlPolicy {
    private static final Pattern V3_ONION = Pattern.compile("^[a-z2-7]{56}\\.onion$");
    private static final Pattern PUBLIC_HOST = Pattern.compile("^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$");
    private UrlPolicy() { }
    public static final class Result {
        public final boolean valid;
        public final String url;
        public final String error;
        private Result(boolean valid, String url, String error) {
            this.valid = valid; this.url = url; this.error = error;
        }
        static Result ok(String url) { return new Result(true, url, null); }
        static Result err(String error) { return new Result(false, null, error); }
    }
    public static Result resolve(String input) {
        if (input == null || input.trim().isEmpty()) return Result.err("Type an address or search terms.");
        String text = input.trim();
        if (text.length() > 2048) return Result.err("Address is too long.");
        if (text.contains("\n") || text.contains("\r") || text.contains("\t"))
            return Result.err("Unsupported characters in address.");
        if (text.contains(" ")) return search(text);
        if (text.startsWith("//") || text.startsWith("\\")) return Result.err("Invalid URL.");
        if (!text.contains("://")) {
            if (text.contains(":")) return Result.err("Only HTTPS or v3 .onion links are supported.");
            if (text.indexOf('.') < 0) return search(text);
            text = (text.toLowerCase(Locale.ROOT).contains(".onion") ? "http://" : "https://") + text;
        }
        try {
            URI uri = new URI(text);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http")))
                return Result.err("Only HTTPS or v3 .onion links are supported.");
            if (uri.getRawUserInfo() != null) return Result.err("Addresses with embedded credentials are blocked.");
            String hostname = uri.getHost();
            if (hostname == null) return Result.err("Enter a valid hostname.");
            String host = IDN.toASCII(hostname.toLowerCase(Locale.ROOT), IDN.USE_STD3_ASCII_RULES);
            if (host.endsWith(".onion")) {
                if (!V3_ONION.matcher(host).matches())
                    return Result.err("Use a valid 56-character v3 .onion address.");
            } else {
                if (!scheme.equalsIgnoreCase("https")) return Result.err("Regular websites must use HTTPS.");
                if (!PUBLIC_HOST.matcher(host).matches() || !host.contains(".") || host.contains(".."))
                    return Result.err("Use a valid public HTTPS website.");
                if (host.equals("localhost") || host.endsWith(".local"))
                    return Result.err("Local network addresses are blocked.");
            }
            return Result.ok(uri.toASCIIString());
        } catch (URISyntaxException | IllegalArgumentException ex) {
            return Result.err("Invalid address. Check the spelling.");
        }
    }
    private static Result search(String words) {
        return Result.ok("https://duckduckgo.com/?q=" + URLEncoder.encode(words, StandardCharsets.UTF_8));
    }
}
