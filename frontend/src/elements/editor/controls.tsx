import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Chip, ColorInput, Slider } from '@mantine/core';
import type { ReactNode } from 'react';
import { HEX, toHexColor } from '../../lib/color.ts';
import { ActionIcon, Switch } from '../../lib/core.ts';
import { PRESETS, type ZoronTheme } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';

/**
 * Every control is marked with the theme field it edits (`data-zoron-setting`), which the settings search scrolls to
 * (fields.ts lists them). The field controls below mark themselves; `Setting` marks any other control.
 */
export const Setting = ({ field, children }: { field: keyof ZoronTheme; children: ReactNode }) => (
  <div data-zoron-setting={field}>{children}</div>
);

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
  field,
  label,
  description,
  value,
  fallback,
  optional = false,
  onChange,
}: {
  field: keyof ZoronTheme;
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
    <Setting field={field}>
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
    </Setting>
  );
}

export function SliderField({
  field,
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  format,
  onChange,
}: {
  field: keyof ZoronTheme;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** How the value reads beside the label; `unit` is appended to the plain number otherwise. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className='flex flex-col gap-1.5' data-zoron-setting={field}>
      <div className='flex items-center justify-between text-sm'>
        <span>{label}</span>
        <span className='rounded-md bg-(--mantine-color-default) px-1.5 py-0.5 font-mono text-xs tabular-nums text-(--mantine-color-dimmed)'>
          {format ? format(value) : `${value}${unit}`}
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
  field,
  label,
  description,
  checked,
  onChange,
}: {
  field: keyof ZoronTheme;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Setting field={field}>
      <Switch
        label={label}
        description={description}
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    </Setting>
  );
}

/** A row of chips, any number of them on; `onChange` gets the picked values in the order `options` lists them. */
export function ToggleChips<T extends string>({
  field,
  label,
  value,
  options,
  onChange,
}: {
  field: keyof ZoronTheme;
  label: string;
  value: readonly T[];
  options: { value: T; label: string }[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div className='flex flex-col gap-1.5' data-zoron-setting={field}>
      <span className='text-sm'>{label}</span>
      <Chip.Group
        multiple
        value={[...value]}
        onChange={(next) => onChange(options.map((option) => option.value).filter((v) => next.includes(v)))}
      >
        <div className='flex flex-wrap gap-1.5' role='group' aria-label={label}>
          {options.map((option) => (
            <Chip key={option.value} value={option.value} size='xs' variant='outline'>
              {option.label}
            </Chip>
          ))}
        </div>
      </Chip.Group>
    </div>
  );
}

export interface Tile<T extends string> {
  value: T;
  label: string;
  preview: ReactNode;
}

/** A row of picture buttons, one per choice. */
export function ChoiceTiles<T extends string>({
  field,
  label,
  value,
  options,
  columns = 2,
  onChange,
}: {
  field: keyof ZoronTheme;
  label?: string;
  value: T;
  options: Tile<T>[];
  columns?: 2 | 3 | 4;
  onChange: (value: T) => void;
}) {
  const grid = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];
  return (
    <div className='flex flex-col gap-1.5' role='radiogroup' aria-label={label} data-zoron-setting={field}>
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
              className={`zoron-tile group relative flex cursor-pointer flex-col gap-1 rounded-xl border p-1 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
                selected
                  ? 'border-(--zoron-accent) bg-(--mantine-color-default-hover) shadow-[0_0_0_3px_color-mix(in_srgb,var(--zoron-accent)_22%,transparent)]'
                  : 'border-(--mantine-color-default-border) bg-(--mantine-color-default) hover:border-(--mantine-color-placeholder)'
              }`}
            >
              <div className='h-12 w-full overflow-hidden rounded-lg'>{option.preview}</div>
              <span className='flex items-center justify-between gap-1 px-1 pb-0.5 text-xs font-medium'>
                <span className='truncate'>{option.label}</span>
                {selected && <FontAwesomeIcon icon={faCheck} className='text-[0.625rem] text-(--zoron-accent)' />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
