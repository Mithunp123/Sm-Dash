import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP
 * @returns {string} 6-digit OTP
 */
export const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Calculates the expiration time for an OTP
 * @param {number} minutes - Duration in minutes
 * @returns {string} ISO date string
 */
export const getOTPExpiry = (minutes = 10) => {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};
