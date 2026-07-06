const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT token FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token for Linhares");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  let totalIndicacoes = 0;
  for (let i = 1; i <= 31; i++) {
     const dt = `${i.toString().padStart(2, '0')}/07/2026`;
     const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/clientes?codEstab=1&dt_cadastro=${dt}&pagina=0`;
     const res = await fetch(apiUrl, { headers: { Authorization: row.token } });
     const data = await res.json();
     if (Array.isArray(data)) {
        const indicatedByBarbara = data.filter(c => c.origem && c.origem.includes('82700'));
        totalIndicacoes += indicatedByBarbara.length;
        if (indicatedByBarbara.length > 0) {
            console.log(`Found on ${dt}:`, indicatedByBarbara.map(c => ({ nome: c.nome, origem: c.origem, tipoOrigem: c.tipoOrigem })));
        }
     }
  }
  console.log("Total indicated by Barbara:", totalIndicacoes);
});
