import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  authDomain: "data-center-40843.firebaseapp.com",
  databaseURL: "https://data-center-40843-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "data-center-40843",
  admin_key: "WEB_ADMIN_456"   // SAMA dengan di rules
};

const ADMIN_KEY = firebaseConfig.admin_key;

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const firestore = getFirestore(app);
const thresholdsRef = ref(rtdb, "thresholds");
const latestRef = ref(rtdb, "latest");

let thresholds = {
  tempHigh: 35,
  humHigh: 80
};
let latestData = null;
let chartInstance = null;

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay') || document.getElementById('overlay');
const menuBtn = document.getElementById('mobileMenuBtn') || document.getElementById('menuToggle');
const chartLastUpdateEl = document.getElementById('chart-last-update') || document.getElementById('chartLastUpdate');
const tempChartCanvas = document.getElementById('tempChart');
const trendChartCanvas = document.getElementById('trendChart');
const chartCanvas = tempChartCanvas || trendChartCanvas;

const detailsElements = {
  tempHigh: document.getElementById('tempHigh'),
  tempHighValue: document.getElementById('tempHighValue'),
  humHigh: document.getElementById('humHigh'),
  humHighValue: document.getElementById('humHighValue'),
  tempAlert: document.getElementById('tempAlert'),
  humAlert: document.getElementById('humAlert'),
  currentTemp: document.getElementById('currentTemp'),
  currentHum: document.getElementById('currentHum'),
  recentGrid: document.getElementById('recentGrid'),
  timeBtns: document.querySelectorAll('.time-btn')
};

const isIndexPage = !!document.getElementById('stat-suhu');
const isDetailsPage = !!document.getElementById('trendChart');

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function toggleMenu() {
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
}

menuBtn?.addEventListener('click', toggleMenu);
overlay?.addEventListener('click', toggleMenu);

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    sidebar?.classList.remove('active');
    overlay?.classList.remove('active');
  }
});

async function loadThresholds() {
  try {
    const snapshot = await get(thresholdsRef);
    if (snapshot.exists()) {
      thresholds = snapshot.val();
      // Hapus properti admin_key dari objek thresholds agar tidak mengganggu tampilan
      delete thresholds.admin_key;
      console.log('Thresholds loaded:', thresholds);
    } else {
      // Inisialisasi default dengan menyertakan admin_key
      const defaultThresholds = {
        tempHigh: 35,
        humHigh: 80,
        admin_key: WEB_ADMIN_456
      };
      await set(thresholdsRef, defaultThresholds);
      thresholds = { tempHigh: 35, humHigh: 80 };
      console.log('Thresholds initialized with defaults');
    }
    updateThresholdDisplay();
  } catch (error) {
    console.error('Error loading thresholds:', error);
  }
}

function updateThresholdDisplay() {
  setText('threshold-temp', `${thresholds.tempHigh.toFixed(1)}°C`);
  setText('threshold-hum', `${thresholds.humHigh.toFixed(1)}%`);
  setText('threshold-temp-critical', `${(thresholds.tempHigh + 5).toFixed(1)}°C`);
  setText('threshold-hum-critical', `${(thresholds.humHigh + 5).toFixed(1)}%`);

  if (latestData) {
    if (isIndexPage) updateIndexStatus(latestData);
    if (isDetailsPage) updateDetailsAlerts();
  }
}

onValue(thresholdsRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    thresholds = data;
    updateThresholdDisplay();
  }
});

onValue(latestRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;
  latestData = data;

  const suhu = typeof data.suhu === 'number' ? data.suhu : parseFloat(data.suhu);
  const hum = typeof data.humidity === 'number' ? data.humidity : parseFloat(data.humidity);
  const ts = data.timestamp;
  const timeStr = ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  if (isIndexPage) {
    const statSuhu = document.getElementById('stat-suhu');
    const statHum = document.getElementById('stat-hum');
    if (statSuhu) statSuhu.innerHTML = `${suhu?.toFixed(1) ?? '--'}<span class="stat-unit">°C</span>`;
    if (statHum) statHum.innerHTML = `${hum?.toFixed(1) ?? '--'}<span class="stat-unit">%</span>`;
    const sensor1 = document.getElementById('sensor-val-1');
    const sensor2 = document.getElementById('sensor-val-2');
    const sensorTime1 = document.getElementById('sensor-time-1');
    const sensorTime2 = document.getElementById('sensor-time-2');
    if (sensor1) sensor1.innerText = `${suhu?.toFixed(1) ?? '--'}°C`;
    if (sensor2) sensor2.innerText = `${hum?.toFixed(1) ?? '--'}%`;
    if (sensorTime1) sensorTime1.innerText = timeStr;
    if (sensorTime2) sensorTime2.innerText = timeStr;
    updateIndexStatus({ suhu, humidity: hum });
  }

  if (isDetailsPage) {
    if (detailsElements.currentTemp) detailsElements.currentTemp.textContent = `${suhu?.toFixed(1) ?? '--'} °C`;
    if (detailsElements.currentHum) detailsElements.currentHum.textContent = `${hum?.toFixed(1) ?? '--'}%`;
    updateDetailsAlerts();
  }
});

