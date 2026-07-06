const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT token FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  let pagina = 0;
  let hasMore = true;
  let total = 0;
  let indicacoes = 0;
  while(hasMore) {
     const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/clientes?codEstab=1&dt_cadastro_inicio=01/07/2026&dt_cadastro_fim=31/07/2026&pagina=${pagina}`;
     const res = await fetch(apiUrl, { headers: { Authorization: row.token } });
     const data = await res.json();
     if (!Array.isArray(data) || data.length === 0) break;
     total += data.length;
     const byBarbara = data.filter(c => c.origem && c.origem.includes('82700'));
     indicacoes += byBarbara.length;
     if (data.length < 100) hasMore = false;
     else pagina++;
  }
  console.log(`Total clients: ${total}, Indicated by Barbara: ${indicacoes}`);
});
