import type { Key } from '../types';

export type KeyUpdate = { id: string; changes: Partial<Key> };

export interface RowLabelingPlan {
  updates: KeyUpdate[];
  additions: Key[];
  labeledKeyCount: number;
}

const SIZE_LEGEND_SLOT = 1;
const ROW_LABEL_WIDTH = 1;
const ROW_LABEL_GUTTER = 1.25;

const parseHexColor = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, '');
  const expanded = hex.length === 3
    ? hex.split('').map((character) => character.repeat(2)).join('')
    : hex;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return null;
  }

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
};

const relativeLuminance = ([red, green, blue]: [number, number, number]): number => {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
};

export const getGeneratedSizeLabelColor = (key: Key): '#000000' | '#ffffff' | undefined => {
  const provenance = key.sizeLabelProvenance;
  if (!provenance || key.frontLegends?.[provenance.slot] !== provenance.appliedValue) {
    return undefined;
  }

  const rgb = parseHexColor(key.color || '#f9f9f9');
  if (!rgb) {
    return '#000000';
  }

  const luminance = relativeLuminance(rgb);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
};

export const getFrontLegendColor = (key: Key, frontIndex: number): string => {
  const generatedSizeLabelColor = key.sizeLabelProvenance?.slot === frontIndex
    ? getGeneratedSizeLabelColor(key)
    : undefined;
  if (generatedSizeLabelColor) {
    return generatedSizeLabelColor;
  }

  const legendIndex = frontIndex + 4;
  if (Array.isArray(key.textColor) && key.textColor[legendIndex]) {
    return key.textColor[legendIndex];
  }
  if (key.default?.color?.[0]) {
    return key.default.color[0];
  }

  return 'rgba(0,0,0,0.6)';
};

export const formatKeySize = (key: Pick<Key, 'width' | 'height'>): string => {
  if (key.height === 1) {
    return `${key.width}u`;
  }

  return `${key.width}×${key.height}`;
};

const isNonUnitSizeLabelKey = (key: Key): boolean => (
  (key.width > 1 || key.height > 1) &&
  !key.decal &&
  key.profile !== 'LED' &&
  key.profile !== 'ENCODER'
);

export const planSizeLabelUpdates = (keys: Key[], enabled: boolean): KeyUpdate[] => {
  return keys.flatMap((key) => {
    // Size auto-labeling owns only non-1u physical keys. Keep every field on
    // 1u and special keys byte-for-byte unchanged in both directions.
    if (!isNonUnitSizeLabelKey(key)) {
      return [];
    }

    if (enabled) {
      const appliedValue = formatKeySize(key);
      const frontLegends = [...(key.frontLegends ?? ['', '', ''])];
      const previousValue = frontLegends[SIZE_LEGEND_SLOT];

      frontLegends[SIZE_LEGEND_SLOT] = appliedValue;

      return [{
        id: key.id,
        changes: {
          frontLegends,
          sizeLabelProvenance: {
            slot: SIZE_LEGEND_SLOT,
            previousValue,
            appliedValue,
          },
        },
      }];
    }

    const provenance = key.sizeLabelProvenance;
    if (!provenance) {
      return [];
    }

    const changes: Partial<Key> = { sizeLabelProvenance: undefined };

    // Restore only the value this action wrote. A user edit made while labels were
    // enabled wins and is never replaced with stale provenance.
    if (key.frontLegends?.[provenance.slot] === provenance.appliedValue) {
      const frontLegends = [...key.frontLegends];
      frontLegends[provenance.slot] = provenance.previousValue ?? '';
      changes.frontLegends = frontLegends;
    }

    return [{ id: key.id, changes }];
  });
};

const isPhysicalKey = (key: Key): boolean => (
  !key.decal &&
  !key.ghost &&
  key.profile !== 'LED' &&
  key.profile !== 'ENCODER'
);

const rowBucket = (key: Key): number => Math.floor(key.y + 0.001);
const validRowPosition = (value: string | undefined): value is string => (
  value !== undefined && /^K[1-6]$/.test(value)
);

export const isRowLabelKey = (key: Key): boolean => (
  key.decal === true && key.ghost === true && key.color === 'transparent'
);

const visibleLabelForPosition = (rowPosition: string): string => (
  rowPosition === 'K6' ? 'SP' : `R${rowPosition.slice(1)}`
);

