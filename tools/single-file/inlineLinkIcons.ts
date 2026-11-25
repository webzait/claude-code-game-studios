import type { Plugin } from 'vite';

/**
 * The single-file build inlines scripts and styles (vite-plugin-singlefile), but Vite writes the
 * images that index.html's `<link rel="icon">` and `<link rel="apple-touch-icon">` point at as
 * files next to the page. This puts them into the page as data URLs and drops the files, so the
 * single file carries its own tab and home-screen icon.
 */

/** Media types of the icon files this handles. */
const TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml' };

/** The media type for a file name, or null when it is not an icon file this inlines. */
export function iconType(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return TYPES[ext] ?? null;
}

/**
 * Replaces the href of every icon `<link>` in `html` that points at one of `files` (keyed by the
 * file name as written next to the page) with a base64 data URL. Returns the new html and the
 * names of the files it inlined. Hrefs that match no file are left alone.
 */
export function inlineLinkIcons(html: string, files: ReadonlyMap<string, Uint8Array>): { html: string; inlined: string[] } {
  const inlined: string[] = [];
  const out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*"(?:icon|shortcut icon|apple-touch-icon)"/i.test(tag)) return tag;
    return tag.replace(/\bhref\s*=\s*"([^"]+)"/i, (attr, href: string) => {
      const name = href.replace(/^\.?\//, '');
      const bytes = files.get(name);
      const type = iconType(name);
      if (!bytes || !type) return attr;
      if (!inlined.includes(name)) inlined.push(name);
      return `href="data:${type};base64,${Buffer.from(bytes).toString('base64')}"`;
    });
  });
  return { html: out, inlined };
}

/** Vite plugin for the single-file build: inline the page's link icons and remove their files. */
export function inlineLinkIconsPlugin(): Plugin {
  return {
    name: 'turnflock-inline-link-icons',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = new Map<string, Uint8Array>();
      for (const item of Object.values(bundle)) {
        if (item.type === 'asset' && typeof item.source !== 'string' && iconType(item.fileName)) files.set(item.fileName, item.source);
      }
      for (const item of Object.values(bundle)) {
        if (item.type !== 'asset' || !item.fileName.endsWith('.html')) continue;
        const html = typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
        const result = inlineLinkIcons(html, files);
        item.source = result.html;
        // Only files no other page or script still needs: every icon here is referenced from the page alone.
        for (const name of result.inlined) delete bundle[name];
      }
    },
  };
}
