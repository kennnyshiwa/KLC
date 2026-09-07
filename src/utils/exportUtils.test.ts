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
    expect(svg).toContain("@font-face { font-family: 'trashcons'; src: url('data:");
    expect(svg).toContain('\ue90e');
    expect(svg).not.toContain('&lt;span class=');
    expect(svg).not.toContain('icon-enter');
  });

  it('positions legends inside the keycap top surface instead of the outer shell', () => {
    const keyboard: Keyboard = {
      meta: {
        name: 'position-test',
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
          color: '#cccccc',
          labels: ['Esc'],
          textColor: ['#111111'],
          textSize: [3],
          frontLegends: [],
        },
      ],
    };

    const svg = buildKeyboardSVG(keyboard);

    expect(svg).toContain('<text x="6.82" y="7.9"');
    expect(svg).not.toContain('<text x="1.06" y="2.6500000000000004"');
  });

  it('exports generated size legends with keycap contrast while preserving user front colors', () => {
    const keyboard: Keyboard = {
      meta: { name: 'front-color-test' },
      keys: [
        {
          id: 'dark-short', x: 0, y: 0, width: 2, height: 1, color: '#111', labels: [''],
          frontLegends: ['', '2u', ''],
          textColor: ['', '', '', '', '', '#ff00ff'],
          sizeLabelProvenance: { slot: 1, appliedValue: '2u' },
        },
        {
          id: 'dark', x: 2, y: 0, width: 2, height: 1, color: '#222222', labels: [''],
          frontLegends: ['', '2u', ''],
          sizeLabelProvenance: { slot: 1, appliedValue: '2u' },
        },
        {
          id: 'light', x: 4, y: 0, width: 2, height: 1, color: '#f5e7c6', labels: [''],
          frontLegends: ['', '2u', ''],
          sizeLabelProvenance: { slot: 1, appliedValue: '2u' },
        },
        {
          id: 'user', x: 6, y: 0, width: 1, height: 1, color: '#222', labels: [''],
          frontLegends: ['USER', '', ''],
          textColor: ['', '', '', '', '#123456'],
        },
      ],
    };

    const svg = buildKeyboardSVG(keyboard);

    expect(svg.match(/fill="#ffffff"[^>]*><tspan[^>]*>2u<\/tspan><\/text>/g)).toHaveLength(2);
    expect(svg).toMatch(/fill="#000000"[^>]*><tspan[^>]*>2u<\/tspan><\/text>/);
    expect(svg).toMatch(/fill="#123456"[^>]*><tspan[^>]*>USER<\/tspan><\/text>/);
    expect(svg).not.toContain('fill="#ff00ff"');
  });
});
