const pool = require('../config/db');
const { eggTotals, mortalityRate, saleTotal, profit: calcProfit } = require('../utils/calculations');

const MODULE_LABELS = {
  eggs: 'Egg Production',
  mortality: 'Mortality',
  feed: 'Feed',
  sales: 'Sales',
  expenses: 'Expenses',
  profit: 'Profit Summary',
};

async function buildReport(userId, moduleName, from, to) {
  switch (moduleName) {
    case 'eggs': {
      const [rows] = await pool.query(
        'SELECT * FROM egg_records WHERE user_id = ? AND record_date BETWEEN ? AND ? ORDER BY record_date',
        [userId, from, to]
      );
      let totalGood = 0;
      let totalDamaged = 0;
      const tableRows = rows.map((r) => {
        const t = eggTotals(r.eggs_good, r.eggs_damaged);
        totalGood += r.eggs_good;
        totalDamaged += r.eggs_damaged;
        return [r.record_date, r.eggs_good, r.eggs_damaged, t.total, t.damageRate + '%'];
      });
      const overall = eggTotals(totalGood, totalDamaged);
      return {
        columns: ['Date', 'Good', 'Damaged', 'Total', 'Damage Rate'],
        rows: tableRows,
        summary: [
          { label: 'Total Eggs Collected', value: totalGood + totalDamaged },
          { label: 'Total Damaged', value: totalDamaged },
          { label: 'Overall Damage Rate', value: overall.damageRate + '%' },
        ],
        chartMetric: 'eggs',
      };
    }
    case 'mortality': {
      const [rows] = await pool.query(
        "SELECT * FROM quail_population WHERE user_id = ? AND change_type = 'mortality' AND entry_date BETWEEN ? AND ? ORDER BY entry_date",
        [userId, from, to]
      );
      let totalDead = 0;
      let rateSum = 0;
      const tableRows = rows.map((r) => {
        const rate = mortalityRate(r.quantity, r.population_before);
        totalDead += r.quantity;
        rateSum += rate;
        return [r.entry_date, r.quantity, r.population_before, rate + '%'];
      });
      const avgRate = rows.length ? Math.round((rateSum / rows.length) * 100) / 100 : 0;
      return {
        columns: ['Date', 'Dead', 'Population Before', 'Mortality Rate'],
        rows: tableRows,
        summary: [
          { label: 'Total Deaths', value: totalDead },
          { label: 'Average Mortality Rate', value: avgRate + '%' },
        ],
        chartMetric: 'mortality',
      };
    }
    case 'feed': {
      const [purchases] = await pool.query(
        'SELECT purchase_date AS date, quantity_kg, cost FROM feed_purchases WHERE user_id = ? AND purchase_date BETWEEN ? AND ?',
        [userId, from, to]
      );
      const [consumption] = await pool.query(
        'SELECT consumption_date AS date, quantity_kg FROM feed_consumption WHERE user_id = ? AND consumption_date BETWEEN ? AND ?',
        [userId, from, to]
      );
      const tableRows = [
        ...purchases.map((r) => [r.date, 'Purchase', r.quantity_kg, '₱' + Number(r.cost).toFixed(2)]),
        ...consumption.map((r) => [r.date, 'Consumption', r.quantity_kg, '-']),
      ].sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0));
      const totalPurchasedKg = purchases.reduce((s, r) => s + Number(r.quantity_kg), 0);
      const totalCost = purchases.reduce((s, r) => s + Number(r.cost), 0);
      const totalConsumedKg = consumption.reduce((s, r) => s + Number(r.quantity_kg), 0);
      return {
        columns: ['Date', 'Type', 'Quantity (kg)', 'Cost'],
        rows: tableRows,
        summary: [
          { label: 'Total Purchased (kg)', value: totalPurchasedKg },
          { label: 'Total Consumed (kg)', value: totalConsumedKg },
          { label: 'Total Feed Cost', value: '₱' + totalCost.toFixed(2) },
        ],
        chartMetric: 'feed',
      };
    }
    case 'sales': {
      const [rows] = await pool.query(
        'SELECT * FROM sales WHERE user_id = ? AND sale_date BETWEEN ? AND ? ORDER BY sale_date',
        [userId, from, to]
      );
      let total = 0;
      const tableRows = rows.map((r) => {
        const t = saleTotal(r.quantity, r.unit_price);
        total += t;
        return [r.sale_date, r.item_type, r.quantity, '₱' + Number(r.unit_price).toFixed(2), '₱' + t.toFixed(2)];
      });
      return {
        columns: ['Date', 'Item', 'Qty', 'Unit Price', 'Total'],
        rows: tableRows,
        summary: [{ label: 'Total Sales', value: '₱' + total.toFixed(2) }],
        chartMetric: 'sales',
      };
    }
    case 'expenses': {
      const [rows] = await pool.query(
        'SELECT * FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ? ORDER BY expense_date',
        [userId, from, to]
      );
      let total = 0;
      const tableRows = rows.map((r) => {
        total += Number(r.amount);
        return [r.expense_date, r.category, r.description || '-', '₱' + Number(r.amount).toFixed(2)];
      });
      return {
        columns: ['Date', 'Category', 'Description', 'Amount'],
        rows: tableRows,
        summary: [{ label: 'Total Expenses', value: '₱' + total.toFixed(2) }],
        chartMetric: 'expenses',
      };
    }
    case 'profit': {
      const [salesRows] = await pool.query(
        'SELECT sale_date AS d, SUM(quantity * unit_price) AS v FROM sales WHERE user_id = ? AND sale_date BETWEEN ? AND ? GROUP BY sale_date',
        [userId, from, to]
      );
      const [expenseRows] = await pool.query(
        'SELECT expense_date AS d, SUM(amount) AS v FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ? GROUP BY expense_date',
        [userId, from, to]
      );
      const [feedRows] = await pool.query(
        'SELECT purchase_date AS d, SUM(cost) AS v FROM feed_purchases WHERE user_id = ? AND purchase_date BETWEEN ? AND ? GROUP BY purchase_date',
        [userId, from, to]
      );
      const salesMap = new Map(salesRows.map((r) => [r.d, Number(r.v)]));
      const expenseMap = new Map(expenseRows.map((r) => [r.d, Number(r.v)]));
      const feedMap = new Map(feedRows.map((r) => [r.d, Number(r.v)]));
      const allDates = Array.from(new Set([...salesMap.keys(), ...expenseMap.keys(), ...feedMap.keys()])).sort();
      let totalSales = 0;
      let totalExpenses = 0;
      let totalFeed = 0;
      const peso = (n) => '₱' + n.toFixed(2);
      const tableRows = allDates.map((d) => {
        const s = salesMap.get(d) || 0;
        const e = expenseMap.get(d) || 0;
        const f = feedMap.get(d) || 0;
        totalSales += s;
        totalExpenses += e;
        totalFeed += f;
        return [d, peso(s), peso(f), peso(e), peso(calcProfit(s, e + f))];
      });
      return {
        columns: ['Date', 'Sales', 'Feed', 'Other Expenses', 'Profit'],
        rows: tableRows,
        summary: [
          { label: 'Total Sales', value: peso(totalSales) },
          { label: 'Feed Costs', value: peso(totalFeed) },
          { label: 'Other Expenses', value: peso(totalExpenses) },
          { label: 'Total Profit', value: peso(calcProfit(totalSales, totalExpenses + totalFeed)) },
        ],
        chartMetric: 'profit',
      };
    }
    default:
      throw new Error('Unknown module: ' + moduleName);
  }
}

module.exports = { buildReport, MODULE_LABELS };
