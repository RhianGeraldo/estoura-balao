import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

// Load .env.local first (takes precedence), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config(); // loads .env as fallback
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let db;

async function setupDatabase() {
    const url = process.env.DATABASE_URL || 'file:./database.sqlite';
    const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

    const client = createClient({
        url,
        authToken
    });

    db = {
        exec: async (sql) => {
            // libSQL client.executeMultiple handles multiple statements like CREATE TABLE
            return await client.executeMultiple(sql);
        },
        run: async (sql, params = []) => {
            const result = await client.execute({ sql, args: params });
            return { changes: result.rowsAffected, lastID: result.lastInsertRowid?.toString() };
        },
        get: async (sql, params = []) => {
            const result = await client.execute({ sql, args: params });
            return result.rows[0] || null;
        },
        all: async (sql, params = []) => {
            const result = await client.execute({ sql, args: params });
            return result.rows;
        },
        prepare: async (sql) => {
            // For prepared statements in libSQL, we just return an object with a run method.
            return {
                run: async (...args) => {
                    const params = args.slice(0, args.length);
                    await client.execute({ sql, args: params });
                },
                finalize: async () => { }
            };
        }
    };

    await db.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo_jogo TEXT NOT NULL DEFAULT 'balloon',
      orcamento_total NUMERIC NOT NULL,
      qtd_baloes INTEGER NOT NULL,
      qtd_premiados INTEGER NOT NULL,
      valor_multiplo NUMERIC NOT NULL,
      valor_minimo NUMERIC NOT NULL,
      valor_maximo NUMERIC NOT NULL,
      venda_minima NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS balloons (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      numero INTEGER NOT NULL,
      valor NUMERIC NOT NULL DEFAULT 0,
      premiado BOOLEAN NOT NULL DEFAULT 0,
      estourado BOOLEAN NOT NULL DEFAULT 0,
      user_id TEXT,
      vendedor TEXT,
      data_estouro DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(action_id) REFERENCES actions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_balloons_action_id ON balloons(action_id);

    CREATE TABLE IF NOT EXISTS unidades (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
    // Alter table if vendedor or cliente column does not exist(for backward compatibility)
    try {
        await db.run("ALTER TABLE balloons ADD COLUMN vendedor TEXT;");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE balloons ADD COLUMN cliente TEXT;");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE balloons ADD COLUMN nivel TEXT DEFAULT 'simples';");
    } catch (e) { }
    // Alter table if tipo_jogo column does not exist (for backward compatibility)
    try {
        await db.run("ALTER TABLE actions ADD COLUMN tipo_jogo TEXT DEFAULT 'balloon';");
    } catch (e) { }
    // Add venda_minima to actions
    try {
        await db.run("ALTER TABLE actions ADD COLUMN venda_minima NUMERIC NOT NULL DEFAULT 0;");
    } catch (e) { }
    
    // Add premium configuration columns to actions
    const premiumColumns = [
        "orcamento_total_premium NUMERIC DEFAULT 0",
        "qtd_baloes_premium INTEGER DEFAULT 0",
        "qtd_premiados_premium INTEGER DEFAULT 0",
        "valor_minimo_premium NUMERIC DEFAULT 0",
        "valor_maximo_premium NUMERIC DEFAULT 0",
        "venda_minima_premium NUMERIC DEFAULT 0",
        "desconto_max_premium NUMERIC DEFAULT 0",
        "formas_pagamento_premium TEXT"
    ];
    for (const col of premiumColumns) {
        try {
            await db.run(`ALTER TABLE actions ADD COLUMN ${col};`);
        } catch (e) { }
    }
    
    // Add CRC indications config columns to actions
    try {
        await db.run("ALTER TABLE actions ADD COLUMN qtd_indicacoes_simples INTEGER DEFAULT 0;");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE actions ADD COLUMN qtd_indicacoes_premium INTEGER DEFAULT 0;");
    } catch (e) { }

    // Add CRC Usage table
    try {
        await db.run(`
            CREATE TABLE IF NOT EXISTS crc_usage (
                action_id TEXT,
                crc_codigo TEXT,
                indicacoes_gastas INTEGER DEFAULT 0,
                PRIMARY KEY (action_id, crc_codigo),
                FOREIGN KEY (action_id) REFERENCES actions (id) ON DELETE CASCADE
            )
        `);
    } catch (e) {
        console.error("Error creating crc_usage table:", e);
    }

    // Add nome to users and created_by to actions
    try {
        await db.run("ALTER TABLE users ADD COLUMN nome TEXT;");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE actions ADD COLUMN created_by TEXT;");
    } catch (e) { }
    // Create action_unidades table for N:N relationship between campaigns and stores
    try {
        await db.run(`
            CREATE TABLE IF NOT EXISTS action_unidades (
                action_id TEXT,
                unidade_id TEXT,
                PRIMARY KEY (action_id, unidade_id),
                FOREIGN KEY (action_id) REFERENCES actions (id) ON DELETE CASCADE,
                FOREIGN KEY (unidade_id) REFERENCES unidades (id) ON DELETE CASCADE
            )
        `);
    } catch (e) {
        console.error("Error creating action_unidades table:", e);
    }

    console.log('SQLite database initialized.');

    // Seed default admin if no users exist
    const userCount = await db.get("SELECT COUNT(*) as count FROM users");
    if (userCount.count === 0) {
        const id = crypto.randomUUID();
        const hash = await bcrypt.hash("admin123", 10);
        await db.run("INSERT INTO users (id, username, password_hash, nome) VALUES (?, ?, ?, ?)", [id, "admin@admin.com", hash, "Administrador"]);
        console.log("Default admin user created: admin@admin.com / admin123");
    } else {
        // Update existing default admin if name is missing
        await db.run("UPDATE users SET nome = 'Administrador' WHERE username = 'admin@admin.com' AND (nome IS NULL OR nome = '')");
    }
}

function generateBalloonValues(
    orcamentoTotal,
    qtdPremiados,
    valorMultiplo,
    valorMinimo,
    valorMaximo
) {
    // Force numeric types
    orcamentoTotal = Number(orcamentoTotal);
    qtdPremiados = Number(qtdPremiados);
    valorMultiplo = Number(valorMultiplo);
    valorMinimo = Number(valorMinimo);
    valorMaximo = Number(valorMaximo);

    const values = new Array(qtdPremiados).fill(valorMinimo);
    let saldoRestante = orcamentoTotal - (qtdPremiados * valorMinimo);

    // --- 1. Guaranteed Top Prize (if budget allows) ---
    // If we have enough left to take at least one balloon to its max, do it.
    if (saldoRestante >= (valorMaximo - valorMinimo)) {
        values[0] = valorMaximo;
        saldoRestante -= (valorMaximo - valorMinimo);
    }

    let attempts = 0;
    const maxAttempts = 10000;

    // --- 2. Random Distribution of the rest ---
    while (saldoRestante >= valorMultiplo && attempts < maxAttempts) {
        attempts++;
        const idx = Math.floor(Math.random() * qtdPremiados);
        if (values[idx] + valorMultiplo <= valorMaximo) {
            values[idx] += valorMultiplo;
            saldoRestante -= valorMultiplo;
        }
    }

    // --- Distribution of the small remainder (to reach 100% budget) ---
    if (saldoRestante > 0) {
        // Try to add the remainder to the last changed balloon or any balloon that can take it
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] + saldoRestante <= valorMaximo) {
                values[i] += saldoRestante;
                saldoRestante = 0;
                break;
            }
        }
    }

    const total = values.reduce((a, b) => a + b, 0);
    console.log(`[Balloon Gen] Total: ${total} | Budget: ${orcamentoTotal} | Remaining: ${saldoRestante}`);

    return values;
}

