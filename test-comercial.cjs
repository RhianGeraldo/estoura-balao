const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT token FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const apiUrl = "https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/listagem_comercial_clientes?dtInicio=01/07/2026&dtFim=31/07/2026";
  const res = await fetch(apiUrl, { headers: { Authorization: row.token } });
  const data = await res.json();
  console.log("Total:", Array.isArray(data) ? data.length : data);
  if (Array.isArray(data)) {
     const byBarbara = data.filter(c => c.origemCliente && c.origemCliente.includes('82700'));
     console.log("By Barbara:", byBarbara.length);
     if (byBarbara.length > 0) {
        console.log("First:", byBarbara[0]);
     }
  }
});
