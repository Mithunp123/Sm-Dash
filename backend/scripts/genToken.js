import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';

dotenv.config({ path: '../.env' });

const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const token = jwt.sign({ userId: 1 }, secret, { expiresIn: '1h' });
// write token to file for later use
fs.writeFileSync('d:/sm-dash-main/backend/token.txt', token);
console.log('token written to backend/token.txt');
