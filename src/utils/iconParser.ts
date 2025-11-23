// Icon parsing utility for KLE icon spans

export interface ParsedIcon {
  type: 'text' | 'icon';
  content: string;
  className?: string;
  iconName?: string;
}

// Map of icon class names to their unicode characters (for font icons) or empty string (for SVG icons)
const ICON_MAP: Record<string, string> = {
  // Custom SVG logo
  'icon-40s-logo': '',
  // Trashcons font icons
  'icon-left': '\ue900',
  'icon-right': '\ue901',
  'icon-down': '\ue902',
  'icon-up': '\ue903',
  'icon-mult': '\ue904',
  'icon-minus': '\ue905',
  'icon-plus': '\ue906',
  'icon-div': '\ue907',
  'icon-lower': '\ue908',
  'icon-raise': '\ue909',
  'icon-fn': '\ue90a',
  'icon-shift': '\ue90b',
  'icon-delete': '\ue90c',
  'icon-backspace': '\ue90d',
  'icon-enter': '\ue90e',
  'icon-esc': '\ue90f',
  'icon-tab': '\ue910',
  'icon-menu': '\ue911',
  'icon-sys': '\ue912',
  'icon-alt': '\ue913',
  'icon-ctrl': '\ue914',
  'icon-home': '\ue915',
  'icon-end': '\ue916',
  'icon-pgup': '\ue917',
  'icon-pgdn': '\ue918',
  'icon-capslock': '\ue919',
  'icon-numlock': '\ue91a',
  'icon-scrllock': '\ue91b',
  'icon-prntscrn': '\ue91c',
  'icon-pause': '\ue91d',
  'icon-insert': '\ue91e',
  'icon-kbd-1_round_filled_1': '',
  'icon-kbd-1_round_filled_2': '',
  'icon-kbd-1_round': '',
  'icon-kbd-a_round_filled_sanserif': '',
  'icon-kbd-a_round_filled_serif': '',
  'icon-kbd-a_round_sanserif': '',
  'icon-kbd-a_square_filled_sanserif': '',
  'icon-kbd-a_square_filled_serif': '',
  'icon-kbd-arrows_bottom_1': '',
  'icon-kbd-arrows_bottom_2': '',
  'icon-kbd-arrows_bottom_3': '',
  'icon-kbd-arrows_bottom_4': '',
  'icon-kbd-arrows_down_circle_filled': '',
  'icon-kbd-arrows_down': '',
  'icon-kbd-arrows_left_circle_filled': '',
  'icon-kbd-arrows_left': '',
  'icon-kbd-arrows_right_circle_filled': '',
  'icon-kbd-arrows_right': '',
  'icon-kbd-arrows_top_1': '',
  'icon-kbd-arrows_top_2': '',
  'icon-kbd-arrows_top_3': '',
  'icon-kbd-arrows_top_4': '',
  'icon-kbd-arrows_up_circle_filled': '',
  'icon-kbd-arrows_up_left': '',
  'icon-kbd-arrows_up_right': '',
  'icon-kbd-arrows_up': '',
  'icon-kbd-hamburger_menu': '',
  'icon-kbd-line_end': '',
  'icon-kbd-line_start_end': '',
  'icon-kbd-line_start': '',
  'icon-kbd-multimedia_back': '',
  'icon-kbd-multimedia_down': '',
  'icon-kbd-multimedia_eject': '',
  'icon-kbd-multimedia_fastforwar': '',
  'icon-kbd-multimedia_fastforward_end': '',
  'icon-kbd-multimedia_mute_1': '',
  'icon-kbd-multimedia_mute_2': '',
  'icon-kbd-multimedia_mute_3': '',
  'icon-kbd-multimedia_mute_4': '',
  'icon-kbd-multimedia_pause': '',
  'icon-kbd-multimedia_play_pause': '',
  'icon-kbd-multimedia_play': '',
  'icon-kbd-multimedia_record': '',
  'icon-kbd-multimedia_rewind_start': '',
  'icon-kbd-multimedia_rewind': '',
  'icon-kbd-multimedia_stop': '',
  'icon-kbd-multimedia_up': '',
  'icon-kbd-multimedia_volume_down_1': '',
  'icon-kbd-multimedia_volume_down_2': '',
  'icon-kbd-multimedia_volume_up_1': '',
  'icon-kbd-multimedia_volume_up_2': '',
  'icon-kbd-redo_1': '',
  'icon-kbd-return_1': '',
  'icon-kbd-return_2': '',
  'icon-kbd-return_3': '',
  'icon-kbd-return_4': '',
  'icon-kbd-scissors_1': '',
  'icon-kbd-scissors_2': '',
  'icon-kbd-scissors_3': '',
  'icon-kbd-search_1': '',
  'icon-kbd-search_2': '',
  'icon-kbd-symbol_alien': '',
  'icon-kbd-symbol_ankh': '',
  'icon-kbd-symbol_keyboard': '',
  'icon-kbd-symbol_peace': '',
  'icon-kbd-symbol_skull_bones_1': '',
  'icon-kbd-symbol_skull_bones_2': '',
  'icon-kbd-symbol_yinyang': '',
  'icon-kbd-tab_1': '',
  'icon-kbd-tab_2': '',
  'icon-kbd-undo_1': '',
  'icon-kbd-undo_2': '',
  'icon-kbd-undo_3': '',
  'icon-kbd-unicode_alternate_1': '',
  'icon-kbd-unicode_alternate_2': '',
  'icon-kbd-unicode_backspace_deleteleft_big': '',
  'icon-kbd-unicode_backspace_deleteleft_small': '',
  'icon-kbd-unicode_break_1': '',
  'icon-kbd-unicode_break_2': '',
  'icon-kbd-unicode_clearscreen_1': '',
  'icon-kbd-unicode_clearscreen_2': '',
  'icon-kbd-unicode_clock': '',
  'icon-kbd-unicode_command_1': '',
  'icon-kbd-unicode_command_3': '',
  'icon-kbd-unicode_control_1': '',
  'icon-kbd-unicode_control_2': '',
  'icon-kbd-unicode_control_3': '',
  'icon-kbd-unicode_decimal_separator_1': '',
  'icon-kbd-unicode_decimal_separator_2': '',
  'icon-kbd-unicode_deleteright_big': '',
  'icon-kbd-unicode_deleteright_small': '',
  'icon-kbd-unicode_enter_1': '',
  'icon-kbd-unicode_enter_2': '',
  'icon-kbd-unicode_escape_1': '',
  'icon-kbd-unicode_escape_2': '',
  'icon-kbd-unicode_hourglass_1': '',
  'icon-kbd-unicode_hourglass_2': '',
  'icon-kbd-unicode_insert_1': '',
  'icon-kbd-unicode_insert_2': '',
  'icon-kbd-unicode_lock_closed_1': '',
  'icon-kbd-unicode_lock_closed_2': '',
  'icon-kbd-unicode_lock_open_1': '',
  'icon-kbd-unicode_lock_open_2': '',
  'icon-kbd-unicode_option_1': '',
  'icon-kbd-unicode_option_2': '',
  'icon-kbd-unicode_page_down_1': '',
  'icon-kbd-unicode_page_down_2': '',
  'icon-kbd-unicode_page_down_3': '',
  'icon-kbd-unicode_page_up_1': '',
  'icon-kbd-unicode_page_up_2': '',
  'icon-kbd-unicode_page_up_3': '',
  'icon-kbd-unicode_pause_1': '',
  'icon-kbd-unicode_pause_2': '',
  'icon-kbd-unicode_printscreen_1': '',
  'icon-kbd-unicode_printscreen_2': '',
  'icon-kbd-unicode_screen_bright': '',
  'icon-kbd-unicode_screen_dim': '',
  'icon-kbd-unicode_scroll_1': '',
  'icon-kbd-unicode_scroll_2': '',
  'icon-kbd-unicode_stopwatch': '',
  'icon-kbd-batman': '',
  'icon-kbd-community_awesome_invert': '',
  'icon-kbd-community_awesome': '',
  'icon-kbd-community_hapster': '',
  'icon-kbd-copyleft': '',
  'icon-kbd-logo_amiga': '',
  'icon-kbd-logo_android': '',
  'icon-kbd-logo_apple_outline': '',
  'icon-kbd-logo_apple': '',
  'icon-kbd-logo_atari': '',
  'icon-kbd-logo_bsd_freebsd': '',
  'icon-kbd-logo_commodore': '',
  'icon-kbd-logo_gnu': '',
  'icon-kbd-logo_linux_archlinux': '',
  'icon-kbd-logo_linux_centos': '',
  'icon-kbd-logo_linux_debian': '',
  'icon-kbd-logo_linux_edubuntu': '',
  'icon-kbd-logo_linux_fedora': '',
  'icon-kbd-logo_linux_gentoo': '',
  'icon-kbd-logo_linux_knoppix': '',
  'icon-kbd-logo_linux_opensuse': '',
  'icon-kbd-logo_linux_redhat': '',
  'icon-kbd-logo_linux_tux_ibm_invert': '',
  'icon-kbd-logo_linux_tux_ibm': '',
  'icon-kbd-logo_linux_tux': '',
  'icon-kbd-logo_ubuntu_cof_circle': '',
  'icon-kbd-logo_ubuntu_cof': '',
  'icon-kbd-logo_vim': '',
  'icon-kbd-logo_windows_7': '',
  'icon-kbd-logo_windows_8': '',
  'icon-kbd-logo_winlin_cygwin': '',
  'icon-kbd-unie600_kbd_custom': '',
  'icon-kbd-unie601_kbd_custom': '',
  'icon-kbd-unie602_kbd_custom': '',
  'icon-kbd-unie603_kbd_custom': '',
  'icon-kbd-unie604_kbd_custom': '',
  'icon-kbd-unie605_kbd_custom': '',
  'icon-kbd-unie606_kbd_custom': '',
  'icon-kbd-unie607_kbd_custom': '',
  'icon-kbd-unie608_kbd_custom': '',
  'icon-kbd-unie609_kbd_custom': '',
  'icon-kbd-unie60a_kbd_custom': '',
  'icon-kbd-unie60b_kbd_custom': '',
  'icon-kbd-unie60c_kbd_custom': '',
  'icon-kbd-unie60d_kbd_custom': '',
  'icon-kbd-unie60e_kbd_custom': '',
  'icon-kbd-unie60f_kbd_custom': '',
  'icon-kbd-unie610_kbd_custom': '',
  'icon-kbd-unie611_kbd_custom': '',
  'icon-kbd-unie612_kbd_custom': '',
  'icon-kbd-unie613_kbd_custom': '',
  'icon-kbd-unie614_kbd_custom': '',
  'icon-kbd-unie615_kbd_custom': '',
  'icon-kbd-unie616_kbd_custom': '',
  'icon-kbd-unie617_kbd_custom': '',
  'icon-kbd-unie618_kbd_custom': '',
  'icon-kbd-unie619_kbd_custom': '',
  'icon-kbd-unie700_kbd_custom': '',
  'icon-kbd-unie701_kbd_custom': '',
  'icon-kbd-unie702_kbd_custom': '',
  'icon-kbd-unie703_kbd_custom': '',
  'icon-kbd-unie704_kbd_custom': '',
  'icon-kbd-unie800_kbd_custom': '',
  'icon-kbd-unie801_kbd_custom': '',
  'icon-kbd-unie802_kbd_custom': '',
  'icon-kbd-unie803_kbd_custom': '',
  'icon-kbd-unie804_kbd_custom': '',
  'icon-kbd-unie805_kbd_custom': '',
  'icon-kbd-unie806_kbd_custom': '',
  'icon-kbd-unie807_kbd_custom': '',
  'icon-kbd-unie808_kbd_custom': '',
  'icon-kbd-unie809_kbd_custom': '',
  'icon-kbd-unie80a_kbd_custom': '',
  'icon-kbd-unie80b_kbd_custom': '',
  'icon-kbd-unie80c_kbd_custom': '',
  'icon-kbd-unie80d_kbd_custom': '',
  'icon-kbd-unie80e_kbd_custom': '',
  'icon-kbd-unie80f_kbd_custom': '',
  'icon-kbd-unie810_kbd_custom': '',
  'icon-kbd-unie811_kbd_custom': '',
  'icon-kbd-unie812_kbd_custom': '',
  'icon-kbd-unie813_kbd_custom': '',
  'icon-kbd-unie814_kbd_custom': '',
  'icon-kbd-unie815_kbd_custom': '',
  'icon-kbd-unie816_kbd_custom': '',
  'icon-kbd-unie817_kbd_custom': '',
  'icon-kbd-unie818_kbd_custom': '',
  'icon-kbd-unie819_kbd_custom': '',
  'icon-kbd-unie81a_kbd_custom': '',
  'icon-kbd-unie81b_kbd_custom': '',
  'icon-kbd-unie81c_kbd_custom': '',
  'icon-kbd-unie81d_kbd_custom': '',
  'icon-kbd-unie81e_kbd_custom': '',
  'icon-kbd-unie81f_kbd_custom': '',
  'icon-kbd-unie820_kbd_custom': '',
  'icon-kbd-unie821_kbd_custom': '',
  'icon-kbd-unie822_kbd_custom': '',
  'icon-kbd-unie823_kbd_custom': '',
  'icon-kbd-unie824_kbd_custom': '',
  'icon-kbd-unie825_kbd_custom': '',
  'icon-kbd-unie826_kbd_custom': '',
  'icon-kbd-unie827_kbd_custom': '',
  'icon-kbd-unie828_kbd_custom': '',
  'icon-kbd-unie829_kbd_custom': '',
  'icon-kbd-unie82a_kbd_custom': '',
  'icon-kbd-unie82b_kbd_custom': '',
  'icon-kbd-unie82c_kbd_custom': '',
  'icon-kbd-unie82d_kbd_custom': '',
  'icon-kbd-unie82e_kbd_custom': '',
  'icon-kbd-unie82f_kbd_custom': '',
  'icon-kbd-unie830_kbd_custom': '',
  'icon-kbd-unie831_kbd_custom': '',
  'icon-kbd-unie832_kbd_custom': '',
  'icon-kbd-unie833_kbd_custom': '',
  'icon-kbd-unie834_kbd_custom': '',
  'icon-kbd-unie835_kbd_custom': '',
  'icon-kbd-unie836_kbd_custom': '',
  'icon-kbd-unie837_kbd_custom': '',
  'icon-kbd-unie838_kbd_custom': '',
  'icon-kbd-unie839_kbd_custom': '',
  'icon-kbd-unie83a_kbd_custom': '',
  'icon-kbd-unie83b_kbd_custom': '',
  'icon-kbd-unie83c_kbd_custom': '',
  'icon-kbd-unie83d_kbd_custom': '',
  'icon-kbd-unie83e_kbd_custom': '',
  'icon-kbd-unie83f_kbd_custom': '',
  'icon-kbd-unie840_kbd_custom': '',
  'icon-kbd-unie841_kbd_custom': '',
  'icon-kbd-unie842_kbd_custom': '',
  'icon-kbd-unie843_kbd_custom': '',
  'icon-kbd-unie844_kbd_custom': '',
  'icon-kbd-unie845_kbd_custom': '',
  'icon-kbd-unie846_kbd_custom': '',
  'icon-kbd-unie847_kbd_custom': '',
  'icon-kbd-unie848_kbd_custom': '',
  'icon-kbd-unie849_kbd_custom': '',
  'icon-kbd-unie84a_kbd_custom': '',
  'icon-kbd-unie84b_kbd_custom': '',
  'icon-kbd-unie84c_kbd_custom': '',
  'icon-kbd-unie84d_kbd_custom': '',
  'icon-kbd-unie84e_kbd_custom': '',
  'icon-kbd-unie84f_kbd_custom': '',
  'icon-kbd-unie850_kbd_custom': '',
  'icon-kbd-unie851_kbd_custom': '',
  'icon-kbd-unie852_kbd_custom': '',
  'icon-kbd-unie853_kbd_custom': '',
  'icon-kbd-unie854_kbd_custom': '',
  'icon-kbd-unie855_kbd_custom': '',
  'icon-kbd-unie856_kbd_custom': '',
  'icon-kbd-unie857_kbd_custom': '',
  'icon-kbd-unie858_kbd_custom': '',
  'icon-kbd-unie859_kbd_custom': '',
  'icon-kbd-unie85a_kbd_custom': '',
  'icon-kbd-unie85b_kbd_custom': '',
  'icon-kbd-unie85c_kbd_custom': '',
  'icon-kbd-unie85d_kbd_custom': '',
  'icon-kbd-unie85e_kbd_custom': '',
  'icon-kbd-unie85f_kbd_custom': '',
  'icon-kbd-unie860_kbd_custom': '',
  'icon-kbd-unie861_kbd_custom': '',
  'icon-kbd-unie862_kbd_custom': '',
  'icon-kbd-unie863_kbd_custom': '',
  'icon-kbd-unie864_kbd_custom': '',
  'icon-kbd-unie865_kbd_custom': '',
  'icon-kbd-unie866_kbd_custom': '',
  'icon-kbd-unie867_kbd_custom': '',
  'icon-kbd-unie868_kbd_custom': '',
  'icon-kbd-unie869_kbd_custom': '',
  'icon-kbd-unie86a_kbd_custom': '',
  'icon-kbd-unie86b_kbd_custom': '',
  'icon-kbd-unie86c_kbd_custom': '',
  'icon-kbd-unie86d_kbd_custom': '',
  'icon-kbd-unie86e_kbd_custom': '',
  'icon-kbd-unie86f_kbd_custom': '',
  'icon-kbd-unie870_kbd_custom': '',
  'icon-kbd-unie8a0_kbd_custom': '',
  'icon-kbd-unie8a1_kbd_custom': '',
  'icon-kbd-unie8a2_kbd_custom': '',
  'icon-kbd-unie8a3_kbd_custom': '',
  'icon-kbd-unie8a4_kbd_custom': '',
  'icon-kbd-unie8a5_kbd_custom': '',
  'icon-kbd-unie8a6_kbd_custom': '',
};