function updateIndexStatus(data) {
  const suhu = typeof data.suhu === 'number' ? data.suhu : parseFloat(data.suhu);
  const hum = typeof data.humidity === 'number' ? data.humidity : parseFloat(data.humidity);
  const tempCritical = thresholds.tempHigh + 5;
  const humCritical = thresholds.humHigh + 5;
  const tempPercent = Math.min((suhu / thresholds.tempHigh) * 100, 100);
  const humPercent = Math.min((hum / thresholds.humHigh) * 100, 100);

  const tempProgress = document.getElementById('temp-progress');
  const humProgress = document.getElementById('hum-progress');
  if (tempProgress) {
    tempProgress.style.width = `${tempPercent}%`;
    tempProgress.style.background = suhu >= tempCritical ? '#ef4444' : (suhu >= thresholds.tempHigh ? '#f59e0b' : '#2563eb');
  }
  if (humProgress) {
    humProgress.style.width = `${humPercent}%`;
    humProgress.style.background = hum >= humCritical ? '#ef4444' : (hum >= thresholds.humHigh ? '#f59e0b' : '#10b981');
  }

  checkAlerts({ suhu, humidity: hum, timestamp: data.timestamp });
}

function checkAlerts(data) {
  const suhu = typeof data.suhu === 'number' ? data.suhu : parseFloat(data.suhu);
  const hum = typeof data.humidity === 'number' ? data.humidity : parseFloat(data.humidity);
  const ts = data.timestamp;
  const timeStr = ts ? new Date(ts).toLocaleTimeString('id-ID') : '--';
  const tempCritical = thresholds.tempHigh + 5;
  const humCritical = thresholds.humHigh + 5;
  let alertCount = 0;

  const tempBadge = document.getElementById('alert-temp-badge');
  const tempDesc = document.getElementById('alert-temp-desc');
  const tempTime = document.getElementById('alert-temp-time');
  const tempItem = document.getElementById('alert-temp-item');
  const humBadge = document.getElementById('alert-hum-badge');
  const humDesc = document.getElementById('alert-hum-desc');
  const humTime = document.getElementById('alert-hum-time');
  const humItem = document.getElementById('alert-hum-item');

  console.log('[checkAlerts]', {
    suhu,
    hum,
    tempHigh: thresholds.tempHigh,
    humHigh: thresholds.humHigh,
    hasTempItem: !!tempItem,
    hasHumItem: !!humItem,
    hasTempBadge: !!tempBadge,
    hasHumBadge: !!humBadge
  });

  if (!tempItem || !humItem || !tempBadge || !humBadge || !tempDesc || !tempTime || !humDesc || !humTime) {
    console.warn('[checkAlerts] Missing alert DOM elements', {
      tempItem, humItem, tempBadge, humBadge, tempDesc, tempTime, humDesc, humTime
    });
  }

  if (tempItem) tempItem.className = 'alert-item';
  if (humItem) humItem.className = 'alert-item';
  if (tempBadge) tempBadge.className = 'badge';
  if (humBadge) humBadge.className = 'badge';

  if (suhu >= tempCritical) {
    tempItem?.classList.add('critical');
    tempBadge?.classList.add('critical');
    if (tempBadge) tempBadge.innerText = 'Critical';
    if (tempDesc) tempDesc.innerText = `🔥 Melebihi batas kritis (${tempCritical.toFixed(1)}°C)`;
    if (tempTime) tempTime.innerText = timeStr;
    alertCount++;
  } else if (suhu >= thresholds.tempHigh) {
    tempItem?.classList.add('high');
    tempBadge?.classList.add('high');
    if (tempBadge) tempBadge.innerText = 'High';
    if (tempDesc) tempDesc.innerText = `⚠️ Melebihi batas normal (${thresholds.tempHigh.toFixed(1)}°C)`;
    if (tempTime) tempTime.innerText = timeStr;
    alertCount++;
  } else {
    tempItem?.classList.add('normal');
    tempBadge?.classList.add('normal');
    if (tempBadge) tempBadge.innerText = 'Normal';
    if (tempDesc) tempDesc.innerText = '✅ Dalam batas normal';
    if (tempTime) tempTime.innerText = 'Normal';
  }

  if (hum >= humCritical) {
    humItem?.classList.add('critical');
    humBadge?.classList.add('critical');
    if (humBadge) humBadge.innerText = 'Critical';
    if (humDesc) humDesc.innerText = `🔥 Melebihi batas kritis (${humCritical.toFixed(1)}%)`;
    if (humTime) humTime.innerText = timeStr;
    alertCount++;
  } else if (hum >= thresholds.humHigh) {
    humItem?.classList.add('high');
    humBadge?.classList.add('high');
    if (humBadge) humBadge.innerText = 'High';
    if (humDesc) humDesc.innerText = `⚠️ Melebihi batas normal (${thresholds.humHigh.toFixed(1)}%)`;
    if (humTime) humTime.innerText = timeStr;
    alertCount++;
  } else {
    humItem?.classList.add('normal');
    humBadge?.classList.add('normal');
    if (humBadge) humBadge.innerText = 'Normal';
    if (humDesc) humDesc.innerText = '✅ Dalam batas normal';
    if (humTime) humTime.innerText = 'Normal';
  }

  setText('stat-alerts', `${alertCount}`);
}

