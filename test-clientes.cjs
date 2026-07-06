const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT token, nome FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token for Linhares");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  // Try to fetch clients for a few days to find any with an 'origem'
  for (let i = 1; i <= 5; i++) {
     const dt = `0${i}/07/2026`;
     const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/clientes?codEstab=1&dt_cadastro=${dt}&pagina=0`;
     const res = await fetch(apiUrl, { headers: { Authorization: row.token } });
     const data = await res.json();
     if (Array.isArray(data)) {
        const indicated = data.filter(c => c.origem || c.tipoOrigem);
        if (indicated.length > 0) {
           console.log(`Date: ${dt}, Indicated count:`, indicated.length);
           console.log("First indicated:", JSON.stringify(indicated[0], null, 2));
           return;
        }
     }
  }
  console.log("No indicated clients found in first 5 days");
});
