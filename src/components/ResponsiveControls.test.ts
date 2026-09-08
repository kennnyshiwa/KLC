import { describe, expect, it } from 'vitest';
// @ts-expect-error -- Vitest runs this regression in Node; production code does not require Node types.
import { readFileSync } from 'node:fs';

const styles = readFileSync('src/index.css', 'utf8');
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 768px)'));

describe('mobile control reachability', () => {
  it('wraps both header controls and groups of toolbar controls at narrow widths', () => {
    expect(mobileStyles).toMatch(/\.app-header\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(mobileStyles).toMatch(/\.header-right\s*\{[^}]*width:\s*100%/);
    expect(mobileStyles).toMatch(/\.header-right\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(mobileStyles).toMatch(/\.user-menu-guest,\s*\.toolbar-group\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(mobileStyles).toMatch(/\.menu-bar\s*\{[^}]*flex-wrap:\s*wrap[^}]*height:\s*auto/);
  });
});
