// AI Infrastructure - Main exports
export * from './enhanced-provider'
export * from './prompt-manager'
export * from './core-services'
export * from './monitoring'

// Re-export commonly used functions
import {
    completeAI,
    streamAI,
    createAIService,
    getProviderFromModel,
} from './enhanced-provider'

import {
    registerPrompt,
    getPromptTemplate,
    getPromptsByCategory,
    renderPrompt,
    getAllPrompts,
} from './prompt-manager'

import {
    analyzeSentiment,
    detectIntent,
    extractEntities,
    detectLanguage,
    summarizeText,
    generateContent,
    generateSmartReplies,
    scoreLead,
    generateDealSummary,
    generateCampaignContent,
    generateInsights,
    generateChatbotResponse,
    adjustTone,
    correctGrammar,
    translateText,
} from './core-services'

import {
    AIMonitor,
    logAIUsage,
    getAIUsageStats,
    checkAIBudget,
    getAIUsageTrends,
    calculateCost,
} from './monitoring'

export {
    // Provider functions
    completeAI,
    streamAI,
    createAIService,
    getProviderFromModel,

    // Core services
    analyzeSentiment,
    detectIntent,
    extractEntities,
    detectLanguage,
    summarizeText,
    generateContent,
    generateSmartReplies,
    scoreLead,
    generateDealSummary,
    generateCampaignContent,
    generateInsights,
    generateChatbotResponse,
    adjustTone,
    correctGrammar,
    translateText,

    // Prompt management
    registerPrompt,
    getPromptTemplate,
    getPromptsByCategory,
    renderPrompt,
    getAllPrompts,

    // Monitoring
    AIMonitor,
    logAIUsage,
    getAIUsageStats,
    checkAIBudget,
    getAIUsageTrends,
    calculateCost,
}
