(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMPlaybackTime = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function speechFeatures(value) {
    const text = String(value || '').trim();
    const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu) || []).length;
    const latinWords = (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
    const digitGroups = (text.match(/\d+(?:[.,]\d+)*/g) || []).length;
    const commas = (text.match(/[,，、;；:：]/g) || []).length;
    const sentences = (text.match(/[.!?。！？]/g) || []).length;
    const lineBreaks = (text.match(/\n/g) || []).length;
    const remaining = Math.max(0, Array.from(text.replace(/[\s\u3400-\u9fff\u3040-\u30ff\uac00-\ud7afA-Za-z\d.,，、;；:：!?。！？'’-]/gu, '')).length);
    return { text, cjk, latinWords, digitGroups, commas, sentences, lineBreaks, remaining };
  }

  function estimateSpeechDurationMs(value, rate = 1, calibration = 1) {
    const features = speechFeatures(value);
    if (!features.text) return 0;
    const speakingSeconds = features.cjk / 4.5
      + features.latinWords / 2.7
      + features.digitGroups / 2.8
      + features.remaining / 5;
    const pauseSeconds = features.commas * 0.18
      + features.sentences * 0.35
      + features.lineBreaks * 0.35;
    return Math.round(Math.max(400, ((speakingSeconds + pauseSeconds) * 1000 / clamp(Number(rate) || 1, 0.5, 2))
      * clamp(Number(calibration) || 1, 0.5, 2.5)));
  }

  function resolveSegmentText(rules, document, frame, descriptor, segment) {
    if (segment?.kind === 'expression') {
      return rules?.resolveTextExpression?.(document, frame, segment.expression, descriptor.drawLocals);
    }
    if (segment?.kind === 'template') {
      return String(segment.text || '').replace(/\$\{([^{}]+)\}/g, (_, expression) => {
        const resolved = rules?.resolveTextExpression?.(
          document, frame, expression.trim(), descriptor.drawLocals
        );
        return resolved == null ? '' : String(resolved);
      });
    }
    return segment?.text;
  }

  function resolveFrameSpeechLines(document, frame, dependencies = {}) {
    if (!frame) return [];
    const model = dependencies.model;
    const rules = dependencies.rules;
    const parseMarkup = dependencies.parseMarkup || (value => ({ speech: String(value ?? '') }));
    let descriptors;
    try {
      descriptors = model?.drawingDirectives?.(document, frame, 'texts') || frame.texts || [];
    } catch {
      descriptors = frame.texts || [];
    }
    const output = [];
    descriptors.forEach(descriptor => {
      try {
        if (!rules?.textExpressionMatches?.(document, frame, descriptor?.when, descriptor.drawLocals)) return;
      } catch {
        return;
      }
      const segments = Array.isArray(descriptor?.segments) ? descriptor.segments : [];
      const explicitSpeech = segments.some(segment => Object.hasOwn(segment || {}, 'speech'));
      const lines = [''];
      segments.forEach(segment => {
        let resolved;
        try {
          resolved = resolveSegmentText(rules, document, frame, descriptor, segment);
        } catch {
          resolved = segment?.text;
        }
        const parts = String(resolved ?? '').split('\n');
        parts.forEach((part, partIndex) => {
          let speech = '';
          if (explicitSpeech) {
            if (Object.hasOwn(segment || {}, 'speech') && partIndex === 0) speech = String(segment.speech ?? '');
          } else {
            speech = String(parseMarkup(part)?.speech ?? part);
          }
          lines[lines.length - 1] += speech;
          if (partIndex < parts.length - 1) lines.push('');
        });
      });
      lines.map(line => line.trim()).filter(Boolean).forEach(line => output.push(line));
    });
    return output;
  }

  function createCalibration(initial = {}) {
    const ratios = new Map(Object.entries(initial).filter(([, value]) => Number.isFinite(Number(value))));
    return {
      ratio(key) {
        return clamp(Number(ratios.get(String(key))) || 1, 0.5, 2.5);
      },
      record(key, predictedMs, actualMs) {
        const predicted = Number(predictedMs);
        const actual = Number(actualMs);
        if (!(predicted > 0) || !(actual > 0)) return this.ratio(key);
        const sample = clamp(actual / predicted, 0.5, 2.5);
        const previous = this.ratio(key);
        const next = previous * 0.75 + sample * 0.25;
        ratios.set(String(key), next);
        return next;
      },
      toJSON() {
        return Object.fromEntries(ratios);
      }
    };
  }

  function buildTimeline(options = {}) {
    const frames = Array.isArray(options.frames) ? options.frames : [];
    const rate = Number(options.rate) || 1;
    const gapMs = clamp(Number(options.gapMs) || 0, 0, 2000);
    const calibration = Number(options.calibration) || 1;
    const actualDurations = options.actualDurations instanceof Map
      ? options.actualDurations : new Map(Object.entries(options.actualDurations || {}).map(([key, value]) => [Number(key), value]));
    const transitionDurations = options.transitionDurations instanceof Map
      ? options.transitionDurations : new Map();
    const frameSleeps = options.frameSleeps instanceof Map ? options.frameSleeps : new Map();
    const durations = frames.map((lines, index) => {
      const actual = Number(actualDurations.get(index));
      if (actual >= 0 && Number.isFinite(actual)) return actual;
      const speechMs = (Array.isArray(lines) ? lines : []).reduce((sum, line) => (
        sum + estimateSpeechDurationMs(line, rate, calibration)
      ), 0);
      const transitionMs = Math.max(0, Number(transitionDurations.get(index)) || 0);
      const sleepMs = Math.max(0, Number(frameSleeps.get(index)) || 0);
      const afterFrameGap = index < frames.length - 1 ? gapMs + sleepMs : 0;
      return Math.max(speechMs, transitionMs) + afterFrameGap;
    });
    const offsets = [];
    let totalMs = 0;
    durations.forEach(duration => {
      offsets.push(totalMs);
      totalMs += duration;
    });
    return { durations, offsets, totalMs };
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return {
    speechFeatures,
    estimateSpeechDurationMs,
    resolveFrameSpeechLines,
    createCalibration,
    buildTimeline,
    formatDuration
  };
});