function updateDetailsAlerts() {
  if (!detailsElements.tempAlert || !detailsElements.humAlert || detailsElements.currentTemp === null || detailsElements.currentHum === null) {
    return;
  }

  const tempValue = parseFloat(detailsElements.currentTemp.textContent) || null;
  const humValue = parseFloat(detailsElements.currentHum.textContent) || null;
  const tempCritical = thresholds.tempHigh + 5;
  const humCritical = thresholds.humHigh + 5;

  if (tempValue !== null) {
    if (tempValue >= tempCritical) {
      detailsElements.tempAlert.innerHTML = `<div class="alert-simple critical"><span class="alert-message"><strong>Critical:</strong> Temperature <span class="alert-value">${tempValue.toFixed(1)}°C</span> exceeds critical limit (${tempCritical.toFixed(1)}°C)</span></div>`;
    } else if (tempValue >= thresholds.tempHigh) {
      detailsElements.tempAlert.innerHTML = `<div class="alert-simple high"><span class="alert-message"><strong>High Alert:</strong> Temperature <span class="alert-value">${tempValue.toFixed(1)}°C</span> exceeds limit (${thresholds.tempHigh.toFixed(1)}°C)</span></div>`;
    } else {
      detailsElements.tempAlert.innerHTML = `<div class="alert-simple normal"><span class="alert-message"><strong>Normal:</strong> Temperature within limit</span></div>`;
    }
  }

  if (humValue !== null) {
    if (humValue >= humCritical) {
      detailsElements.humAlert.innerHTML = `<div class="alert-simple critical"><span class="alert-message"><strong>Critical:</strong> Humidity <span class="alert-value">${humValue.toFixed(1)}%</span> exceeds critical limit (${humCritical.toFixed(1)}%)</span></div>`;
    } else if (humValue >= thresholds.humHigh) {
      detailsElements.humAlert.innerHTML = `<div class="alert-simple high"><span class="alert-message"><strong>High Alert:</strong> Humidity <span class="alert-value">${humValue.toFixed(1)}%</span> exceeds limit (${thresholds.humHigh.toFixed(1)}%)</span></div>`;
    } else {
      detailsElements.humAlert.innerHTML = `<div class="alert-simple normal"><span class="alert-message"><strong>Normal:</strong> Humidity within limit</span></div>`;
    }
  }
}

