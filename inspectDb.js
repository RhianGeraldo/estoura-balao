const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function run() {
    try {
        const db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
        console.log("Tables in ./database.sqlite:", tables);

        try {
            const users = await db.all("SELECT * FROM users");
            console.log("Users:", users);
        } catch (e) {
            console.log("Failed to query users:", e.message);
        }
    } catch (err) {
        console.error("Error DB:", err);
    }
}
run();
