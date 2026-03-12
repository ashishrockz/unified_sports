const { getConfig } = require('../modules/appConfig/appConfig.service');

/**
 * Send an SMS via Twilio using credentials from AppConfig.
 * @param {string} to - Phone number with country code (e.g. +919876543210)
 * @param {string} body - SMS message body
 */
const sendSms = async (to, body) => {
  const config = await getConfig();
  const { twilio } = config.integrations || {};

  if (!twilio || !twilio.enabled) {
    console.log(`[SMS] Twilio disabled. To: ${to} | Body: ${body}`);
    return { success: false, reason: 'Twilio not enabled' };
  }

  if (!twilio.accountSid || !twilio.authToken || !twilio.phoneNumber) {
    throw new Error('Twilio credentials are incomplete. Please configure Account SID, Auth Token, and Phone Number.');
  }

  const client = require('twilio')(twilio.accountSid, twilio.authToken);

  const message = await client.messages.create({
    body,
    from: twilio.phoneNumber,
    to,
  });

  console.log(`[SMS] Sent to ${to} | SID: ${message.sid}`);
  return { success: true, sid: message.sid };
};

/**
 * Test Twilio connection by sending a test SMS.
 * @param {string} to - Test phone number
 */
const testTwilioConnection = async (to) => {
  const config = await getConfig();
  const { twilio } = config.integrations || {};

  if (!twilio || !twilio.accountSid || !twilio.authToken || !twilio.phoneNumber) {
    throw new Error('Twilio credentials are incomplete.');
  }

  const client = require('twilio')(twilio.accountSid, twilio.authToken);

  const message = await client.messages.create({
    body: 'CricCircle test SMS - Your Twilio integration is working!',
    from: twilio.phoneNumber,
    to,
  });

  return { success: true, sid: message.sid };
};

module.exports = { sendSms, testTwilioConnection };
