'use client';

import { useState, useEffect } from 'react';

interface MultiSelectProps {
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string[]; // Use controlled component pattern
  defaultSelected?: string[];
  onChange?: (selected: string[]) => void;
}

export function MultiSelect({ name, options, placeholder, value, defaultSelected, onChange }: MultiSelectProps) {
  const [selected, setSelected] = useState<string[]>(value || defaultSelected || []);
  const [searchTerm, setSearchTerm] = useState('');

  // Update selected when value prop changes (controlled component)
  useEffect(() => {
    if (value !== undefined) {
      console.log('MultiSelect controlled update with value:', value);
      setSelected(value);
    }
  }, [value]);

  // Update selected when defaultSelected changes (for template pre-filling)
  useEffect(() => {
    if (!value && defaultSelected !== undefined) {
      console.log('MultiSelect updating with defaultSelected:', defaultSelected);
      setSelected(defaultSelected);
      onChange?.(defaultSelected); // Notify parent of the change
    }
  }, [defaultSelected, onChange, value]);
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    
    setSelected(newSelected);
    onChange?.(newSelected);
  };

  const selectAll = () => {
    const allValues = options.map(o => o.value);
    setSelected(allValues);
    onChange?.(allValues);
  };

  const clearAll = () => {
    setSelected([]);
    onChange?.([]);
  };
  
  return (
    <div className="border rounded p-2">
      <input
        type="text"
        placeholder={placeholder || "Search..."}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-1 mb-2 border-b focus:outline-none focus:ring-2 focus:ring-blue-900"
      />
      <div className="flex gap-2 mb-2">
        <button 
          type="button"
          onClick={selectAll}
          className="text-xs text-blue-600 hover:underline"
        >
          Select All
        </button>
        <button 
          type="button"
          onClick={clearAll}
          className="text-xs text-gray-600 hover:underline"
        >
          Clear All
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filteredOptions.map(option => (
          <label key={option.value} className="flex items-center p-1 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={() => toggleOption(option.value)}
              className="mr-2"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
