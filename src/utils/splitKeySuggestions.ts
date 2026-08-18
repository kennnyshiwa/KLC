import { Key } from '../types';
import { generateKeyId } from './keyUtils';

export type SplitSuggestionBucket = 'common' | 'reasonable' | 'cursed';

export interface SplitSuggestion {
  id: string;
  label: string;
  widths: number[];
  bucket: SplitSuggestionBucket;
  reason: string;
  score: number;
}

const WIDTH_STEP = 0.25;
const ALLOWED_SEGMENT_WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const MAX_SUGGESTIONS_PER_BUCKET: Record<SplitSuggestionBucket, number> = {
  common: 6,
  reasonable: 6,
  cursed: 4,
};

const CURATED_PATTERNS: Array<{
  widths: number[];
  bucket: SplitSuggestionBucket;
  reason: string;
  score: number;
}> = [
  {
    widths: [3, 3],
    bucket: 'reasonable',
    reason: 'Clean symmetric 2-piece split, but less common than split-space clusters',
    score: 72,
  },
  {
    widths: [2.25, 1.5, 2.25],
    bucket: 'reasonable',
    reason: 'Balanced thumb-friendly 3-piece split',
    score: 74,
  },
  {
    widths: [2, 2, 2],
    bucket: 'reasonable',
    reason: 'Three equal 2u blocks',
    score: 70,
  },
  {
    widths: [1.5, 3, 1.5],
    bucket: 'reasonable',
    reason: 'Big center key with balanced outers',
    score: 66,
  },
  {
    widths: [2.75, 1.25, 2.25],
    bucket: 'common',
    reason: 'Very common 6.25u split-space arrangement',
    score: 94,
  },
  {
    widths: [2.25, 1.25, 2.75],
    bucket: 'common',
    reason: 'Mirror of the classic 6.25u split-space arrangement',
    score: 92,
  },
  {
    widths: [1.75, 2.75, 1.75],
    bucket: 'reasonable',
    reason: 'Balanced 6.25u three-piece split',
    score: 64,
  },
  {
    widths: [2.25, 1.75, 2.25],
    bucket: 'reasonable',
    reason: 'Wide-thumb 6.25u split',
    score: 62,
  },
  {
    widths: [2.5, 1, 2.5],
    bucket: 'reasonable',
    reason: 'Compact center pair around larger thumbs',
    score: 80,
  },
  {
    widths: [2, 1, 1, 2],
    bucket: 'reasonable',
    reason: 'Four-piece split with a 1u center pair',
    score: 78,
  },
  {
    widths: [2, 1.25, 1, 2],
    bucket: 'reasonable',
    reason: '4-piece 6.25u split with a compact center cluster',
    score: 77,
  },
  {
    widths: [2.25, 1.25, 1.25, 1.5],
    bucket: 'reasonable',
    reason: 'Asymmetric 6.25u split with extra thumb variety',
    score: 75,
  },
  {
    widths: [1.5, 1.25, 1.25, 2.25],
    bucket: 'reasonable',
    reason: 'Mirror of the asymmetric 6.25u thumb split',
    score: 74,
  },
  {
    widths: [1.5, 1.5, 1.5, 1.5],
    bucket: 'reasonable',
    reason: 'Uniform 4-way split',
    score: 72,
  },
  {
    widths: [1.25, 1.75, 1.75, 1.25],
    bucket: 'reasonable',
    reason: 'Balanced 4-piece cluster',
    score: 68,
  },
  {
    widths: [1, 1, 1, 1, 1, 1],
    bucket: 'cursed',
    reason: 'Maximum 1u chaos',
    score: 10,
  },
  {
    widths: [1.25, 1.25, 1.25, 1.25, 1.25],
    bucket: 'cursed',
    reason: 'Five equal 1.25u keys, for the truly unwell',
    score: 9,
  },
];

const LEFT_TO_RIGHT_SPACEBAR_LEFT_WIDTHS = [2.75, 2.5, 2.25, 2, 1.75, 1.5];
const LEFT_TO_RIGHT_SPACEBAR_CENTER_WIDTHS = [1, 1.25, 1.5];

const normalizeWidth = (width: number): number => Math.round(width / WIDTH_STEP) * WIDTH_STEP;
const toQuarterUnits = (width: number): number => Math.round(normalizeWidth(width) / WIDTH_STEP);
const fromQuarterUnits = (units: number): number => normalizeWidth(units * WIDTH_STEP);

