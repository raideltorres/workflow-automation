import { describe, expect, it } from 'vitest';

import { extractTemplateTokens, findUnknownTemplateTokens, renderTemplate, toTemplateToken } from './template.js';

describe('extractTemplateTokens', () => {
  it('returns unique tokens and tolerates inner whitespace', () => {
    expect(extractTemplateTokens('Hi {{ a.b }} and {{a.b}} and {{c}}')).toEqual(['a.b', 'c']);
  });

  it('ignores malformed placeholders', () => {
    expect(extractTemplateTokens('{{}} {{ has space }} {single}')).toEqual([]);
  });
});

describe('findUnknownTemplateTokens', () => {
  it('reports tokens outside the allowed set', () => {
    expect(findUnknownTemplateTokens('{{known}} {{nope}}', ['known'])).toEqual(['nope']);
  });
});

describe('renderTemplate', () => {
  it('substitutes values, including numbers', () => {
    expect(renderTemplate('#{{n}} {{t}}', { n: 42, t: 'Fix bug' })).toBe('#42 Fix bug');
  });

  it('renders missing and null values as empty strings', () => {
    expect(renderTemplate('[{{missing}}][{{empty}}]', { empty: null })).toBe('[][]');
  });

  it('does not interpret template syntax inside substituted values', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}}', b: 'leak' })).toBe('{{b}}');
  });

  it('never resolves inherited object properties', () => {
    expect(renderTemplate('[{{constructor}}][{{__proto__}}][{{toString}}]', { a: 1 })).toBe('[][][]');
  });

  it('leaves expression-like placeholders untouched instead of evaluating them', () => {
    const template = '{{ a + b }} {{a()}} {{a[0]}} ${a}';

    expect(renderTemplate(template, { a: 'x', b: 'y' })).toBe(template);
    expect(extractTemplateTokens(template)).toEqual([]);
  });
});

describe('toTemplateToken', () => {
  it('round-trips through extraction', () => {
    expect(extractTemplateTokens(toTemplateToken('pull_request.title'))).toEqual(['pull_request.title']);
  });
});
