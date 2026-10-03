function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function eggTotals(eggsGood, eggsDamaged) {
  const good = toNumber(eggsGood);
  const damaged = toNumber(eggsDamaged);
  const total = good + damaged;
  const damageRate = total > 0 ? round2((damaged / total) * 100) : 0;
  return { total, damageRate };
}

function mortalityRate(deadCount, populationBefore) {
  const dead = toNumber(deadCount);
  const population = toNumber(populationBefore);
  if (population <= 0) return 0;
  return round2((dead / population) * 100);
}

function saleTotal(quantity, unitPrice) {
  return round2(toNumber(quantity) * toNumber(unitPrice));
}

function profit(totalSales, totalExpenses) {
  return round2(toNumber(totalSales) - toNumber(totalExpenses));
}

module.exports = { toNumber, round2, eggTotals, mortalityRate, saleTotal, profit };
