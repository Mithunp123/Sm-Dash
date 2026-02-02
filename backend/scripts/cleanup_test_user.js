
import { getDatabase } from '../database/init.js';

const db = getDatabase();
const emailToDelete = 'naren42414@gmail.com';

db.get('SELECT * FROM users WHERE email = ?', [emailToDelete], (err, user) => {
    if (err) {
        console.error('Error finding user:', err);
        return;
    }

    if (user) {
        console.log(`Found user ${user.email} (ID: ${user.id}). Deleting...`);
        db.run('DELETE FROM users WHERE id = ?', [user.id], function (err) {
            if (err) {
                console.error('Error deleting user:', err);
            } else {
                console.log(`✅ Successfully deleted user ${emailToDelete}. Rows affected: ${this.changes}`);
            }
        });
    } else {
        console.log(`ℹ️ User ${emailToDelete} not found in database.`);
    }
});
