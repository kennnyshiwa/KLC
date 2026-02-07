// KLE 2.0 serializer - exports keyboards in a clean, complete format
import { Keyboard, Key } from '../types';

export interface KLE2Format {
  version: string;
  meta: {
    name?: string;
    author?: string;
    notes?: string;
    created?: string;
    modified?: string;
  };
  settings: {
    unitSize: number;
    keySpacing: number;
  };
  keys: KLE2Key[];
}

export interface KLE2Key {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Optional position/size properties
  x2?: number;
  y2?: number;
  width2?: number;
  height2?: number;
  // Rotation
  rotation_x?: number;
  rotation_y?: number;
  rotation_angle?: number;
  // Appearance
  color?: string;
  profile?: string;
  // Labels and text
  labels: string[];
  textColor?: string[];
  textSize?: number[];
  frontLegends?: string[];
  // Special properties
  ghost?: boolean;
  stepped?: boolean;
  steppedCenter?: boolean;
  nub?: boolean;
  decal?: boolean;
}

export function exportToKLE2(keyboard: Keyboard): KLE2Format {
  const now = new Date().toISOString();
  
  return {
    version: '2.0.0',
    meta: {
      name: keyboard.meta.name || 'Untitled Keyboard',
      author: keyboard.meta.author,
      notes: keyboard.meta.notes,
      created: now,
      modified: now
    },
    settings: {
      unitSize: 54,
      keySpacing: 1
    },
    keys: keyboard.keys.map(key => ({
      id: key.id,
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      // Include optional properties only if they exist
      ...(key.x2 !== undefined && { x2: key.x2 }),
      ...(key.y2 !== undefined && { y2: key.y2 }),
      ...(key.width2 !== undefined && { width2: key.width2 }),
      ...(key.height2 !== undefined && { height2: key.height2 }),
      ...(key.rotation_x !== undefined && { rotation_x: key.rotation_x }),
      ...(key.rotation_y !== undefined && { rotation_y: key.rotation_y }),
      ...(key.rotation_angle !== undefined && { rotation_angle: key.rotation_angle }),
      ...(key.color && { color: key.color }),
      ...(key.profile && { profile: key.profile }),
      labels: key.labels,
      ...(key.textColor && { textColor: key.textColor }),
      ...(key.textSize && { textSize: key.textSize }),
      ...(key.frontLegends && { frontLegends: key.frontLegends }),
      ...(key.ghost && { ghost: key.ghost }),
      ...(key.stepped && { stepped: key.stepped }),
      ...(key.steppedCenter && { steppedCenter: key.steppedCenter }),
      ...(key.nub && { nub: key.nub }),
      ...(key.decal && { decal: key.decal })
    }))
  };
}

export function importFromKLE2(data: KLE2Format): Keyboard {
  // Validate version
  if (!data.version || !data.version.startsWith('2.')) {
    throw new Error('Invalid KLE2 format: unsupported version');
  }
  
  return {
    meta: {
      name: data.meta.name,
      author: data.meta.author,
      notes: data.meta.notes
    },
    keys: data.keys.map(keyData => {
      const key: Key = {
        id: keyData.id,
        x: keyData.x,
        y: keyData.y,
        width: keyData.width,
        height: keyData.height,
        labels: keyData.labels || []
      };
      
      // Add optional properties
      if (keyData.x2 !== undefined) key.x2 = keyData.x2;
      if (keyData.y2 !== undefined) key.y2 = keyData.y2;
      if (keyData.width2 !== undefined) key.width2 = keyData.width2;
      if (keyData.height2 !== undefined) key.height2 = keyData.height2;
      if (keyData.rotation_x !== undefined) key.rotation_x = keyData.rotation_x;
      if (keyData.rotation_y !== undefined) key.rotation_y = keyData.rotation_y;
      if (keyData.rotation_angle !== undefined) key.rotation_angle = keyData.rotation_angle;
      if (keyData.color) key.color = keyData.color;
      if (keyData.profile) key.profile = keyData.profile as any;
      if (keyData.textColor) key.textColor = keyData.textColor;
      if (keyData.textSize) key.textSize = keyData.textSize;
      if (keyData.frontLegends) key.frontLegends = keyData.frontLegends;
      if (keyData.ghost) key.ghost = keyData.ghost;
      if (keyData.stepped) key.stepped = keyData.stepped;
      if (keyData.steppedCenter) key.steppedCenter = keyData.steppedCenter;
      if (keyData.nub) key.nub = keyData.nub;
      if (keyData.decal) key.decal = keyData.decal;
      
      return key;
    })
  };
}

export function exportToKLE2String(keyboard: Keyboard): string {
  return JSON.stringify(exportToKLE2(keyboard), null, 2);
}

export function importFromKLE2String(jsonString: string): Keyboard {
  const data = JSON.parse(jsonString) as KLE2Format;
  return importFromKLE2(data);
}