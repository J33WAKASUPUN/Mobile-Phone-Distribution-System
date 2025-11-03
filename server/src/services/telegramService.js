const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

/**
 * Telegram Bot Service
 * Sends notifications to admin
 */
class TelegramService {
  constructor() {
    this.bot = null;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    this.enabled = process.env.TELEGRAM_ENABLED === 'true';
    this.initialize();
  }

  /**
   * Initialize Telegram Bot
   */
  initialize() {
    if (!this.enabled) {
      logger.warn('Telegram notifications are disabled');
      return;
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.warn('Telegram bot token not configured');
      return;
    }

    try {
      this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
      logger.info('Telegram bot initialized successfully');
    } catch (error) {
      logger.error(`Telegram bot initialization error: ${error.message}`);
    }
  }

  /**
   * Check if bot is ready
   */
  isReady() {
    return this.enabled && this.bot !== null && this.adminChatId;
  }

  /**
   * Send DSR assignment notification
   * @param {Object} assignment - Assignment document
   */
  async sendAssignmentNotification(assignment) {
    if (!this.isReady()) {
      logger.warn('Telegram bot not configured, skipping notification');
      return;
    }

    try {
      const message = this.formatAssignmentMessage(assignment);
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' });
      logger.info(`Telegram notification sent for assignment ${assignment.assignmentNumber}`);
    } catch (error) {
      logger.error(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  /**
   * Format assignment notification message
   * @param {Object} assignment - Assignment document
   * @returns {string} Formatted message
   */
  formatAssignmentMessage(assignment) {
    const dsrName = `${assignment.dsr.firstName} ${assignment.dsr.lastName}`;
    const date = new Date(assignment.assignmentDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let message = `🚨 *New DSR Assignment*\n\n`;
    message += `📋 *Assignment #:* ${assignment.assignmentNumber}\n`;
    message += `👤 *DSR:* ${dsrName}\n`;
    message += `📱 *Phone:* ${assignment.dsr.phone}\n`;
    message += `📅 *Date:* ${date}\n`;
    message += `🕐 *Time:* ${assignment.assignmentTime}\n\n`;

    message += `📦 *Assignment Summary:*\n`;
    message += `• Total Phones: ${assignment.totalPhones}\n`;
    message += `• Total Value: Rs. ${assignment.totalValue.toLocaleString()}\n`;
    message += `• Target Revenue: Rs. ${assignment.totalTargetRevenue.toLocaleString()}\n`;
    message += `• Expected Profit: Rs. ${(assignment.totalTargetRevenue - assignment.totalValue).toLocaleString()}\n\n`;

    message += `📱 *Phone Details:*\n`;
    assignment.phones.forEach((phone, index) => {
      message += `${index + 1}. ${phone.product.brand} ${phone.product.model}\n`;
      message += `   IMEI: ${phone.imei}\n`;
      message += `   Cost: Rs. ${phone.assignedPrice.toLocaleString()}\n`;
      message += `   Target: Rs. ${phone.targetPrice.toLocaleString()}\n`;
    });

    if (assignment.notes) {
      message += `\n📝 *Notes:* ${assignment.notes}`;
    }

    return message;
  }

  /**
   * Send daily return summary
   * @param {Object} summary - Daily summary data
   */
  async sendDailyReturnSummary(summary) {
    if (!this.isReady()) return;

    try {
      let message = `📊 *Daily DSR Return Summary*\n\n`;
      message += `📅 *Date:* ${summary.date}\n\n`;
      message += `📦 *Totals:*\n`;
      message += `• Assignments: ${summary.totalAssignments}\n`;
      message += `• Phones Assigned: ${summary.totalPhonesAssigned}\n`;
      message += `• Phones Sold: ${summary.totalPhonesSold}\n`;
      message += `• Phones Returned: ${summary.totalPhonesReturned}\n`;
      message += `• Revenue: Rs. ${summary.totalRevenue.toLocaleString()}\n`;
      message += `• Profit: Rs. ${summary.totalProfit.toLocaleString()}\n`;

      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' });
      logger.info('Daily return summary sent via Telegram');
    } catch (error) {
      logger.error(`Failed to send daily summary: ${error.message}`);
    }
  }
}

module.exports = new TelegramService();