import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

dotenv.config({ path: '../.env' });

async function main() {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  const token = jwt.sign({ userId: 1 }, secret, { expiresIn: '1h' });
  console.log('using token', token);

  const response = await fetch('http://localhost:3000/api/interviews/1', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ interviewer:'Script Mentor', interviewer_email:'script@example.com', mentor_id: 5, status: 'assigned' })
  });
  const data = await response.json();
  console.log('response', data);
}

main().catch(console.error);