/**
 * Parse a legend string that may contain icon spans or i tags
 * Handles both <span class="..."> and <i class="kb kb-..."> formats
 */
export function parseIconLegend(legend: string): ParsedIcon[] {
  const result: ParsedIcon[] = [];
  
  // Match span or i tags - handle both complete tags and unclosed tags
  const iconSpanRegex = /<(span|i)\s+class=["']([^"']+)["']\s*(?:\/>|>(?:[^<]*<\/\1>)?|>)/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = iconSpanRegex.exec(legend)) !== null) {
    // Add text before the icon
    if (match.index > lastIndex) {
      const textBefore = legend.substring(lastIndex, match.index);
      if (textBefore) {
        result.push({
          type: 'text',
          content: textBefore,
        });
      }
    }
    
    // Parse the class attribute (match[1] is tag name, match[2] is classes)
    const classes = match[2].split(/\s+/);
    let iconFound = false;
    
    // Look for icon classes
    for (const cls of classes) {
      // Check if this is a known icon (including custom icons)
      if (cls in ICON_MAP) {
        result.push({
          type: 'icon',
          content: ICON_MAP[cls] || '', // Custom SVG icons have empty content
          className: match[2], // Full class string
          iconName: cls,
        });
        iconFound = true;
        break;
      }
    }
    
    // If no icon was found, treat the whole match as text
    if (!iconFound) {
      result.push({
        type: 'text',
        content: match[0],
      });
    }
    
    // Update lastIndex to skip the entire matched span
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last match
  if (lastIndex < legend.length) {
    const remainingText = legend.substring(lastIndex);
    if (remainingText) {
      result.push({
        type: 'text',
        content: remainingText,
      });
    }
  }
  
  return result;
}

