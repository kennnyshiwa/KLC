// KLE 2.0 serializer - exports keyboards in a clean, complete format
import { Key, Keyboard, KeyboardMetadata } from '../types';

export interface KLE2Format {
  version: string;
  meta: KLE2Metadata;
  settings: {
    unitSize: number;
    keySpacing: number;
  };
  keys: KLE2Key[];
}

export interface KLE2Metadata {
  name?: string;
  author?: string;
  notes?: string;
  background?: { name?: string; style?: string };
  radii?: string;
  switchMount?: string;
  switchBrand?: string;
  switchType?: string;
  plate?: boolean;
  pcb?: boolean;
  css?: string;
  vialLabels?: Array<{ name: string; values: string[] }>;
  created?: string;
  modified?: string;
}

export interface KLE2Key {
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
  color?: string;
  profile?: Key['profile'];
  labels?: string[];
  textColor?: string[];
  textSize?: number[];
  default?: { size?: number[]; color?: string[] };
  frontLegends?: string[];
  sizeLabelProvenance?: {
    slot: number;
    previousValue?: string;
    appliedValue: string;
  };
  centerLegend?: string;
  align?: number;
  font?: string;
  legendRotation?: number[];
  rowPosition?: string;
  rowLabelShape?: Key['rowLabelShape'];
  ghost?: boolean;
  stepped?: boolean;
  steppedCenter?: boolean;
  nub?: boolean;
  decal?: boolean;
}

const copyBackground = (background: NonNullable<KeyboardMetadata['background']>) => ({
  ...(background.name !== undefined && { name: background.name }),
  ...(background.style !== undefined && { style: background.style }),
});

const copyVialLabels = (vialLabels: NonNullable<KeyboardMetadata['vialLabels']>) => (
  vialLabels.map(option => ({ name: option.name, values: [...option.values] }))
);

const copyDefaultText = (defaultText: NonNullable<Key['default']>) => ({
  ...(defaultText.size !== undefined && { size: [...defaultText.size] }),
  ...(defaultText.color !== undefined && { color: [...defaultText.color] }),
});

const copySizeLabelProvenance = (provenance: NonNullable<Key['sizeLabelProvenance']>) => ({
  slot: provenance.slot,
  ...(provenance.previousValue !== undefined && { previousValue: provenance.previousValue }),
  appliedValue: provenance.appliedValue,
});

export function exportToKLE2(keyboard: Keyboard): KLE2Format {
  const now = new Date().toISOString();

  return {
    version: '2.0.0',
    meta: {
      name: keyboard.meta.name ?? 'Untitled Keyboard',
      ...(keyboard.meta.author !== undefined && { author: keyboard.meta.author }),
      ...(keyboard.meta.notes !== undefined && { notes: keyboard.meta.notes }),
      ...(keyboard.meta.background !== undefined && { background: copyBackground(keyboard.meta.background) }),
      ...(keyboard.meta.radii !== undefined && { radii: keyboard.meta.radii }),
      ...(keyboard.meta.switchMount !== undefined && { switchMount: keyboard.meta.switchMount }),
      ...(keyboard.meta.switchBrand !== undefined && { switchBrand: keyboard.meta.switchBrand }),
      ...(keyboard.meta.switchType !== undefined && { switchType: keyboard.meta.switchType }),
      ...(keyboard.meta.plate !== undefined && { plate: keyboard.meta.plate }),
      ...(keyboard.meta.pcb !== undefined && { pcb: keyboard.meta.pcb }),
      ...(keyboard.meta.css !== undefined && { css: keyboard.meta.css }),
      ...(keyboard.meta.vialLabels !== undefined && { vialLabels: copyVialLabels(keyboard.meta.vialLabels) }),
      created: now,
      modified: now,
    },
    settings: { unitSize: 54, keySpacing: 1 },
    keys: keyboard.keys.map(key => ({
      id: key.id,
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      ...(key.x2 !== undefined && { x2: key.x2 }),
      ...(key.y2 !== undefined && { y2: key.y2 }),
      ...(key.width2 !== undefined && { width2: key.width2 }),
      ...(key.height2 !== undefined && { height2: key.height2 }),
      ...(key.rotation_x !== undefined && { rotation_x: key.rotation_x }),
      ...(key.rotation_y !== undefined && { rotation_y: key.rotation_y }),
      ...(key.rotation_angle !== undefined && { rotation_angle: key.rotation_angle }),
      ...(key.color !== undefined && { color: key.color }),
      ...(key.profile !== undefined && { profile: key.profile }),
      labels: [...key.labels],
      ...(key.textColor !== undefined && { textColor: [...key.textColor] }),
      ...(key.textSize !== undefined && { textSize: [...key.textSize] }),
      ...(key.default !== undefined && { default: copyDefaultText(key.default) }),
      ...(key.frontLegends !== undefined && { frontLegends: [...key.frontLegends] }),
      ...(key.sizeLabelProvenance !== undefined && {
        sizeLabelProvenance: copySizeLabelProvenance(key.sizeLabelProvenance),
      }),
      ...(key.centerLegend !== undefined && { centerLegend: key.centerLegend }),
      ...(key.align !== undefined && { align: key.align }),
      ...(key.font !== undefined && { font: key.font }),
      ...(key.legendRotation !== undefined && { legendRotation: [...key.legendRotation] }),
      ...(key.rowPosition !== undefined && { rowPosition: key.rowPosition }),
      ...(key.rowLabelShape !== undefined && { rowLabelShape: key.rowLabelShape }),
      ...(key.ghost !== undefined && { ghost: key.ghost }),
      ...(key.stepped !== undefined && { stepped: key.stepped }),
      ...(key.steppedCenter !== undefined && { steppedCenter: key.steppedCenter }),
      ...(key.nub !== undefined && { nub: key.nub }),
      ...(key.decal !== undefined && { decal: key.decal }),
    })),
  };
}

