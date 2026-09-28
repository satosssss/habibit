'use client';

import { useId } from 'react';

export function Combobox({
  label, value, options, onChange, placeholder, listId,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  listId?: string;   // stable id so tests can assert the suggestion list
}) {
  const id = useId();
  const resolvedListId = listId ?? `${id}-list`;
  return (
    <>
      <label className="block text-sm" htmlFor={id}>
        <span className="mb-1 block font-semibold">{label}</span>
        <input
          id={id} list={resolvedListId} value={value}
          placeholder={placeholder ?? `Choose or type ${label.toLowerCase()}`}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      {/* Outside the label on purpose: a wrapping label would append the option
          text to the field's accessible name ("Intention" + "Study"). The
          association is the input's `list` attribute, not the nesting. */}
      <datalist id={resolvedListId}>
        {/* Text content = accessible name of the suggestion (a bare `value`
            attribute leaves the option unnamed for AT). */}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </datalist>
    </>
  );
}