async function loadHistory(range = '1h') {
  if (!chartCanvas) return;

  const historyRef = collection(firestore, 'sensor_history');
  const now = new Date();
  let startTime;

  if (range === '1h') {
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (range === '6h') {
    startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  } else if (range === '24h') {
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else {
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const q = query(historyRef, orderBy('timestamp', 'desc'), limit(500));
  let querySnapshot;

  try {
    querySnapshot = await getDocs(q);
  } catch (error) {
    console.error('Error loading history:', error);
    if (chartLastUpdateEl) chartLastUpdateEl.textContent = 'Gagal memuat data';
    if (chartInstance) chartInstance.destroy();
    return;
  }

  const data = [];
  querySnapshot.forEach(doc => {
    const d = doc.data();
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
    if (ts >= startTime) {
      data.push({ timestamp: ts, suhu: d.suhu, humidity: d.humidity });
    }
  });

  data.sort((a, b) => a.timestamp - b.timestamp);

  let sampledData;
  if (range === '1h') {
    sampledData = data.slice(-60);
  } else if (range === '6h') {
    sampledData = samplingPerJam(data, 6);
  } else if (range === '24h') {
    sampledData = samplingPerJam(data, 24);
  } else {
    sampledData = samplingPerHari(data, 7);
  }

  if (!sampledData || sampledData.length === 0) {
    if (chartInstance) chartInstance.destroy();
    if (chartLastUpdateEl) chartLastUpdateEl.textContent = 'Tidak ada data baru ditemukan!';
    return;
  }

  updateChart(sampledData, range);
  if (chartLastUpdateEl) chartLastUpdateEl.textContent = `Data terakhir: ${now.toLocaleString('id-ID')}`;
}

function samplingPerJam(data, maxPoints = 24) {
  const hourlyMap = new Map();
  data.forEach(item => {
    const date = new Date(item.timestamp);
    const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    hourlyMap.set(hourKey, item);
  });
  const hourlyArray = Array.from(hourlyMap.values());
  hourlyArray.sort((a, b) => a.timestamp - b.timestamp);
  return hourlyArray.slice(-maxPoints);
}

function samplingPerHari(data, maxPoints = 7) {
  const dailyMap = new Map();
  data.forEach(item => {
    const date = new Date(item.timestamp);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    dailyMap.set(dayKey, item);
  });
  const dailyArray = Array.from(dailyMap.values());
  dailyArray.sort((a, b) => a.timestamp - b.timestamp);
  return dailyArray.slice(-maxPoints);
}

function updateChart(data, range) {
  if (!chartCanvas) return;
  const labels = data.map(row => {
    const time = new Date(row.timestamp);
    if (range === '1h' || range === '6h' || range === '24h') {
      return time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return time.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
  });

  const temps = data.map(row => parseFloat(row.suhu || row.temperature));
  const hums = data.map(row => parseFloat(row.humidity));

  if (temps.length > 0) {
    const avg = temps.reduce((sum, value) => sum + value, 0) / temps.length;
    const statAvg = document.getElementById('stat-avg');
    if (statAvg) statAvg.innerHTML = `${avg.toFixed(1)}<span class="stat-unit">°C</span>`;
  }

  if (chartInstance) chartInstance.destroy();

  const ctx = chartCanvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: temps,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.1)',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Humidity (%)',
          data: hums,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Temperature (°C)' },
          grid: { color: '#e8edf2' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Humidity (%)' },
          grid: { drawOnChartArea: false },
          min: 0,
          max: 100
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            maxTicksLimit: 12
          }
        }
      }
    }
  });
}

if (detailsElements.tempHigh) {
  detailsElements.tempHigh.addEventListener('input', (event) => {
    thresholds.tempHigh = parseFloat(event.target.value);
    detailsElements.tempHighValue.textContent = thresholds.tempHigh.toFixed(1);
    set(thresholdsRef, {
      tempHigh: thresholds.tempHigh,
      humHigh: thresholds.humHigh,
      admin_key: ADMIN_KEY
    });
    updateThresholdDisplay();
    updateDetailsAlerts();
  });
}

if (detailsElements.humHigh) {
  detailsElements.humHigh.addEventListener('input', (event) => {
    thresholds.humHigh = parseFloat(event.target.value);
    detailsElements.humHighValue.textContent = thresholds.humHigh.toFixed(1);
    set(thresholdsRef, {
      tempHigh: thresholds.tempHigh,
      humHigh: thresholds.humHigh,
      admin_key: ADMIN_KEY
    });
    updateThresholdDisplay();
    updateDetailsAlerts();
  });
}

async function loadRecentReadings() {
  if (!detailsElements.recentGrid) return;

  try {
    const historyRef = collection(firestore, 'sensor_history');
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(4));
    const snapshot = await getDocs(q);
    const recent = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      recent.push({
        time: ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        temp: d.suhu,
        hum: d.humidity
      });
    });

    if (recent.length === 0) {
      detailsElements.recentGrid.innerHTML = '<div class="recent-item">Tidak ada data terbaru</div>';
      return;
    }

    detailsElements.recentGrid.innerHTML = recent.map(item => `
      <div class="recent-item">
        <div class="recent-time">${item.time}</div>
        <div class="recent-temp">${item.temp.toFixed(1)}°C</div>
        <div class="recent-hum">${item.hum.toFixed(1)}%</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading recent readings:', error);
    detailsElements.recentGrid.innerHTML = '<div class="recent-item">Gagal memuat data</div>';
  }
}

function setupDetailsTimeButtons() {
  if (!detailsElements.timeBtns?.length) return;
  detailsElements.timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      detailsElements.timeBtns.forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      loadHistory(btn.dataset.range);
    });
  });
}

loadThresholds();

if (isIndexPage) {
  loadHistory('1h');
  setInterval(() => loadHistory('1h'), 300000);
}

if (isDetailsPage) {
  setupDetailsTimeButtons();
  loadHistory('24h');
  loadRecentReadings();
  setInterval(() => {
    const activeBtn = Array.from(detailsElements.timeBtns).find(btn => btn.classList.contains('active'));
    const range = activeBtn?.dataset.range || '24h';
    loadHistory(range);
    loadRecentReadings();
  }, 300000);
}