export function importFromKLE2(data: KLE2Format): Keyboard {
  if (!data.version || !data.version.startsWith('2.')) {
    throw new Error('Invalid KLE2 format: unsupported version');
  }

  return {
    meta: {
      ...(data.meta.name !== undefined && { name: data.meta.name }),
      ...(data.meta.author !== undefined && { author: data.meta.author }),
      ...(data.meta.notes !== undefined && { notes: data.meta.notes }),
      ...(data.meta.background !== undefined && { background: copyBackground(data.meta.background) }),
      ...(data.meta.radii !== undefined && { radii: data.meta.radii }),
      ...(data.meta.switchMount !== undefined && { switchMount: data.meta.switchMount }),
      ...(data.meta.switchBrand !== undefined && { switchBrand: data.meta.switchBrand }),
      ...(data.meta.switchType !== undefined && { switchType: data.meta.switchType }),
      ...(data.meta.plate !== undefined && { plate: data.meta.plate }),
      ...(data.meta.pcb !== undefined && { pcb: data.meta.pcb }),
      ...(data.meta.css !== undefined && { css: data.meta.css }),
      ...(data.meta.vialLabels !== undefined && { vialLabels: copyVialLabels(data.meta.vialLabels) }),
    },
    keys: data.keys.map(keyData => ({
      id: keyData.id,
      x: keyData.x,
      y: keyData.y,
      width: keyData.width,
      height: keyData.height,
      labels: keyData.labels !== undefined ? [...keyData.labels] : [],
      ...(keyData.x2 !== undefined && { x2: keyData.x2 }),
      ...(keyData.y2 !== undefined && { y2: keyData.y2 }),
      ...(keyData.width2 !== undefined && { width2: keyData.width2 }),
      ...(keyData.height2 !== undefined && { height2: keyData.height2 }),
      ...(keyData.rotation_x !== undefined && { rotation_x: keyData.rotation_x }),
      ...(keyData.rotation_y !== undefined && { rotation_y: keyData.rotation_y }),
      ...(keyData.rotation_angle !== undefined && { rotation_angle: keyData.rotation_angle }),
      ...(keyData.color !== undefined && { color: keyData.color }),
      ...(keyData.profile !== undefined && { profile: keyData.profile }),
      ...(keyData.textColor !== undefined && { textColor: [...keyData.textColor] }),
      ...(keyData.textSize !== undefined && { textSize: [...keyData.textSize] }),
      ...(keyData.default !== undefined && { default: copyDefaultText(keyData.default) }),
      ...(keyData.frontLegends !== undefined && { frontLegends: [...keyData.frontLegends] }),
      ...(keyData.sizeLabelProvenance !== undefined && {
        sizeLabelProvenance: copySizeLabelProvenance(keyData.sizeLabelProvenance),
      }),
      ...(keyData.centerLegend !== undefined && { centerLegend: keyData.centerLegend }),
      ...(keyData.align !== undefined && { align: keyData.align }),
      ...(keyData.font !== undefined && { font: keyData.font }),
      ...(keyData.legendRotation !== undefined && { legendRotation: [...keyData.legendRotation] }),
      ...(keyData.rowPosition !== undefined && { rowPosition: keyData.rowPosition }),
      ...(keyData.rowLabelShape !== undefined && { rowLabelShape: keyData.rowLabelShape }),
      ...(keyData.ghost !== undefined && { ghost: keyData.ghost }),
      ...(keyData.stepped !== undefined && { stepped: keyData.stepped }),
      ...(keyData.steppedCenter !== undefined && { steppedCenter: keyData.steppedCenter }),
      ...(keyData.nub !== undefined && { nub: keyData.nub }),
      ...(keyData.decal !== undefined && { decal: keyData.decal }),
    })),
  };
}

export function exportToKLE2String(keyboard: Keyboard): string {
  return JSON.stringify(exportToKLE2(keyboard), null, 2);
}

export function importFromKLE2String(jsonString: string): Keyboard {
  const data = JSON.parse(jsonString) as KLE2Format;
  return importFromKLE2(data);
}
