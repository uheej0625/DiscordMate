import { MESSAGE_ROLE } from '../database/schemas/messages.js';

/**
 * Conversation service for managing chat history and context for AI prompts
 */
class ConversationService {
  /**
   * Creates an instance of ConversationService.
   * @param {MessageRepository} messageRepository - Message repository instance
   */
  constructor(messageRepository) {
    this.messageRepository = messageRepository;
  }

  /**
   * Get conversation history for AI prompt context
   * @param {string} userId - Discord user ID
   * @param {string} channelId - Discord channel ID
   * @param {number} [limit=10] - Number of recent messages to fetch
   * @returns {string} Formatted conversation history
   */
  getConversationHistory(userId, channelId, limit = 10) {
    const messages = this.messageRepository.findByChannelId(channelId, limit);
    
    // Filter messages to include both user and bot messages
    const conversationMessages = messages
      .reverse() // Chronological order
      .map(msg => ({
        isBot: msg.author_role === MESSAGE_ROLE.ASSISTANT,
        content: msg.content,
        timestamp: msg.created_at
      }));

    return this.formatForPrompt(conversationMessages);
  }

  /**
   * Format conversation messages for AI prompt
   * @param {Array} messages - Array of message objects
   * @returns {string} Formatted conversation string
   */
  formatForPrompt(messages) {
    if (messages.length === 0) return '';

    return messages
      .map(msg => {
        const speaker = msg.isBot ? '어시스턴트' : '사용자';
        return `${speaker}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Get recent user messages for context
   * @param {string} authorId - Author ID
   * @param {number} [limit=5] - Number of recent messages
   * @returns {Array} Recent author messages
   */
  getAuthorRecentMessages(authorId, limit = 5) {
    return this.messageRepository.findByAuthorId(authorId, limit);
  }

  /**
   * Save conversation context (if needed for future reference)
   * @param {string} userId - Discord user ID
   * @param {string} channelId - Discord channel ID
   * @param {string} userMessage - User's message
   * @param {string} botResponse - Bot's response
   */
  saveConversationContext(userId, channelId, userMessage, botResponse) {
    // This could be used to save processed conversation context
    // if you need to store additional metadata beyond individual messages
    // Implementation depends on your specific needs
  }
}

export default ConversationService;
