/**
 * OpenRouter Auto - Model Selector Component
 * Searchable dropdown for selecting OpenRouter models
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useOpenRouter } from '../context';
import { OpenRouterModel, ModelFilterOptions } from '@openrouter-auto/core';

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #e1e4e8',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputFocus: {
    borderColor: '#0366d6',
    boxShadow: '0 0 0 3px rgba(3, 102, 214, 0.1)',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #e1e4e8',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
  },
  modelItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f3f4',
    transition: 'background-color 0.15s',
  },
  modelItemHover: {
    backgroundColor: '#f6f8fa',
  },
  modelItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  modelName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#24292e',
    marginBottom: '4px',
  },
  modelId: {
    fontSize: '12px',
    color: '#586069',
    fontFamily: 'monospace',
  },
  modelMeta: {
    display: 'flex',
    gap: '12px',
    marginTop: '6px',
    fontSize: '12px',
    color: '#586069',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
  },
  badgeFree: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  badgeCheap: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  badgeModerate: {
    backgroundColor: '#ffe0b2',
    color: '#e65100',
  },
  badgeExpensive: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  contextLength: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  noResults: {
    padding: '20px',
    textAlign: 'center',
    color: '#586069',
    fontSize: '14px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#586069',
    fontSize: '14px',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderBottom: '1px solid #e1e4e8',
    backgroundColor: '#f6f8fa',
  },
  filterButton: {
    padding: '4px 12px',
    fontSize: '12px',
    border: '1px solid #d1d5da',
    borderRadius: '16px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  filterButtonActive: {
    backgroundColor: '#0366d6',
    color: '#fff',
    borderColor: '#0366d6',
  },
};

// Props interface
interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string, model: OpenRouterModel) => void;
  placeholder?: string;
  showPricing?: boolean;
  showContextLength?: boolean;
  filters?: ModelFilterOptions;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Price tier colors
function getPriceTierColor(tier: string): React.CSSProperties {
  switch (tier) {
    case 'free':
      return styles.badgeFree;
    case 'cheap':
      return styles.badgeCheap;
    case 'moderate':
      return styles.badgeModerate;
    case 'expensive':
      return styles.badgeExpensive;
    default:
      return {};
  }
}

// Format context length
function formatContextLength(length: number): string {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M`;
  }
  if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K`;
  }
  return length.toString();
}

// Format price
function formatPrice(price: string): string {
  const value = parseFloat(price);
  if (value === 0) return 'Free';
  if (value < 0.000001) return '<$0.000001';
  return `$${value.toFixed(6)}`;
}

// Get price tier
function getPriceTier(model: OpenRouterModel): string {
  const promptPrice = parseFloat(model.pricing.prompt) || 0;
  const completionPrice = parseFloat(model.pricing.completion) || 0;
  const avgPrice = (promptPrice + completionPrice) / 2;
  
  if (avgPrice === 0) return 'free';
  if (avgPrice < 0.0001) return 'cheap';
  if (avgPrice < 0.01) return 'moderate';
  return 'expensive';
}

export function ModelSelector({
  value,
  onChange,
  placeholder = 'Search models...',
  showPricing = true,
  showContextLength = true,
  filters = {},
  disabled = false,
  style = {},
  className = '',
}: ModelSelectorProps) {
  const { models, filterModels, isLoading, getModel } = useOpenRouter();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [priceFilter, setPriceFilter] = useState<string | null>(null);

  // Filter models
  const filteredModels = useMemo(() => {
    const combinedFilters: ModelFilterOptions = {
      ...filters,
      search: search || undefined,
    };
    
    if (priceFilter === 'free') {
      combinedFilters.freeOnly = true;
    } else if (priceFilter === 'cheap') {
      combinedFilters.maxPrice = 0.0001;
    }
    
    return filterModels(combinedFilters);
  }, [filterModels, filters, search, priceFilter]);

  // Get selected model
  const selectedModel = value ? getModel(value) : null;

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
    setHoveredIndex(-1);
  }, []);

  // Handle model selection
  const handleSelect = useCallback((model: OpenRouterModel) => {
    onChange(model.id, model);
    setSearch('');
    setIsOpen(false);
    setHoveredIndex(-1);
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIndex(prev => 
        prev < filteredModels.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && hoveredIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredModels[hoveredIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHoveredIndex(-1);
    }
  }, [filteredModels, hoveredIndex, handleSelect]);

  // Handle click outside
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsOpen(false);
      setHoveredIndex(-1);
    }, 200);
  }, []);

  // Display value
  const displayValue = selectedModel 
    ? selectedModel.name 
    : search;

  return (
    <div style={{ ...styles.container, ...style }} className={className}>
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        style={{
          ...styles.input,
          ...(isOpen ? styles.inputFocus : {}),
        }}
      />

      {isOpen && (
        <div style={styles.dropdown}>
          {/* Filter bar */}
          <div style={styles.filterBar}>
            {['all', 'free', 'cheap'].map((filter) => (
              <button
                key={filter}
                onClick={() => setPriceFilter(filter === 'all' ? null : filter)}
                style={{
                  ...styles.filterButton,
                  ...(priceFilter === filter || (filter === 'all' && !priceFilter)
                    ? styles.filterButtonActive
                    : {}),
                }}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Model list */}
          {isLoading ? (
            <div style={styles.loading}>Loading models...</div>
          ) : filteredModels.length === 0 ? (
            <div style={styles.noResults}>
              {search ? 'No models found' : 'Type to search models'}
            </div>
          ) : (
            filteredModels.map((model, index) => {
              const priceTier = getPriceTier(model);
              const isHovered = index === hoveredIndex;
              const isSelected = value === model.id;

              return (
                <div
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  style={{
                    ...styles.modelItem,
                    ...(isHovered ? styles.modelItemHover : {}),
                    ...(isSelected ? styles.modelItemSelected : {}),
                  }}
                >
                  <div style={styles.modelName}>{model.name}</div>
                  <div style={styles.modelId}>{model.id}</div>
                  
                  <div style={styles.modelMeta}>
                    {showPricing && (
                      <span style={{ ...styles.badge, ...getPriceTierColor(priceTier) }}>
                        {formatPrice(model.pricing.prompt)}/1K
                      </span>
                    )}
                    
                    {showContextLength && (
                      <span style={styles.contextLength}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                        {formatContextLength(model.context_length)}
                      </span>
                    )}
                    
                    <span>{model.architecture.modality}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
