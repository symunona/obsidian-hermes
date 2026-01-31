import React, { useState } from 'react';
import { saveAppSettings, loadAppSettings } from '../persistence/persistence';

const ApiKeySetup: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setIsSaving(true);
    try {
      // Load current settings
      const currentSettings = loadAppSettings();
      if (currentSettings) {
        // Update the API key
        currentSettings.manualApiKey = apiKey.trim();
        await saveAppSettings(currentSettings);
      }
      
      setApiKey(''); // Clear input after save
      
      // Notify parent component about settings change
      if (typeof window !== 'undefined' && window.hermesSettingsUpdate) {
        window.hermesSettingsUpdate(currentSettings);
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="max-w-2xl text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center rounded-full bg-blue-500/10">
          <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Welcome to Hermes
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Your Obsidian Interactive Voice Assistant — the bridge between you and your notes
        </p>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          To use Hermes Voice Assistant, you need a Gemini API key from Google AI Studio.
          The API key allows the assistant to connect to Google's language models.
        </p>

        {/* API Key Input */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Gemini API Key</label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API Key..."
              className="w-full h-12 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>

        <button 
            onClick={handleSave}
            disabled={!apiKey.trim() || isSaving}
            className={`w-full py-4 px-8 font-semibold rounded-lg transition-colors text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] ${
              apiKey.trim() && !isSaving
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save API Key'}
          </button>

        {/* Instructions */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-left">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            How to get your API key:
          </h2>
          <ol className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">1</span>
              <span>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline">Google AI Studio</a></span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">2</span>
              <span>Sign in with your Google account</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">3</span>
              <span>Click "Create API Key" and give it a name</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">4</span>
              <span>Copy your API key</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">5</span>
              <span>Paste it in the Settings panel</span>
            </li>
          </ol>
        </div>

        {/* Additional Info */}
        <p className="text-sm text-gray-500 dark:text-gray-500">
          <a href="https://github.com/symunona/obsidian-haiku">Go see me on github</a>. Or buy me a tea.
        </p>
      </div>
    </div>
  );
};

export default ApiKeySetup;
