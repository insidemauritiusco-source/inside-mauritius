package org.example.darkwebnavigator;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** URL templates only. Search requests go directly through official Tor Browser. */
public final class SearchProvider {
    public static final String[] NAMES = {"DuckDuckGo", "Brave Search", "Startpage"};
    private SearchProvider() { }

    public static String build(int engine, String query) {
        if (query == null || query.trim().isEmpty()) throw new IllegalArgumentException("Empty search query");
        if (query.length() > 1000) throw new IllegalArgumentException("Search too long");
        String q = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
        switch (engine) {
            case 1: return "https://search.brave.com/search?q=" + q;
            case 2: return "https://www.startpage.com/sp/search?query=" + q;
            default: return "https://duckduckgo.com/?q=" + q;
        }
    }

    public static boolean isSearch(String raw) {
        if (raw == null) return false;
        String v = raw.trim();
        return !v.contains("://") && (v.contains(" ") || !v.contains("."));
    }
}
