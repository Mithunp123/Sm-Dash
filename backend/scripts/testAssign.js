import fetch from 'node-fetch';

async function main() {
  const base = 'http://localhost:3000/api';
  // login as admin
  const loginResp = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smvolunteers@ksrct.ac.in', password: 'password' })
  });
  const loginData = await loginResp.json();
  console.log('loginData', loginData);
  if (!loginData.token) return;
  const token = loginData.token;

  const payload = {
    interviewer: 'Test Mentor',
    interviewer_email: 'mentor@example.com',
    mentor_id: 5,
    status: 'assigned'
  };

  const resp = await fetch(`${base}/interviews/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  console.log('update response', data);
}

main().catch(console.error);
