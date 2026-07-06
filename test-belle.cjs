const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('server/database.sqlite');
db.get("SELECT token FROM unidades LIMIT 1", async (err, row) => {
  if (err) return console.error(err);
  if (!row) return console.log("No token");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  const res = await fetch("https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/usuario/listar?codEstab=1", {
    headers: { Authorization: row.token }
  });
  const data = await res.json();
  console.log(JSON.stringify(data).substring(0, 500));
});
