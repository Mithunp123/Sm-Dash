#!/usr/bin/env node

/**
 * Phone Mentoring API Endpoint Tester
 * Tests all CRUD operations for attendance and updates
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/phone-mentoring';
let token = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function login() {
  try {
    log('🔐 Logging in...', 'cyan');
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'smvolunteers@ksrct.ac.in',
        password: 'password123' // Default test password
      })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    token = data.token;
    log('✅ Logged in successfully\n', 'green');
    return true;
  } catch (error) {
    log(`❌ Login failed: ${error.message}\n`, 'red');
    return false;
  }
}

async function testGetMentees() {
  try {
    log('📋 Testing: GET /phone-mentoring (Get My Mentees)', 'blue');
    const response = await fetch(`${BASE_URL}/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.mentees && data.mentees.length > 0) {
      log(`✅ Got ${data.mentees.length} mentees`, 'green');
      data.mentees.forEach((m, i) => {
        log(`   ${i + 1}. ${m.mentee_name} (ID: ${m.id})`, 'cyan');
      });
      return data.mentees[0];
    } else {
      log('⚠️  No mentees found', 'yellow');
      return null;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function testSaveAttendance(assignmentId) {
  try {
    log(`\n📝 Testing: POST /mentees/${assignmentId}/attendance (Save Attendance)`, 'blue');
    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch(`${BASE_URL}/mentees/${assignmentId}/attendance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'PRESENT',
        notes: 'API Test - Attendance saved successfully',
        date: today
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    log(`✅ Attendance saved successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testGetAttendance(assignmentId) {
  try {
    log(`\n📖 Testing: GET /mentees/${assignmentId}/attendance (Get Attendance History)`, 'blue');
    const response = await fetch(`${BASE_URL}/mentees/${assignmentId}/attendance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.attendance && data.attendance.length > 0) {
      log(`✅ Got ${data.attendance.length} attendance records`, 'green');
      data.attendance.slice(0, 3).forEach((a, i) => {
        log(`   ${i + 1}. ${a.attendance_date}: ${a.status}`, 'cyan');
      });
      return true;
    } else {
      log('⚠️  No attendance records found', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testSaveUpdate(assignmentId) {
  try {
    log(`\n✏️  Testing: POST / (Save Mentoring Update)`, 'blue');
    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assignment_id: assignmentId,
        status: 'CALL_DONE',
        explanation: 'API Test - Mentoring update saved successfully',
        attempts: 1,
        date: today
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    log(`✅ Mentoring update saved successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testGetUpdates(assignmentId) {
  try {
    log(`\n📖 Testing: GET /mentees/${assignmentId}/updates (Get Updates History)`, 'blue');
    const response = await fetch(`${BASE_URL}/mentees/${assignmentId}/updates`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.updates && data.updates.length > 0) {
      log(`✅ Got ${data.updates.length} update records`, 'green');
      data.updates.slice(0, 3).forEach((u, i) => {
        log(`   ${i + 1}. ${u.update_date}: ${u.status}`, 'cyan');
      });
      return true;
    } else {
      log('⚠️  No update records found', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  console.clear();
  log('=' + '='.repeat(58), 'cyan');
  log('  🧪 PHONE MENTORING SYSTEM - ENDPOINT TEST SUITE', 'cyan');
  log('=' + '='.repeat(58) + '\n', 'cyan');

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    log('Cannot proceed without login', 'red');
    process.exit(1);
  }

  // Get mentees
  const mentee = await testGetMentees();
  if (!mentee) {
    log('\nNo mentees available for testing. Run create-phone-mentoring-test-data.js first', 'yellow');
    process.exit(0);
  }

  const assignmentId = mentee.id;

  // Test all operations
  log('\n' + '-'.repeat(60), 'cyan');
  log('TESTING ATTENDANCE ENDPOINTS', 'cyan');
  log('-'.repeat(60) + '\n', 'cyan');

  const saveAttendanceOk = await testSaveAttendance(assignmentId);
  const getAttendanceOk = await testGetAttendance(assignmentId);

  log('\n' + '-'.repeat(60), 'cyan');
  log('TESTING MENTORING UPDATE ENDPOINTS', 'cyan');
  log('-'.repeat(60) + '\n', 'cyan');

  const saveUpdateOk = await testSaveUpdate(assignmentId);
  const getUpdatesOk = await testGetUpdates(assignmentId);

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const tests = [
    { name: 'Save Attendance', ok: saveAttendanceOk },
    { name: 'Get Attendance History', ok: getAttendanceOk },
    { name: 'Save Mentoring Update', ok: saveUpdateOk },
    { name: 'Get Update History', ok: getUpdatesOk }
  ];

  tests.forEach((test, i) => {
    const status = test.ok ? '✅ PASS' : '❌ FAIL';
    const color = test.ok ? 'green' : 'red';
    log(`${i + 1}. ${test.name}: ${status}`, color);
  });

  const allPassed = tests.every(t => t.ok);
  
  if (allPassed) {
    log('\n✅ ALL TESTS PASSED! System is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the output above for details.', 'yellow');
  }

  console.log('\n');
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
