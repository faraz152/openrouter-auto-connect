/**
 * OpenRouter Auto - Model Config Panel
 * Configure parameters for a selected model with validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useOpenRouter } from '../context';
import { ParameterDefinition, ModelConfig } from '@openrouter-auto/core';

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    backgroundColor: '#f6f8fa',
    borderRadius: '8px',
    border: '1px solid #e1e4e8',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e1e4e8',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#24292e',
    margin: 0,
  },
  modelId: {
    fontSize: '12px',
    color: '#586069',
    fontFamily: 'monospace',
  },
  testButton: {
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  testButtonDefault: {
    backgroundColor: '#0366d6',
    color: '#fff',
  },
  testButtonSuccess: {
    backgroundColor: '#28a745',
    color: '#fff',
  },
  testButtonError: {
    backgroundColor: '#dc3545',
    color: '#fff',
  },
  testButtonDisabled: {
    backgroundColor: '#e1e4e8',
    color: '#6a737d',
    cursor: 'not-allowed',
  },
  parameterGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#24292e',
    marginBottom: '6px',
  },
  description: {
    fontSize: '12px',
    color: '#586069',
    marginBottom: '8px',
    lineHeight: 1.4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5da',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputError: {
    borderColor: '#dc3545',
    boxShadow: '0 0 0 3px rgba(220, 53, 69, 0.1)',
  },
  slider: {
    width: '100%',
    marginTop: '8px',
  },
  rangeValue: {
    display: 'inline-block',
    marginLeft: '8px',
    fontSize: '13px',
    color: '#586069',
    fontFamily: 'monospace',
  },
  error: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#dc3545',
  },
  success: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#28a745',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e1e4e8',
  },
  saveButton: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  saveButtonDisabled: {
    backgroundColor: '#94d3a2',
    cursor: 'not-allowed',
  },
  resetButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#fff',
    color: '#586069',
    border: '1px solid #d1d5da',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  testResult: {
    marginTop: '12px',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  testResultSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  testResultError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#586069',
    marginTop: '4px',
  },
};

// Props interface
interface ModelConfigPanelProps {
  modelId: string;
  onSave?: (config: ModelConfig) => void;
  onTest?: (result: { success: boolean; error?: string }) => void;
  showTestButton?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Input component for different parameter types
function ParameterInput({
  definition,
  value,
  onChange,
  error,
}: {
  definition: ParameterDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue: any = e.target.value;
    
    if (definition.type === 'number' || definition.type === 'integer') {
      newValue = newValue === '' ? undefined : parseFloat(newValue);
      if (definition.type === 'integer') {
        newValue = newValue !== undefined ? Math.round(newValue) : undefined;
      }
    } else if (definition.type === 'boolean') {
      newValue = e.target.checked;
    }
    
    onChange(newValue);
  }, [definition.type, onChange]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  }, [onChange]);

  const inputStyle = error ? { ...styles.input, ...styles.inputError } : styles.input;

  // Number/Integer with slider for ranges
  if ((definition.type === 'number' || definition.type === 'integer') && 
      definition.min !== undefined && definition.max !== undefined) {
    const step = definition.type === 'integer' ? 1 : 0.1;
    const displayValue = value !== undefined ? value : definition.default;
    
    return (
      <div>
        <input
          type="number"
          value={value !== undefined ? value : ''}
          onChange={handleChange}
          min={definition.min}
          max={definition.max}
          step={step}
          style={inputStyle}
        />
        <input
          type="range"
          value={displayValue || definition.min}
          onChange={handleSliderChange}
          min={definition.min}
          max={definition.max}
          step={step}
          style={styles.slider}
        />
        <span style={styles.rangeValue}>
          {displayValue !== undefined ? displayValue.toFixed(definition.type === 'integer' ? 0 : 2) : 'Not set'}
        </span>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // Number/Integer without slider
  if (definition.type === 'number' || definition.type === 'integer') {
    return (
      <div>
        <input
          type="number"
          value={value !== undefined ? value : ''}
          onChange={handleChange}
          min={definition.min}
          max={definition.max}
          step={definition.type === 'integer' ? 1 : 0.1}
          style={inputStyle}
        />
        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // Boolean
  if (definition.type === 'boolean') {
    return (
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value || false}
            onChange={handleChange}
          />
          <span style={{ fontSize: '13px', color: '#586069' }}>
            {value ? 'Enabled' : 'Disabled'}
          </span>
        </label>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // String/Array (default)
  return (
    <div>
      <input
        type="text"
        value={value !== undefined ? String(value) : ''}
        onChange={handleChange}
        placeholder={definition.default !== undefined ? String(definition.default) : ''}
        style={inputStyle}
      />
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

export function ModelConfigPanel({
  modelId,
  onSave,
  onTest,
  showTestButton = true,
  style = {},
  className = '',
}: ModelConfigPanelProps) {
  const { getModel, getModelParameters, getModelConfig, updateModelParameters, testModel, addModel } = useOpenRouter();
  
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const model = getModel(modelId);
  const parameterDefinitions = getModelParameters(modelId);
  const existingConfig = getModelConfig(modelId);

  // Initialize parameters from existing config
  useEffect(() => {
    if (existingConfig) {
      setParameters(existingConfig.parameters);
    } else {
      // Set defaults
      const defaults: Record<string, any> = {};
      for (const def of parameterDefinitions) {
        if (def.default !== undefined) {
          defaults[def.name] = def.default;
        }
      }
      setParameters(defaults);
    }
  }, [existingConfig, parameterDefinitions]);

  // Handle parameter change
  const handleParameterChange = useCallback((name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
    // Clear error for this parameter
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  // Handle test
  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testModel(modelId);
      setTestResult(result);
      onTest?.(result);
    } catch (error: any) {
      const result = { success: false, error: error.message };
      setTestResult(result);
      onTest?.(result);
    } finally {
      setIsTesting(false);
    }
  }, [modelId, testModel, onTest]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrors({});
    
    try {
      let config: ModelConfig;
      
      if (existingConfig) {
        config = await updateModelParameters(modelId, parameters);
      } else {
        config = await addModel(modelId, parameters);
      }
      
      onSave?.(config);
    } catch (error: any) {
      if (error.details?.errors) {
        setErrors(error.details.errors);
      }
    } finally {
      setIsSaving(false);
    }
  }, [modelId, parameters, existingConfig, addModel, updateModelParameters, onSave]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (existingConfig) {
      setParameters(existingConfig.parameters);
    } else {
      const defaults: Record<string, any> = {};
      for (const def of parameterDefinitions) {
        if (def.default !== undefined) {
          defaults[def.name] = def.default;
        }
      }
      setParameters(defaults);
    }
    setErrors({});
    setTestResult(null);
  }, [existingConfig, parameterDefinitions]);

  if (!model) {
    return (
      <div style={{ ...styles.container, ...style }} className={className}>
        <div style={{ color: '#dc3545', fontSize: '14px' }}>
          Model not found. Please select a valid model.
        </div>
      </div>
    );
  }

  const testButtonStyle = testResult?.success
    ? { ...styles.testButton, ...styles.testButtonSuccess }
    : testResult?.success === false
    ? { ...styles.testButton, ...styles.testButtonError }
    : { ...styles.testButton, ...styles.testButtonDefault };

  return (
    <div style={{ ...styles.container, ...style }} className={className}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>{model.name}</h3>
          <div style={styles.modelId}>{model.id}</div>
        </div>
        
        {showTestButton && (
          <button
            onClick={handleTest}
            disabled={isTesting}
            style={{
              ...testButtonStyle,
              ...(isTesting ? styles.testButtonDisabled : {}),
            }}
          >
            {isTesting ? 'Testing...' : testResult?.success ? 'Tested ✓' : 'Test Model'}
          </button>
        )}
      </div>

      {/* Parameters */}
      {parameterDefinitions.map((def) => (
        <div key={def.name} style={styles.parameterGroup}>
          <label style={styles.label}>
            {def.name}
            {def.required && <span style={{ color: '#dc3545' }}> *</span>}
          </label>
          <div style={styles.description}>{def.description}</div>
          <ParameterInput
            definition={def}
            value={parameters[def.name]}
            onChange={(value) => handleParameterChange(def.name, value)}
            error={errors[def.name]}
          />
          <div style={styles.infoRow}>
            {def.min !== undefined && <span>Min: {def.min}</span>}
            {def.max !== undefined && <span>Max: {def.max}</span>}
            {def.default !== undefined && <span>Default: {def.default}</span>}
          </div>
        </div>
      ))}

      {/* Test Result */}
      {testResult && (
        <div
          style={{
            ...styles.testResult,
            ...(testResult.success ? styles.testResultSuccess : styles.testResultError),
          }}
        >
          {testResult.success
            ? '✓ Model test successful! The model is working correctly.'
            : `✗ Model test failed: ${testResult.error}`}
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            ...styles.saveButton,
            ...(isSaving ? styles.saveButtonDisabled : {}),
          }}
        >
          {isSaving ? 'Saving...' : existingConfig ? 'Update Configuration' : 'Add Model'}
        </button>
        <button onClick={handleReset} style={styles.resetButton}>
          Reset
        </button>
      </div>
    </div>
  );
}
