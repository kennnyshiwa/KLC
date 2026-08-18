import type { Key, Keyboard } from '../types';
import { canSuggestSplitOptions, createSplitKeysFromWidths } from './splitKeySuggestions';

const UNIT_STEP = 0.25;
const EPSILON = 0.001;

export interface BottomRowTargetDetection {
  key: Key;
  keys: Key[];
  x: number;
  y: number;
  width: number;
  source: 'bottom-row' | 'fallback';
  summary: string;
  reason: string;
}

export interface BottomRowVariantPlan {
  appendedKeys: Key[];
  insertAfterKeyId: string;
  nextY: number;
}

const normalizeUnit = (value: number): number => Math.round(value / UNIT_STEP) * UNIT_STEP;
const getKeyRight = (key: Key): number => normalizeUnit(key.x + key.width);
const getKeyBottom = (key: Key): number => normalizeUnit(key.y + key.height);

const formatUnit = (value: number): string => {
  const normalized = normalizeUnit(value);
  return Number.isInteger(normalized)
    ? normalized.toString()
    : normalized.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const formatWidth = (width: number): string => `${formatUnit(width)}u`;
const formatRow = (y: number): string => `row y=${formatUnit(y)}`;

const hasSimpleRectFootprint = (key: Key): boolean => {
  const hasSecondaryRect =
    key.x2 !== undefined ||
    key.y2 !== undefined ||
    key.width2 !== undefined ||
    key.height2 !== undefined;

  return !hasSecondaryRect && !key.stepped && !key.steppedCenter;
};

const canParticipateInBottomRowCluster = (key: Key): boolean => {
  const hasRotation = Math.abs(key.rotation_angle || 0) > EPSILON;
  return !key.decal && !hasRotation && Math.abs(key.height - 1) < EPSILON && hasSimpleRectFootprint(key) && key.width >= 1;
};

const getRowCenter = (rowKeys: Key[]): number => {
  const rowLeft = Math.min(...rowKeys.map((key) => key.x));
  const rowRight = Math.max(...rowKeys.map((key) => getKeyRight(key)));
  return (rowLeft + rowRight) / 2;
};

const getHorizontalOverlap = (left: Key, right: Key): number => {
  const overlap = Math.min(getKeyRight(left), getKeyRight(right)) - Math.max(left.x, right.x);
  return overlap > EPSILON ? overlap : 0;
};

interface BottomRowClusterCandidate {
  keys: Key[];
  x: number;
  y: number;
  width: number;
  score: number;
}

const TYPICAL_BOTTOM_ROW_WIDTHS = [6, 6.25, 6.5, 7];

const getClusterScore = (clusterKeys: Key[], rowKeys: Key[]): number => {
  const width = normalizeUnit(clusterKeys.reduce((sum, key) => sum + key.width, 0));
  const left = clusterKeys[0].x;
  const right = getKeyRight(clusterKeys[clusterKeys.length - 1]);
  const center = (left + right) / 2;
  const rowCenter = getRowCenter(rowKeys);
  const widestKey = Math.max(...clusterKeys.map((key) => key.width));
  const narrowEdgePenalty = (clusterKeys[0].width <= 1.5 ? 10 : 0) + (clusterKeys[clusterKeys.length - 1].width <= 1.5 ? 10 : 0);
  const allNarrowPenalty = clusterKeys.every((key) => key.width <= 1.5) ? 40 : 0;
  const centerPenalty = Math.abs(center - rowCenter) * 8;
  const widthPenalty = Math.min(...TYPICAL_BOTTOM_ROW_WIDTHS.map((targetWidth) => Math.abs(width - targetWidth))) * 30;
  const wideKeyBonus = widestKey >= 2.25 ? 18 : widestKey >= 1.75 ? 8 : 0;
  const exactTypicalBonus = TYPICAL_BOTTOM_ROW_WIDTHS.some((targetWidth) => Math.abs(width - targetWidth) < EPSILON) ? 35 : 0;

  return 200 + exactTypicalBonus + wideKeyBonus - widthPenalty - centerPenalty - narrowEdgePenalty - allNarrowPenalty;
};

const detectBottomRowCluster = (rowKeys: Key[]): BottomRowClusterCandidate | null => {
  const sorted = [...rowKeys]
    .filter(canParticipateInBottomRowCluster)
    .sort((left, right) => left.x - right.x);

  if (sorted.length === 0) {
    return null;
  }

  const candidates: BottomRowClusterCandidate[] = [];

  for (let start = 0; start < sorted.length; start += 1) {
    let currentRight = getKeyRight(sorted[start]);
    let currentWidth = sorted[start].width;

    if (currentWidth >= 2.5) {
      candidates.push({
        keys: [sorted[start]],
        x: sorted[start].x,
        y: sorted[start].y,
        width: normalizeUnit(currentWidth),
        score: getClusterScore([sorted[start]], rowKeys),
      });
    }

    for (let end = start + 1; end < sorted.length; end += 1) {
      const next = sorted[end];
      const gap = normalizeUnit(next.x - currentRight);

      if (gap > 0.5) {
        break;
      }

      currentRight = getKeyRight(next);
      currentWidth = normalizeUnit(currentWidth + next.width + Math.max(gap, 0));
      const clusterKeys = sorted.slice(start, end + 1);

      if (currentWidth < 2.5 || currentWidth > 8) {
        continue;
      }

      candidates.push({
        keys: clusterKeys,
        x: clusterKeys[0].x,
        y: clusterKeys[0].y,
        width: currentWidth,
        score: getClusterScore(clusterKeys, rowKeys),
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => {
    if (Math.abs(right.score - left.score) > EPSILON) {
      return right.score - left.score;
    }

    if (Math.abs(right.width - left.width) > EPSILON) {
      return right.width - left.width;
    }

    return left.x - right.x;
  })[0];
};

const getRepresentativeKey = (keys: Key[]): Key => {
  const withLegend = keys.find((key) => key.centerLegend || key.labels.some((label) => Boolean(label)));
  if (withLegend) {
    return withLegend;
  }

  return [...keys].sort((left, right) => right.width - left.width)[0];
};

export const detectBottomRowTarget = (keys: Key[]): BottomRowTargetDetection | null => {
  const compatibleKeys = keys.filter(canSuggestSplitOptions);
  const clusterableKeys = keys.filter(canParticipateInBottomRowCluster);

  if (compatibleKeys.length === 0 && clusterableKeys.length === 0) {
    return null;
  }

  const physicalKeys = keys.filter((key) => !key.decal);
  if (physicalKeys.length === 0) {
    return null;
  }

  const bottomRow = Math.max(...physicalKeys.map((key) => getKeyBottom(key)));
  const bottomRowKeys = physicalKeys.filter((key) => Math.abs(getKeyBottom(key) - bottomRow) < EPSILON);
  const bottomRowCluster = detectBottomRowCluster(bottomRowKeys);

  if (bottomRowCluster) {
    const target = getRepresentativeKey(bottomRowCluster.keys);
    return {
      key: target,
      keys: bottomRowCluster.keys,
      x: bottomRowCluster.x,
      y: bottomRowCluster.y,
      width: bottomRowCluster.width,
      source: 'bottom-row',
      summary: `${formatWidth(bottomRowCluster.width)} on ${formatRow(bottomRowCluster.y)}`,
      reason: bottomRowCluster.keys.length > 1
        ? 'Detected a split bottom-row span from the lowest physical row and based suggestions on the full footprint.'
        : 'Picked the widest compatible anchor from the lowest physical row.',
    };
  }

  if (compatibleKeys.length === 0) {
    return null;
  }

  const fallbackTarget = [...compatibleKeys].sort((left, right) => {
    if (Math.abs(right.width - left.width) > EPSILON) {
      return right.width - left.width;
    }

    if (Math.abs(getKeyBottom(right) - getKeyBottom(left)) > EPSILON) {
      return getKeyBottom(right) - getKeyBottom(left);
    }

    return left.x - right.x;
  })[0];

  return {
    key: fallbackTarget,
    keys: [fallbackTarget],
    x: fallbackTarget.x,
    y: fallbackTarget.y,
    width: fallbackTarget.width,
    source: 'fallback',
    summary: `${formatWidth(fallbackTarget.width)} on ${formatRow(fallbackTarget.y)}`,
    reason: 'No bottom-row anchor fit, so this fell back to the widest compatible horizontal key.',
  };
};

export const planBottomRowSplitVariant = (
  keyboard: Keyboard,
  target: BottomRowTargetDetection,
  widths: number[],
): BottomRowVariantPlan => {
  const targetSpan: Key = {
    ...target.key,
    x: target.x,
    y: target.y,
    width: target.width,
    height: 1,
  };

  const overlappingKeys = keyboard.keys.filter(
    (key) => !key.decal && key.y >= target.y - EPSILON && getHorizontalOverlap(key, targetSpan) > EPSILON,
  );

  const maxBottom = overlappingKeys.reduce(
    (currentMax, key) => Math.max(currentMax, getKeyBottom(key)),
    getKeyBottom(targetSpan),
  );
  const nextY = normalizeUnit(maxBottom);

  const appendedKeys = createSplitKeysFromWidths(
    {
      ...target.key,
      x: target.x,
      y: nextY,
      width: target.width,
    },
    widths,
  );

  const overlapIds = new Set(overlappingKeys.map((key) => key.id));
  const insertAfterKey = [...keyboard.keys].reverse().find((key) => overlapIds.has(key.id)) ?? target.key;

  return {
    appendedKeys,
    insertAfterKeyId: insertAfterKey.id,
    nextY,
  };
};

export const appendBottomRowSplitVariant = (
  keyboard: Keyboard,
  target: BottomRowTargetDetection,
  widths: number[],
): { keyboard: Keyboard } & BottomRowVariantPlan => {
  const plan = planBottomRowSplitVariant(keyboard, target, widths);
  const insertIndex = keyboard.keys.findIndex((key) => key.id === plan.insertAfterKeyId);
  const nextKeys = [...keyboard.keys];

  nextKeys.splice(insertIndex + 1, 0, ...plan.appendedKeys);

  return {
    ...plan,
    keyboard: {
      ...keyboard,
      keys: nextKeys,
    },
  };
};
