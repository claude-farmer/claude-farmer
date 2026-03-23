'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from '@/lib/locale-context';
import { composeCharacterSprite } from '@/canvas/character';
import { drawSprite } from '@/canvas/sprites';
import type { CharacterAppearance, CharacterType, HairStyle, SkinTone, EyeStyle, Accessory } from '@claude-farmer/shared';
import {
  DEFAULT_CHARACTER_APPEARANCE,
  CHARACTER_HAIR_COLORS,
  CHARACTER_SKIN_TONES,
  CHARACTER_CLOTHES_COLORS,
  ANIMAL_PALETTES,
  CHARACTER_TYPES,
} from '@claude-farmer/shared';

interface CharacterEditorProps {
  current?: CharacterAppearance;
  onSave: (appearance: CharacterAppearance) => void;
  onCancel: () => void;
}

const HAIR_STYLES: HairStyle[] = ['short', 'long', 'curly', 'ponytail', 'bun', 'spiky', 'bob', 'buzz'];
const SKIN_TONES: SkinTone[] = ['light', 'medium', 'dark', 'pale'];
const EYE_STYLES: EyeStyle[] = ['dot', 'round', 'line', 'star', 'closed'];
const ACCESSORIES: Accessory[] = ['none', 'glasses', 'sunglasses', 'eyepatch', 'bandaid'];

const TYPE_LABELS: Record<CharacterType, { en: string; ko: string; emoji: string }> = {
  human:  { en: 'Human',  ko: '사람',    emoji: '🧑' },
  bear:   { en: 'Bear',   ko: '곰',      emoji: '🐻' },
  rabbit: { en: 'Rabbit', ko: '토끼',    emoji: '🐰' },
  tiger:  { en: 'Tiger',  ko: '호랑이',  emoji: '🐯' },
  wolf:   { en: 'Wolf',   ko: '늑대',    emoji: '🐺' },
  frog:   { en: 'Frog',   ko: '개구리',  emoji: '🐸' },
  husky:  { en: 'Husky',  ko: '허스키',  emoji: '🐕' },
  bichon: { en: 'Bichon', ko: '비숑',    emoji: '🐩' },
  corgi:  { en: 'Corgi',  ko: '코기',    emoji: '🦊' },
};

const HAIR_STYLE_LABELS: Record<HairStyle, { en: string; ko: string }> = {
  short:    { en: 'Short',    ko: '짧은' },
  long:     { en: 'Long',     ko: '긴' },
  curly:    { en: 'Curly',    ko: '곱슬' },
  ponytail: { en: 'Ponytail', ko: '포니테일' },
  bun:      { en: 'Bun',      ko: '번' },
  spiky:    { en: 'Spiky',    ko: '뾰족' },
  bob:      { en: 'Bob',      ko: '단발' },
  buzz:     { en: 'Buzz',     ko: '스포츠' },
};

const EYE_LABELS: Record<EyeStyle, string> = {
  dot: '•', round: '◉', line: '─', star: '★', closed: '◡',
};

const ACCESSORY_LABELS: Record<Accessory, { en: string; ko: string }> = {
  none:       { en: 'None',       ko: '없음' },
  glasses:    { en: 'Glasses',    ko: '안경' },
  sunglasses: { en: 'Sunglasses', ko: '선글라스' },
  eyepatch:   { en: 'Eyepatch',   ko: '안대' },
  bandaid:    { en: 'Band-Aid',   ko: '반창고' },
};

