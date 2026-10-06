import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ColorInput, Slider } from '@mantine/core';
import type { ReactNode } from 'react';
import { HEX, toHexColor } from '../../lib/color.ts';
import { ActionIcon, Switch } from '../../lib/core.ts';
import { PRESETS } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';

/** A titled block of settings inside a section. */
export function Group({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className='flex flex-col gap-3'>
      <header className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h3 className='text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-(--mantine-color-dimmed)'>
            {title}
          </h3>
          {hint && <p className='mt-0.5 text-xs text-(--mantine-color-placeholder)'>{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const SWATCHES = [...new Set(PRESETS.flatMap((p) => [p.look.accent, p.look.accent2]))];

/**
 * A colour input. Typing keeps the raw text in the draft (the preview uses the last valid value), blur turns
 * `#abc`, `rgb()` and friends into `#rrggbb`. `optional` fields may be empty; `fallback` is then shown as the
 * placeholder, the colour actually painted.
 */
export function ColorField({
  label,
  description,
  value,
  fallback,
  optional = false,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  fallback?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useExtTranslations();
  const invalid = value !== '' && !HEX.test(value);
  return (
    <ColorInput
      size='sm'
      label={label}
      description={description}
      value={value}
      placeholder={fallback}
      format='hex'
      withEyeDropper
      swatches={SWATCHES}
      swatchesPerRow={8}
      error={invalid ? t('colors.notHex', {}) : undefined}
      onChange={onChange}
      onBlur={() => {
        if (value === '' && optional) return;
        const hex = toHexColor(value);
        if (hex && hex !== value) onChange(hex);
      }}
      rightSection={
        optional && value !== '' ? (
          <ActionIcon
            size='sm'
            variant='subtle'
            color='gray'
            aria-label={t('colors.clear', {})}
            onClick={() => onChange('')}
          >
            <FontAwesomeIcon icon={faXmark} />
          </ActionIcon>
        ) : undefined
      }
    />
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-center justify-between text-sm'>
        <span>{label}</span>
        <span className='rounded-md bg-(--mantine-color-default) px-1.5 py-0.5 font-mono text-xs tabular-nums text-(--mantine-color-dimmed)'>
          {value}
          {unit}
        </span>
      </div>
      <Slider
        size='sm'
        min={min}
        max={max}
        step={step}
        value={value}
        label={null}
        onChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      label={label}
      description={description}
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}

export interface Tile<T extends string> {
  value: T;
  label: string;
  preview: ReactNode;
}

/** A row of picture buttons, one per choice. */
export function ChoiceTiles<T extends string>({
  label,
  value,
  options,
  columns = 2,
  onChange,
}: {
  label?: string;
  value: T;
  options: Tile<T>[];
  columns?: 2 | 3 | 4;
  onChange: (value: T) => void;
}) {
  const grid = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];
  return (
    <div className='flex flex-col gap-1.5' role='radiogroup' aria-label={label}>
      {label && <span className='text-sm'>{label}</span>}
      <div className={`grid ${grid} gap-2`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type='button'
              role='radio'
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`xylo-tile group relative flex cursor-pointer flex-col gap-1 rounded-xl border p-1 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
                selected
                  ? 'border-(--xylo-accent) bg-(--mantine-color-default-hover) shadow-[0_0_0_3px_color-mix(in_srgb,var(--xylo-accent)_22%,transparent)]'
                  : 'border-(--mantine-color-default-border) bg-(--mantine-color-default) hover:border-(--mantine-color-placeholder)'
              }`}
            >
              <div className='h-12 w-full overflow-hidden rounded-lg'>{option.preview}</div>
              <span className='flex items-center justify-between gap-1 px-1 pb-0.5 text-xs font-medium'>
                <span className='truncate'>{option.label}</span>
                {selected && <FontAwesomeIcon icon={faCheck} className='text-[0.625rem] text-(--xylo-accent)' />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