// Legacy AVAILABLE_ICONS for backward compatibility (now use KBD_ICONS from kbdIconsList.ts)
export const AVAILABLE_ICONS = [
  { name: 'None', value: '' },
  { name: '40s Logo', value: '<span class="custom-icon icon-40s-logo"></span>' },
  // Trashcons font icons
  { name: 'Enter (Trashcons)', value: '<span class="trashcons icon-enter"></span>' },
  { name: 'Escape (Trashcons)', value: '<span class="trashcons icon-esc"></span>' },
  { name: 'Tab (Trashcons)', value: '<span class="trashcons icon-tab"></span>' },
  { name: 'Backspace (Trashcons)', value: '<span class="trashcons icon-backspace"></span>' },
  { name: 'Delete (Trashcons)', value: '<span class="trashcons icon-delete"></span>' },
  { name: 'Shift (Trashcons)', value: '<span class="trashcons icon-shift"></span>' },
  { name: 'Control (Trashcons)', value: '<span class="trashcons icon-ctrl"></span>' },
  { name: 'Alt (Trashcons)', value: '<span class="trashcons icon-alt"></span>' },
  { name: 'Arrows ← (Trashcons)', value: '<span class="trashcons icon-left"></span>' },
  { name: 'Arrows → (Trashcons)', value: '<span class="trashcons icon-right"></span>' },
  { name: 'Arrows ↑ (Trashcons)', value: '<span class="trashcons icon-up"></span>' },
  { name: 'Arrows ↓ (Trashcons)', value: '<span class="trashcons icon-down"></span>' },
];