export default function CharacterEditor({ current, onSave, onCancel }: CharacterEditorProps) {
  const { t, locale } = useLocale();
  const [appearance, setAppearance] = useState<CharacterAppearance>(current ?? DEFAULT_CHARACTER_APPEARANCE);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const update = useCallback((patch: Partial<CharacterAppearance>) => {
    setAppearance(prev => ({ ...prev, ...patch }));
  }, []);

  // 미리보기 렌더링
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const sprite = composeCharacterSprite(appearance);
    // 4x 스케일로 중앙에 그리기
    const scale = 4;
    const ox = (canvas.width - 16 * scale) / 2;
    const oy = (canvas.height - 16 * scale) / 2;
    drawSprite(ctx, sprite, ox / scale, oy / scale, scale);
  }, [appearance]);

  const isHuman = appearance.type === 'human';
  const l = (obj: { en: string; ko: string }) => locale === 'ko' ? obj.ko : obj.en;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl max-w-[360px] w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <span className="font-bold text-sm">{t.charEditorTitle}</span>
          <button onClick={onCancel} className="text-sm opacity-40 hover:opacity-70 px-1">✕</button>
        </div>

        {/* 미리보기 */}
        <div className="flex justify-center py-3 bg-[var(--bg)]">
          <canvas
            ref={previewRef}
            width={80}
            height={80}
            className="border border-[var(--border)] rounded-lg"
            style={{ imageRendering: 'pixelated', width: 80, height: 80 }}
          />
        </div>

        <div className="p-3 flex flex-col gap-3">
          {/* 타입 선택 */}
          <Section label={t.charType}>
            <div className="flex flex-wrap gap-1">
              {CHARACTER_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => update({ type })}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    appearance.type === type
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                      : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'
                  }`}
                >
                  {TYPE_LABELS[type].emoji} {l(TYPE_LABELS[type])}
                </button>
              ))}
            </div>
          </Section>

          {/* 인간 전용 옵션 */}
          {isHuman && (
            <>
              {/* 헤어 스타일 */}
              <Section label={t.charHairStyle}>
                <div className="flex flex-wrap gap-1">
                  {HAIR_STYLES.map(hs => (
                    <button
                      key={hs}
                      onClick={() => update({ hairStyle: hs })}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        appearance.hairStyle === hs
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                          : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {l(HAIR_STYLE_LABELS[hs])}
                    </button>
                  ))}
                </div>
              </Section>

              {/* 헤어 색상 */}
              <Section label={t.charHairColor}>
                <div className="flex gap-1">
                  {Object.entries(CHARACTER_HAIR_COLORS).map(([id, colors]) => (
                    <button
                      key={id}
                      onClick={() => update({ hairColor: id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        appearance.hairColor === id ? 'border-[var(--accent)] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: colors.base }}
                      title={id}
                    />
                  ))}
                </div>
              </Section>

              {/* 피부톤 */}
              <Section label={t.charSkinTone}>
                <div className="flex gap-1">
                  {SKIN_TONES.map(st => (
                    <button
                      key={st}
                      onClick={() => update({ skinTone: st })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        appearance.skinTone === st ? 'border-[var(--accent)] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: CHARACTER_SKIN_TONES[st].base }}
                      title={st}
                    />
                  ))}
                </div>
              </Section>

              {/* 눈 스타일 */}
              <Section label={t.charEyeStyle}>
                <div className="flex gap-1">
                  {EYE_STYLES.map(es => (
                    <button
                      key={es}
                      onClick={() => update({ eyeStyle: es })}
                      className={`w-7 h-7 rounded border text-sm flex items-center justify-center transition-colors ${
                        appearance.eyeStyle === es
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                          : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {EYE_LABELS[es]}
                    </button>
                  ))}
                </div>
              </Section>

              {/* 악세서리 */}
              <Section label={t.charAccessory}>
                <div className="flex flex-wrap gap-1">
                  {ACCESSORIES.map(acc => (
                    <button
                      key={acc}
                      onClick={() => update({ accessory: acc })}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        appearance.accessory === acc
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                          : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {l(ACCESSORY_LABELS[acc])}
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* 의상 색상 (공통) */}
          <Section label={t.charClothes}>
            <div className="flex gap-1">
              {Object.entries(CHARACTER_CLOTHES_COLORS).map(([id, colors]) => (
                <button
                  key={id}
                  onClick={() => update({ clothesColor: id })}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    appearance.clothesColor === id ? 'border-[var(--accent)] scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: colors.base }}
                  title={id}
                />
              ))}
            </div>
          </Section>
        </div>

        {/* 저장/취소 */}
        <div className="flex gap-2 p-3 border-t border-[var(--border)]">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--bg)] transition-colors"
          >
            {t.charCancel}
          </button>
          <button
            onClick={() => onSave(appearance)}
            className="flex-1 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
          >
            {t.charSave}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs opacity-50 mb-1">{label}</div>
      {children}
    </div>
  );
}
