package org.example.darkwebnavigator;

public class UrlPolicySmokeTest {
    private static void check(boolean ok, String explanation) {
        if (!ok) throw new AssertionError(explanation);
    }
    public static void main(String[] args) {
        check(UrlPolicy.resolve("https://www.torproject.org/").valid, "HTTPS allowed");
        check(!UrlPolicy.resolve("http://example.org").valid, "Non onion http blocked");
        check(!UrlPolicy.resolve("file:///etc/passwd").valid, "file blocked");
        check(!UrlPolicy.resolve("javascript:alert(1)").valid, "script blocked");
        check(!UrlPolicy.resolve("intent://example.com").valid, "intent blocked");
        check(!UrlPolicy.resolve("http://short.onion").valid, "short onion blocked");
        check(!UrlPolicy.resolve("http://"+"0".repeat(56)+".onion").valid,"invalid base32 rejected");
        check(UrlPolicy.resolve("http://"+"b".repeat(56)+".onion").valid,"v3 onion syntactically accepted");
        check(!UrlPolicy.resolve("https://user:password@example.com").valid,"embedded credentials blocked");
        check(SearchProvider.build(0,"hello world").startsWith("https://duckduckgo.com/?q="),"DDG selection");
        check(SearchProvider.build(1,"hello world").startsWith("https://search.brave.com/search?q="),"Brave selection");
        check(SearchProvider.build(2,"hello world").startsWith("https://www.startpage.com/sp/search?query="),"Startpage selection");
        check(SearchProvider.isSearch("mortgage government records"),"search words recognized");
        check(!SearchProvider.isSearch("https://example.com/page"),"URL not search");
        System.out.println("14 URL/search smoke checks passed");
    }
}
