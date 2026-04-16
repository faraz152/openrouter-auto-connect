/**
 * OpenRouter Auto - Cost Estimator
 * Real-time cost estimation component
 */

import { CostEstimate } from "@openrouter-auto/core";
import React, { useCallback, useEffect, useState } from "react";
import { useOpenRouter } from "../context";

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: "16px",
    backgroundColor: "#f6f8fa",
    borderRadius: "8px",
    border: "1px solid #e1e4e8",
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#24292e",
    margin: "0 0 12px 0",
  },
  inputGroup: {
    marginBottom: "12px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    color: "#586069",
    marginBottom: "4px",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #d1d5da",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #d1d5da",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
    minHeight: "80px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  costBreakdown: {
    marginTop: "16px",
    padding: "12px",
    backgroundColor: "#fff",
    borderRadius: "6px",
    border: "1px solid #e1e4e8",
  },
  costRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: "13px",
    borderBottom: "1px solid #f1f3f4",
  },
  costRowLast: {
    borderBottom: "none",
    fontWeight: 600,
    fontSize: "14px",
    paddingTop: "10px",
    marginTop: "6px",
    borderTop: "2px solid #e1e4e8",
  },
  costLabel: {
    color: "#586069",
  },
  costValue: {
    color: "#24292e",
    fontFamily: "monospace",
  },
  costValueFree: {
    color: "#28a745",
  },
  infoText: {
    fontSize: "12px",
    color: "#586069",
    marginTop: "8px",
    fontStyle: "italic",
  },
  pricingInfo: {
    marginTop: "12px",
    padding: "10px",
    backgroundColor: "#fffbeb",
    borderRadius: "6px",
    border: "1px solid #f59e0b",
  },
  pricingTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#92400e",
    marginBottom: "4px",
  },
  pricingRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#92400e",
  },
};

// Props interface
interface CostEstimatorProps {
  modelId: string;
  defaultPromptTokens?: number;
  defaultCompletionTokens?: number;
  showTextInput?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Format cost
function formatCostValue(cost: number): string {
  if (cost === 0) return "Free";
  if (cost < 0.000001) return "< $0.000001";
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// Estimate tokens from text
function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4);
}

export function CostEstimator({
  modelId,
  defaultPromptTokens = 1000,
  defaultCompletionTokens = 500,
  showTextInput = false,
  style = {},
  className = "",
}: CostEstimatorProps) {
  const { getModel, calculateCost } = useOpenRouter();

  const [promptTokens, setPromptTokens] = useState(defaultPromptTokens);
  const [completionTokens, setCompletionTokens] = useState(
    defaultCompletionTokens,
  );
  const [inputText, setInputText] = useState("");
  const [cost, setCost] = useState<CostEstimate | null>(null);

  const model = getModel(modelId);

  // Calculate cost when inputs change
  useEffect(() => {
    if (model) {
      try {
        const newCost = calculateCost(modelId, promptTokens, completionTokens);
        setCost(newCost);
      } catch (error) {
        setCost(null);
      }
    }
  }, [modelId, promptTokens, completionTokens, model, calculateCost]);

  // Handle text input change
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setInputText(text);
      const estimated = estimateTokensFromText(text);
      setPromptTokens(estimated);
    },
    [],
  );

  // Handle token input change
  const handlePromptTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 0;
      setPromptTokens(value);
    },
    [],
  );

  const handleCompletionTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 0;
      setCompletionTokens(value);
    },
    [],
  );

  if (!model) {
    return (
      <div style={{ ...styles.container, ...style }} className={className}>
        <div style={{ color: "#dc3545", fontSize: "14px" }}>
          Model not found. Please select a valid model.
        </div>
      </div>
    );
  }

  const isFree = cost?.totalCost === 0;

  return (
    <div style={{ ...styles.container, ...style }} className={className}>
      <h4 style={styles.title}>Cost Estimator</h4>

      {/* Text input option */}
      {showTextInput && (
        <div style={styles.inputGroup}>
          <label style={styles.label}>Input Text (optional)</label>
          <textarea
            value={inputText}
            onChange={handleTextChange}
            placeholder="Paste your prompt here to estimate tokens..."
            style={styles.textarea}
          />
          <div style={styles.infoText}>Estimated tokens: {promptTokens}</div>
        </div>
      )}

      {/* Token inputs */}
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.label}>Prompt Tokens</label>
          <input
            type="number"
            value={promptTokens}
            onChange={handlePromptTokensChange}
            min={0}
            style={styles.input}
          />
        </div>
        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.label}>Completion Tokens</label>
          <input
            type="number"
            value={completionTokens}
            onChange={handleCompletionTokensChange}
            min={0}
            style={styles.input}
          />
        </div>
      </div>

      {/* Cost breakdown */}
      {cost && (
        <div style={styles.costBreakdown}>
          <div style={styles.costRow}>
            <span style={styles.costLabel}>Prompt Cost</span>
            <span style={styles.costValue}>
              {formatCostValue(cost.promptCost)}
            </span>
          </div>
          <div style={styles.costRow}>
            <span style={styles.costLabel}>Completion Cost</span>
            <span style={styles.costValue}>
              {formatCostValue(cost.completionCost)}
            </span>
          </div>
          <div style={{ ...styles.costRow, ...styles.costRowLast }}>
            <span style={styles.costLabel}>Total Cost</span>
            <span
              style={
                isFree
                  ? { ...styles.costValue, ...styles.costValueFree }
                  : styles.costValue
              }>
              {formatCostValue(cost.totalCost)}
            </span>
          </div>
        </div>
      )}

      {/* Pricing info */}
      <div style={styles.pricingInfo}>
        <div style={styles.pricingTitle}>Model Pricing</div>
        <div style={styles.pricingRow}>
          <span>Prompt:</span>
          <span>${parseFloat(model.pricing.prompt).toFixed(6)}/1K tokens</span>
        </div>
        <div style={styles.pricingRow}>
          <span>Completion:</span>
          <span>
            ${parseFloat(model.pricing.completion).toFixed(6)}/1K tokens
          </span>
        </div>
      </div>

      <div style={styles.infoText}>
        * Costs are estimates. Actual costs may vary based on tokenization.
      </div>
    </div>
  );
}
