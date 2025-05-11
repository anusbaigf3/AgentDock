const { Groq } = require('groq-sdk');
const { createLogger } = require('../utils/logger');

const logger = createLogger('groqService');

/**
 * Service for interacting with Groq's LLM API
 */
class GroqService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    
    // Default model settings
    this.defaultModel = 'llama3-70b-8192';
    this.defaultTemperature = 0.5;
    this.defaultMaxTokens = 1024;
    
    logger.info('Groq service initialized');
  }
  
  /**
   * Generate completion using Groq's API
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - The LLM response
   */
  async generateCompletion(prompt, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const temperature = options.temperature || this.defaultTemperature;
      const maxTokens = options.maxTokens || this.defaultMaxTokens;
      
      logger.info(`Generating completion with model: ${model}`);
      
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model,
        temperature,
        max_tokens: maxTokens
      });
      
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating completion:', error);
      throw new Error(`Failed to generate completion: ${error.message}`);
    }
  }
  
  /**
   * Generate chat completion with conversation history
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The LLM response
   */
  async generateChatCompletion(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const temperature = options.temperature || this.defaultTemperature;
      const maxTokens = options.maxTokens || this.defaultMaxTokens;
      
      logger.info(`Generating chat completion with model: ${model}`);
      
      const completion = await this.groq.chat.completions.create({
        messages,
        model,
        temperature,
        max_tokens: maxTokens
      });
      
      return {
        content: completion.choices[0]?.message?.content || '',
        usage: completion.usage
      };
    } catch (error) {
      logger.error('Error generating chat completion:', error);
      throw new Error(`Failed to generate chat completion: ${error.message}`);
    }
  }
  
  /**
   * Extract structured data from text
   * @param {string} text - The text to analyze
   * @param {Object} schema - The schema for extraction
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Structured data
   */
  async extractData(text, schema, options = {}) {
    try {
      const schemaStr = JSON.stringify(schema, null, 2);
      
      const prompt = `
      Extract structured data from the following text according to this schema:
      
      ${schemaStr}
      
      Text to analyze:
      """
      ${text}
      """
      
      Respond with a valid JSON object that matches the schema exactly.
      `;
      
      const completion = await this.generateCompletion(prompt, options);
      
      // Extract JSON from response
      const jsonMatch = completion.match(/```json\s*([\s\S]*?)\s*```/) || 
                         completion.match(/\{[\s\S]*\}/);
      
      let jsonData;
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        try {
          jsonData = JSON.parse(completion.trim());
        } catch (error) {
          throw new Error('Failed to parse structured data from LLM response');
        }
      }
      
      return jsonData;
    } catch (error) {
      logger.error('Error extracting structured data:', error);
      throw new Error(`Failed to extract structured data: ${error.message}`);
    }
  }
  
  /**
   * Summarize a text
   * @param {string} text - The text to summarize
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Summary text
   */
  async summarizeText(text, options = {}) {
    try {
      const maxLength = options.maxLength || 'medium';
      
      const prompt = `
      Summarize the following text in a ${maxLength} length summary:
      
      """
      ${text}
      """
      
      Summary:
      `;
      
      return await this.generateCompletion(prompt, {
        ...options,
        temperature: 0.3 // Lower temperature for summarization
      });
    } catch (error) {
      logger.error('Error summarizing text:', error);
      throw new Error(`Failed to summarize text: ${error.message}`);
    }
  }
  
  /**
   * Answer a question based on provided context
   * @param {string} question - The question to answer
   * @param {string} context - The context information
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Answer text
   */
  async answerQuestion(question, context, options = {}) {
    try {
      const prompt = `
      Answer the following question based on the provided context:
      
      Context:
      """
      ${context}
      """
      
      Question: ${question}
      
      Answer:
      `;
      
      return await this.generateCompletion(prompt, options);
    } catch (error) {
      logger.error('Error answering question:', error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }
  
  /**
   * Generate code based on a specification
   * @param {string} specification - The code specification
   * @param {string} language - Programming language
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Generated code
   */
  async generateCode(specification, language, options = {}) {
    try {
      const prompt = `
      Generate ${language} code based on the following specification:
      
      ${specification}
      
      Provide only the code with appropriate comments. Do not include explanations outside of the code.
      `;
      
      const completion = await this.generateCompletion(prompt, {
        ...options,
        temperature: 0.2 // Lower temperature for code generation
      });
      
      // Extract code from response if surrounded by markdown blocks
      const codeMatch = completion.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
      return codeMatch ? codeMatch[1] : completion;
    } catch (error) {
      logger.error('Error generating code:', error);
      throw new Error(`Failed to generate code: ${error.message}`);
    }
  }
  
  /**
   * Analyze sentiment of a text
   * @param {string} text - The text to analyze
   * @returns {Promise<Object>} - Sentiment analysis result
   */
  async analyzeSentiment(text) {
    try {
      const prompt = `
      Analyze the sentiment of the following text. Classify it as positive, negative, or neutral,
      and provide a confidence score from 0.0 to 1.0.
      
      Text:
      """
      ${text}
      """
      
      Respond with a JSON object that has the following structure:
      {
        "sentiment": "positive|negative|neutral",
        "confidence": 0.0-1.0,
        "explanation": "brief explanation"
      }
      `;
      
      const completion = await this.generateCompletion(prompt, {
        temperature: 0.2
      });
      
      // Extract JSON from response
      const jsonMatch = completion.match(/```json\s*([\s\S]*?)\s*```/) || 
                         completion.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error('Failed to parse sentiment analysis result');
      }
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      throw new Error(`Failed to analyze sentiment: ${error.message}`);
    }
  }
  
  /**
   * Translate text to another language
   * @param {string} text - The text to translate
   * @param {string} targetLanguage - Target language
   * @returns {Promise<string>} - Translated text
   */
  async translateText(text, targetLanguage) {
    try {
      const prompt = `
      Translate the following text to ${targetLanguage}:
      
      """
      ${text}
      """
      
      Translation:
      `;
      
      return await this.generateCompletion(prompt, {
        temperature: 0.3
      });
    } catch (error) {
      logger.error('Error translating text:', error);
      throw new Error(`Failed to translate text: ${error.message}`);
    }
  }
}

module.exports = new GroqService();