import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail } from '../repositories/userRepository.js';

let ensurePromise;

const DEFAULT_ADMIN_EMAIL =
  process.env.DEFAULT_ADMIN_EMAIL || 'smvolunteers@ksrct.ac.in';
const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD || '12345';

const maybeCreateAdmin = async () => {
  const existing = await findUserByEmail(DEFAULT_ADMIN_EMAIL);
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  const adminUser = await createUser({
    name: 'Admin User',
    email: DEFAULT_ADMIN_EMAIL,
    role: 'admin',
    passwordHash,
    mustChangePassword: false,
  });

  console.log('✅ Default admin user seeded in Firestore');
  return adminUser;
};

export const ensureDefaultAdmin = () => {
  if (!ensurePromise) {
    ensurePromise = maybeCreateAdmin().catch((err) => {
      console.error('❌ Failed to ensure default admin user', err);
      ensurePromise = undefined;
      throw err;
    });
  }
  return ensurePromise;
};

