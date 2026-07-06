const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT id FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token for Linhares");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const apiUrl = "http://localhost:3000/api/validate-crc";
  const res = await fetch(apiUrl, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cod_crc: "82700",
      dt_inicio: "01/07/2026",
      dt_fim: "31/07/2026",
      unidade_id: row.id
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
});
