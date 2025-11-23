import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useKeyboardStore } from '../store/keyboardStoreOptimized';
import { Key } from '../types';
import { getLegendPosition, getStabilizerPositions } from '../utils/keyUtils';
import { parseIconLegend } from '../utils/iconParser';
import { fontManager } from '../utils/fontManager';
import { isPointInRotatedRect, calculateNewPositionForRotationCenter } from '../utils/rotationUtils';

interface KeyboardCanvasProps {
  width: number;
  height: number;
}

export interface KeyboardCanvasRef {
  getStage: () => { toDataURL: () => string } | null;
}

interface KeyRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  key: Key;
}

// Canvas padding for easier edge selection
const CANVAS_PADDING_LEFT = 40;
const CANVAS_PADDING_TOP = 40;

const KeyboardCanvas = forwardRef<KeyboardCanvasRef, KeyboardCanvasProps>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const keyRectsRef = useRef<KeyRect[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  
  // Interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isSelectingRef = useRef(false);
  const selectionRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const isDuplicatingRef = useRef(false);
  const duplicatedKeysRef = useRef<Set<string>>(new Set());
  const lastSelectedKeyRef = useRef<string | null>(null);
  const isAddingToSelectionRef = useRef(false); // Track if we're adding to selection
  const hoveredStabRef = useRef<{ keyId: string; stabIndex: number; x: number; y: number; keyWidth: number } | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  // Store state cache
  const stateRef = useRef({
    keyboard: useKeyboardStore.getState().keyboard,
    selectedKeys: useKeyboardStore.getState().selectedKeys,
    hoveredKey: useKeyboardStore.getState().hoveredKey,
    editorSettings: useKeyboardStore.getState().editorSettings,
    isSettingRotationPoint: useKeyboardStore.getState().isSettingRotationPoint,
    isRotationSectionExpanded: useKeyboardStore.getState().isRotationSectionExpanded,
  });

  useImperativeHandle(ref, () => ({
    getStage: () => canvasRef.current ? {
      toDataURL: () => canvasRef.current!.toDataURL()
    } : null
  }));

  // Helper function to adjust color brightness
  const adjustColorBrightness = (color: string, amount: number): string => {
    const normalizedColor = color.startsWith('#') ? color : `#${color}`;
    const rgb = parseInt(normalizedColor.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((rgb >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((rgb >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (rgb & 255) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Cache for loaded SVG images
  const svgImageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  // Cache for colored icon canvases
  const coloredIconCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  
  // Load SVG icon if needed
  const loadSvgIcon = (iconName: string): HTMLImageElement | null => {
    const cacheKey = iconName;
    
    if (svgImageCache.current.has(cacheKey)) {
      return svgImageCache.current.get(cacheKey) || null;
    }
    
    // Map icon names to their SVG paths
    const svgPaths: Record<string, string> = {
      'icon-40s-logo': '/icons/40s-logo.svg',
      // All kbd SVG icon paths
      'icon-kbd-1_round_filled_1': '/icons/kbd/1-Round-Filled-1.svg',
      'icon-kbd-1_round_filled_2': '/icons/kbd/1-Round-Filled-2.svg',
      'icon-kbd-1_round': '/icons/kbd/1-Round.svg',
      'icon-kbd-a_round_filled_sanserif': '/icons/kbd/A-Round-Filled-SanSerif.svg',
      'icon-kbd-a_round_filled_serif': '/icons/kbd/A-Round-Filled-Serif.svg',
      'icon-kbd-a_round_sanserif': '/icons/kbd/A-Round-SanSerif.svg',
      'icon-kbd-a_square_filled_sanserif': '/icons/kbd/A-Square-Filled-SanSerif.svg',
      'icon-kbd-a_square_filled_serif': '/icons/kbd/A-Square-Filled-Serif.svg',
      'icon-kbd-arrows_bottom_1': '/icons/kbd/Arrows-Bottom-1.svg',
      'icon-kbd-arrows_bottom_2': '/icons/kbd/Arrows-Bottom-2.svg',
      'icon-kbd-arrows_bottom_3': '/icons/kbd/Arrows-Bottom-3.svg',
      'icon-kbd-arrows_bottom_4': '/icons/kbd/Arrows-Bottom-4.svg',
      'icon-kbd-arrows_down_circle_filled': '/icons/kbd/Arrows-Down-Circle-Filled.svg',
      'icon-kbd-arrows_down': '/icons/kbd/Arrows-Down.svg',
      'icon-kbd-arrows_left_circle_filled': '/icons/kbd/Arrows-Left-Circle-Filled.svg',
      'icon-kbd-arrows_left': '/icons/kbd/Arrows-Left.svg',
      'icon-kbd-arrows_right_circle_filled': '/icons/kbd/Arrows-Right-Circle-Filled.svg',
      'icon-kbd-arrows_right': '/icons/kbd/Arrows-Right.svg',
      'icon-kbd-arrows_top_1': '/icons/kbd/Arrows-Top-1.svg',
      'icon-kbd-arrows_top_2': '/icons/kbd/Arrows-Top-2.svg',
      'icon-kbd-arrows_top_3': '/icons/kbd/Arrows-Top-3.svg',
      'icon-kbd-arrows_top_4': '/icons/kbd/Arrows-Top-4.svg',
      'icon-kbd-arrows_up_circle_filled': '/icons/kbd/Arrows-Up-Circle-Filled.svg',
      'icon-kbd-arrows_up_left': '/icons/kbd/Arrows-Up-Left.svg',
      'icon-kbd-arrows_up_right': '/icons/kbd/Arrows-Up-Right.svg',
      'icon-kbd-arrows_up': '/icons/kbd/Arrows-Up.svg',
      'icon-kbd-hamburger_menu': '/icons/kbd/Hamburger-Menu.svg',
      'icon-kbd-line_end': '/icons/kbd/Line-End.svg',
      'icon-kbd-line_start_end': '/icons/kbd/Line-Start-End.svg',
      'icon-kbd-line_start': '/icons/kbd/Line-Start.svg',
      'icon-kbd-multimedia_back': '/icons/kbd/Multimedia-Back.svg',
      'icon-kbd-multimedia_down': '/icons/kbd/Multimedia-Down.svg',
      'icon-kbd-multimedia_eject': '/icons/kbd/Multimedia-Eject.svg',
      'icon-kbd-multimedia_fastforwar': '/icons/kbd/Multimedia-FastForwar.svg',
      'icon-kbd-multimedia_fastforward_end': '/icons/kbd/Multimedia-FastForward-End.svg',
      'icon-kbd-multimedia_mute_1': '/icons/kbd/Multimedia-Mute-1.svg',
      'icon-kbd-multimedia_mute_2': '/icons/kbd/Multimedia-Mute-2.svg',
      'icon-kbd-multimedia_mute_3': '/icons/kbd/Multimedia-Mute-3.svg',
      'icon-kbd-multimedia_mute_4': '/icons/kbd/Multimedia-Mute-4.svg',
      'icon-kbd-multimedia_pause': '/icons/kbd/Multimedia-Pause.svg',
      'icon-kbd-multimedia_play_pause': '/icons/kbd/Multimedia-Play-Pause.svg',
      'icon-kbd-multimedia_play': '/icons/kbd/Multimedia-Play.svg',
      'icon-kbd-multimedia_record': '/icons/kbd/Multimedia-Record.svg',
      'icon-kbd-multimedia_rewind_start': '/icons/kbd/Multimedia-Rewind-Start.svg',
      'icon-kbd-multimedia_rewind': '/icons/kbd/Multimedia-Rewind.svg',
      'icon-kbd-multimedia_stop': '/icons/kbd/Multimedia-Stop.svg',
      'icon-kbd-multimedia_up': '/icons/kbd/Multimedia-Up.svg',
      'icon-kbd-multimedia_volume_down_1': '/icons/kbd/Multimedia-Volume-Down-1.svg',
      'icon-kbd-multimedia_volume_down_2': '/icons/kbd/Multimedia-Volume-Down-2.svg',
      'icon-kbd-multimedia_volume_up_1': '/icons/kbd/Multimedia-Volume-Up-1.svg',
      'icon-kbd-multimedia_volume_up_2': '/icons/kbd/Multimedia-Volume-Up-2.svg',
      'icon-kbd-redo_1': '/icons/kbd/Redo-1.svg',
      'icon-kbd-return_1': '/icons/kbd/Return-1.svg',
      'icon-kbd-return_2': '/icons/kbd/Return-2.svg',
      'icon-kbd-return_3': '/icons/kbd/Return-3.svg',
      'icon-kbd-return_4': '/icons/kbd/Return-4.svg',
      'icon-kbd-scissors_1': '/icons/kbd/Scissors-1.svg',
      'icon-kbd-scissors_2': '/icons/kbd/Scissors-2.svg',
      'icon-kbd-scissors_3': '/icons/kbd/Scissors-3.svg',
      'icon-kbd-search_1': '/icons/kbd/Search-1.svg',
      'icon-kbd-search_2': '/icons/kbd/Search-2.svg',
      'icon-kbd-symbol_alien': '/icons/kbd/Symbol-Alien.svg',
      'icon-kbd-symbol_ankh': '/icons/kbd/Symbol-Ankh.svg',
      'icon-kbd-symbol_keyboard': '/icons/kbd/Symbol-Keyboard.svg',
      'icon-kbd-symbol_peace': '/icons/kbd/Symbol-Peace.svg',
      'icon-kbd-symbol_skull_bones_1': '/icons/kbd/Symbol-Skull-Bones-1.svg',
      'icon-kbd-symbol_skull_bones_2': '/icons/kbd/Symbol-Skull-Bones-2.svg',
      'icon-kbd-symbol_yinyang': '/icons/kbd/Symbol-YinYang.svg',
      'icon-kbd-tab_1': '/icons/kbd/Tab-1.svg',
      'icon-kbd-tab_2': '/icons/kbd/Tab-2.svg',
      'icon-kbd-undo_1': '/icons/kbd/Undo-1.svg',
      'icon-kbd-undo_2': '/icons/kbd/Undo-2.svg',
      'icon-kbd-undo_3': '/icons/kbd/Undo-3.svg',
      'icon-kbd-unicode_alternate_1': '/icons/kbd/Unicode-Alternate-1.svg',
      'icon-kbd-unicode_alternate_2': '/icons/kbd/Unicode-Alternate-2.svg',
      'icon-kbd-unicode_backspace_deleteleft_big': '/icons/kbd/Unicode-BackSpace-DeleteLeft-Big.svg',
      'icon-kbd-unicode_backspace_deleteleft_small': '/icons/kbd/Unicode-BackSpace-DeleteLeft-Small.svg',
      'icon-kbd-unicode_break_1': '/icons/kbd/Unicode-Break-1.svg',
      'icon-kbd-unicode_break_2': '/icons/kbd/Unicode-Break-2.svg',
      'icon-kbd-unicode_clearscreen_1': '/icons/kbd/Unicode-ClearScreen-1.svg',
      'icon-kbd-unicode_clearscreen_2': '/icons/kbd/Unicode-ClearScreen-2.svg',
      'icon-kbd-unicode_clock': '/icons/kbd/Unicode-Clock.svg',
      'icon-kbd-unicode_command_1': '/icons/kbd/Unicode-Command-1.svg',
      'icon-kbd-unicode_command_3': '/icons/kbd/Unicode-Command-3.svg',
      'icon-kbd-unicode_control_1': '/icons/kbd/Unicode-Control-1.svg',
      'icon-kbd-unicode_control_2': '/icons/kbd/Unicode-Control-2.svg',
      'icon-kbd-unicode_control_3': '/icons/kbd/Unicode-Control-3.svg',
      'icon-kbd-unicode_decimal_separator_1': '/icons/kbd/Unicode-Decimal-Separator-1.svg',
      'icon-kbd-unicode_decimal_separator_2': '/icons/kbd/Unicode-Decimal-Separator-2.svg',
      'icon-kbd-unicode_deleteright_big': '/icons/kbd/Unicode-DeleteRight-Big.svg',
      'icon-kbd-unicode_deleteright_small': '/icons/kbd/Unicode-DeleteRight-Small.svg',
      'icon-kbd-unicode_enter_1': '/icons/kbd/Unicode-Enter-1.svg',
      'icon-kbd-unicode_enter_2': '/icons/kbd/Unicode-Enter-2.svg',
      'icon-kbd-unicode_escape_1': '/icons/kbd/Unicode-Escape-1.svg',
      'icon-kbd-unicode_escape_2': '/icons/kbd/Unicode-Escape-2.svg',
      'icon-kbd-unicode_hourglass_1': '/icons/kbd/Unicode-Hourglass-1.svg',
      'icon-kbd-unicode_hourglass_2': '/icons/kbd/Unicode-Hourglass-2.svg',
      'icon-kbd-unicode_insert_1': '/icons/kbd/Unicode-Insert-1.svg',
      'icon-kbd-unicode_insert_2': '/icons/kbd/Unicode-Insert-2.svg',
      'icon-kbd-unicode_lock_closed_1': '/icons/kbd/Unicode-Lock-Closed-1.svg',
      'icon-kbd-unicode_lock_closed_2': '/icons/kbd/Unicode-Lock-Closed-2.svg',
      'icon-kbd-unicode_lock_open_1': '/icons/kbd/Unicode-Lock-Open-1.svg',
      'icon-kbd-unicode_lock_open_2': '/icons/kbd/Unicode-Lock-Open-2.svg',
      'icon-kbd-unicode_option_1': '/icons/kbd/Unicode-Option-1.svg',
      'icon-kbd-unicode_option_2': '/icons/kbd/Unicode-Option-2.svg',
      'icon-kbd-unicode_page_down_1': '/icons/kbd/Unicode-Page-Down-1.svg',
      'icon-kbd-unicode_page_down_2': '/icons/kbd/Unicode-Page-Down-2.svg',
      'icon-kbd-unicode_page_down_3': '/icons/kbd/Unicode-Page-Down-3.svg',
      'icon-kbd-unicode_page_up_1': '/icons/kbd/Unicode-Page-Up-1.svg',
      'icon-kbd-unicode_page_up_2': '/icons/kbd/Unicode-Page-Up-2.svg',
      'icon-kbd-unicode_page_up_3': '/icons/kbd/Unicode-Page-Up-3.svg',
      'icon-kbd-unicode_pause_1': '/icons/kbd/Unicode-Pause-1.svg',
      'icon-kbd-unicode_pause_2': '/icons/kbd/Unicode-Pause-2.svg',
      'icon-kbd-unicode_printscreen_1': '/icons/kbd/Unicode-PrintScreen-1.svg',
      'icon-kbd-unicode_printscreen_2': '/icons/kbd/Unicode-PrintScreen-2.svg',
      'icon-kbd-unicode_screen_bright': '/icons/kbd/Unicode-Screen-Bright.svg',
      'icon-kbd-unicode_screen_dim': '/icons/kbd/Unicode-Screen-Dim.svg',
      'icon-kbd-unicode_scroll_1': '/icons/kbd/Unicode-Scroll-1.svg',
      'icon-kbd-unicode_scroll_2': '/icons/kbd/Unicode-Scroll-2.svg',
      'icon-kbd-unicode_stopwatch': '/icons/kbd/Unicode-Stopwatch.svg',
      'icon-kbd-batman': '/icons/kbd/batman.svg',
      'icon-kbd-community_awesome_invert': '/icons/kbd/community-awesome-invert.svg',
      'icon-kbd-community_awesome': '/icons/kbd/community-awesome.svg',
      'icon-kbd-community_hapster': '/icons/kbd/community-hapster.svg',
      'icon-kbd-copyleft': '/icons/kbd/copyleft.svg',
      'icon-kbd-logo_amiga': '/icons/kbd/logo-amiga.svg',
      'icon-kbd-logo_android': '/icons/kbd/logo-android.svg',
      'icon-kbd-logo_apple_outline': '/icons/kbd/logo-apple-outline.svg',
      'icon-kbd-logo_apple': '/icons/kbd/logo-apple.svg',
      'icon-kbd-logo_atari': '/icons/kbd/logo-atari.svg',
      'icon-kbd-logo_bsd_freebsd': '/icons/kbd/logo-bsd-freebsd.svg',
      'icon-kbd-logo_commodore': '/icons/kbd/logo-commodore.svg',
      'icon-kbd-logo_gnu': '/icons/kbd/logo-gnu.svg',
      'icon-kbd-logo_linux_archlinux': '/icons/kbd/logo-linux-archlinux.svg',
      'icon-kbd-logo_linux_centos': '/icons/kbd/logo-linux-centos.svg',
      'icon-kbd-logo_linux_debian': '/icons/kbd/logo-linux-debian.svg',
      'icon-kbd-logo_linux_edubuntu': '/icons/kbd/logo-linux-edubuntu.svg',
      'icon-kbd-logo_linux_fedora': '/icons/kbd/logo-linux-fedora.svg',
      'icon-kbd-logo_linux_gentoo': '/icons/kbd/logo-linux-gentoo.svg',
      'icon-kbd-logo_linux_knoppix': '/icons/kbd/logo-linux-knoppix.svg',
      'icon-kbd-logo_linux_opensuse': '/icons/kbd/logo-linux-opensuse.svg',
      'icon-kbd-logo_linux_redhat': '/icons/kbd/logo-linux-redhat.svg',
      'icon-kbd-logo_linux_tux_ibm_invert': '/icons/kbd/logo-linux-tux-ibm-invert.svg',
      'icon-kbd-logo_linux_tux_ibm': '/icons/kbd/logo-linux-tux-ibm.svg',
      'icon-kbd-logo_linux_tux': '/icons/kbd/logo-linux-tux.svg',
      'icon-kbd-logo_ubuntu_cof_circle': '/icons/kbd/logo-ubuntu_cof-circle.svg',
      'icon-kbd-logo_ubuntu_cof': '/icons/kbd/logo-ubuntu_cof.svg',
      'icon-kbd-logo_vim': '/icons/kbd/logo-vim.svg',
      'icon-kbd-logo_windows_7': '/icons/kbd/logo-windows-7.svg',
      'icon-kbd-logo_windows_8': '/icons/kbd/logo-windows-8.svg',
      'icon-kbd-logo_winlin_cygwin': '/icons/kbd/logo-winlin-cygwin.svg',
      'icon-kbd-unie600_kbd_custom': '/icons/kbd/uniE600_kbd-custom.svg',
      'icon-kbd-unie601_kbd_custom': '/icons/kbd/uniE601_kbd-custom.svg',
      'icon-kbd-unie602_kbd_custom': '/icons/kbd/uniE602_kbd-custom.svg',
      'icon-kbd-unie603_kbd_custom': '/icons/kbd/uniE603_kbd-custom.svg',
      'icon-kbd-unie604_kbd_custom': '/icons/kbd/uniE604_kbd-custom.svg',
      'icon-kbd-unie605_kbd_custom': '/icons/kbd/uniE605_kbd-custom.svg',
      'icon-kbd-unie606_kbd_custom': '/icons/kbd/uniE606_kbd-custom.svg',
      'icon-kbd-unie607_kbd_custom': '/icons/kbd/uniE607_kbd-custom.svg',
      'icon-kbd-unie608_kbd_custom': '/icons/kbd/uniE608_kbd-custom.svg',
      'icon-kbd-unie609_kbd_custom': '/icons/kbd/uniE609_kbd-custom.svg',
      'icon-kbd-unie60a_kbd_custom': '/icons/kbd/uniE60A_kbd-custom.svg',
      'icon-kbd-unie60b_kbd_custom': '/icons/kbd/uniE60B_kbd-custom.svg',
      'icon-kbd-unie60c_kbd_custom': '/icons/kbd/uniE60C_kbd-custom.svg',
      'icon-kbd-unie60d_kbd_custom': '/icons/kbd/uniE60D_kbd-custom.svg',
      'icon-kbd-unie60e_kbd_custom': '/icons/kbd/uniE60E_kbd-custom.svg',
      'icon-kbd-unie60f_kbd_custom': '/icons/kbd/uniE60F_kbd-custom.svg',
      'icon-kbd-unie610_kbd_custom': '/icons/kbd/uniE610_kbd-custom.svg',
      'icon-kbd-unie611_kbd_custom': '/icons/kbd/uniE611_kbd-custom.svg',
      'icon-kbd-unie612_kbd_custom': '/icons/kbd/uniE612_kbd-custom.svg',
      'icon-kbd-unie613_kbd_custom': '/icons/kbd/uniE613_kbd-custom.svg',
      'icon-kbd-unie614_kbd_custom': '/icons/kbd/uniE614_kbd-custom.svg',
      'icon-kbd-unie615_kbd_custom': '/icons/kbd/uniE615_kbd-custom.svg',
      'icon-kbd-unie616_kbd_custom': '/icons/kbd/uniE616_kbd-custom.svg',
      'icon-kbd-unie617_kbd_custom': '/icons/kbd/uniE617_kbd-custom.svg',
      'icon-kbd-unie618_kbd_custom': '/icons/kbd/uniE618_kbd-custom.svg',
      'icon-kbd-unie619_kbd_custom': '/icons/kbd/uniE619_kbd-custom.svg',
      'icon-kbd-unie700_kbd_custom': '/icons/kbd/uniE700_kbd-custom.svg',
      'icon-kbd-unie701_kbd_custom': '/icons/kbd/uniE701_kbd-custom.svg',
      'icon-kbd-unie702_kbd_custom': '/icons/kbd/uniE702_kbd-custom.svg',
      'icon-kbd-unie703_kbd_custom': '/icons/kbd/uniE703_kbd-custom.svg',
      'icon-kbd-unie704_kbd_custom': '/icons/kbd/uniE704_kbd-custom.svg',
      'icon-kbd-unie800_kbd_custom': '/icons/kbd/uniE800_kbd-custom.svg',
      'icon-kbd-unie801_kbd_custom': '/icons/kbd/uniE801_kbd-custom.svg',
      'icon-kbd-unie802_kbd_custom': '/icons/kbd/uniE802_kbd-custom.svg',
      'icon-kbd-unie803_kbd_custom': '/icons/kbd/uniE803_kbd-custom.svg',
      'icon-kbd-unie804_kbd_custom': '/icons/kbd/uniE804_kbd-custom.svg',
      'icon-kbd-unie805_kbd_custom': '/icons/kbd/uniE805_kbd-custom.svg',
      'icon-kbd-unie806_kbd_custom': '/icons/kbd/uniE806_kbd-custom.svg',
      'icon-kbd-unie807_kbd_custom': '/icons/kbd/uniE807_kbd-custom.svg',
      'icon-kbd-unie808_kbd_custom': '/icons/kbd/uniE808_kbd-custom.svg',
      'icon-kbd-unie809_kbd_custom': '/icons/kbd/uniE809_kbd-custom.svg',
      'icon-kbd-unie80a_kbd_custom': '/icons/kbd/uniE80A_kbd-custom.svg',
      'icon-kbd-unie80b_kbd_custom': '/icons/kbd/uniE80B_kbd-custom.svg',
      'icon-kbd-unie80c_kbd_custom': '/icons/kbd/uniE80C_kbd-custom.svg',
      'icon-kbd-unie80d_kbd_custom': '/icons/kbd/uniE80D_kbd-custom.svg',
      'icon-kbd-unie80e_kbd_custom': '/icons/kbd/uniE80E_kbd-custom.svg',
      'icon-kbd-unie80f_kbd_custom': '/icons/kbd/uniE80F_kbd-custom.svg',
      'icon-kbd-unie810_kbd_custom': '/icons/kbd/uniE810_kbd-custom.svg',
      'icon-kbd-unie811_kbd_custom': '/icons/kbd/uniE811_kbd-custom.svg',
      'icon-kbd-unie812_kbd_custom': '/icons/kbd/uniE812_kbd-custom.svg',
      'icon-kbd-unie813_kbd_custom': '/icons/kbd/uniE813_kbd-custom.svg',
      'icon-kbd-unie814_kbd_custom': '/icons/kbd/uniE814_kbd-custom.svg',
      'icon-kbd-unie815_kbd_custom': '/icons/kbd/uniE815_kbd-custom.svg',
      'icon-kbd-unie816_kbd_custom': '/icons/kbd/uniE816_kbd-custom.svg',
      'icon-kbd-unie817_kbd_custom': '/icons/kbd/uniE817_kbd-custom.svg',
      'icon-kbd-unie818_kbd_custom': '/icons/kbd/uniE818_kbd-custom.svg',
      'icon-kbd-unie819_kbd_custom': '/icons/kbd/uniE819_kbd-custom.svg',
      'icon-kbd-unie81a_kbd_custom': '/icons/kbd/uniE81A_kbd-custom.svg',
      'icon-kbd-unie81b_kbd_custom': '/icons/kbd/uniE81B_kbd-custom.svg',
      'icon-kbd-unie81c_kbd_custom': '/icons/kbd/uniE81C_kbd-custom.svg',
      'icon-kbd-unie81d_kbd_custom': '/icons/kbd/uniE81D_kbd-custom.svg',
      'icon-kbd-unie81e_kbd_custom': '/icons/kbd/uniE81E_kbd-custom.svg',
      'icon-kbd-unie81f_kbd_custom': '/icons/kbd/uniE81F_kbd-custom.svg',
      'icon-kbd-unie820_kbd_custom': '/icons/kbd/uniE820_kbd-custom.svg',
      'icon-kbd-unie821_kbd_custom': '/icons/kbd/uniE821_kbd-custom.svg',
      'icon-kbd-unie822_kbd_custom': '/icons/kbd/uniE822_kbd-custom.svg',
      'icon-kbd-unie823_kbd_custom': '/icons/kbd/uniE823_kbd-custom.svg',
      'icon-kbd-unie824_kbd_custom': '/icons/kbd/uniE824_kbd-custom.svg',
      'icon-kbd-unie825_kbd_custom': '/icons/kbd/uniE825_kbd-custom.svg',
      'icon-kbd-unie826_kbd_custom': '/icons/kbd/uniE826_kbd-custom.svg',
      'icon-kbd-unie827_kbd_custom': '/icons/kbd/uniE827_kbd-custom.svg',
      'icon-kbd-unie828_kbd_custom': '/icons/kbd/uniE828_kbd-custom.svg',
      'icon-kbd-unie829_kbd_custom': '/icons/kbd/uniE829_kbd-custom.svg',
      'icon-kbd-unie82a_kbd_custom': '/icons/kbd/uniE82A_kbd-custom.svg',
      'icon-kbd-unie82b_kbd_custom': '/icons/kbd/uniE82B_kbd-custom.svg',
      'icon-kbd-unie82c_kbd_custom': '/icons/kbd/uniE82C_kbd-custom.svg',
      'icon-kbd-unie82d_kbd_custom': '/icons/kbd/uniE82D_kbd-custom.svg',
      'icon-kbd-unie82e_kbd_custom': '/icons/kbd/uniE82E_kbd-custom.svg',
      'icon-kbd-unie82f_kbd_custom': '/icons/kbd/uniE82F_kbd-custom.svg',
      'icon-kbd-unie830_kbd_custom': '/icons/kbd/uniE830_kbd-custom.svg',
      'icon-kbd-unie831_kbd_custom': '/icons/kbd/uniE831_kbd-custom.svg',
      'icon-kbd-unie832_kbd_custom': '/icons/kbd/uniE832_kbd-custom.svg',
      'icon-kbd-unie833_kbd_custom': '/icons/kbd/uniE833_kbd-custom.svg',
      'icon-kbd-unie834_kbd_custom': '/icons/kbd/uniE834_kbd-custom.svg',
      'icon-kbd-unie835_kbd_custom': '/icons/kbd/uniE835_kbd-custom.svg',
      'icon-kbd-unie836_kbd_custom': '/icons/kbd/uniE836_kbd-custom.svg',
      'icon-kbd-unie837_kbd_custom': '/icons/kbd/uniE837_kbd-custom.svg',
      'icon-kbd-unie838_kbd_custom': '/icons/kbd/uniE838_kbd-custom.svg',
      'icon-kbd-unie839_kbd_custom': '/icons/kbd/uniE839_kbd-custom.svg',
      'icon-kbd-unie83a_kbd_custom': '/icons/kbd/uniE83A_kbd-custom.svg',
      'icon-kbd-unie83b_kbd_custom': '/icons/kbd/uniE83B_kbd-custom.svg',
      'icon-kbd-unie83c_kbd_custom': '/icons/kbd/uniE83C_kbd-custom.svg',
      'icon-kbd-unie83d_kbd_custom': '/icons/kbd/uniE83D_kbd-custom.svg',
      'icon-kbd-unie83e_kbd_custom': '/icons/kbd/uniE83E_kbd-custom.svg',
      'icon-kbd-unie83f_kbd_custom': '/icons/kbd/uniE83F_kbd-custom.svg',
      'icon-kbd-unie840_kbd_custom': '/icons/kbd/uniE840_kbd-custom.svg',
      'icon-kbd-unie841_kbd_custom': '/icons/kbd/uniE841_kbd-custom.svg',
      'icon-kbd-unie842_kbd_custom': '/icons/kbd/uniE842_kbd-custom.svg',
      'icon-kbd-unie843_kbd_custom': '/icons/kbd/uniE843_kbd-custom.svg',
      'icon-kbd-unie844_kbd_custom': '/icons/kbd/uniE844_kbd-custom.svg',
      'icon-kbd-unie845_kbd_custom': '/icons/kbd/uniE845_kbd-custom.svg',
      'icon-kbd-unie846_kbd_custom': '/icons/kbd/uniE846_kbd-custom.svg',
      'icon-kbd-unie847_kbd_custom': '/icons/kbd/uniE847_kbd-custom.svg',
      'icon-kbd-unie848_kbd_custom': '/icons/kbd/uniE848_kbd-custom.svg',
      'icon-kbd-unie849_kbd_custom': '/icons/kbd/uniE849_kbd-custom.svg',
      'icon-kbd-unie84a_kbd_custom': '/icons/kbd/uniE84A_kbd-custom.svg',
      'icon-kbd-unie84b_kbd_custom': '/icons/kbd/uniE84B_kbd-custom.svg',
      'icon-kbd-unie84c_kbd_custom': '/icons/kbd/uniE84C_kbd-custom.svg',
      'icon-kbd-unie84d_kbd_custom': '/icons/kbd/uniE84D_kbd-custom.svg',
      'icon-kbd-unie84e_kbd_custom': '/icons/kbd/uniE84E_kbd-custom.svg',
      'icon-kbd-unie84f_kbd_custom': '/icons/kbd/uniE84F_kbd-custom.svg',
      'icon-kbd-unie850_kbd_custom': '/icons/kbd/uniE850_kbd-custom.svg',
      'icon-kbd-unie851_kbd_custom': '/icons/kbd/uniE851_kbd-custom.svg',
      'icon-kbd-unie852_kbd_custom': '/icons/kbd/uniE852_kbd-custom.svg',
      'icon-kbd-unie853_kbd_custom': '/icons/kbd/uniE853_kbd-custom.svg',
      'icon-kbd-unie854_kbd_custom': '/icons/kbd/uniE854_kbd-custom.svg',
      'icon-kbd-unie855_kbd_custom': '/icons/kbd/uniE855_kbd-custom.svg',
      'icon-kbd-unie856_kbd_custom': '/icons/kbd/uniE856_kbd-custom.svg',
      'icon-kbd-unie857_kbd_custom': '/icons/kbd/uniE857_kbd-custom.svg',
      'icon-kbd-unie858_kbd_custom': '/icons/kbd/uniE858_kbd-custom.svg',
      'icon-kbd-unie859_kbd_custom': '/icons/kbd/uniE859_kbd-custom.svg',
      'icon-kbd-unie85a_kbd_custom': '/icons/kbd/uniE85A_kbd-custom.svg',
      'icon-kbd-unie85b_kbd_custom': '/icons/kbd/uniE85B_kbd-custom.svg',
      'icon-kbd-unie85c_kbd_custom': '/icons/kbd/uniE85C_kbd-custom.svg',
      'icon-kbd-unie85d_kbd_custom': '/icons/kbd/uniE85D_kbd-custom.svg',
      'icon-kbd-unie85e_kbd_custom': '/icons/kbd/uniE85E_kbd-custom.svg',
      'icon-kbd-unie85f_kbd_custom': '/icons/kbd/uniE85F_kbd-custom.svg',
      'icon-kbd-unie860_kbd_custom': '/icons/kbd/uniE860_kbd-custom.svg',
      'icon-kbd-unie861_kbd_custom': '/icons/kbd/uniE861_kbd-custom.svg',
      'icon-kbd-unie862_kbd_custom': '/icons/kbd/uniE862_kbd-custom.svg',
      'icon-kbd-unie863_kbd_custom': '/icons/kbd/uniE863_kbd-custom.svg',
      'icon-kbd-unie864_kbd_custom': '/icons/kbd/uniE864_kbd-custom.svg',
      'icon-kbd-unie865_kbd_custom': '/icons/kbd/uniE865_kbd-custom.svg',
      'icon-kbd-unie866_kbd_custom': '/icons/kbd/uniE866_kbd-custom.svg',
      'icon-kbd-unie867_kbd_custom': '/icons/kbd/uniE867_kbd-custom.svg',
      'icon-kbd-unie868_kbd_custom': '/icons/kbd/uniE868_kbd-custom.svg',
      'icon-kbd-unie869_kbd_custom': '/icons/kbd/uniE869_kbd-custom.svg',
      'icon-kbd-unie86a_kbd_custom': '/icons/kbd/uniE86A_kbd-custom.svg',
      'icon-kbd-unie86b_kbd_custom': '/icons/kbd/uniE86B_kbd-custom.svg',
      'icon-kbd-unie86c_kbd_custom': '/icons/kbd/uniE86C_kbd-custom.svg',
      'icon-kbd-unie86d_kbd_custom': '/icons/kbd/uniE86D_kbd-custom.svg',
      'icon-kbd-unie86e_kbd_custom': '/icons/kbd/uniE86E_kbd-custom.svg',
      'icon-kbd-unie86f_kbd_custom': '/icons/kbd/uniE86F_kbd-custom.svg',
      'icon-kbd-unie870_kbd_custom': '/icons/kbd/uniE870_kbd-custom.svg',
      'icon-kbd-unie8a0_kbd_custom': '/icons/kbd/uniE8A0_kbd-custom.svg',
      'icon-kbd-unie8a1_kbd_custom': '/icons/kbd/uniE8A1_kbd-custom.svg',
      'icon-kbd-unie8a2_kbd_custom': '/icons/kbd/uniE8A2_kbd-custom.svg',
      'icon-kbd-unie8a3_kbd_custom': '/icons/kbd/uniE8A3_kbd-custom.svg',
      'icon-kbd-unie8a4_kbd_custom': '/icons/kbd/uniE8A4_kbd-custom.svg',
      'icon-kbd-unie8a5_kbd_custom': '/icons/kbd/uniE8A5_kbd-custom.svg',
      'icon-kbd-unie8a6_kbd_custom': '/icons/kbd/uniE8A6_kbd-custom.svg'
    };
    
    const path = svgPaths[iconName];
    if (!path) return null;
    
    const img = new Image();
    img.src = path;
    img.onload = () => {
      // Clear colored cache when base image loads
      coloredIconCache.current.clear();
      requestRender(); // Re-render when image loads
    };
    
    svgImageCache.current.set(cacheKey, img);
    return img;
  };
  
  // Get or create colored version of icon
  const getColoredIcon = (iconName: string, color: string, size: number): HTMLCanvasElement | null => {
    const cacheKey = `${iconName}-${color}-${size}`;
    
    // Check cache first
    if (coloredIconCache.current.has(cacheKey)) {
      return coloredIconCache.current.get(cacheKey) || null;
    }
    
    const svgImage = loadSvgIcon(iconName);
    if (!svgImage || !svgImage.complete) return null;
    
    // Create colored version
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Draw the SVG
    ctx.drawImage(svgImage, 0, 0, size, size);
    
    // Apply color by compositing
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    
    // Cache the result
    coloredIconCache.current.set(cacheKey, canvas);
    return canvas;
  };

  // Fast render function
  const render = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    // Debug: confirm render is running

    // Clear canvas with appropriate background for theme
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { editorSettings, keyboard, selectedKeys, hoveredKey } = stateRef.current;
    const unitSize = editorSettings.unitSize;
    const keyInset = 1; // 1 pixel inset on all sides = 2 pixel gap between keys

    // Save context and apply padding transform
    ctx.save();
    ctx.translate(CANVAS_PADDING_LEFT, CANVAS_PADDING_TOP);

    // Update key rectangles
    keyRectsRef.current = [];

    // Draw keys
    keyboard.keys.forEach(key => {
      // Calculate exact position and size
      const baseX = key.x * unitSize;
      const baseY = key.y * unitSize;
      const baseWidth = key.width * unitSize;
      const baseHeight = key.height * unitSize;
      
      // Round AFTER applying inset to ensure consistent gaps
      const keyX = Math.round(baseX + keyInset);
      const keyY = Math.round(baseY + keyInset);
      // Calculate width/height directly to preserve fractional key sizes
      const keyWidth = Math.round(baseWidth - keyInset * 2);
      const keyHeight = Math.round(baseHeight - keyInset * 2);
      
      // Apply drag offset to selected keys
      let renderX = keyX;
      let renderY = keyY;
      if (isDraggingRef.current && selectedKeys.has(key.id)) {
        renderX += dragOffsetRef.current.x;
        renderY += dragOffsetRef.current.y;
      }
      
      // Apply rotation if needed
      const hasRotation = key.rotation_angle !== undefined && key.rotation_angle !== 0;
      if (hasRotation) {
        ctx.save();
        
        // Determine rotation center
        let rotationCenterX: number;
        let rotationCenterY: number;
        
        if (key.rotation_x !== undefined && key.rotation_y !== undefined) {
          // Use custom rotation center
          rotationCenterX = key.rotation_x * unitSize;
          rotationCenterY = key.rotation_y * unitSize;
        } else {
          // Default to key center
          rotationCenterX = renderX + keyWidth / 2;
          rotationCenterY = renderY + keyHeight / 2;
        }
        
        // Apply rotation transform
        ctx.translate(rotationCenterX, rotationCenterY);
        ctx.rotate(key.rotation_angle! * Math.PI / 180);
        ctx.translate(-rotationCenterX, -rotationCenterY);
      }
      
      // Store rect for hit testing
      keyRectsRef.current.push({
        id: key.id,
        x: renderX,
        y: renderY,
        width: keyWidth,
        height: keyHeight,
        key: key
      });
      
      // Handle special key types
      if (key.ghost && !(key.decal && key.color === 'transparent')) {
        // Regular ghost keys (not row labels) are rendered as flat, semi-transparent rectangles
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = key.color || '#cccccc';
        ctx.fillRect(renderX, renderY, keyWidth, keyHeight);
        
        // Draw border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(renderX, renderY, keyWidth, keyHeight);
        
        // Ghost keys should not render any text
        
        ctx.restore();
        
        // Skip the rest of the rendering for regular ghost keys
        return;
      }
      
      // Check if this is a rotary encoder
      if (key.profile === 'ENCODER') {
        // Draw simple encoder circle with position indicator
        ctx.save();
        
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        const radius = Math.min(keyWidth, keyHeight) / 2 - 2; // Slight padding
        
        // Draw outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        const baseColor = key.color || '#cccccc';
        ctx.fillStyle = baseColor;
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = isDarkMode ? '#666666' : '#333333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw position indicator line (from center to top)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - radius * 0.7);
        ctx.strokeStyle = '#000000';
        // Make line thickness proportional to encoder size
        ctx.lineWidth = Math.max(2, radius * 0.1);
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();
        
        // Skip normal key rendering for encoders
      } else if (key.profile === 'LED') {
        // Draw LED indicator as a circle
        ctx.save();
        
        // LED should be drawn as a circle at the center of the key position
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        const radius = Math.min(keyWidth, keyHeight) / 2;
        
        // Draw outer ring (bezel)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#333333';
        ctx.fill();
        
        // Draw inner LED
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        
        // Use the key color for the LED
        const ledColor = key.color || '#ff0000';
        
        // Create gradient for LED effect
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.8);
        gradient.addColorStop(0, ledColor);
        gradient.addColorStop(0.7, ledColor);
        gradient.addColorStop(1, adjustColorBrightness(ledColor, -50));
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add glossy effect
        ctx.beginPath();
        ctx.arc(centerX, centerY - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
        const glossGradient = ctx.createRadialGradient(
          centerX, centerY - radius * 0.3, 0,
          centerX, centerY - radius * 0.3, radius * 0.3
        );
        glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glossGradient;
        ctx.fill();
        
        ctx.restore();
        
        // Skip normal key rendering for LEDs
      } else if (key.decal) {
        // For decal keys, skip all the key rendering and only draw text
        // No shadow, no key shape, just transparent
        ctx.shadowColor = 'transparent';
      } else {
        // Shadow for the entire key
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }
      
      // Get base color - brighten slightly when hovered
      const keyColor = key.color || '#f9f9f9';
      const baseColor = keyColor;
      
      // 3D key rendering with visible edges
      const edgeHeight = key.decal ? 0 : 6; // Height of the visible edge (0 for decals)
      const topOffset = key.decal ? 0 : 3; // How much the top surface is offset (0 for decals)
      
      // Only render the key shape if it's not a decal, LED, or encoder
      if (!key.decal && key.profile !== 'LED' && key.profile !== 'ENCODER') {
        // Parse base color to RGB
        const parseColor = (color: string) => {
          // Ensure color starts with #
          const normalizedColor = color.startsWith('#') ? color : `#${color}`;
          const rgb = parseInt(normalizedColor.slice(1), 16);
          return {
            r: (rgb >> 16) & 255,
            g: (rgb >> 8) & 255,
            b: rgb & 255
          };
        };
        
        const adjustBrightness = (color: { r: number, g: number, b: number }, amount: number) => {
          return {
            r: Math.max(0, Math.min(255, color.r + amount)),
            g: Math.max(0, Math.min(255, color.g + amount)),
            b: Math.max(0, Math.min(255, color.b + amount))
          };
        };
        
        const toRgbString = (color: { r: number, g: number, b: number }) => {
          return `rgb(${color.r}, ${color.g}, ${color.b})`;
        };
        
        let baseRgb = parseColor(baseColor);
        
        // Brighten the key when hovered
        if (hoveredKey === key.id) {
          baseRgb = adjustBrightness(baseRgb, 20);
        }
        
        const sideColor = toRgbString(adjustBrightness(baseRgb, -40));
        const bottomColor = toRgbString(adjustBrightness(baseRgb, -80));
      
        // Check if this is a special shaped key (ISO Enter, Big Ass Enter)
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        
        if (hasSecondaryRect) {
          // Draw complex shape (like ISO Enter or Big Ass Enter)
          // Calculate secondary rectangle offsets
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          // For Big Ass Enter and ISO Enter, we need to draw it as one unified shape
          // Draw the unified bottom layer first
          ctx.fillStyle = bottomColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY + topOffset, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(renderX + x2, renderY + y2 + topOffset, width2, height2 - topOffset, 5);
          ctx.fill();
          
          // Draw the unified middle layer
          ctx.fillStyle = sideColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(renderX + x2, renderY + y2, width2, height2 - topOffset, 5);
          ctx.fill();
          
          
          // Draw the top surfaces
          ctx.fillStyle = toRgbString(baseRgb);
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          ctx.beginPath();
          ctx.roundRect(
            renderX + x2 + edgeHeight, 
            renderY + y2 + edgeHeight, 
            width2 - edgeHeight * 2, 
            height2 - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          // Add subtle highlight on top surfaces
          const highlightGradient = ctx.createLinearGradient(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            renderX + edgeHeight, 
            renderY + edgeHeight + 20
          );
          highlightGradient.addColorStop(0, toRgbString(adjustBrightness(baseRgb, 15)));
          highlightGradient.addColorStop(1, toRgbString(baseRgb));
          
          ctx.fillStyle = highlightGradient;
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          ctx.beginPath();
          ctx.roundRect(
            renderX + x2 + edgeHeight, 
            renderY + y2 + edgeHeight, 
            width2 - edgeHeight * 2, 
            height2 - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
        } else {
          // Draw simple rectangular key with all 4 visible edges
          
          // First draw the base (bottom layer) in the darkest color
          ctx.fillStyle = bottomColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY + topOffset, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          
          // Draw the middle layer (the visible edges) in medium color
          ctx.fillStyle = sideColor;
          ctx.beginPath();
          ctx.roundRect(renderX, renderY, keyWidth, keyHeight - topOffset, 5);
          ctx.fill();
          
          // Draw the top surface
          ctx.fillStyle = toRgbString(baseRgb);
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
          
          // Add subtle highlight on top surface
          const highlightGradient = ctx.createLinearGradient(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            renderX + edgeHeight, 
            renderY + edgeHeight + 20
          );
          highlightGradient.addColorStop(0, toRgbString(adjustBrightness(baseRgb, 15)));
          highlightGradient.addColorStop(1, toRgbString(baseRgb));
          
          ctx.fillStyle = highlightGradient;
          ctx.beginPath();
          ctx.roundRect(
            renderX + edgeHeight, 
            renderY + edgeHeight, 
            keyWidth - edgeHeight * 2, 
            keyHeight - edgeHeight * 2 - topOffset, 
            4
          );
          ctx.fill();
        }
      
        // Draw stepped key indicator
        if (key.stepped) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Darker shade
          
          // Check if key has secondary dimensions (like stepped Caps Lock)
          if (key.x2 !== undefined || key.y2 !== undefined || key.width2 || key.height2) {
            const x2 = (key.x2 || 0) * unitSize;
            const y2 = (key.y2 || 0) * unitSize;
            const width2 = (key.width2 || key.width) * unitSize;
            const height2 = (key.height2 || key.height) * unitSize;
            
            // Only shade the primary rectangle if y2 > 0 (there's a gap between them)
            if (y2 > 0) {
              ctx.fillRect(
                renderX + keyWidth * 0.5, // Start at middle
                renderY + edgeHeight, 
                keyWidth * 0.5 - edgeHeight, // Extend to right edge
                keyHeight - edgeHeight * 2 - topOffset
              );
            }
            
            // Always shade the secondary rectangle's right half
            ctx.fillRect(
              renderX + x2 + width2 * 0.5, // Start at middle of secondary
              renderY + y2 + edgeHeight,
              width2 * 0.5 - edgeHeight, // Extend to right edge
              height2 - edgeHeight * 2 - topOffset
            );
          } else {
            // For regular keys, shade from middle to right
            ctx.fillRect(
              renderX + keyWidth * 0.5, // Start at middle
              renderY + edgeHeight, 
              keyWidth * 0.5 - edgeHeight, // Extend to right edge minus the edge border
              keyHeight - edgeHeight * 2 - topOffset
            );
          }
        }
        
        // Draw homing nub indicator
        if (key.nub) {
          // Draw a more pronounced circular depression in the center of the key
          const centerX = renderX + keyWidth / 2;
          const centerY = renderY + keyHeight / 2;
          const radius = Math.min(keyWidth, keyHeight) * 0.25; // Increased from 0.15
          
          // Create radial gradient for depression effect with stronger shading
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)'); // Increased from 0.15
          gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)'); // Added middle stop
          gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)'); // Changed from 0.7
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fill();
        }
      } // End of if (!key.decal)
      
      
      // Draw selection outline if selected (skip for row labels)
      if (selectedKeys.has(key.id) && !(key.decal && key.ghost)) {
        // Check if this is a special shaped key
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        // Draw a thick outline with a contrasting color
        // Use green for duplicated keys, blue for regular selection
        if (isDuplicatingRef.current && duplicatedKeysRef.current.has(key.id)) {
          ctx.strokeStyle = '#27ae60'; // Green for duplicates
          ctx.setLineDash([5, 3]); // Dashed line for duplicates
        } else {
          ctx.strokeStyle = '#3498db';
          ctx.setLineDash([]);
        }
        ctx.lineWidth = 3;
        
        if (hasSecondaryRect) {
          // For special keys, we need to draw a path that follows the actual shape
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          // Draw the selection outline as a unified shape
          const outlineOffset = 1;
          const radius = 6;
          
          // Create a path that outlines the L-shaped key
          ctx.beginPath();
          
          // Determine the type of special key and draw appropriate outline
          // Check if this is an L-shaped key (ISO Enter, Big Ass Enter, etc)
          const isLShaped = (x2 !== 0 || y2 !== 0) && (width2 !== key.width || height2 !== key.height);
                    
          if (isLShaped) {
            // Draw a continuous outline for L-shaped keys
            // We'll create a path that traces the outer edge of the combined shape
            
            // Draw the L-shape outline
            if (x2 < 0 && height2 < keyHeight) {
              // ISO Enter type - secondary rect is at top and extends left
              // Typical ISO: x2:-0.25, y2:0, h2:1, h:2
              
              // For ISO Enter, we need to trace the actual L-shape outline
              // Start from top-left of secondary rect
              ctx.moveTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              
              // Top-left corner of secondary rect
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, renderX + x2 - outlineOffset, renderY + y2 - outlineOffset + radius, radius);
              
              // Left side of secondary rect going down
              ctx.lineTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset);
              
              // Since x2 is negative, this creates the notch - go RIGHT to main rect left edge
              ctx.lineTo(renderX - outlineOffset, renderY + y2 + height2 + outlineOffset);
              
              // Down the left side of main rect (continuing from where secondary rect ends)
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              
              // Bottom-left corner of main rect
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              
              // Bottom of main rect
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              
              // Bottom-right corner of main rect
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              
              // Right side of main rect going up to top of main rect
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY + radius);
              
              // Top-right corner of main rect
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY, renderX + keyWidth + outlineOffset - radius, renderY, radius);
              
              // Top of main rect going left to where secondary rect connects
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY);
              
              // Top-right corner of secondary rect area
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY, renderX + x2 + width2 + outlineOffset, renderY + radius, radius);
              
              // Right side of secondary rect going up
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              
              // Top-right corner of secondary rect
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              
              // Top of secondary rect back to start
              ctx.lineTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              
              ctx.closePath();
            } else if (y2 < 0) {
              // Original ISO Enter type where y2 is negative
              ctx.moveTo(renderX + x2 - outlineOffset + radius, renderY + y2 - outlineOffset);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, renderX + x2 - outlineOffset, renderY + y2 - outlineOffset + radius, radius);
              ctx.lineTo(renderX + x2 - outlineOffset, renderY - outlineOffset - radius);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY - outlineOffset, renderX + x2 - outlineOffset + radius, renderY - outlineOffset, radius);
              ctx.lineTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY + y2 + height2 + outlineOffset - radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY + y2 + height2 + outlineOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY + y2 + height2 + outlineOffset);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              ctx.closePath();
            } else if (x2 > 0) {
              // Big Ass Enter type (secondary rect extends to the right)
              ctx.moveTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + x2 - outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + keyHeight + outlineOffset, renderX + x2 - outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset - radius);
              ctx.arcTo(renderX + x2 - outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 - outlineOffset + radius, renderY + y2 + height2 + outlineOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset - radius, renderY + y2 + height2 + outlineOffset);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset, renderX + x2 + width2 + outlineOffset, renderY + y2 + height2 + outlineOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + outlineOffset, renderY + y2 - outlineOffset, renderX + x2 + width2 + outlineOffset - radius, renderY + y2 - outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + y2 - outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + y2 - outlineOffset, renderX + keyWidth + outlineOffset, renderY + y2 - outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset + radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY - outlineOffset, radius);
              ctx.closePath();
            } else {
              // Generic L-shape - for now use the same approach as other ISO variants
              // This ensures all L-shaped keys get a continuous outline
              ctx.moveTo(renderX - outlineOffset + radius, renderY - outlineOffset);
              ctx.arcTo(renderX - outlineOffset, renderY - outlineOffset, renderX - outlineOffset, renderY - outlineOffset + radius, radius);
              ctx.lineTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset - radius);
              ctx.arcTo(renderX - outlineOffset, renderY + keyHeight + outlineOffset, renderX - outlineOffset + radius, renderY + keyHeight + outlineOffset, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset - radius, renderY + keyHeight + outlineOffset);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset, renderX + keyWidth + outlineOffset, renderY + keyHeight + outlineOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset + radius);
              ctx.arcTo(renderX + keyWidth + outlineOffset, renderY - outlineOffset, renderX + keyWidth + outlineOffset - radius, renderY - outlineOffset, radius);
              ctx.closePath();
            }
          } else {
            // For stepped keys or other special cases
            // Check if this is a stepped caps lock with overlapping rectangles
            if (key.stepped && y2 === 0 && x2 === 0) {
              // Stepped caps lock - draw as one continuous outline
              // Combine both rectangles into one path
              const combinedWidth = Math.max(keyWidth, width2);
              const combinedHeight = Math.max(keyHeight, y2 + height2);
              ctx.roundRect(renderX - outlineOffset, renderY - outlineOffset, combinedWidth + outlineOffset * 2, combinedHeight + outlineOffset * 2, radius);
            } else {
              // Other special keys - draw separate rectangles
              ctx.roundRect(renderX - outlineOffset, renderY - outlineOffset, keyWidth + outlineOffset * 2, keyHeight + outlineOffset * 2, radius);
              if (width2 > 0 || height2 > 0) {
                ctx.roundRect(renderX + x2 - outlineOffset, renderY + y2 - outlineOffset, width2 + outlineOffset * 2, height2 + outlineOffset * 2, radius);
              }
            }
          }
          
          ctx.stroke();
          
          // Add a white inner stroke for better contrast
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          const innerOffset = 2;
          
          // Repeat the same path but with larger offset for the inner stroke
          ctx.beginPath();
          if (isLShaped) {
            if (x2 < 0 && height2 < keyHeight) {
              // ISO Enter type - Same path logic but with innerOffset instead of outlineOffset
              // Typical ISO: x2:-0.25, y2:0, h2:1, h:2
              
              // For ISO Enter, we need to trace the actual L-shape outline
              // Start from top-left of secondary rect
              ctx.moveTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              
              // Top-left corner of secondary rect
              ctx.arcTo(renderX + x2 - innerOffset, renderY + y2 - innerOffset, renderX + x2 - innerOffset, renderY + y2 - innerOffset + radius, radius);
              
              // Left side of secondary rect going down
              ctx.lineTo(renderX + x2 - innerOffset, renderY + y2 + height2 + innerOffset);
              
              // Since x2 is negative, this creates the notch - go RIGHT to main rect left edge
              ctx.lineTo(renderX - innerOffset, renderY + y2 + height2 + innerOffset);
              
              // Down the left side of main rect (continuing from where secondary rect ends)
              ctx.lineTo(renderX - innerOffset, renderY + keyHeight + innerOffset - radius);
              
              // Bottom-left corner of main rect
              ctx.arcTo(renderX - innerOffset, renderY + keyHeight + innerOffset, renderX - innerOffset + radius, renderY + keyHeight + innerOffset, radius);
              
              // Bottom of main rect
              ctx.lineTo(renderX + keyWidth + innerOffset - radius, renderY + keyHeight + innerOffset);
              
              // Bottom-right corner of main rect
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset, renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset - radius, radius);
              
              // Right side of main rect going up to top of main rect
              ctx.lineTo(renderX + keyWidth + innerOffset, renderY + radius);
              
              // Top-right corner of main rect
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY, renderX + keyWidth + innerOffset - radius, renderY, radius);
              
              // Top of main rect going left to where secondary rect connects
              ctx.lineTo(renderX + x2 + width2 + innerOffset - radius, renderY);
              
              // Top-right corner of secondary rect area
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY, renderX + x2 + width2 + innerOffset, renderY + radius, radius);
              
              // Right side of secondary rect going up
              ctx.lineTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset + radius);
              
              // Top-right corner of secondary rect
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset, renderX + x2 + width2 + innerOffset - radius, renderY + y2 - innerOffset, radius);
              
              // Top of secondary rect back to start
              ctx.lineTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              
              ctx.closePath();
            } else if (y2 < 0) {
              // Original ISO Enter type where y2 is negative
              ctx.moveTo(renderX + x2 - innerOffset + radius, renderY + y2 - innerOffset);
              ctx.arcTo(renderX + x2 - innerOffset, renderY + y2 - innerOffset, renderX + x2 - innerOffset, renderY + y2 - innerOffset + radius, radius);
              ctx.lineTo(renderX + x2 - innerOffset, renderY - innerOffset - radius);
              ctx.arcTo(renderX + x2 - innerOffset, renderY - innerOffset, renderX + x2 - innerOffset + radius, renderY - innerOffset, radius);
              ctx.lineTo(renderX - innerOffset + radius, renderY - innerOffset);
              ctx.arcTo(renderX - innerOffset, renderY - innerOffset, renderX - innerOffset, renderY - innerOffset + radius, radius);
              ctx.lineTo(renderX - innerOffset, renderY + keyHeight + innerOffset - radius);
              ctx.arcTo(renderX - innerOffset, renderY + keyHeight + innerOffset, renderX - innerOffset + radius, renderY + keyHeight + innerOffset, radius);
              ctx.lineTo(renderX + keyWidth + innerOffset - radius, renderY + keyHeight + innerOffset);
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset, renderX + keyWidth + innerOffset, renderY + keyHeight + innerOffset - radius, radius);
              ctx.lineTo(renderX + keyWidth + innerOffset, renderY + y2 + height2 + innerOffset - radius);
              ctx.arcTo(renderX + keyWidth + innerOffset, renderY + y2 + height2 + innerOffset, renderX + keyWidth + innerOffset - radius, renderY + y2 + height2 + innerOffset, radius);
              ctx.lineTo(renderX + x2 + width2 + innerOffset - radius, renderY + y2 + height2 + innerOffset);
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 + height2 + innerOffset, renderX + x2 + width2 + innerOffset, renderY + y2 + height2 + innerOffset - radius, radius);
              ctx.lineTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset + radius);
              ctx.arcTo(renderX + x2 + width2 + innerOffset, renderY + y2 - innerOffset, renderX + x2 + width2 + innerOffset - radius, renderY + y2 - innerOffset, radius);
              ctx.closePath();
            } else {
              // For other L-shaped keys, draw two rounded rectangles
              ctx.roundRect(renderX - innerOffset, renderY - innerOffset, keyWidth + innerOffset * 2, keyHeight + innerOffset * 2, radius);
              ctx.roundRect(renderX + x2 - innerOffset, renderY + y2 - innerOffset, width2 + innerOffset * 2, height2 + innerOffset * 2, radius);
            }
          } else {
            // For stepped keys or other special cases
            // Check if this is a stepped caps lock with overlapping rectangles
            if (key.stepped && y2 === 0 && x2 === 0) {
              // Stepped caps lock - draw as one continuous outline
              // Combine both rectangles into one path
              const combinedWidth = Math.max(keyWidth, width2);
              const combinedHeight = Math.max(keyHeight, y2 + height2);
              ctx.roundRect(renderX - innerOffset, renderY - innerOffset, combinedWidth + innerOffset * 2, combinedHeight + innerOffset * 2, radius);
            } else {
              // Other special keys - draw separate rectangles
              ctx.roundRect(renderX - innerOffset, renderY - innerOffset, keyWidth + innerOffset * 2, keyHeight + innerOffset * 2, radius);
              if (width2 > 0 || height2 > 0) {
                ctx.roundRect(renderX + x2 - innerOffset, renderY + y2 - innerOffset, width2 + innerOffset * 2, height2 + innerOffset * 2, radius);
              }
            }
          }
          ctx.stroke();
        } else {
          // Regular key - single outline
          // Draw outline slightly outside the key bounds for better visibility
          ctx.beginPath();
          ctx.roundRect(renderX - 1, renderY - 1, keyWidth + 2, keyHeight + 2, 6);
          ctx.stroke();
          
          // Add a white inner stroke for better contrast
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(renderX - 2, renderY - 2, keyWidth + 4, keyHeight + 4, 7);
          ctx.stroke();
        }
      }
      
      // Draw front legends if present
      if (key.frontLegends && key.frontLegends.some(l => l)) {
        ctx.save();
        // Use white text for decal keys in dark mode, otherwise black
        ctx.fillStyle = (key.decal && isDarkMode) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
        const frontFont = key.font || '';
        ctx.font = frontFont ? fontManager.getRenderFont(frontFont, 10) : '10px Arial';
        ctx.textBaseline = 'middle';
        
        const frontY = renderY + keyHeight - 3;
        const padding = 5;
        
        // Check if side-printed text should be centered (bit 2 of align)
        const centerSidePrinted = key.align !== undefined && (key.align & 0x04) !== 0;
        
        if (centerSidePrinted) {
          // If bit 2 is set, each front legend should still be in its own position
          // but the text within that position should be centered
          
          // Left front legend - centered within left third
          if (key.frontLegends[0]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[0], renderX + keyWidth / 6, frontY);
          }
          
          // Center front legend
          if (key.frontLegends[1]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[1], renderX + keyWidth / 2, frontY);
          }
          
          // Right front legend - centered within right third
          if (key.frontLegends[2]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[2], renderX + keyWidth * 5 / 6, frontY);
          }
        } else {
          // Default positioning for front legends
          // Left front legend
          if (key.frontLegends[0]) {
            ctx.textAlign = 'left';
            ctx.fillText(key.frontLegends[0], renderX + padding, frontY);
          }
          
          // Center front legend
          if (key.frontLegends[1]) {
            ctx.textAlign = 'center';
            ctx.fillText(key.frontLegends[1], renderX + keyWidth / 2, frontY);
          }
          
          // Right front legend
          if (key.frontLegends[2]) {
            ctx.textAlign = 'right';
            ctx.fillText(key.frontLegends[2], renderX + keyWidth - padding, frontY);
          }
        }
        
        ctx.restore();
      }
      
      // Draw labels
      ctx.fillStyle = '#000000';
      
      // Special handling for row labels (decal + ghost keys with transparent color)
      if (key.decal && key.ghost && key.color === 'transparent') {
        // Row labels are fully transparent like ghost keys
        ctx.save();
        
        // Draw a ghost key style border
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(renderX, renderY, keyWidth, keyHeight);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        
        // Draw the text if there's a label
        if (key.labels && key.labels.length > 0 && key.labels[0]) {
          const label = key.labels[0];
          const centerX = renderX + keyWidth / 2;
          
          // Draw main label
          ctx.font = 'bold 16px system-ui';
          ctx.fillStyle = isDarkMode ? '#888888' : '#666666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Adjust vertical position based on whether we have shape text
          const centerY = key.rowLabelShape 
            ? renderY + keyHeight / 2 - 8  // Move up if shape text present
            : renderY + keyHeight / 2;      // Center if no shape text
          ctx.fillText(label, centerX, centerY);
          
          // Draw shape text if specified
          if (key.rowLabelShape) {
            ctx.font = '11px system-ui';
            ctx.fillStyle = isDarkMode ? '#666666' : '#888888';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const shapeText = key.rowLabelShape === 'convex' ? 'convex' : 'concave';
            const shapeCenterY = renderY + keyHeight / 2 + 12; // Position below main label
            ctx.fillText(shapeText, centerX, shapeCenterY);
          }
        }
        ctx.restore();
      } else {
      
      
      key.labels.forEach((label, index) => {
        if (!label) return;
        
        // Skip positions that should be handled by front legends or center legend
        if ((index === 4 || index === 6) && key.frontLegends && !key.decal) {
          return;
        }
        if (index === 8 && key.centerLegend && !key.decal) {
          return;
        }
        
        // For decal keys, remap certain positions:
        // Position 6 should render as middle-left (position 7)
        // Position 8 should render as top-center (position 10)
        let mappedIndex = index;
        if (key.decal) {
          if (index === 6) {
            mappedIndex = 7; // middle-left
          } else if (index === 8) {
            mappedIndex = 10; // top-center
          }
        }
        
        const position = getLegendPosition(mappedIndex);
        const legendRotation = key.legendRotation?.[index] || 0;
        
        // Override position if key has align property
        let finalPosition = { ...position };
        if (key.align !== undefined && index < 4) {
          // KLE align is a bit field:
          // 0x01 (bit 0) - Center labels horizontally
          // 0x02 (bit 1) - Center labels vertically  
          // 0x04 (bit 2) - Center side-printed text (for indices 4-11)
          // Note: align only affects main labels (indices 0-3), not front/side legends
          
          const centerHorizontally = (key.align & 0x01) !== 0;
          const centerVertically = (key.align & 0x02) !== 0;
          
          // Start with the default position for this index
          finalPosition = { ...position };
          
          // Apply horizontal centering if bit 0 is set
          if (centerHorizontally) {
            finalPosition.x = 0.5;
            finalPosition.align = 'center';
          }
          
          // Apply vertical centering if bit 1 is set
          if (centerVertically) {
            finalPosition.y = 0.5;
            finalPosition.baseline = 'middle';
          }
        }
        // Check for text size in order: specific index, default size, or fallback to 3
        let textSizeValue = 3;
        if (Array.isArray(key.textSize) && key.textSize[index] !== undefined) {
          textSizeValue = key.textSize[index];
        } else if (key.default?.size && Array.isArray(key.default.size) && key.default.size[0] !== undefined) {
          textSizeValue = key.default.size[0];
        }
        
        
        // Convert KLE textSize (1-9) to actual font size using the formula: 6 + 2*textSize
        const fontSize = 6 + 2 * textSizeValue;
        
        // Check for text color similarly
        let textColor = '#000000';
        
        if (Array.isArray(key.textColor) && key.textColor[index]) {
          textColor = key.textColor[index];
        } else if (Array.isArray(key.textColor) && key.textColor[0]) {
          // Use first color as default for all positions if specific position not set
          textColor = key.textColor[0];
        } else if (key.default?.color && Array.isArray(key.default.color) && key.default.color[0]) {
          textColor = key.default.color[0];
          // Override dark colors for decal keys in dark mode
          if (key.decal && isDarkMode) {
            textColor = '#ffffff';
          }
        } else if (key.decal && isDarkMode) {
          // For decal keys in dark mode, use white text for visibility
          textColor = '#ffffff';
        }
        
        
        // Parse the label for icons
        const parsedLabel = parseIconLegend(label);
        
        
        // Calculate starting position based on alignment
        // For complex shaped keys (like little ass enter), only use the primary rectangle
        let effectiveRenderX = renderX;
        let effectiveRenderY = renderY;
        let effectiveWidth = keyWidth;
        let effectiveHeight = keyHeight;
        
        // Check if this is a "little ass enter" or similar complex key
        // Little ass enter: narrow vertical main rect, wider horizontal secondary rect
        const hasSecondaryRect = key.x2 !== undefined || key.y2 !== undefined || 
                                key.width2 !== undefined || key.height2 !== undefined;
        
        if (hasSecondaryRect && key.x2 !== undefined && key.x2 < 0 && key.width2 && key.width2 > key.width) {
          // This is likely a "little ass enter" - use the secondary (horizontal) rectangle for labels
          // Calculate secondary rectangle offsets
          const x2 = (key.x2 || 0) * unitSize;
          const y2 = (key.y2 || 0) * unitSize;
          const width2 = (key.width2 || key.width) * unitSize - keyInset * 2;
          const height2 = (key.height2 || key.height) * unitSize - keyInset * 2;
          
          effectiveRenderX = renderX + x2;
          effectiveRenderY = renderY + y2;
          effectiveWidth = width2;
          effectiveHeight = height2;
        }
        
        // Adjust for the keycap top surface
        const innerX = effectiveRenderX + edgeHeight;
        const innerY = effectiveRenderY + edgeHeight;
        const innerWidth = effectiveWidth - edgeHeight * 2;
        const innerHeight = effectiveHeight - edgeHeight * 2 - topOffset;
        
        // Calculate position based on the position object from getLegendPosition
        let currentX: number;
        let currentY: number;
        
        // Calculate X position using the relative position from getLegendPosition
        currentX = innerX + (innerWidth * finalPosition.x);
        
        // Calculate Y position using the relative position from getLegendPosition
        currentY = innerY + (innerHeight * finalPosition.y);
        
        // Apply rotation if needed
        const needsRotation = legendRotation !== 0;
        if (needsRotation) {
          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.rotate((legendRotation * Math.PI) / 180);
          // Reset position to origin since we've translated
          currentX = 0;
          currentY = 0;
        }
        
        // Measure total width if needed for center/right alignment
        if (finalPosition.align !== 'start') {
          let totalWidth = 0;
          parsedLabel.forEach(part => {
            if (part.type === 'icon') {
              // Check if this is a custom SVG icon
              if (part.className?.includes('custom-icon')) {
                totalWidth += fontSize; // SVG icons are sized same as font size
              } else {
                // Trashcons font icons
                ctx.font = fontManager.getRenderFont('trashcons', fontSize);
                totalWidth += ctx.measureText(part.content).width;
              }
            } else {
              const keyFont = key.font || '';
              ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
              totalWidth += ctx.measureText(part.content).width;
            }
          });
          
          if (finalPosition.align === 'center') {
            currentX -= totalWidth / 2;
          } else if (finalPosition.align === 'end') {
            currentX -= totalWidth;
          }
        }
        
        // Draw each part
        if (parsedLabel.length === 0 && label) {
          // Fallback - draw as plain text
          const keyFont = key.font || '';
          ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = position.baseline as CanvasTextBaseline;
          ctx.fillText(label, currentX, currentY);
          return;
        }
        
        parsedLabel.forEach((part, partIndex) => {
          if (part.type === 'icon') {
            // Check if this is a custom SVG icon
            if (part.className?.includes('custom-icon') && part.iconName) {
              // Calculate icon size - use fontSize directly to match text sizing
              const iconSize = fontSize;

              // Get colored version of the icon
              const coloredIcon = getColoredIcon(part.iconName, textColor, iconSize);

              if (coloredIcon) {
                // Calculate Y position based on text baseline
                // Note: kbd SVG files have viewBox="0 -200 1000 1000" which includes
                // significant top/bottom padding. The actual icon content is centered
                // in the viewBox, so we need aggressive upward shifts.
                let iconY = currentY;
                if (finalPosition.baseline === 'middle') {
                  // Middle baseline: center of text is at currentY
                  // Icons are already centered in their viewBox, so just center vertically
                  iconY = currentY - iconSize / 2;
                } else if (finalPosition.baseline === 'alphabetic') {
                  // Alphabetic baseline: bottom of text is at currentY
                  // Shift up significantly due to viewBox padding
                  iconY = currentY - iconSize * 0.7;
                } else if (finalPosition.baseline === 'hanging') {
                  // Hanging baseline: top of text is at currentY
                  // SVG viewBox has significant top padding (~20% of viewBox)
                  // Shift up by ~35% of icon size to align with actual top
                  iconY = currentY - iconSize * 0.35;
                }

                // Calculate X position with column alignment
                // Only normalize position if this is the first part (for column alignment)
                // If there's text before the icon, let it flow naturally after the text
                let iconX = currentX;
                if (partIndex === 0) {
                  // First part - apply column normalization for alignment
                  if (finalPosition.align === 'start') {
                    // Left column: normalize all to x=0.10 for vertical alignment
                    const targetX = 0.10;
                    const normalizedX = innerX + (innerWidth * targetX);
                    iconX = normalizedX - iconSize * 0.08; // Apply left padding adjustment
                  } else if (finalPosition.align === 'end') {
                    // Right column: normalize all to x=0.90 for vertical alignment
                    const targetX = 0.90;
                    const normalizedX = innerX + (innerWidth * targetX);
                    iconX = normalizedX + iconSize * 0.18; // Apply right padding adjustment
                  } else {
                    // Center column: use currentX as calculated
                    iconX = currentX;
                  }
                } else {
                  // Subsequent part - position after previous content
                  // Apply only the SVG padding adjustment, not column normalization
                  if (finalPosition.align === 'start') {
                    iconX = currentX - iconSize * 0.08;
                  } else if (finalPosition.align === 'end') {
                    iconX = currentX + iconSize * 0.18;
                  } else {
                    iconX = currentX;
                  }
                }

                // Draw the colored icon
                ctx.drawImage(coloredIcon, iconX, iconY);
                currentX += iconSize;
              }
            } else {
              // Draw Trashcons font icon
              ctx.font = `${fontSize}px trashcons`;
              ctx.fillStyle = textColor;
              ctx.textAlign = 'left';
              ctx.textBaseline = finalPosition.baseline as CanvasTextBaseline;

              // Render the icon character
              if (part.content && part.content.length > 0) {
                ctx.fillText(part.content, currentX, currentY);
                currentX += ctx.measureText(part.content).width;
              }
            }
          } else {
            // Draw regular text - handle newlines for dual legend keys
            const keyFont = key.font || '';
            ctx.font = keyFont ? fontManager.getRenderFont(keyFont, fontSize) : `${fontSize}px Arial`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = finalPosition.baseline as CanvasTextBaseline;
            
            // Check if this text contains newlines (for dual legend keys like ":\n;")
            const lines = part.content.split('\n');
            if (lines.length > 1 && index === 0) {
              // This is a dual legend key in the main position
              // Check if alignment is set to center labels
              if (key.align !== undefined && (key.align & 0x01) !== 0) {
                // Horizontal centering is enabled - render as top/bottom centered
                ctx.textAlign = 'center';
                const centerX = renderX + keyWidth / 2;
                
                // First line at top center
                if (lines[0]) {
                  ctx.textBaseline = 'hanging';
                  ctx.fillText(lines[0], centerX, renderY + keyHeight * 0.2);
                }
                
                // Second line at bottom center
                if (lines[1]) {
                  ctx.textBaseline = 'alphabetic';
                  ctx.fillText(lines[1], centerX, renderY + keyHeight * 0.8);
                }
              } else {
                // Default behavior - vertically stacked at the current position
                ctx.textAlign = finalPosition.align as CanvasTextAlign;
                
                // Calculate line height
                const lineHeight = fontSize * 1.2;
                
                // For dual legends, adjust the starting Y position to center both lines
                const totalHeight = lineHeight * (lines.length - 1);
                let lineY = currentY - totalHeight / 2;
                
                lines.forEach((line) => {
                  if (line) {
                    ctx.fillText(line, currentX, lineY);
                  }
                  lineY += lineHeight;
                });
                
                // For horizontal positioning, use the widest line
                const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
                currentX += maxWidth;
              }
            } else if (lines.length > 1) {
              // Multi-line text in other positions - render with line breaks
              ctx.textAlign = finalPosition.align as CanvasTextAlign;
              const lineHeight = fontSize * 1.2;
              let lineY = currentY;
              
              lines.forEach((line, idx) => {
                if (line) {
                  ctx.fillText(line, currentX, lineY);
                }
                if (idx < lines.length - 1) {
                  lineY += lineHeight;
                }
              });
              
              const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
              currentX += maxWidth;
            } else {
              // Single line text
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width;
            }
          }
        });
        
        // Restore context if we applied rotation
        if (needsRotation) {
          ctx.restore();
        }
      });
      
      // Draw center legend LAST so it's on top of everything else
      if (key.centerLegend) {
        ctx.save();
        // Use the same font as other labels
        const centerFont = key.font || '';
        ctx.font = centerFont ? fontManager.getRenderFont(centerFont, 12) : '12px Arial';
        // Use the same color as other labels
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw in the center of the key
        const centerX = renderX + keyWidth / 2;
        const centerY = renderY + keyHeight / 2;
        ctx.fillText(key.centerLegend, centerX, centerY);
        ctx.restore();
      }
      
      // Draw stabilizer positions if enabled (while rotation is still active)
      // Skip decal keys as they're just labels, not physical keys
      const isMiniISO = key.width === 0.75 && key.height === 2 && key.x2 !== undefined && Math.abs(key.x2 + 0.25) < 0.01;
      const needsStabilizers = (key.width >= 2 || key.height >= 2) && !key.decal && !isMiniISO;
      const isISOEnter = (key.x2 !== undefined && key.x2 < 0 && key.height2 !== undefined && key.height2 < key.height && !isMiniISO) ||
                         (key.y2 !== undefined && key.y2 < 0);
      const isBAE = key.x2 !== undefined && key.x2 > 0 && key.height2 !== undefined; // Big Ass Enter extends to the right

      if (editorSettings.showStabilizerPositions && needsStabilizers) {
        const stabPositions = getStabilizerPositions(key.width, key.height, isISOEnter, isBAE, isMiniISO);
        
        ctx.save();
        ctx.strokeStyle = isDarkMode ? 'rgba(128, 128, 128, 0.7)' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = isDarkMode ? 1.5 : 1;
        
        stabPositions.forEach(pos => {
          const stabX = renderX + pos.x * keyWidth;
          const stabY = renderY + pos.y * keyHeight;
          
          // Draw outer circle
          ctx.beginPath();
          ctx.arc(stabX, stabY, 10, 0, Math.PI * 2);
          ctx.stroke();
          
          // Draw crosshair
          ctx.beginPath();
          // Horizontal line
          ctx.moveTo(stabX - 8, stabY);
          ctx.lineTo(stabX + 8, stabY);
          // Vertical line
          ctx.moveTo(stabX, stabY - 8);
          ctx.lineTo(stabX, stabY + 8);
          ctx.stroke();
          
          // Draw small inner circle
          ctx.beginPath();
          ctx.arc(stabX, stabY, 3, 0, Math.PI * 2);
          ctx.stroke();
        });
        
        ctx.restore();
      }
      } // End of else block for non-row-label keys
      
      // Restore canvas state if we applied rotation
      if (hasRotation) {
        ctx.restore();
      }
    });
    
    // Restore transform before drawing selection rectangle
    ctx.restore();
    
    // Draw selection rectangle (in screen coordinates)
    if (isSelectingRef.current) {
      ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 1;
      const rect = selectionRectRef.current;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    
    // Re-apply transform for rotation points
    ctx.save();
    ctx.translate(CANVAS_PADDING_LEFT, CANVAS_PADDING_TOP);
    
    // Draw rotation points for selected keys (only when rotation section is expanded)
    if (stateRef.current.selectedKeys.size > 0 && stateRef.current.isRotationSectionExpanded) {
      ctx.save();
      stateRef.current.selectedKeys.forEach(keyId => {
        const key = keyboard.keys.find(k => k.id === keyId);
        if (key) {
          let rotX: number, rotY: number;
          
          // Determine rotation center position (with canvas padding)
          if (key.rotation_x !== undefined && key.rotation_y !== undefined) {
            // Use existing rotation center
            rotX = key.rotation_x * unitSize;
            rotY = key.rotation_y * unitSize;
          } else {
            // Default to key center
            rotX = (key.x + key.width / 2) * unitSize;
            rotY = (key.y + key.height / 2) * unitSize;
          }
          
          // Apply drag offset if this key is being dragged
          if (isDraggingRef.current && selectedKeys.has(key.id)) {
            // For key-center rotation (undefined rotation_x/y), move with the key
            if (key.rotation_x === undefined || key.rotation_y === undefined) {
              rotX += dragOffsetRef.current.x;
              rotY += dragOffsetRef.current.y;
            }
            // For custom rotation points, don't move them during drag
          }
          
          // Draw crosshair at rotation point
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rotX - 10, rotY);
          ctx.lineTo(rotX + 10, rotY);
          ctx.moveTo(rotX, rotY - 10);
          ctx.lineTo(rotX, rotY + 10);
          ctx.stroke();
          
          // Draw circle at rotation point
          ctx.beginPath();
          ctx.arc(rotX, rotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#e74c3c';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      ctx.restore();
    }
    
    // Update cursor if in rotation point setting mode
    if (stateRef.current.isSettingRotationPoint) {
      canvas.style.cursor = 'crosshair';
    }
    
    // Draw stabilizer tooltip if hovering over one
    if (hoveredStabRef.current && stateRef.current.editorSettings.showStabilizerPositions) {
      const { keyId, stabIndex, x, y, keyWidth } = hoveredStabRef.current;
      const key = keyboard.keys.find(k => k.id === keyId);
      if (key) {
        // Determine stabilizer type based on key orientation
        const isVertical = key.height >= 2 && key.width < 2;
        const isMiniISO = key.width === 0.75 && key.height === 2 && key.x2 !== undefined && Math.abs(key.x2 + 0.25) < 0.01;
        const isISOEnter = (key.x2 !== undefined && key.x2 < 0 && key.height2 !== undefined && key.height2 < key.height && !isMiniISO) ||
                           (key.y2 !== undefined && key.y2 < 0);
        const isBAE = key.x2 !== undefined && key.x2 > 0 && key.height2 !== undefined;

        let stabType = '';
        if (isBAE) {
          // Big Ass Enter has 4 stabilizers
          if (stabIndex === 0) stabType = 'Center';
          else if (stabIndex === 1) stabType = 'Left';
          else if (stabIndex === 2) stabType = 'Right';
          else if (stabIndex === 3) stabType = 'Upper';
        } else if (stabIndex === 0) {
          stabType = 'Center';
        } else if (stabIndex === 1) {
          stabType = (isVertical || isISOEnter) ? 'Top' : 'Left';
        } else if (stabIndex === 2) {
          stabType = (isVertical || isISOEnter) ? 'Bottom' : 'Right';
        }

        // Calculate coordinates in units (relative to key position)
        const stabPositions = getStabilizerPositions(keyWidth, key.height, isISOEnter, isBAE, isMiniISO);
        const relativeX = stabPositions[stabIndex].x * keyWidth;
        const relativeY = stabPositions[stabIndex].y * key.height;
        
        // Create tooltip text
        const tooltipLines = [
          `${keyWidth}u ${stabType} Stem`,
          `X: ${relativeX.toFixed(3)}u`,
          `Y: ${relativeY.toFixed(3)}u`
        ];
        
        // Measure tooltip dimensions
        ctx.save();
        ctx.font = '12px Arial';
        const padding = 8;
        const lineHeight = 16;
        const maxWidth = Math.max(...tooltipLines.map(line => ctx.measureText(line).width));
        const tooltipWidth = maxWidth + padding * 2;
        const tooltipHeight = tooltipLines.length * lineHeight + padding * 2;
        
        // Position tooltip (offset from stabilizer position)
        let tooltipX = x + 15;
        let tooltipY = y - tooltipHeight - 10;
        
        // Keep tooltip on screen
        if (tooltipX + tooltipWidth > canvas.width) {
          tooltipX = x - tooltipWidth - 15;
        }
        if (tooltipY < 0) {
          tooltipY = y + 20;
        }
        
        // Draw tooltip background
        ctx.fillStyle = isDarkMode ? 'rgba(50, 50, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        ctx.fill();
        ctx.stroke();
        
        // Draw tooltip text
        ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        
        tooltipLines.forEach((line, index) => {
          const textY = tooltipY + padding + lineHeight / 2 + index * lineHeight;
          ctx.fillText(line, tooltipX + padding, textY);
        });
        
        ctx.restore();
      }
    }
    
    // Final restore of transform
    ctx.restore();
  };

  // Request animation frame render
  const requestRender = () => {
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      // Ensure we have the latest state before rendering
      const latestState = useKeyboardStore.getState();
      stateRef.current = {
        keyboard: latestState.keyboard,
        selectedKeys: latestState.selectedKeys,
        hoveredKey: latestState.hoveredKey,
        editorSettings: latestState.editorSettings,
        isSettingRotationPoint: latestState.isSettingRotationPoint,
        isRotationSectionExpanded: latestState.isRotationSectionExpanded,
      };
      render();
    });
  };

  // Get key at position
  const getKeyAtPosition = (x: number, y: number): KeyRect | null => {
    const unitSize = stateRef.current.editorSettings.unitSize;
    
    // Adjust coordinates for canvas padding
    const adjustedX = x - CANVAS_PADDING_LEFT;
    const adjustedY = y - CANVAS_PADDING_TOP;
    
    // Check keys in reverse order (top to bottom) for proper overlap handling
    for (let i = keyRectsRef.current.length - 1; i >= 0; i--) {
      const rect = keyRectsRef.current[i];
      const key = rect.key;
      
      // Use rotation-aware hit testing if the key is rotated
      if (key.rotation_angle) {
        const isInside = isPointInRotatedRect(
          adjustedX,
          adjustedY,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          key.rotation_angle,
          key.rotation_x !== undefined ? key.rotation_x * unitSize : undefined,
          key.rotation_y !== undefined ? key.rotation_y * unitSize : undefined
        );
        
        if (isInside) {
          return rect;
        }
      } else {
        // Simple bounds check for non-rotated keys
        if (adjustedX >= rect.x && adjustedX <= rect.x + rect.width &&
            adjustedY >= rect.y && adjustedY <= rect.y + rect.height) {
          return rect;
        }
      }
    }
    return null;
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const store = useKeyboardStore.getState();

    // Handle rotation point setting mode
    if (store.isSettingRotationPoint) {
      const selectedKeyIds = Array.from(store.selectedKeys);
      if (selectedKeyIds.length > 0) {
        // Convert canvas coordinates to keyboard units (accounting for padding)
        const unitSize = store.editorSettings.unitSize;
        let rotationX = (x - CANVAS_PADDING_LEFT) / unitSize;
        let rotationY = (y - CANVAS_PADDING_TOP) / unitSize;

        // Don't snap to grid for rotation points - we want precise positioning
        // to avoid shifting rotated keys. Round to 2 decimal places for cleaner values.
        rotationX = Math.round(rotationX * 100) / 100;
        rotationY = Math.round(rotationY * 100) / 100;

        // Get actual key objects
        const selectedKeys = selectedKeyIds
          .map(id => store.keyboard.keys.find(k => k.id === id))
          .filter(Boolean) as Key[];

        // Update all selected keys with the new rotation point, maintaining visual position
        const updates = selectedKeys.map(key => {
          const newPos = calculateNewPositionForRotationCenter(key, rotationX, rotationY);
          return {
            id: key.id,
            changes: {
              x: newPos.x,
              y: newPos.y,
              rotation_x: rotationX,
              rotation_y: rotationY
            }
          };
        });

        store.updateKeys(updates);
        store.saveToHistory();
        store.setIsSettingRotationPoint(false);

        // Update canvas cursor
        canvas.style.cursor = 'default';
      }
      return;
    }
    
    const keyRect = getKeyAtPosition(x, y);
    
    if (keyRect) {
      // Key clicked
      const store = useKeyboardStore.getState();
      const isMultiSelect = e.ctrlKey || e.metaKey;
      const isShiftSelect = e.shiftKey;
      const isKeyAlreadySelected = store.selectedKeys.has(keyRect.id);
      
      if (isShiftSelect && lastSelectedKeyRef.current) {
        // Shift-click: select range
        const keysToSelect: string[] = [];
        const lastKeyIndex = keyRectsRef.current.findIndex(k => k.id === lastSelectedKeyRef.current);
        const currentKeyIndex = keyRectsRef.current.findIndex(k => k.id === keyRect.id);
        
        if (lastKeyIndex !== -1 && currentKeyIndex !== -1) {
          const start = Math.min(lastKeyIndex, currentKeyIndex);
          const end = Math.max(lastKeyIndex, currentKeyIndex);
          
          for (let i = start; i <= end; i++) {
            keysToSelect.push(keyRectsRef.current[i].id);
          }
          
          if (isMultiSelect) {
            // Add to existing selection
            const existingSelection = Array.from(store.selectedKeys);
            const combinedSelection = [...new Set([...existingSelection, ...keysToSelect])];
            store.selectKeys(combinedSelection);
          } else {
            // Replace selection
            store.selectKeys(keysToSelect);
          }
        }
      } else if (!isKeyAlreadySelected || isMultiSelect) {
        // Normal click or ctrl-click
        store.selectKey(keyRect.id, isMultiSelect);
        lastSelectedKeyRef.current = keyRect.id;
      } else {
        // Clicking on already selected key without modifiers
        lastSelectedKeyRef.current = keyRect.id;
      }
      
      // Start dragging if key is selected (either was already selected or just got selected)
      if (store.selectedKeys.has(keyRect.id)) {
        isDraggingRef.current = true;
        dragStartRef.current = { x, y };
        dragOffsetRef.current = { x: 0, y: 0 };
        
        // Check if Alt is pressed - if so, we'll duplicate on drag
        if (e.altKey) {
          isDuplicatingRef.current = true;
          duplicatedKeysRef.current.clear();
          
          // Create duplicates of all selected keys
          const selectedKeysList = Array.from(store.selectedKeys)
            .map(id => stateRef.current.keyboard.keys.find(k => k.id === id))
            .filter(Boolean) as Key[];
          
          const newKeys: Key[] = [];
          const newKeyIds: string[] = [];
          
          selectedKeysList.forEach(key => {
            const newKey: Key = {
              ...key,
              id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              labels: [...(key.labels || [])],
              textColor: [...(key.textColor || [])],
              textSize: [...(key.textSize || [])],
            };
            newKeys.push(newKey);
            newKeyIds.push(newKey.id);
            duplicatedKeysRef.current.add(newKey.id);
          });
          
          // Add the new keys to the store
          newKeys.forEach(key => store.addKey(key));
          
          // Update selection to the new duplicated keys
          store.selectKeys(newKeyIds);
          
          // Update our cached state
          stateRef.current.selectedKeys = new Set(newKeyIds);
          stateRef.current.keyboard = store.keyboard;
          
          canvas.style.cursor = 'copy';
        } else {
          canvas.style.cursor = 'move';
        }
      }
    } else {
      // Start selection rectangle
      isAddingToSelectionRef.current = e.ctrlKey || e.metaKey;
      
      if (!isAddingToSelectionRef.current) {
        useKeyboardStore.getState().clearSelection();
      }
      
      isSelectingRef.current = true;
      const startX = x;
      const startY = y;
      selectionRectRef.current = { x: startX, y: startY, width: 0, height: 0 };
      dragStartRef.current = { x: startX, y: startY };
    }
    
    stateRef.current.selectedKeys = useKeyboardStore.getState().selectedKeys;
    requestRender();
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingRef.current) {
      // Update cursor based on whether Alt is still held
      if (isDuplicatingRef.current) {
        canvas.style.cursor = e.altKey ? 'copy' : 'move';
      }
      // Update drag offset
      dragOffsetRef.current = {
        x: x - dragStartRef.current.x,
        y: y - dragStartRef.current.y
      };
      
      // Snap to grid if enabled
      const { editorSettings } = stateRef.current;
      if (editorSettings.snapToGrid) {
        const gridSize = editorSettings.gridSize * editorSettings.unitSize;
        dragOffsetRef.current.x = Math.round(dragOffsetRef.current.x / gridSize) * gridSize;
        dragOffsetRef.current.y = Math.round(dragOffsetRef.current.y / gridSize) * gridSize;
      }
      
      requestRender();
    } else if (isSelectingRef.current) {
      // Update selection rectangle
      const startX = dragStartRef.current.x;
      const startY = dragStartRef.current.y;
      selectionRectRef.current = {
        x: Math.min(x, startX),
        y: Math.min(y, startY),
        width: Math.abs(x - startX),
        height: Math.abs(y - startY)
      };
      requestRender();
    } else {
      // Store mouse position for tooltip
      mousePositionRef.current = { x, y };
      
      // Hover effect
      const keyRect = getKeyAtPosition(x, y);
      const hoveredId = keyRect?.id || null;
      
      if (stateRef.current.hoveredKey !== hoveredId) {
        useKeyboardStore.getState().setHoveredKey(hoveredId);
        stateRef.current.hoveredKey = hoveredId;
        requestRender();
      }
      
      // Check for stabilizer hover if stabilizers are shown
      if (stateRef.current.editorSettings.showStabilizerPositions) {
        let foundStab = false;
        const { unitSize } = stateRef.current.editorSettings;
        
        // Check each key for stabilizer positions
        for (const keyRect of keyRectsRef.current) {
          const key = stateRef.current.keyboard.keys.find(k => k.id === keyRect.id);
          if (!key || (key.width < 2 && key.height < 2)) continue;

          const isMiniISO = key.width === 0.75 && key.height === 2 && key.x2 !== undefined && Math.abs(key.x2 + 0.25) < 0.01;
          if (isMiniISO) continue;
          const isISOEnter = (key.x2 !== undefined && key.x2 < 0 && key.height2 !== undefined && key.height2 < key.height && !isMiniISO) ||
                             (key.y2 !== undefined && key.y2 < 0);
          const isBAE = key.x2 !== undefined && key.x2 > 0 && key.height2 !== undefined;
          const stabPositions = getStabilizerPositions(key.width, key.height, isISOEnter, isBAE, isMiniISO);
          const keyInset = 1;
          const renderX = Math.round(key.x * unitSize + keyInset);
          const renderY = Math.round(key.y * unitSize + keyInset);
          const keyWidth = Math.round(key.width * unitSize - keyInset * 2);
          const keyHeight = Math.round(key.height * unitSize - keyInset * 2);
          
          // Check each stabilizer position
          for (let i = 0; i < stabPositions.length; i++) {
            const pos = stabPositions[i];
            const stabX = renderX + pos.x * keyWidth;
            const stabY = renderY + pos.y * keyHeight;
            
            // Check if mouse is over this stabilizer (within 12 pixel radius)
            const dist = Math.sqrt(Math.pow(x - stabX, 2) + Math.pow(y - stabY, 2));
            if (dist <= 12) {
              hoveredStabRef.current = {
                keyId: key.id,
                stabIndex: i,
                x: stabX,
                y: stabY,
                keyWidth: key.width
              };
              foundStab = true;
              break;
            }
          }
          
          if (foundStab) break;
        }
        
        // Clear hovered stab if none found
        if (!foundStab && hoveredStabRef.current) {
          hoveredStabRef.current = null;
          requestRender();
        } else if (foundStab && !hoveredStabRef.current) {
          requestRender();
        }
      }
      
      canvas.style.cursor = keyRect ? 'pointer' : 'default';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cancel rotation point setting mode with Escape
    if (e.key === 'Escape' && stateRef.current.isSettingRotationPoint) {
      useKeyboardStore.getState().setIsSettingRotationPoint(false);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
      requestRender();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // If Alt is released during duplicate-drag, remove the duplicated keys
    if (e.key === 'Alt' && isDuplicatingRef.current && isDraggingRef.current) {
      const store = useKeyboardStore.getState();
      
      // Get the original keys that were selected before duplication
      const originalKeys: string[] = [];
      stateRef.current.keyboard.keys.forEach(key => {
        if (!duplicatedKeysRef.current.has(key.id) && 
            stateRef.current.selectedKeys.has(key.id)) {
          originalKeys.push(key.id);
        }
      });
      
      // Remove duplicated keys
      const keysToDelete = Array.from(duplicatedKeysRef.current);
      store.deleteKeys(keysToDelete);
      
      // Restore selection to original keys
      store.selectKeys(originalKeys);
      
      // Update state
      isDuplicatingRef.current = false;
      duplicatedKeysRef.current.clear();
      stateRef.current.selectedKeys = new Set(originalKeys);
      stateRef.current.keyboard = store.keyboard;
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'move';
      }
      
      requestRender();
    }
  };

  const handleMouseUp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (isDraggingRef.current) {
      // Apply movement to keys
      const { selectedKeys } = stateRef.current;
      const unitSize = stateRef.current.editorSettings.unitSize;
      const deltaX = dragOffsetRef.current.x / unitSize;
      const deltaY = dragOffsetRef.current.y / unitSize;
      
      if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
        const updates = Array.from(selectedKeys).map(id => {
          const key = stateRef.current.keyboard.keys.find(k => k.id === id);
          if (!key) return null;

          const changes: Partial<Key> = {
            x: key.x + deltaX,
            y: key.y + deltaY
          };

          // If this is a duplicated key with custom rotation points, adjust them too
          if (isDuplicatingRef.current && duplicatedKeysRef.current.has(id)) {
            if (key.rotation_x !== undefined) {
              changes.rotation_x = key.rotation_x + deltaX;
            }
            if (key.rotation_y !== undefined) {
              changes.rotation_y = key.rotation_y + deltaY;
            }
          }

          return {
            id: id,
            changes
          };
        }).filter(Boolean) as Array<{ id: string; changes: Partial<Key> }>;

        useKeyboardStore.getState().updateKeys(updates);
        useKeyboardStore.getState().saveToHistory();
      }
      
      isDraggingRef.current = false;
      isDuplicatingRef.current = false;
      duplicatedKeysRef.current.clear();
      dragOffsetRef.current = { x: 0, y: 0 };
      canvas.style.cursor = 'default';
    } else if (isSelectingRef.current) {
      // Select keys in rectangle
      const rect = selectionRectRef.current;
      const selectedIds: string[] = [];
      const selectionMode = stateRef.current.editorSettings.selectionMode || 'touch';
      
      // Adjust selection rectangle for canvas padding
      const adjustedRect = {
        x: rect.x - CANVAS_PADDING_LEFT,
        y: rect.y - CANVAS_PADDING_TOP,
        width: rect.width,
        height: rect.height
      };
      
      keyRectsRef.current.forEach(keyRect => {
        if (selectionMode === 'touch') {
          // Touch mode: select if any part of the key overlaps with the selection
          if (!(keyRect.x + keyRect.width < adjustedRect.x ||
                keyRect.x > adjustedRect.x + adjustedRect.width ||
                keyRect.y + keyRect.height < adjustedRect.y ||
                keyRect.y > adjustedRect.y + adjustedRect.height)) {
            selectedIds.push(keyRect.id);
          }
        } else {
          // Enclose mode: select only if the key is fully contained within the selection
          if (keyRect.x >= adjustedRect.x &&
              keyRect.x + keyRect.width <= adjustedRect.x + adjustedRect.width &&
              keyRect.y >= adjustedRect.y &&
              keyRect.y + keyRect.height <= adjustedRect.y + adjustedRect.height) {
            selectedIds.push(keyRect.id);
          }
        }
      });
      
      if (selectedIds.length > 0) {
        const store = useKeyboardStore.getState();
        
        if (isAddingToSelectionRef.current) {
          // Add to existing selection
          const existingSelection = Array.from(store.selectedKeys);
          const combinedSelection = [...new Set([...existingSelection, ...selectedIds])];
          store.selectKeys(combinedSelection);
        } else {
          // Replace selection
          store.selectKeys(selectedIds);
        }
      }
      
      isSelectingRef.current = false;
      isAddingToSelectionRef.current = false;
    }
    
    requestRender();
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    contextRef.current = ctx;

    // Support high-DPI displays for crisp rendering
    // Use a higher resolution multiplier to match original KLE's DOM-based crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const RESOLUTION_MULTIPLIER = 3; // Render at 3x resolution for crisp output
    const totalScale = dpr * RESOLUTION_MULTIPLIER;

    // Set canvas resolution (accounting for device pixel ratio + additional quality multiplier)
    canvas.width = width * totalScale;
    canvas.height = height * totalScale;

    // Set canvas display size (CSS pixels)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale context to match total resolution
    ctx.scale(totalScale, totalScale);

    // Disable image smoothing for pixel-perfect crisp rendering
    ctx.imageSmoothingEnabled = false;

    // Set high-quality text rendering
    ctx.textRendering = 'optimizeLegibility' as any;
    ctx.fontKerning = 'normal' as any;
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Initial render
    render();
    
    // Listen for font load events and re-render
    if (document.fonts) {
      document.fonts.ready.then(() => {
        requestRender();
      });
    }
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useKeyboardStore.subscribe((state) => {
      stateRef.current = {
        keyboard: state.keyboard,
        selectedKeys: state.selectedKeys,
        hoveredKey: state.hoveredKey,
        editorSettings: state.editorSettings,
        isSettingRotationPoint: state.isSettingRotationPoint,
        isRotationSectionExpanded: state.isRotationSectionExpanded,
      };
      requestRender();
    });
    
    return unsubscribe;
  }, []);
  
  // Get keyboard from store to properly track changes
  const keyboard = useKeyboardStore((state) => state.keyboard);
  
  // Check for font loading and trigger re-render when loaded
  useEffect(() => {
    // Check if any keys have icons
    const hasIcons = keyboard.keys.some(key => 
      key.labels.some(label => label && (label.includes('trashcons') || label.includes('<span')))
    );
    
    if (hasIcons) {
      if (!fontManager.isFontLoaded('trashcons')) {
        // Add listener for when font loads
        fontManager.onFontLoaded('trashcons', () => {
          requestRender();
        });
      } else {
        // Font is already loaded, make sure we render
        requestRender();
      }
    }
    
    // Listen for dark mode toggle
    const handleDarkModeToggle = () => {
      requestRender();
    };
    
    window.addEventListener('darkModeToggled', handleDarkModeToggle);
    
    return () => {
      window.removeEventListener('darkModeToggled', handleDarkModeToggle);
    };
  }, [keyboard]); // Remove requestRender from deps to avoid issues

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent'
      }}
    />
  );
});

KeyboardCanvas.displayName = 'KeyboardCanvas';

export default KeyboardCanvas;