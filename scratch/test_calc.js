
function generateBalloonValues(
    orcamentoTotal,
    qtdPremiados,
    valorMultiplo,
    valorMinimo,
    valorMaximo
) {
    orcamentoTotal = Number(orcamentoTotal);
    qtdPremiados = Number(qtdPremiados);
    valorMultiplo = Number(valorMultiplo);
    valorMinimo = Number(valorMinimo);
    valorMaximo = Number(valorMaximo);

    const values = new Array(qtdPremiados).fill(valorMinimo);
    let saldoRestante = orcamentoTotal - (qtdPremiados * valorMinimo);

    if (saldoRestante >= (valorMaximo - valorMinimo)) {
        values[0] = valorMaximo;
        saldoRestante -= (valorMaximo - valorMinimo);
    }

    let attempts = 0;
    const maxAttempts = 10000;

    while (saldoRestante >= valorMultiplo && attempts < maxAttempts) {
        attempts++;
        const idx = Math.floor(Math.random() * qtdPremiados);
        if (values[idx] + valorMultiplo <= valorMaximo) {
            values[idx] += valorMultiplo;
            saldoRestante -= valorMultiplo;
        }
    }

    if (saldoRestante > 0) {
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] + saldoRestante <= valorMaximo) {
                values[i] += saldoRestante;
                saldoRestante = 0;
                break;
            }
        }
    }

    const total = values.reduce((a, b) => a + b, 0);
    return { values, total, remaining: saldoRestante };
}

const result = generateBalloonValues(250, 20, 5, 5, 30);
console.log(JSON.stringify(result, null, 2));
