import { FormControl, FormSelect, FormLabel, FormGroup } from 'react-bootstrap';
import { ReactNode } from 'react';

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  label?: string;
}

export function Input({ type = 'text', placeholder, value, onChange, className = '', label }: InputProps) {
  const input = (
    <FormControl
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`form-control-custom ${className}`}
    />
  );

  if (label) {
    return (
      <FormGroup className="mb-3">
        <FormLabel>{label}</FormLabel>
        {input}
      </FormGroup>
    );
  }

  return input;
}

interface SelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  label?: string;
}

export function Select({ options, value, onChange, className = '', label }: SelectProps) {
  const select = (
    <FormSelect
      value={value}
      onChange={onChange}
      className={`form-select-custom ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormSelect>
  );

  if (label) {
    return (
      <FormGroup className="mb-3">
        <FormLabel>{label}</FormLabel>
        {select}
      </FormGroup>
    );
  }

  return select;
}

interface TextFieldProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  className?: string;
  label?: string;
}

export function TextField({ placeholder, value, onChange, rows = 3, className = '', label }: TextFieldProps) {
  const textarea = (
    <FormControl
      as="textarea"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      className={`form-control-custom ${className}`}
      style={{ resize: 'vertical' }}
    />
  );

  if (label) {
    return (
      <FormGroup className="mb-3">
        <FormLabel>{label}</FormLabel>
        {textarea}
      </FormGroup>
    );
  }

  return textarea;
}

