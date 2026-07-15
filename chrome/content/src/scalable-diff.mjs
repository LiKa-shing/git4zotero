export const EXACT_GAP_CELL_LIMIT = 50_000;
export const APPROXIMATE_WINDOW = 12;
export const SIMILARITY_THRESHOLD = 0.35;
const TOKEN_DIFF_CELL_LIMIT = 20_000;

export function alignParagraphs(oldParagraphs, newParagraphs, oldDetails = [], newDetails = [], options = {}) {
  const oldValues = oldParagraphs.map(normalizeComparableText);
  const newValues = newParagraphs.map(normalizeComparableText);
  const anchors = patienceAnchors(oldValues, newValues, options);
  const alignments = [];
  const approximateRanges = [];
  let quality = "exact";
  let oldCursor = 0;
  let newCursor = 0;

  for (const anchor of [...anchors, { oldIndex: oldValues.length, newIndex: newValues.length, sentinel: true }]) {
    const oldEnd = anchor.oldIndex;
    const newEnd = anchor.newIndex;
    const oldLength = oldEnd - oldCursor;
    const newLength = newEnd - newCursor;
    if (oldLength && newLength) {
      let gapAlignments;
      if (oldLength * newLength <= EXACT_GAP_CELL_LIMIT) {
        gapAlignments = exactGapAlignments(oldValues, newValues, oldCursor, oldEnd, newCursor, newEnd);
      }
      else {
        quality = "approximate";
        approximateRanges.push({ oldStart: oldCursor, oldEnd, newStart: newCursor, newEnd });
        gapAlignments = approximateGapAlignments(
          oldValues,
          newValues,
          oldDetails,
          newDetails,
          oldCursor,
          oldEnd,
          newCursor,
          newEnd,
          options
        );
      }
      alignments.push(...gapAlignments);
    }
    if (!anchor.sentinel) {
      alignments.push({ ...anchor, equal: true });
    }
    oldCursor = anchor.oldIndex + 1;
    newCursor = anchor.newIndex + 1;
  }

  return { alignments, quality, approximateRanges };
}

export function createTokenDiff(oldText, newText, options = {}) {
  const oldValue = String(oldText ?? "");
  const newValue = String(newText ?? "");
  const oldTokens = segmentWords(oldValue);
  const newTokens = segmentWords(newValue);
  if (oldValue.length + newValue.length > 500 || oldTokens.length * newTokens.length > TOKEN_DIFF_CELL_LIMIT) {
    return createPrefixSuffixTokenDiff(oldValue, newValue);
  }
  const matches = exactGapAlignments(oldTokens, newTokens, 0, oldTokens.length, 0, newTokens.length);
  const segments = [];
  let oldCursor = 0;
  let newCursor = 0;
  for (const match of [...matches, { oldIndex: oldTokens.length, newIndex: newTokens.length, sentinel: true }]) {
    appendSegment(segments, "deleted", oldTokens.slice(oldCursor, match.oldIndex).join(""));
    appendSegment(segments, "added", newTokens.slice(newCursor, match.newIndex).join(""));
    if (!match.sentinel) {
      appendSegment(segments, "equal", oldTokens[match.oldIndex]);
    }
    oldCursor = match.oldIndex + 1;
    newCursor = match.newIndex + 1;
  }
  return { simplified: false, segments, locale: options.locale || "" };
}

export function segmentWords(value, locale = undefined) {
  const text = String(value ?? "");
  if (typeof Intl?.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
      return [...segmenter.segment(text)].map((part) => part.segment);
    }
    catch {
      // Fall through to the deterministic tokenizer.
    }
  }
  return text.match(/[\u3400-\u9fff]|[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)*|\s+|[^\s\w]/gu) ?? [];
}

function patienceAnchors(oldValues, newValues, options) {
  const oldOccurrences = occurrenceMap(oldValues, options, "old");
  const newOccurrences = occurrenceMap(newValues, options, "new");
  const candidates = [];
  for (const [value, oldIndexes] of oldOccurrences) {
    const newIndexes = newOccurrences.get(value);
    if (oldIndexes.length === 1 && newIndexes?.length === 1) {
      candidates.push({ oldIndex: oldIndexes[0], newIndex: newIndexes[0] });
    }
  }
  candidates.sort((a, b) => a.oldIndex - b.oldIndex);
  return longestIncreasingNewIndex(candidates);
}

function occurrenceMap(values, options, phase) {
  const map = new Map();
  for (let index = 0; index < values.length; index += 1) {
    checkCancelled(options.signal);
    if (!map.has(values[index])) {
      map.set(values[index], []);
    }
    map.get(values[index]).push(index);
    reportProgress(options, phase, index + 1, values.length);
  }
  return map;
}

function longestIncreasingNewIndex(candidates) {
  if (!candidates.length) {
    return [];
  }
  const tails = [];
  const tailIndexes = [];
  const previous = Array(candidates.length).fill(-1);
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index].newIndex;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }
    tails[low] = value;
    previous[index] = low > 0 ? tailIndexes[low - 1] : -1;
    tailIndexes[low] = index;
  }
  const result = [];
  for (let index = tailIndexes[tails.length - 1]; index >= 0; index = previous[index]) {
    result.push(candidates[index]);
  }
  return result.reverse();
}

