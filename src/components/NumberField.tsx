import React, { useEffect, useState } from 'react';
import { parseDecimal as parse } from '../utils/numbers';

interface NumberFieldProps {
  value: number;
  /** Appelé uniquement avec une valeur numérique valide (jamais pour un champ vide ou « - » en cours de frappe) */
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  /** Nombre maximal de décimales affichées */
  decimals?: number;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}

const format = (v: number, decimals: number) => String(Number(v.toFixed(decimals)));

/**
 * Champ numérique tolérant la saisie intermédiaire (« - », « 12, », champ vidé) :
 * on ne remet jamais la valeur à 0 pendant la frappe, et on accepte la virgule décimale.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onCommit,
  min,
  max,
  decimals = 3,
  className = '',
  ariaLabel,
  placeholder,
}) => {
  const [text, setText] = useState(format(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value, decimals));
  }, [value, decimals, focused]);

  const parsed = parse(text);
  const outOfRange = parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));
  const invalid = (text.trim() !== '' && parsed === null && text.trim() !== '-') || outOfRange;

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        setText(format(value, decimals)); // revient à la dernière valeur valide
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = parse(raw);
        if (n === null) return;
        if ((min !== undefined && n < min) || (max !== undefined && n > max)) return;
        onCommit(n);
      }}
      className={`${className} ${invalid ? '!border-rose-500 !text-rose-300' : ''}`}
    />
  );
};