const resolvePhysicalRows = (keys: Key[]): Array<{ rowKeys: Key[]; rowPosition: string }> => {
  const rows = new Map<number, Key[]>();

  keys.filter(isPhysicalKey).forEach((key) => {
    const bucket = rowBucket(key);
    rows.set(bucket, [...(rows.get(bucket) ?? []), key]);
  });

  const sortedRows = [...rows.entries()].sort(([a], [b]) => a - b);
  const existingPositionsByRow = sortedRows.map(([, rowKeys]) => (
    new Set(rowKeys.map((key) => key.rowPosition).filter(validRowPosition))
  ));
  const positionOwners = new Map<string, number>();

  existingPositionsByRow.forEach((positions, rowIndex) => {
    positions.forEach((position) => {
      if (!positionOwners.has(position)) {
        positionOwners.set(position, rowIndex);
      } else if (positionOwners.get(position) !== rowIndex) {
        positionOwners.set(position, -1);
      }
    });
  });

  return sortedRows.flatMap(([, rowKeys], rowIndex) => {
    if (rowIndex >= 6) {
      return [];
    }

    const existingPositions = existingPositionsByRow[rowIndex];
    let rowPosition: string | undefined;

    if (existingPositions.size === 1) {
      rowPosition = [...existingPositions][0];
    } else if (existingPositions.size === 0 && rowKeys.every((key) => !key.rowPosition)) {
      const expectedPosition = `K${rowIndex + 1}`;
      const owner = positionOwners.get(expectedPosition);
      if (owner === undefined || owner === rowIndex) {
        rowPosition = expectedPosition;
      }
    }

    return rowPosition ? [{ rowKeys, rowPosition }] : [];
  });
};

export const planRowPositionUpdates = (keys: Key[]): KeyUpdate[] => {
  return resolvePhysicalRows(keys).flatMap(({ rowKeys, rowPosition }) => (
    rowKeys
      .filter((key) => !key.rowPosition)
      .map((key) => ({ id: key.id, changes: { rowPosition } }))
  ));
};

export const planRowLabeling = (keys: Key[], createId: () => string): RowLabelingPlan => {
  const resolvedRows = resolvePhysicalRows(keys);
  const existingRowLabels = keys.filter(isRowLabelKey);
  const existingLegendValues = new Set(existingRowLabels.map((key) => key.labels?.[0]).filter(Boolean));

  // Visible labels are separate KLC row-label decals. Existing row-label decals
  // own their row and are never moved, renamed, or overwritten. Ambiguous KRK
  // rows are omitted by resolvePhysicalRows, so custom/conflicting data wins.
  const additions = resolvedRows.flatMap(({ rowKeys, rowPosition }) => {
    const y = Math.min(...rowKeys.map((key) => key.y));
    const label = visibleLabelForPosition(rowPosition);
    const rowAlreadyHasLabel = existingRowLabels.some((key) => rowBucket(key) === rowBucket(rowKeys[0]));

    if (rowAlreadyHasLabel || existingLegendValues.has(label)) {
      return [];
    }

    existingLegendValues.add(label);
    return [{
      id: createId(),
      x: 0,
      y,
      width: ROW_LABEL_WIDTH,
      height: 1,
      labels: [label],
      color: 'transparent',
      profile: 'OEM' as const,
      decal: true,
      ghost: true,
    }];
  });

  const rowPositionUpdates = planRowPositionUpdates(keys);
  const shouldReserveLabelGutter = additions.length > 0 && existingRowLabels.length === 0;
  const rowPositionChanges = new Map(rowPositionUpdates.map(({ id, changes }) => [id, changes]));
  const updates = shouldReserveLabelGutter
    ? keys.filter((key) => !isRowLabelKey(key)).map((key) => ({
      id: key.id,
      changes: {
        x: key.x + ROW_LABEL_GUTTER,
        ...(key.rotation_x === undefined ? {} : { rotation_x: key.rotation_x + ROW_LABEL_GUTTER }),
        ...rowPositionChanges.get(key.id),
      },
    }))
    : rowPositionUpdates;

  return {
    updates,
    additions,
    labeledKeyCount: resolvedRows.reduce((count, row) => count + row.rowKeys.length, 0),
  };
};
