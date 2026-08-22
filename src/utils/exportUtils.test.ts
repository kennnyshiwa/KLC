import { describe, expect, it } from 'vitest';
import type { Keyboard } from '../types';
import { buildKeyboardSVG } from './exportUtils';

describe('buildKeyboardSVG', () => {
  it('renders trashcons legends as glyph text instead of escaped HTML', () => {
    const keyboard: Keyboard = {
      meta: {
        name: 'export-test',
        author: '',
        notes: '',
      },
      keys: [
        {
          id: 'k1',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          color: '#ff5500',
          labels: ['<span class="trashcons icon-enter"></span>'],
          textColor: ['#111111'],
          textSize: [6],
          frontLegends: [],
        },
      ],
    };

    const svg = buildKeyboardSVG(keyboard);

    expect(svg).toContain("font-family: 'trashcons'");
    expect(svg).toContain('<tspan font-family="trashcons">');
    expect(svg).toContain('\ue90e');
    expect(svg).not.toContain('&lt;span class=');
    expect(svg).not.toContain('icon-enter');
  });
});