const sumWidths = (widths: number[]): number => normalizeWidth(widths.reduce((total, width) => total + width, 0));

const formatWidth = (width: number): string => {
  const normalized = normalizeWidth(width);
  const text = Number.isInteger(normalized) ? normalized.toString() : normalized.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}u`;
};

const formatSuggestionLabel = (widths: number[]): string => {
  if (widths.every((width) => Math.abs(width - 1) < 0.001)) {
    return `${widths.length} x 1u`;
  }

  return widths.map(formatWidth).join(' + ');
};

const createSuggestionId = (widths: number[]): string => widths.map((width) => formatWidth(width)).join('|');

const hasSimpleRectFootprint = (key: Key): boolean => {
  const hasSecondaryRect =
    key.x2 !== undefined ||
    key.y2 !== undefined ||
    key.width2 !== undefined ||
    key.height2 !== undefined;

  return !hasSecondaryRect && !key.stepped && !key.steppedCenter;
};

export const canSuggestSplitOptions = (key: Key | undefined | null): key is Key => {
  if (!key) {
    return false;
  }

  const isHorizontal = Math.abs(key.height - 1) < 0.001 && key.width >= 2.5;
  const hasRotation = Math.abs(key.rotation_angle || 0) > 0.001;

  return isHorizontal && !hasRotation && hasSimpleRectFootprint(key) && !key.decal;
};

export const getSuggestedSplitOptions = (keyOrWidth: Key | number): SplitSuggestion[] => {
  const totalWidth = typeof keyOrWidth === 'number' ? keyOrWidth : keyOrWidth.width;
  const normalizedTotalWidth = normalizeWidth(totalWidth);
  const totalUnits = toQuarterUnits(normalizedTotalWidth);
  const suggestions: SplitSuggestion[] = [];
  const seen = new Set<string>();

  const addSuggestion = (
    widths: number[],
    bucket: SplitSuggestionBucket,
    reason: string,
    score: number,
  ) => {
    if (widths.length < 2) {
      return;
    }

    const normalizedWidths = widths.map(normalizeWidth);
    if (toQuarterUnits(sumWidths(normalizedWidths)) !== totalUnits) {
      return;
    }

    const id = createSuggestionId(normalizedWidths);
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    suggestions.push({
      id,
      widths: normalizedWidths,
      label: formatSuggestionLabel(normalizedWidths),
      bucket,
      reason,
      score,
    });
  };

  CURATED_PATTERNS.forEach((pattern) => {
    addSuggestion(pattern.widths, pattern.bucket, pattern.reason, pattern.score);
  });

  if (normalizedTotalWidth >= 5.75) {
    LEFT_TO_RIGHT_SPACEBAR_LEFT_WIDTHS.forEach((leftWidth) => {
      LEFT_TO_RIGHT_SPACEBAR_CENTER_WIDTHS.forEach((centerWidth) => {
        const rightWidth = normalizeWidth(normalizedTotalWidth - leftWidth - centerWidth);

        if (!ALLOWED_SEGMENT_WIDTHS.includes(leftWidth) || !ALLOWED_SEGMENT_WIDTHS.includes(centerWidth) || !ALLOWED_SEGMENT_WIDTHS.includes(rightWidth)) {
          return;
        }

        const commonCenter = centerWidth <= 1.25;
        const commonOuterWidths = leftWidth >= 2 && rightWidth >= 2;
        const bucket: SplitSuggestionBucket = commonCenter && commonOuterWidths ? 'common' : 'reasonable';
        const centerBonus = centerWidth === 1 ? 36 : centerWidth === 1.25 ? 24 : 10;
        const outerBalancePenalty = Math.abs(leftWidth - rightWidth) * 4;
        const score = 110 + centerBonus - outerBalancePenalty - (bucket === 'reasonable' ? 18 : 0);

        addSuggestion(
          [leftWidth, centerWidth, rightWidth],
          bucket,
          centerWidth === 1
            ? 'Classic split-space pattern with a 1u key inside the cluster'
            : centerWidth === 1.25
              ? 'Common split-space pattern with a compact center key'
              : 'Less typical split-space pattern built left to right',
          score,
        );
      });
    });
  }

  if (totalUnits % 2 === 0) {
    const halfWidth = fromQuarterUnits(totalUnits / 2);
    if (ALLOWED_SEGMENT_WIDTHS.includes(halfWidth)) {
      addSuggestion([halfWidth, halfWidth], 'common', 'Simple equal split', 90);
    }
  }

  ALLOWED_SEGMENT_WIDTHS.forEach((outerWidth) => {
    const centerUnits = totalUnits - toQuarterUnits(outerWidth) * 2;
    if (centerUnits <= 0) {
      return;
    }

    const centerWidth = fromQuarterUnits(centerUnits);
    if (!ALLOWED_SEGMENT_WIDTHS.includes(centerWidth)) {
      return;
    }

    const isCommon = outerWidth >= 1.5 && outerWidth <= 2.25 && centerWidth >= 1.5;
    addSuggestion(
      [outerWidth, centerWidth, outerWidth],
      isCommon ? 'common' : 'reasonable',
      isCommon ? 'Balanced symmetric 3-piece split' : 'Symmetric 3-piece split',
      isCommon ? 84 : 70,
    );
  });

  ALLOWED_SEGMENT_WIDTHS.forEach((outerWidth) => {
    ALLOWED_SEGMENT_WIDTHS.forEach((innerWidth) => {
      const totalPatternUnits = (toQuarterUnits(outerWidth) + toQuarterUnits(innerWidth)) * 2;
      if (totalPatternUnits !== totalUnits) {
        return;
      }

      const isUniform = Math.abs(outerWidth - innerWidth) < 0.001;
      addSuggestion(
        [outerWidth, innerWidth, innerWidth, outerWidth],
        'reasonable',
        isUniform ? 'Even 4-way split' : 'Symmetric 4-piece split',
        isUniform ? 66 : 62,
      );
    });
  });

  if (Math.abs(normalizedTotalWidth - Math.round(normalizedTotalWidth)) < 0.001 && normalizedTotalWidth >= 4) {
    addSuggestion(
      Array.from({ length: Math.round(normalizedTotalWidth) }, () => 1),
      'cursed',
      'Because sometimes chaos is the point',
      8,
    );
  }

  const bucketOrder: SplitSuggestionBucket[] = ['common', 'reasonable', 'cursed'];

  return bucketOrder.flatMap((bucket) =>
    suggestions
      .filter((suggestion) => suggestion.bucket === bucket)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (left.widths.length !== right.widths.length) {
          return left.widths.length - right.widths.length;
        }

        return left.label.localeCompare(right.label);
      })
      .slice(0, MAX_SUGGESTIONS_PER_BUCKET[bucket])
  );
};

const cloneDefaultTextMeta = (key: Key) => {
  if (!key.default) {
    return undefined;
  }

  return {
    size: key.default.size ? [...key.default.size] : undefined,
    color: key.default.color ? [...key.default.color] : undefined,
  };
};

export const createSplitKeysFromWidths = (originalKey: Key, widths: number[]): Key[] => {
  const blankLabels = Array.from({ length: Math.max(originalKey.labels.length, 1) }, () => '');
  const legendOwnerIndex = Math.floor((widths.length - 1) / 2);
  let currentX = normalizeWidth(originalKey.x);

  return widths.map((width, index) => {
    const splitKey: Key = {
      ...originalKey,
      id: generateKeyId(),
      x: currentX,
      y: originalKey.y,
      width: normalizeWidth(width),
      height: originalKey.height,
      labels: index === legendOwnerIndex ? [...originalKey.labels] : [...blankLabels],
      textColor: originalKey.textColor ? [...originalKey.textColor] : undefined,
      textSize: originalKey.textSize ? [...originalKey.textSize] : undefined,
      default: cloneDefaultTextMeta(originalKey),
      frontLegends: index === legendOwnerIndex && originalKey.frontLegends ? [...originalKey.frontLegends] : undefined,
      centerLegend: index === legendOwnerIndex ? originalKey.centerLegend : undefined,
      legendRotation: originalKey.legendRotation ? [...originalKey.legendRotation] : undefined,
      x2: undefined,
      y2: undefined,
      width2: undefined,
      height2: undefined,
      stepped: false,
      steppedCenter: false,
      nub: false,
    };

    currentX = normalizeWidth(currentX + width);
    return splitKey;
  });
};
