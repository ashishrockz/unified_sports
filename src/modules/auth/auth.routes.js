const router = require('express').Router();
const { loginLimiter } = require('../../middlewares/rateLimiter');
const { sendOtpHandler, verifyOtpHandler } = require('./auth.controller');

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to a phone number or email address
 *     description: >
 *       Generates a 6-digit OTP valid for 10 minutes and delivers it
 *       via email (nodemailer) or WhatsApp/SMS (console-logged until provider configured).
 *       Any previously unused OTPs for the same identifier are invalidated.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpSendRequest'
 *           examples:
 *             email:
 *               summary: Send OTP via email
 *               value:
 *                 identifier: user@example.com
 *                 type: email
 *             phone:
 *               summary: Send OTP via phone (WhatsApp)
 *               value:
 *                 identifier: "+919876543210"
 *                 type: phone
 *     responses:
 *       200:
 *         description: OTP dispatched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: OTP sent successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/send-otp', loginLimiter, sendOtpHandler);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and receive a JWT token
 *     description: >
 *       Validates the OTP against the stored record.
 *       On success the OTP is marked as used and cannot be reused.
 *       If no user exists for the identifier, one is auto-created (sign-up flow).
 *       Returns a JWT valid for 7 days.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OtpVerifyRequest'
 *           example:
 *             identifier: user@example.com
 *             type: email
 *             otp: "482916"
 *     responses:
 *       200:
 *         description: OTP verified — returns JWT token and user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: OTP invalid, expired, or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               expired:
 *                 summary: OTP has expired
 *                 value:
 *                   message: OTP not found or expired
 *               invalid:
 *                 summary: OTP is wrong
 *                 value:
 *                   message: Invalid OTP
 */
router.post('/verify-otp', verifyOtpHandler);

module.exports = router;
