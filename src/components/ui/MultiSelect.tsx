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

  // Update selected when defaultSelected changes
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
    <div className="border border-gray-300 rounded-md bg-white">
      <div className="p-2 border-b border-gray-200">
        <input
          type="text"
          placeholder={placeholder || "Search..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <div className="flex gap-3 mt-2">
          <button 
            type="button"
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Select All
          </button>
          <button 
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
          >
            Clear All
          </button>
          {selected.length > 0 && (
            <span className="text-xs text-gray-500 ml-auto">
              {selected.length} selected
            </span>
          )}
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto p-2">
        {filteredOptions.length === 0 ? (
          <div className="text-sm text-gray-500 p-2 text-center">No options found</div>
        ) : (
          filteredOptions.map(option => (
            <label key={option.value} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