/**
 * Convert parsed icons back to HTML string
 */
export function iconPartsToHtml(parts: ParsedIcon[]): string {
  return parts.map(part => {
    if (part.type === 'icon' && part.className) {
      return `<span class="${part.className}"></span>`;
    }
    return part.content;
  }).join('');
}

/**
 * Convert parsed icons to plain text (with icon unicode characters)
 */
export function iconPartsToText(parts: ParsedIcon[]): string {
  return parts.map(part => part.content).join('');
}

/**
 * Check if a legend contains icon spans
 */
export function hasIcons(legend: string): boolean {
  return /<(span|i)\s+class=["'][^"']*(?:trashcons|icon-|custom-icon)[^"']*["']/.test(legend);
}

/**
 * Process labels for icons and auto-size them
 */
export function processLabelsForIcons(labels: string[], parentKey: any): void {
  labels.forEach((label, index) => {
    if (label && hasIcons(label)) {
      // Auto-size icon legends to size 9
      if (!parentKey.textSize) {
        parentKey.textSize = [];
      }
      // Ensure array is long enough
      while (parentKey.textSize.length <= index) {
        parentKey.textSize.push(undefined);
      }
      if (!parentKey.textSize[index]) {
        parentKey.textSize[index] = 9;
      }
    }
  });
}
