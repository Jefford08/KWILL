(function () {
  const canvas = document.getElementById('trend-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const METRIC_COLORS = {
    eggs: '#2f6f3e',
    mortality: '#c0362c',
    feed: '#a86a12',
    sales: '#1d4ed8',
    expenses: '#d9480f',
    costs: '#d9480f',
    profit: '#7c3aed',
    population: '#0f766e',
  };

  const METRIC_LABELS = {
    eggs: 'Eggs',
    mortality: 'Mortality',
    feed: 'Feed used (kg)',
    sales: 'Sales (₱)',
    expenses: 'Expenses (₱)',
    costs: 'Costs incl. feed (₱)',
    profit: 'Profit (₱)',
    population: 'Quail change',
  };

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function fmtDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
      from: canvas.dataset.from || params.get('from'),
      to: canvas.dataset.to || params.get('to'),
    };
  }

  function getGranularity() {
    const params = new URLSearchParams(window.location.search);
    if (canvas.dataset.granularity) return canvas.dataset.granularity;
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
      backgroundColor: hexToRgba(color, 0.08),
      fill: true,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: data.length > 40 ? 0 : 2.5,
      pointHoverRadius: 5,
      pointBackgroundColor: color,
    };
  }

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#5c6b60';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function prettyLabel(label) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(label));
    if (!m) return label;
    const mon = MONTHS[Number(m[2]) - 1];
    return m[3] ? `${mon} ${Number(m[3])}` : `${mon} ${m[1]}`;
  }

  function chartOptions(showLegend) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: showLegend, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
        tooltip: {
          backgroundColor: '#17231a', padding: 10, cornerRadius: 8, boxPadding: 4,
          callbacks: { title: (items) => (items.length ? prettyLabel(items[0].label) : '') },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkipPadding: 16, callback(value) { return prettyLabel(this.getLabelForValue(value)); } },
        },
        y: { beginAtZero: true, grid: { color: '#edf1ec' }, border: { display: false } },
      },
    };
  }

  function render(labels, datasets) {
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.options.plugins.legend.display = datasets.length > 1;
      chart.update();
    } else {
      chart = new Chart(canvas, { type: 'line', data: { labels, datasets }, options: chartOptions(datasets.length > 1) });
    }
  }

  let chart;
  let refresh = async () => {};
  let latestRequest = 0;
  const checkboxContainer = document.getElementById('metric-checkboxes');

  if (checkboxContainer) {
    const allToggle = checkboxContainer.querySelector('[data-metric-all]');
    const checkboxes = Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]:not([data-metric-all])'));
    refresh = async () => {
      const request = ++latestRequest;
      const selected = checkboxes.filter((c) => c.checked).map((c) => c.value);
      if (selected.length === 0) {
        if (chart) { chart.destroy(); chart = null; }
        return;
      }
      const results = await Promise.all(selected.map((m) => fetchSeries(m)));
      if (request !== latestRequest) return;
      render(results[0].labels, selected.map((metric, i) => buildDataset(metric, results[i].data)));
    };

    const syncAll = () => { if (allToggle) allToggle.checked = checkboxes.every((c) => c.checked); };
    if (allToggle) {
      allToggle.addEventListener('change', () => {
        if (allToggle.checked) checkboxes.forEach((c) => { c.checked = true; });
        else checkboxes.forEach((c) => { c.checked = c.value === 'eggs'; });
        refresh();
      });
    }
    checkboxes.forEach((box) => box.addEventListener('change', () => {
      if (allToggle && allToggle.checked) {
        checkboxes.forEach((c) => { c.checked = c === box; });
      }
      syncAll();
      refresh();
    }));
    syncAll();
  } else {
  
    const metric = canvas.dataset.metric || 'eggs';
    refresh = async () => {
      const request = ++latestRequest;
      const { labels, data } = await fetchSeries(metric);
      if (request !== latestRequest) return;
      render(labels, [buildDataset(metric, data)]);
    };
  }

  refresh();
  if (fromInput) fromInput.addEventListener('change', refresh);
  if (toInput) toInput.addEventListener('change', refresh);
})();
