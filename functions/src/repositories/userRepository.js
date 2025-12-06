import admin from 'firebase-admin';
import { firestore } from '../firebaseAdmin.js';

const usersCollection = firestore.collection('users');

const normalizeEmail = (email = '') => email.toLowerCase().trim();

const mapDocToUser = (doc) => {
  if (!doc?.exists) return null;
  return {
    id: doc.id,
    ...doc.data(),
  };
};

export const findUserById = async (id) => {
  if (!id) return null;
  const doc = await usersCollection.doc(id).get();
  return mapDocToUser(doc);
};

export const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const snapshot = await usersCollection
    .where('emailLower', '==', normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return mapDocToUser(snapshot.docs[0]);
};

export const createUser = async (payload) => {
  const normalized = normalizeEmail(payload.email);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = payload.id
    ? usersCollection.doc(payload.id)
    : usersCollection.doc();

  await docRef.set(
    {
      ...payload,
      emailLower: normalized,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const latest = await docRef.get();
  return mapDocToUser(latest);
};

export const updateUser = async (id, payload) => {
  if (!id) throw new Error('User id is required');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await usersCollection.doc(id).set(
    {
      ...payload,
      updatedAt: now,
    },
    { merge: true },
  );

  return findUserById(id);
};

