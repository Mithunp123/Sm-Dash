import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;

console.log(`🔍 Checking if port ${PORT} is in use...`);

try {
    let pid;
    if (process.platform === 'win32') {
        try {
            const output = execSync(`netstat -ano | findstr :${PORT}`).toString();
            const lines = output.trim().split('\n');
            if (lines.length > 0) {
                // TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       PID
                const parts = lines[0].trim().split(/\s+/);
                pid = parts[parts.length - 1];
            }
        } catch (e) {
            // Port not in use (findstr returns exit code 1)
        }
    } else {
        try {
            pid = execSync(`lsof -t -i:${PORT}`).toString().trim();
        } catch (e) {
            // Port not in use
        }
    }

    if (pid && pid !== process.pid.toString()) {
        console.log(`🚀 Port ${PORT} is occupied by PID ${pid}. Killing it...`);
        if (process.platform === 'win32') {
            execSync(`taskkill /F /PID ${pid} /T`);
        } else {
            execSync(`kill -9 ${pid}`);
        }
        console.log(`✅ Freed port ${PORT}.`);
    } else {
        console.log(`✅ Port ${PORT} is free.`);
    }
} catch (error) {
    // Silence errors - just move on to starting the server
}
