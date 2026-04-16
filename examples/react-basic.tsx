/**
 * OpenRouter Auto - React Basic Example
 * Basic usage of OpenRouter Auto with React
 */

import React, { useState } from 'react';
import {
  OpenRouterProvider,
  useOpenRouter,
  ModelSelector,
  ModelConfigPanel,
  CostEstimator,
  ErrorDisplay,
} from 'openrouter-auto/react';

// Main App with Provider
function App() {
  return (
    <OpenRouterProvider
      apiKey={process.env.REACT_APP_OPENROUTER_API_KEY || ''}
      options={{
        storageType: 'localStorage',
        enableTesting: true,
      }}
      onError={(error) => console.error('OpenRouter Error:', error)}
      onEvent={(event) => console.log('OpenRouter Event:', event)}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1>OpenRouter Auto Demo</h1>
        <ModelManager />
      </div>
    </OpenRouterProvider>
  );
}

// Model Manager Component
function ModelManager() {
  const { models, isLoading, error, selectedModel, selectModel, addModel, chat } = useOpenRouter();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const handleSend = async () => {
    if (!selectedModel || !input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsChatting(true);

    try {
      const response = await chat({
        model: selectedModel,
        messages: [...messages, userMessage],
      });

      const assistantMessage = response.choices[0].message;
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div>
      {/* Error Display */}
      {error && <ErrorDisplay onRetry={() => window.location.reload()} />}

      {/* Loading State */}
      {isLoading && <div>Loading models...</div>}

      {/* Model Stats */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f6f8fa', borderRadius: '6px' }}>
        <strong>Available Models:</strong> {models.length}
      </div>

      {/* Model Selector */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Select a Model</h3>
        <ModelSelector
          value={selectedModel}
          onChange={(modelId) => selectModel(modelId)}
          showPricing={true}
          showContextLength={true}
        />
      </div>

      {/* Model Configuration */}
      {selectedModel && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Configure Model</h3>
          <ModelConfigPanel
            modelId={selectedModel}
            onSave={(config) => console.log('Model configured:', config)}
            showTestButton={true}
          />
        </div>
      )}

      {/* Cost Estimator */}
      {selectedModel && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Cost Estimate</h3>
          <CostEstimator
            modelId={selectedModel}
            showTextInput={true}
          />
        </div>
      )}

      {/* Chat Interface */}
      {selectedModel && (
        <div style={{ marginTop: '30px' }}>
          <h3>Chat</h3>
          
          {/* Messages */}
          <div
            style={{
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              padding: '10px',
              minHeight: '200px',
              maxHeight: '400px',
              overflowY: 'auto',
              marginBottom: '10px',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: '#586069', textAlign: 'center', padding: '40px' }}>
                Start a conversation...
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '10px',
                    padding: '10px',
                    backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f6f8fa',
                    borderRadius: '6px',
                  }}
                >
                  <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
                  <div style={{ marginTop: '5px' }}>{msg.content}</div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #d1d5da',
                borderRadius: '6px',
                fontSize: '14px',
              }}
              disabled={isChatting}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isChatting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#0366d6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: input.trim() && !isChatting ? 'pointer' : 'not-allowed',
                opacity: input.trim() && !isChatting ? 1 : 0.6,
              }}
            >
              {isChatting ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
