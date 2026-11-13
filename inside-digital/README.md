# Inside Digital

An original, Microsoft-inspired *product showcase* built as a standalone static microsite with Inside Digital's own branding and content.

## Preview

Open `inside-digital/index.html` in any modern browser. All assets use relative paths. When this branch is merged to GitHub Pages, its intended location is `https://mr.insidemauritius.com/inside-digital/`, assuming the current GitHub Pages configuration continues to publish from the repository root.

## Features

- Responsive homepage with sticky navigation, mobile menu, custom visuals, and accessible skip link
- Product collection featuring Inside Mauritius, LinkBook, Virelo, and Island Hearts
- Client-side search and category filters with an accessible status announcement and empty state
- Native product-details dialogs with clear descriptions of each project's status
- FAQ, contact mailto, and reduced-motion support
- No account collection, tracking, backend dependencies, or direct Microsoft content or assets
- Responsive-grid overflow fixes, 44px navigation/details touch targets, scrollable product dialogs, and improved mobile-menu dismissal

## Manual test checklist

1. On mobile, open and close the navigation using its button, a navigation link, tapping outside, and Escape; verify focus returns to the toggle after Escape.
2. Search `LinkBook`, then `no match`; verify the filter and reset states.
3. Select Media, Social, and Creative tabs; check card counts and aria-pressed.
4. Open product details and close via button, Escape and backdrop.
5. Visit Inside Mauritius's external site; check the new tab and safe rel attributes.
6. Check keyboard tabbing, visible focus styles, desktop 1440px, mobile 360px, and console errors.
7. Check widths 360px, 820px, 1024px, and 1440px, especially Solutions, Vision, and FAQ for unwanted horizontal scrolling; open a long dialog on a short-height screen.
8. Verify unaffected existing homepage and news updates before approving merge.

## Important

This is a **showcase**, not a clone of Microsoft and not a replacement for Microsoft 365, Windows, Azure, Copilot, or their live applications. The product names here refer to separate ongoing projects; this page does not claim that they are publicly launched or their backends are available.

**Deployment safety:** the existing `index.html`, `CNAME`, and news scripts are unchanged by this PR. Do not merge until reviewed and tested.
