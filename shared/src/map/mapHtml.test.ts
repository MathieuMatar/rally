import { describe, expect, it } from 'vitest';
import { buildMapHtml, MAP_CATEGORY_COLORS } from './mapHtml';

describe('buildMapHtml', () => {
  it('embeds Leaflet, the category color map, and the postMessage protocol handlers', () => {
    const html = buildMapHtml();

    expect(html).toContain('leaflet.js');
    expect(html).toContain('leaflet.css');
    expect(html).toContain(JSON.stringify(MAP_CATEGORY_COLORS));
    expect(html).toContain("addEventListener('message'");
    expect(html).toContain("type === 'init'");
    expect(html).toContain("type === 'trail'");
    expect(html).toContain("type === 'pins'");
    expect(html).toContain("notifyHost({ type: 'ready' })");
  });
});