function exactGapAlignments(oldValues, newValues, oldStart, oldEnd, newStart, newEnd) {
  const oldLength = oldEnd - oldStart;
  const newLength = newEnd - newStart;
  const cols = newLength + 1;
  const table = new Uint32Array((oldLength + 1) * cols);
  for (let oldOffset = oldLength - 1; oldOffset >= 0; oldOffset -= 1) {
    for (let newOffset = newLength - 1; newOffset >= 0; newOffset -= 1) {
      const index = oldOffset * cols + newOffset;
      table[index] = oldValues[oldStart + oldOffset] === newValues[newStart + newOffset]
        ? table[(oldOffset + 1) * cols + newOffset + 1] + 1
        : Math.max(table[(oldOffset + 1) * cols + newOffset], table[oldOffset * cols + newOffset + 1]);
    }
  }
  const matches = [];
  let oldOffset = 0;
  let newOffset = 0;
  while (oldOffset < oldLength && newOffset < newLength) {
    if (oldValues[oldStart + oldOffset] === newValues[newStart + newOffset]) {
      matches.push({ oldIndex: oldStart + oldOffset, newIndex: newStart + newOffset, equal: true });
      oldOffset += 1;
      newOffset += 1;
    }
    else if (table[(oldOffset + 1) * cols + newOffset] >= table[oldOffset * cols + newOffset + 1]) {
      oldOffset += 1;
    }
    else {
      newOffset += 1;
    }
  }
  return matches;
}

function approximateGapAlignments(oldValues, newValues, oldDetails, newDetails, oldStart, oldEnd, newStart, newEnd, options) {
  const matches = [];
  const usedNew = new Set();
  let minimumNewIndex = newStart;
  const oldLength = Math.max(1, oldEnd - oldStart);
  const newLength = Math.max(1, newEnd - newStart);
  const tokenCache = new Map();

  for (let oldIndex = oldStart; oldIndex < oldEnd; oldIndex += 1) {
    checkCancelled(options.signal);
    const relative = (oldIndex - oldStart) / oldLength;
    const expected = newStart + Math.floor(relative * newLength);
    const from = Math.max(minimumNewIndex, newStart, expected - APPROXIMATE_WINDOW);
    const to = Math.min(newEnd - 1, expected + APPROXIMATE_WINDOW);
    let best = null;
    for (let newIndex = from; newIndex <= to; newIndex += 1) {
      if (usedNew.has(newIndex) || !sameStructure(oldDetails[oldIndex], newDetails[newIndex])) {
        continue;
      }
      const equal = oldValues[oldIndex] === newValues[newIndex];
      const score = equal ? 1 : tokenSimilarity(oldValues[oldIndex], newValues[newIndex], tokenCache);
      if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score || (score === best.score && Math.abs(newIndex - expected) < Math.abs(best.newIndex - expected)))) {
        best = { oldIndex, newIndex, score, equal };
      }
    }
    if (best) {
      matches.push(best);
      usedNew.add(best.newIndex);
      minimumNewIndex = best.newIndex + 1;
    }
    reportProgress(options, "approximate", oldIndex - oldStart + 1, oldEnd - oldStart);
  }
  return matches;
}

function sameStructure(oldDetail = {}, newDetail = {}) {
  const oldSource = oldDetail?.source || "document";
  const newSource = newDetail?.source || "document";
  const oldArea = oldDetail?.areaType || "body";
  const newArea = newDetail?.areaType || "body";
  if (oldSource !== newSource || oldArea !== newArea) {
    return false;
  }
  const oldHeading = (oldDetail?.headingPath ?? []).join("/");
  const newHeading = (newDetail?.headingPath ?? []).join("/");
  return !oldHeading || !newHeading || oldHeading === newHeading;
}

function tokenSimilarity(left, right, cache) {
  const leftTokens = cachedTokenSet(left, cache);
  const rightTokens = cachedTokenSet(right, cache);
  if (!leftTokens.size && !rightTokens.size) {
    return 1;
  }
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.max(1, leftTokens.size + rightTokens.size - intersection);
}

function cachedTokenSet(value, cache) {
  if (!cache.has(value)) {
    cache.set(value, new Set(segmentWords(value).map((token) => token.trim().toLocaleLowerCase()).filter(Boolean)));
  }
  return cache.get(value);
}

function createPrefixSuffixTokenDiff(oldText, newText) {
  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (suffix < oldText.length - prefix
      && suffix < newText.length - prefix
      && oldText[oldText.length - suffix - 1] === newText[newText.length - suffix - 1]) {
    suffix += 1;
  }
  const segments = [];
  appendSegment(segments, "equal", oldText.slice(0, prefix));
  appendSegment(segments, "deleted", oldText.slice(prefix, oldText.length - suffix));
  appendSegment(segments, "added", newText.slice(prefix, newText.length - suffix));
  appendSegment(segments, "equal", suffix ? oldText.slice(oldText.length - suffix) : "");
  return { simplified: true, segments };
}

function appendSegment(segments, type, text) {
  if (!text) {
    return;
  }
  const previous = segments[segments.length - 1];
  if (previous?.type === type) {
    previous.text += text;
  }
  else {
    segments.push({ type, text });
  }
}

function normalizeComparableText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function checkCancelled(signal) {
  if (signal?.aborted) {
    const error = new Error("git4zotero diff analysis was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function reportProgress(options, phase, completed, total) {
  if (completed % 200 === 0 || completed === total) {
    options.onProgress?.({ phase, completed, total });
  }
}
