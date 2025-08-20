export type KeyProfile = 'DCS' | 'DSA' | 'SA' | 'OEM' | 'CHICKLET' | 'FLAT' | 'XDA' | 'MA';

export interface KeyLegends {
  [position: number]: string;
}

export interface KeyTextMeta {
  size?: number[];
  color?: string[];
}

export interface Key {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  x2?: number;
  y2?: number;
  width2?: number;
  height2?: number;
  rotation_x?: number;
  rotation_y?: number;
  rotation_angle?: number;
  labels: string[];
  textColor?: string[];
  textSize?: number[];
  default?: KeyTextMeta;
  color?: string;
  profile?: KeyProfile;
  nub?: boolean;
  ghost?: boolean;
  stepped?: boolean;
  decal?: boolean;
  frontLegends?: string[];
  centerLegend?: string;
  align?: number;
  font?: string;
  legendRotation?: number[];
}

export interface KeyboardMetadata {
  name?: string;
  author?: string;
  notes?: string;
  background?: {
    name?: string;
    style?: string;
  };
  radii?: string;
  switchMount?: string;
  switchBrand?: string;
  switchType?: string;
  plate?: boolean;
  pcb?: boolean;
  css?: string;
}

export interface Keyboard {
  meta: KeyboardMetadata;
  keys: Key[];
}

export interface KLEKeyData {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x2?: number;
  y2?: number;
  w2?: number;
  h2?: number;
  rx?: number;
  ry?: number;
  r?: number;
  l?: boolean;
  n?: boolean;
  d?: boolean;
  g?: boolean;
  p?: KeyProfile;
  c?: string;
  t?: string | string[];
  a?: number;
  f?: number | number[];
  f2?: number | number[];
  fa?: number[];
  default?: {
    f?: number;
    t?: string;
  };
}

export type KLELayout = Array<Array<KLEKeyData | string>>;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface EditorSettings {
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  unitSize: number;
  keySpacing: number;
  showStabilizerPositions: boolean;
}

export interface ColorSwatch {
  name: string;
  colors: {
    [key: string]: string;
  };
}

export interface Switch {
  brand: string;
  type: string;
  feel: 'linear' | 'tactile' | 'clicky';
  weight?: number;
  travel?: number;
  partNumber?: string;
}