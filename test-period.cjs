const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.get("SELECT token FROM unidades WHERE nome LIKE '%Linhares%' LIMIT 1", async (err, row) => {
  if (err || !row) return console.log("No token");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  // test dt_cadastro_inicio
  let apiUrl = "https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/clientes?codEstab=1&dt_cadastro_inicio=01/07/2026&dt_cadastro_fim=31/07/2026&pagina=0";
  let res = await fetch(apiUrl, { headers: { Authorization: row.token } });
  let data = await res.json();
  console.log("dt_cadastro_inicio:", Array.isArray(data) ? data.length : data);

  // test dt_inicio / dt_fim
  apiUrl = "https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/clientes?codEstab=1&dt_inicio=01/07/2026&dt_fim=31/07/2026&pagina=0";
  res = await fetch(apiUrl, { headers: { Authorization: row.token } });
  data = await res.json();
  console.log("dt_inicio:", Array.isArray(data) ? data.length : data);
});
