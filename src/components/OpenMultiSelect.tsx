import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';

interface OpenMultiSelectProps {
  label?: string;
  presetOptions: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helperText?: string;
  className?: string;
}

export default function OpenMultiSelect({
  label,
  presetOptions,
  selectedValues,
  onChange,
  placeholder = "Add custom option & press Enter...",
  helperText = "Select one or more, or type custom options below",
  className = ""
}: OpenMultiSelectProps) {
  const [customInput, setCustomInput] = useState('');

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(item => item !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  };

  const addCustomOption = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedValues.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selectedValues, trimmed]);
    }
    setCustomInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomOption();
    }
  };

  const removeValue = (valToRemove: string) => {
    onChange(selectedValues.filter(item => item !== valToRemove));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear all ({selectedValues.length})
            </button>
          )}
        </div>
      )}

      {/* Preset pills for quick multi-selection */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80">
        {presetOptions.map((opt) => {
          const isSelected = selectedValues.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggleOption(opt)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
              {opt}
            </button>
          );
        })}
      </div>

      {/* Open Custom Tag Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={addCustomOption}
          disabled={!customInput.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Currently Selected Badges Display (if custom or non-preset tags added) */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Active:
          </span>
          {selectedValues.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700/50"
            >
              {val}
              <button
                type="button"
                onClick={() => removeValue(val)}
                className="hover:text-red-500 rounded p-0.5 transition-colors"
                title={`Remove ${val}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
