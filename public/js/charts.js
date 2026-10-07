(function () {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;

  const METRIC_COLORS = {
    eggs: '#2f6f3e',
    mortality: '#b3261e',
    feed: '#8a5a2b',
    sales: '#1d4ed8',
    expenses: '#c2410c',
    profit: '#7c3aed',
    population: '#0f766e',
  };

  const METRIC_LABELS = {
    eggs: 'Egg Production',
    mortality: 'Mortality',
    feed: 'Feed Consumption',
    sales: 'Sales',
    expenses: 'Expenses',
    profit: 'Profit',
    population: 'Stock Change',
  };

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function fmtDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function defaultRangeClient(days) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: fmtDate(from), to: fmtDate(to) };
  }

  function daysBetween(from, to) {
    const a = new Date(from + 'T00:00:00Z');
    const b = new Date(to + 'T00:00:00Z');
    return Math.round((b - a) / 86400000) + 1;
  }

  function suggestGranularity(from, to) {
    const span = daysBetween(from, to);
    if (span > 366) return 'year';
    if (span > 180) return 'month';
    if (span > 60) return 'week';
    return 'day';
  }

  const fromInput = document.getElementById('chart-from');
  const toInput = document.getElementById('chart-to');

  if (fromInput && toInput && (!fromInput.value || !toInput.value)) {
    const range = defaultRangeClient(30);
    fromInput.value = fromInput.value || range.from;
    toInput.value = toInput.value || range.to;
  }

  function getRange() {
    if (fromInput && toInput && fromInput.value && toInput.value) {
      return { from: fromInput.value, to: toInput.value };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      from: window.__chartRangeFrom || params.get('from'),
      to: window.__chartRangeTo || params.get('to'),
    };
  }

  function getGranularity() {
    const params = new URLSearchParams(window.location.search);
    if (window.__chartRangeGranularity) return window.__chartRangeGranularity;
    if (params.get('granularity')) return params.get('granularity');
    const { from, to } = getRange();
    return suggestGranularity(from, to);
  }

  async function fetchSeries(metric) {
    const { from, to } = getRange();
    const granularity = getGranularity();
    let url = `/api/charts/${metric}`;
    if (from && to) {
      url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${encodeURIComponent(granularity)}`;
    }
    const res = await fetch(url);
    return res.json();
  }

  function buildDataset(metric, data) {
    const color = METRIC_COLORS[metric] || '#2f6f3e';
    return {
      label: METRIC_LABELS[metric] || metric,
      data,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.15),
      fill: true,
      tension: 0.25,
    };
  }

  let chart;
  const checkboxContainer = document.getElementById('metric-checkboxes');
  const select = document.getElementById('metric-select');
  let refresh = async () => {};

  if (checkboxContainer) {
    const checkboxes = Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]'));

    async function refreshChart() {
      const selected = checkboxes.filter((c) => c.checked).map((c) => c.value);
      if (selected.length === 0) {
        if (chart) {
          chart.destroy();
          chart = null;
        }
        return;
      }

      const results = await Promise.all(selected.map((m) => fetchSeries(m)));
      const labels = results[0].labels;
      const datasets = selected.map((metric, i) => buildDataset(metric, results[i].data));

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        chart.update();
      } else {
        chart = new Chart(canvas, {
          type: 'line',
          data: { labels, datasets },
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      }
    }

    checkboxes.forEach((c) => c.addEventListener('change', refreshChart));
    refresh = refreshChart;
    refreshChart();
  } else {
    async function loadMetric(metric) {
      const { labels, data } = await fetchSeries(metric);
      const dataset = buildDataset(metric, data);

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0] = dataset;
        chart.update();
      } else {
        chart = new Chart(canvas, {
          type: 'line',
          data: { labels, datasets: [dataset] },
          options: { responsive: true, scales: { y: { beginAtZero: true } } },
        });
      }
    }

    const initialMetric = canvas.dataset.metric || (select ? select.value : 'eggs');
    refresh = () => loadMetric(select ? select.value : initialMetric);
    loadMetric(initialMetric);

    if (select) {
      select.addEventListener('change', () => loadMetric(select.value));
    }
  }

  if (fromInput) fromInput.addEventListener('change', refresh);
  if (toInput) toInput.addEventListener('change', refresh);
})();