// --- AUTH MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Acesso negado." });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        console.error("Auth Error:", e.message);
        res.status(401).json({ error: "Token inválido ou expirado." });
    }
};

// POST /create-action
app.post('/api/create-action', authMiddleware, async (req, res) => {
    try {
        const { 
            nome, tipo_jogo, unidades,
            orcamento_total, qtd_baloes, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo, venda_minima,
            orcamento_total_premium, qtd_baloes_premium, qtd_premiados_premium, valor_minimo_premium, valor_maximo_premium, venda_minima_premium, desconto_max_premium,
            formas_pagamento_premium,
            qtd_indicacoes_simples, qtd_indicacoes_premium
        } = req.body;

        if (qtd_premiados > qtd_baloes) return res.status(400).json({ error: "Quantidade de premiados não pode ser maior que total de balões" });
        if (qtd_premiados * valor_minimo > orcamento_total) return res.status(400).json({ error: "Orçamento insuficiente para os valores mínimos" });
        if (valor_minimo > valor_maximo) return res.status(400).json({ error: "Valor mínimo não pode ser maior que valor máximo" });

        const hasPremium = qtd_baloes_premium > 0;
        if (hasPremium) {
            if (qtd_premiados_premium > qtd_baloes_premium) return res.status(400).json({ error: "Quantidade de premiados (Premium) não ser maior que total (Premium)" });
            if (qtd_premiados_premium * valor_minimo_premium > orcamento_total_premium) return res.status(400).json({ error: "Orçamento insuficiente para prêmios mínimos (Premium)" });
            if (valor_minimo_premium > valor_maximo_premium) return res.status(400).json({ error: "Valor mínimo (Premium) não pode ser maior que valor máximo (Premium)" });
        }

        const validTypes = ['balloon', 'envelope', 'heart', 'chest', 'roulette'];
        const tipoJogo = validTypes.includes(tipo_jogo) ? tipo_jogo : 'balloon';

        const actionId = crypto.randomUUID();
        const vMinima = venda_minima ? Number(venda_minima) : 0;
        
        await db.run(
            `INSERT INTO actions (
                id, nome, tipo_jogo, orcamento_total, qtd_baloes, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo, venda_minima, created_by,
                orcamento_total_premium, qtd_baloes_premium, qtd_premiados_premium, valor_minimo_premium, valor_maximo_premium, venda_minima_premium, desconto_max_premium, formas_pagamento_premium,
                qtd_indicacoes_simples, qtd_indicacoes_premium
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                actionId, nome, tipoJogo, orcamento_total, qtd_baloes, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo, vMinima, req.user.id,
                orcamento_total_premium || 0, qtd_baloes_premium || 0, qtd_premiados_premium || 0, valor_minimo_premium || 0, valor_maximo_premium || 0, venda_minima_premium || 0, desconto_max_premium || 0,
                Array.isArray(formas_pagamento_premium) ? JSON.stringify(formas_pagamento_premium) : null,
                qtd_indicacoes_simples || 0, qtd_indicacoes_premium || 0
            ]
        );

        const action = await db.get("SELECT * FROM actions WHERE id = ?", [actionId]);

        const balloons = [];

        // --- Generate Simple Balloons ---
        const prizeValuesSimples = generateBalloonValues(orcamento_total, qtd_premiados, valor_multiplo, valor_minimo, valor_maximo);
        const prizeIndicesSimples = new Set();
        while (prizeIndicesSimples.size < qtd_premiados) {
            prizeIndicesSimples.add(Math.floor(Math.random() * qtd_baloes));
        }
        const prizeIdxArraySimples = Array.from(prizeIndicesSimples);
        let prizeCounterSimples = 0;
        for (let i = 0; i < qtd_baloes; i++) {
            const isPrize = prizeIdxArraySimples.includes(i);
            balloons.push({
                id: crypto.randomUUID(),
                action_id: actionId,
                numero: i + 1,
                valor: isPrize ? prizeValuesSimples[prizeCounterSimples] : 0,
                premiado: isPrize ? 1 : 0,
                nivel: 'simples'
            });
            if (isPrize) prizeCounterSimples++;
        }

        // --- Generate Premium Balloons ---
        if (hasPremium) {
            const prizeValuesPremium = generateBalloonValues(orcamento_total_premium, qtd_premiados_premium, valor_multiplo, valor_minimo_premium, valor_maximo_premium);
            const prizeIndicesPremium = new Set();
            while (prizeIndicesPremium.size < qtd_premiados_premium) {
                prizeIndicesPremium.add(Math.floor(Math.random() * qtd_baloes_premium));
            }
            const prizeIdxArrayPremium = Array.from(prizeIndicesPremium);
            let prizeCounterPremium = 0;
            for (let i = 0; i < qtd_baloes_premium; i++) {
                const isPrize = prizeIdxArrayPremium.includes(i);
                balloons.push({
                    id: crypto.randomUUID(),
                    action_id: actionId,
                    numero: qtd_baloes + i + 1,
                    valor: isPrize ? prizeValuesPremium[prizeCounterPremium] : 0,
                    premiado: isPrize ? 1 : 0,
                    nivel: 'premium'
                });
                if (isPrize) prizeCounterPremium++;
            }
        }

        const stmt = await db.prepare(
            `INSERT INTO balloons (id, action_id, numero, valor, premiado, nivel) VALUES (?, ?, ?, ?, ?, ?)`
        );
        for (const b of balloons) {
            await stmt.run(b.id, b.action_id, b.numero, b.valor, b.premiado, b.nivel);
        }
        await stmt.finalize();

        // Save selected units
        if (Array.isArray(unidades) && unidades.length > 0) {
            const stmtUnidades = await db.prepare(
                `INSERT INTO action_unidades (action_id, unidade_id) VALUES (?, ?)`
            );
            for (const unidadeId of unidades) {
                await stmtUnidades.run(actionId, unidadeId);
            }
            await stmtUnidades.finalize();
        }

        res.json({ action, balloons_created: qtd_baloes, unidades_vinculadas: unidades?.length || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// PUT /actions/:id (Update name and restricted units)
app.put('/api/actions/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { 
        nome, 
        unidades, 
        qtd_indicacoes_simples, 
        qtd_indicacoes_premium,
        venda_minima,
        venda_minima_premium,
        desconto_max_premium,
        formas_pagamento_premium
    } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'Nome não informado' });
    }

    let formasPagamentoStr = formas_pagamento_premium;
    if (Array.isArray(formas_pagamento_premium)) {
        formasPagamentoStr = JSON.stringify(formas_pagamento_premium);
    }

    try {
        const action = await db.get("SELECT * FROM actions WHERE id = ?", [id]);
        if (!action) return res.status(404).json({ error: 'Ação não encontrada' });

        await db.run(
            `UPDATE actions SET 
                nome = ?, 
                qtd_indicacoes_simples = COALESCE(?, qtd_indicacoes_simples), 
                qtd_indicacoes_premium = COALESCE(?, qtd_indicacoes_premium),
                venda_minima = COALESCE(?, venda_minima),
                venda_minima_premium = COALESCE(?, venda_minima_premium),
                desconto_max_premium = COALESCE(?, desconto_max_premium),
                formas_pagamento_premium = COALESCE(?, formas_pagamento_premium)
            WHERE id = ?`, 
            [
                nome, 
                qtd_indicacoes_simples, 
                qtd_indicacoes_premium,
                venda_minima,
                venda_minima_premium,
                desconto_max_premium,
                formasPagamentoStr,
                id
            ]
        );

        await db.run("DELETE FROM action_unidades WHERE action_id = ?", [id]);

        if (Array.isArray(unidades) && unidades.length > 0) {
            const stmtUnidades = await db.prepare(
                `INSERT INTO action_unidades (action_id, unidade_id) VALUES (?, ?)`
            );
            for (const unidadeId of unidades) {
                await stmtUnidades.run(id, unidadeId);
            }
            await stmtUnidades.finalize();
        }

        res.json({ success: true, message: 'Ação atualizada com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /active-actions
app.get('/api/active-actions', async (req, res) => {
    try {
        const actions = await db.all(`
            SELECT a.*, u.nome as created_by_name 
            FROM actions a 
            LEFT JOIN users u ON a.created_by = u.id 
            WHERE a.status = 'active' 
            ORDER BY a.created_at DESC
        `);

        if (!actions || actions.length === 0) return res.json({ actions: [] });

        const activeActionsData = [];

        for (const action of actions) {
            // Fetch allowed units for this action
            let allowedUnidades = [];
            const actionUnidades = await db.all(
                `SELECT u.* FROM unidades u 
                 JOIN action_unidades au ON u.id = au.unidade_id 
                 WHERE au.action_id = ?`, 
                [action.id]
            );
            
            if (actionUnidades.length > 0) {
                allowedUnidades = actionUnidades;
            } else {
                const allUnidades = await db.all("SELECT * FROM unidades ORDER BY nome");
                allowedUnidades = allUnidades;
            }

            const balloons = await db.all(
                "SELECT valor, premiado, estourado FROM balloons WHERE action_id = ?", [action.id]
            );

            const totalBaloes = balloons.length;
            const estouradosCount = balloons.filter(b => b.estourado).length;
            let totalDistribuido = 0;

            balloons.forEach(b => {
                if (b.estourado && b.premiado) {
                    totalDistribuido += Number(b.valor);
                }
            });

            const stats = {
                total_baloes: totalBaloes,
                estourados: estouradosCount,
                distribuido_grana: totalDistribuido
            };

            activeActionsData.push({
                action: {
                    ...action,
                    unidades: allowedUnidades
                },
                stats
            });
        }

        res.json({ actions: activeActionsData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /active-action
app.get('/api/active-action', async (req, res) => {
    try {
        const action = await db.get(
            "SELECT * FROM actions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
        );

        if (!action) return res.json({ action: null });

        // Fetch allowed units for this action
        let allowedUnidades = [];
        const actionUnidades = await db.all(
            `SELECT u.* FROM unidades u 
             JOIN action_unidades au ON u.id = au.unidade_id 
             WHERE au.action_id = ?`, 
            [action.id]
        );
        
        if (actionUnidades.length > 0) {
            allowedUnidades = actionUnidades;
        } else {
            // Legacy campaigns: if no units specified, allow all
            const allUnidades = await db.all("SELECT * FROM unidades ORDER BY nome");
            allowedUnidades = allUnidades;
        }

        const balloons = await db.all(
            "SELECT valor, premiado, estourado FROM balloons WHERE action_id = ?", [action.id]
        );

        const totalBaloes = balloons.length;
        const estouradosCount = balloons.filter(b => b.estourado).length;
        let totalDistribuido = 0;

        balloons.forEach(b => {
            if (b.estourado && b.premiado) {
                totalDistribuido += Number(b.valor);
            }
        });

        const stats = {
            total_baloes: totalBaloes,
            estourados: estouradosCount,
            distribuido_grana: totalDistribuido
        };

        const responseAction = {
            ...action,
            unidades: allowedUnidades
        };

        res.json({ action: responseAction, stats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /actions (History of all campaigns)
app.get('/api/actions', authMiddleware, async (req, res) => {
    try {
        const actions = await db.all(`
            SELECT a.*, u.nome as created_by_name 
            FROM actions a 
            LEFT JOIN users u ON a.created_by = u.id 
            ORDER BY a.created_at DESC
        `);

        // Let's also fetch the number of balloons popped for each action to show in the list
        for (const action of actions) {
            const poppedCount = await db.get("SELECT COUNT(id) as count FROM balloons WHERE action_id = ? AND estourado = 1", [action.id]);
            action.estourados = poppedCount.count;
        }

        res.json({ actions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /reopen-action
app.post('/api/reopen-action', authMiddleware, async (req, res) => {
    try {
        const { action_id } = req.body;
        if (!action_id) return res.status(400).json({ error: "action_id required" });

        // Check if there are still unopened (not popped) balloons/items
        const stats = await db.get(
            "SELECT COUNT(id) as total, SUM(CASE WHEN estourado = 1 THEN 1 ELSE 0 END) as popped FROM balloons WHERE action_id = ?",
            [action_id]
        );

        const total = Number(stats?.total || 0);
        const popped = Number(stats?.popped || 0);

        console.log(`[Reopen] IDs: ${action_id} | Total: ${total} | Popped: ${popped}`);

        if (total > 0 && popped >= total) {
            console.log("[Reopen] Blocked: All items opened.");
            return res.status(400).json({ error: "Esta campanha não pode ser reaberta pois todos os itens já foram abertos." });
        }

        // Reopen the requested action (multiple active campaigns are allowed)
        await db.run("UPDATE actions SET status = 'active' WHERE id = ?", [action_id]);

        res.json({ success: true, message: "Ação reaberta com sucesso!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /balloons
app.get('/api/balloons', async (req, res) => {
    try {
        const actionId = req.query.action_id;
        if (!actionId) return res.status(400).json({ error: "action_id required" });

        const balloons = await db.all(
            "SELECT id, numero, estourado, premiado, valor, data_estouro, nivel FROM balloons WHERE action_id = ? ORDER BY numero",
            [actionId]
        );

        const safeBalloons = balloons.map((b) => ({
            ...b,
            premiado: b.estourado ? Boolean(b.premiado) : null,
            valor: b.estourado ? b.valor : null,
            estourado: Boolean(b.estourado),
            nivel: b.nivel
        }));

        res.json({ balloons: safeBalloons });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /unidades
app.get('/api/unidades', async (req, res) => {
    try {
        const data = await db.all("SELECT id, nome, token, created_at FROM unidades ORDER BY nome");
        res.json({ unidades: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /unidades
app.post('/api/unidades', authMiddleware, async (req, res) => {
    try {
        const { nome, token } = req.body;
        if (!nome || !token) return res.status(400).json({ error: "nome e token são obrigatórios" });

        const unidadeId = crypto.randomUUID();
        await db.run("INSERT INTO unidades (id, nome, token) VALUES (?, ?, ?)", [unidadeId, nome, token]);
        const unidade = await db.get("SELECT id, nome, token, created_at FROM unidades WHERE id = ?", [unidadeId]);

        res.json({ unidade });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /unidades
app.delete('/api/unidades', authMiddleware, async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: "id required" });

        await db.run("DELETE FROM unidades WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /validate-budget
app.post('/api/validate-budget', async (req, res) => {
    try {
        const { cod_orcamentos, unidade_id, cod_orcamento } = req.body;
        const orcamentos = cod_orcamentos || (cod_orcamento ? [cod_orcamento] : []);
        
        if (orcamentos.length === 0 || !unidade_id) return res.status(400).json({ error: "cod_orcamentos e unidade_id são obrigatórios" });

        const unidade = await db.get("SELECT token FROM unidades WHERE id = ?", [unidade_id]);
        if (!unidade) return res.status(404).json({ error: "Unidade não encontrada" });

        const today = new Date();
        const dtFim = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        const dtInicio = startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

        let totalValorBruto = 0;
        let totalPrecoOriginal = 0;
        let isApproved = true;
        let comumVendedor = null;
        let comumCliente = null;
        let combinedStatusPlano = "";
        
        let allParcelas = [];

        for (const cod of orcamentos) {
            const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/venda_planos?codEstab=1&dtInicio=${dtInicio}&dtFim=${dtFim}&codOrcamento=${cod}`;
            const fetchResult = await fetch(apiUrl, { headers: { "Authorization": unidade.token } });
            if (!fetchResult.ok) return res.status(502).json({ error: `Erro ao consultar API externa para orçamento ${cod}` });

            const apiData = await fetchResult.json();
            const planos = Array.isArray(apiData) ? apiData : [apiData];
            const plano = planos.find((p) => String(p.codOrcamento) === String(cod));

            if (!plano) return res.status(404).json({ error: `Orçamento ${cod} não encontrado`, approved: false });

            console.log(`PLANO_DADOS (${cod}):`, JSON.stringify(plano, null, 2));

            if (!plano.statusPlano?.toLowerCase().includes("aprovado")) {
                isApproved = false;
                combinedStatusPlano = plano.statusPlano;
            }

            if (!comumVendedor) {
                comumVendedor = plano.vendedor;
                comumCliente = plano.cliente;
            } else if (String(plano.vendedor).trim().toLowerCase() !== String(comumVendedor).trim().toLowerCase()) {
                return res.status(400).json({ error: "Todos os orçamentos informados devem ser do mesmo vendedor.", approved: false });
            }

            const precoStr = String(plano.precoFinal || "0").replace(/\./g, "").replace(",", ".");
            const valorBruto = Number(precoStr);
            totalValorBruto += valorBruto;

            let precoOriginal = 0;
            if (plano.tipoDesconto === "%") {
                const descStr = String(plano.desconto || "0").replace(/\./g, "").replace(",", ".");
                const discountPctLocal = Number(descStr);
                precoOriginal = valorBruto / (1 - (discountPctLocal / 100));
            } else {
                const precoOriginalStr = String(plano.preco || "0").replace(/\./g, "").replace(",", ".");
                precoOriginal = Number(precoOriginalStr);
            }
            if (!precoOriginal || precoOriginal < valorBruto) precoOriginal = valorBruto;
            totalPrecoOriginal += precoOriginal;

            if (plano.parcelas && Array.isArray(plano.parcelas)) {
                allParcelas = allParcelas.concat(plano.parcelas);
            }
        }

        let alreadyUsed = false;
        for (const cod of orcamentos) {
            const used = await db.get("SELECT id FROM balloons WHERE estourado = 1 AND (user_id = ? OR user_id LIKE ? OR user_id LIKE ? OR user_id LIKE ?)", 
                [String(cod), `${cod}, %`, `%, ${cod}, %`, `%, ${cod}`]);
            if (used) {
                alreadyUsed = true;
                combinedStatusPlano = "Orçamento já utilizado.";
                break;
            }
        }

        if (isApproved && combinedStatusPlano === "") {
            combinedStatusPlano = "Aprovado";
        }

        let isMinVendaMet = true;
        let msgVenda = "";
        let minVenda = 0;
        let discountPct = 0;

        if (totalPrecoOriginal > 0) {
            discountPct = ((totalPrecoOriginal - totalValorBruto) / totalPrecoOriginal) * 100;
        }

        let action = null;
        if (req.body.action_id) {
            action = await db.get("SELECT venda_minima, venda_minima_premium, desconto_max_premium, qtd_baloes_premium, formas_pagamento_premium FROM actions WHERE id = ?", [req.body.action_id]);
        } else {
            action = await db.get("SELECT venda_minima, venda_minima_premium, desconto_max_premium, qtd_baloes_premium, formas_pagamento_premium FROM actions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
        }
        
        let nivelPermitido = null;
        if (action) {
            minVenda = Number(action.venda_minima || 0);
            if (totalValorBruto < minVenda) {
                isMinVendaMet = false;
                msgVenda = `O valor total (R$ ${totalValorBruto.toFixed(2)}) é inferior à venda mínima da campanha (R$ ${minVenda.toFixed(2)}).`;
            } else {
                const hasPremium = (action.qtd_baloes_premium || 0) > 0;
                if (hasPremium) {
                    const minVendaPremium = Number(action.venda_minima_premium || 0);
                    const descMaxPremium = Number(action.desconto_max_premium || 0);
                    
                    if (minVendaPremium > 0 && totalValorBruto >= minVendaPremium) {
                        nivelPermitido = "premium";
                    } else if (descMaxPremium > 0 && discountPct <= descMaxPremium) {
                        nivelPermitido = "premium";
                    } else {
                        nivelPermitido = "simples";
                    }
                    
                    if (nivelPermitido === "premium" && action.formas_pagamento_premium) {
                        try {
                            const allowedMethods = JSON.parse(action.formas_pagamento_premium);
                            if (Array.isArray(allowedMethods) && allowedMethods.length > 0) {
                                let hasAllowedPayment = false;
                                if (allParcelas.length > 0) {
                                    for (const parcela of allParcelas) {
                                        const pm = String(parcela.formaPagamento || "").toLowerCase();
                                        if (
                                            (allowedMethods.includes("pix") && pm.includes("pix")) ||
                                            (allowedMethods.includes("dinheiro") && pm.includes("dinheiro")) ||
                                            (allowedMethods.includes("cartão de crédito") && (pm.includes("crédito") || pm.includes("credito"))) ||
                                            (allowedMethods.includes("cartão de débito") && (pm.includes("débito") || pm.includes("debito"))) ||
                                            (allowedMethods.includes("cartão recorrente") && pm.includes("recorrente"))
                                        ) {
                                            hasAllowedPayment = true;
                                            break;
                                        }
                                    }
                                }
                                if (!hasAllowedPayment) {
                                    nivelPermitido = "simples";
                                }
                            }
                        } catch (e) {
                            console.error("Erro ao fazer parse de formas_pagamento_premium", e);
                        }
                    }
                } else {
                    nivelPermitido = "simples";
                }
            }
        } else {
            nivelPermitido = "simples";
        }

        const combinedCodOrcamentoStr = orcamentos.join(", ");

        res.json({
            approved: isApproved && isMinVendaMet && !alreadyUsed,
            isPlanoAprovado: isApproved,
            isMinVendaMet: isMinVendaMet,
            valorBruto: totalValorBruto,
            vendaMinima: minVenda,
            msgVenda: msgVenda,
            statusPlano: combinedStatusPlano,
            cliente: comumCliente,
            vendedor: comumVendedor,
            codOrcamento: combinedCodOrcamentoStr,
            nivelPermitido: nivelPermitido,
            discountPct: discountPct
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        const { unidade_id } = req.query;
        if (!unidade_id) {
            return res.status(400).json({ error: "Falta o parâmetro unidade_id" });
        }

        const unidade = await db.get("SELECT token FROM unidades WHERE id = ?", [unidade_id]);
        if (!unidade) return res.status(404).json({ error: "Unidade não encontrada" });

        const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/usuario/listar?codEstab=1`;
        const fetchResult = await fetch(apiUrl, { headers: { "Authorization": unidade.token } });
        
        if (!fetchResult.ok) {
            console.error("Erro na API da Belle Software:", await fetchResult.text());
            return res.status(500).json({ error: "Falha ao buscar usuários na API Belle" });
        }
        
        const usuarios = await fetchResult.json();
        console.log("Usuarios da Belle:", typeof usuarios, Array.isArray(usuarios) ? usuarios.length : "Not array", usuarios);
        res.json({ usuarios });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /validate-crc
app.post('/api/validate-crc', async (req, res) => {
    try {
        console.log("=== /api/validate-crc RECEIVED ===", req.body);
        const { cod_crc, dt_inicio, dt_fim, unidade_id, action_id } = req.body;
        if (!cod_crc || !dt_inicio || !dt_fim || !unidade_id || !action_id) {
            return res.status(400).json({ error: "Faltam parâmetros obrigatórios" });
        }

        const unidade = await db.get("SELECT token FROM unidades WHERE id = ?", [unidade_id]);
        if (!unidade) return res.status(404).json({ error: "Unidade não encontrada" });

        const action = await db.get("SELECT id, qtd_indicacoes_simples, qtd_indicacoes_premium FROM actions WHERE id = ?", [action_id]);
        if (!action) return res.status(404).json({ error: "Campanha não encontrada" });

        let totalIndicacoes = 0;
        let crcNome = "";
        const dtInicioFmt = dt_inicio; // Formato dd/mm/yyyy
        const dtFimFmt = dt_fim;
        
        const apiUrl = `https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0/listagem_comercial_clientes?dtInicio=${dtInicioFmt}&dtFim=${dtFimFmt}`;
        console.log(`Fetching from Belle: ${apiUrl}`);
        
        try {
            const fetchResult = await fetch(apiUrl, { headers: { "Authorization": unidade.token } });
            if (!fetchResult.ok) {
                console.error("API falhou para", apiUrl, await fetchResult.text());
                return res.status(500).json({ error: "Falha na API da Belle Software" });
            }
            
            const clientes = await fetchResult.json();
            console.log(`Belle response type:`, typeof clientes, Array.isArray(clientes) ? `Array[${clientes.length}]` : 'Not array');
            
            if (Array.isArray(clientes)) {
                for (const cli of clientes) {
                    const validOrigins = ["Cliente", "Profissional", "Usuário", "Usuario"];
                    const cleanCodCrc = String(cod_crc).trim();
                    // In listagem_comercial_clientes, the property is origemCliente and tipoOrigem
                    if (validOrigins.includes(cli.tipoOrigem) && cli.origemCliente && String(cli.origemCliente).includes(cleanCodCrc)) {
                        console.log(`Matched! origemCliente: ${cli.origemCliente}, tipoOrigem: ${cli.tipoOrigem}`);
                        totalIndicacoes++;
                        if (!crcNome && String(cli.origemCliente).includes("-")) {
                            crcNome = String(cli.origemCliente).split("-").slice(1).join("-").trim();
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao buscar listagem comercial:", err);
            return res.status(500).json({ error: "Erro de rede ao validar clientes" });
        }

        const cleanCodCrc = String(cod_crc).trim();
        const usage = await db.get("SELECT indicacoes_gastas FROM crc_usage WHERE action_id = ? AND crc_codigo = ?", [action.id, cleanCodCrc]);
        const indicacoesGastas = usage ? usage.indicacoes_gastas : 0;
        const indicacoesDisponiveis = totalIndicacoes - indicacoesGastas;

        res.json({
            approved: true,
            totalIndicacoes,
            indicacoesGastas,
            indicacoesDisponiveis,
            crcNome,
            qtd_indicacoes_simples: action.qtd_indicacoes_simples || 0,
            qtd_indicacoes_premium: action.qtd_indicacoes_premium || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /pop-balloon
app.post('/api/pop-balloon', async (req, res) => {
    try {
        const { balloon_id, user_id, cod_orcamento, vendedor, cliente, tipo_estouro, cod_crc, nivel_balao } = req.body;
        
        const cleanCodCrc = cod_crc ? String(cod_crc).trim() : '';
        let poppedUserId = null;
        if (tipo_estouro === 'crc') {
            poppedUserId = `CRC_${cleanCodCrc}_${new Date().getTime()}`;
        } else {
            poppedUserId = cod_orcamento || user_id || null;
        }

        const balloon = await db.get("SELECT * FROM balloons WHERE id = ?", [balloon_id]);
        if (!balloon) return res.status(404).json({ error: "Balão não encontrado!" });
        if (balloon.estourado) return res.status(400).json({ error: "Balão já estourado!", balloon });

        if (tipo_estouro !== 'crc' && poppedUserId) {
            const alreadyPopped = await db.get("SELECT id FROM balloons WHERE user_id = ? AND estourado = 1", [String(poppedUserId)]);
            if (alreadyPopped) {
                return res.status(400).json({ error: "Este orçamento já estourou o limite de balões disponíveis (1)." });
            }
        }

        if (tipo_estouro === 'crc') {
            const action = await db.get("SELECT * FROM actions WHERE id = ?", [balloon.action_id]);
            const custo = nivel_balao === 'premium' ? action.qtd_indicacoes_premium : action.qtd_indicacoes_simples;
            
            const usage = await db.get("SELECT indicacoes_gastas FROM crc_usage WHERE action_id = ? AND crc_codigo = ?", [balloon.action_id, cleanCodCrc]);
            if (usage) {
                await db.run("UPDATE crc_usage SET indicacoes_gastas = indicacoes_gastas + ? WHERE action_id = ? AND crc_codigo = ?", [custo, balloon.action_id, cleanCodCrc]);
            } else {
                await db.run("INSERT INTO crc_usage (action_id, crc_codigo, indicacoes_gastas) VALUES (?, ?, ?)", [balloon.action_id, cleanCodCrc, custo]);
            }
        }

        const poppedVendedor = vendedor || null;
        const poppedCliente = cliente || null;
        const now = new Date().toISOString();

        await db.run(
            "UPDATE balloons SET estourado = 1, user_id = ?, vendedor = ?, cliente = ?, data_estouro = ? WHERE id = ?",
            [poppedUserId, poppedVendedor, poppedCliente, now, balloon_id]
        );

        const updated = await db.get("SELECT * FROM balloons WHERE id = ?", [balloon_id]);
        updated.premiado = Boolean(updated.premiado);
        updated.estourado = Boolean(updated.estourado);

        res.json({ balloon: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /vendedores-stats
app.get('/api/vendedores-stats', authMiddleware, async (req, res) => {
    try {
        const actionId = req.query.action_id;
        if (!actionId) return res.status(400).json({ error: "action_id required" });

        const history = await db.all(
            `SELECT vendedor, cliente, user_id as cod_orcamento, valor, premiado, data_estouro 
       FROM balloons 
       WHERE action_id = ? AND estourado = 1 AND vendedor IS NOT NULL 
       ORDER BY data_estouro DESC`,
            [actionId]
        );

        res.json({ history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /close-action
app.post('/api/close-action', authMiddleware, async (req, res) => {
    try {
        const { action_id } = req.body;
        await db.run("UPDATE actions SET status = 'closed' WHERE id = ?", [action_id]);
        const action = await db.get("SELECT * FROM actions WHERE id = ?", [action_id]);
        res.json({ action });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- AUTHENTICATION & USERS ---

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (!user) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, nome, created_at FROM users ORDER BY created_at DESC");
        res.json({ users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', authMiddleware, async (req, res) => {
    try {
        const { username, password, nome } = req.body;
        if (!username || !password || !nome) return res.status(400).json({ error: "Informe nome, usuário e senha." });
        if (password.length < 6) return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });

        const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
        if (existing) return res.status(400).json({ error: "Usuário já existe." });

        const id = crypto.randomUUID();
        const hash = await bcrypt.hash(password, 10);
        await db.run("INSERT INTO users (id, username, password_hash, nome) VALUES (?, ?, ?, ?)", [id, username, hash, nome]);

        const user = await db.get("SELECT id, username, nome, created_at FROM users WHERE id = ?", [id]);
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const count = await db.get("SELECT COUNT(*) as count FROM users");
        if (count.count <= 1) return res.status(400).json({ error: "Não é possível excluir o único administrador." });

        await db.run("DELETE FROM users WHERE id = ?", [id]);
        res.json({ success: true, message: "Usuário excluído com sucesso." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /users/:id (Edit name, email and optionally password)
app.put('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, nome, password } = req.body;

        if (!username || !nome) {
            return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });
        }

        if (password && password.length > 0 && password.length < 6) {
            return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
        }

        const existing = await db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username, id]);
        if (existing) return res.status(400).json({ error: "E-mail/Usuário já está em uso por outro administrador." });

        if (password && password.length > 0) {
            const hash = await bcrypt.hash(password, 10);
            await db.run("UPDATE users SET username = ?, nome = ?, password_hash = ? WHERE id = ?", [username, nome, hash, id]);
        } else {
            await db.run("UPDATE users SET username = ?, nome = ? WHERE id = ?", [username, nome, id]);
        }

        const user = await db.get("SELECT id, username, nome, created_at FROM users WHERE id = ?", [id]);
        res.json({ user, message: "Administrador atualizado com sucesso." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/me/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
        }

        // Get user from token
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db.get("SELECT * FROM users WHERE id = ?", [decoded.id]);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: "Senha atual incorreta." });

        const hash = await bcrypt.hash(newPassword, 10);
        await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, user.id]);

        res.json({ success: true, message: "Senha alterada com sucesso!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

setupDatabase().then(() => {
    // Serve static files from the React app build
    import('path').then(({ default: path }) => {
        import('url').then(({ fileURLToPath }) => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const distPath = path.join(__dirname, '..', 'dist');

            app.use(express.static(distPath));

            // All other routes serve the React app
            app.get('/{*path}', (req, res) => {
                res.sendFile(path.join(distPath, 'index.html'));
            });
        });
    });

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
