// Configuration
const CONFIG = {
    API_KEY: 'DEMO_KEY',
    FLR_ENDPOINT: 'https://api.nasa.gov/DONKI/FLR',
    UPDATE_INTERVAL: 60000 * 5 // 5 minutes
};

// DOM Elements
const elements = {
    clock: document.getElementById('clock'),
    eventsList: document.getElementById('events-list'),
    threatText: document.getElementById('threat-text'),
    threatClass: document.getElementById('threat-class'),
    marqueeText: document.getElementById('marquee-text'),
    simBtn: document.getElementById('sim-btn'),
    body: document.body
};

// Audio Context (Synthesized Alarm)
let audioCtx = null;
let alarmInterval = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playAlarmBeep() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square';
    // Sirens usually alternate frequencies
    const time = audioCtx.currentTime;
    osc.frequency.setValueAtTime(600, time);
    osc.frequency.exponentialRampToValueAtTime(1000, time + 0.5);
    
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.3, time + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.8);
}

function startAlarm() {
    initAudio();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    // Play one beep immediately, then loop
    playAlarmBeep();
    if (!alarmInterval) {
        alarmInterval = setInterval(playAlarmBeep, 1000);
    }
}

function stopAlarm() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

// Clock
function updateClock() {
    const now = new Date();
    elements.clock.textContent = now.toISOString().split('T')[1].split('.')[0] + ' UTC';
}
setInterval(updateClock, 1000);
updateClock();

// Data Fetching
async function fetchSolarFlares() {
    try {
        const today = new Date();
        const pastWeek = new Date();
        pastWeek.setDate(today.getDate() - 7);
        
        const startStr = pastWeek.toISOString().split('T')[0];
        const endStr = today.toISOString().split('T')[0];
        
        const res = await fetch(`${CONFIG.FLR_ENDPOINT}?startDate=${startStr}&endDate=${endStr}&api_key=${CONFIG.API_KEY}`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        renderEvents(data);
        evaluateThreat(data);
    } catch (e) {
        console.error('Fetch error:', e);
        elements.eventsList.innerHTML = `<div class="loading-state"><p style="color:var(--color-critical)">BAĞLANTI BAŞARISIZ OLDU. TEKRAR DENENİYOR...</p></div>`;
    }
}

// Parsing & Rendering
function parseClass(classType) {
    if (!classType) return 'normal';
    if (classType.startsWith('X')) return 'x-class';
    if (classType.startsWith('M')) return 'm-class';
    return 'normal';
}

function renderEvents(events) {
    elements.eventsList.innerHTML = '';
    
    if (!events || events.length === 0) {
        elements.eventsList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Yakın zamanda etkinlik bulunamadı.</p>';
        return;
    }

    // Reverse to show latest first
    events.reverse().slice(0, 10).forEach(ev => {
        const cType = parseClass(ev.classType);
        const card = document.createElement('div');
        card.className = `event-card ${cType}`;
        card.innerHTML = `
            <div class="event-header">
                <span class="event-id">${ev.flrID}</span>
                <span class="event-time">${ev.beginTime.split('T').join(' ').split('Z')[0]}</span>
            </div>
            <div class="event-body">
                Sınıf <strong>${ev.classType}</strong> Patlama tespit edildi. 
                Kaynak: AR ${ev.activeRegionNum || 'Bilinmiyor'}
            </div>
        `;
        elements.eventsList.appendChild(card);
    });
}

function setSystemState(level, text, subtext, marquee) {
    elements.threatText.textContent = text;
    elements.threatClass.textContent = subtext;
    elements.marqueeText.textContent = marquee;
    
    // Clear themes
    elements.body.className = '';
    
    if (level === 'KRİTİK') {
        elements.body.classList.add('theme-critical');
        startAlarm();
    } else if (level === 'DİKKAT') {
        elements.body.classList.add('theme-elevate'); // Optional amber theme
        stopAlarm();
    } else {
        elements.body.classList.add('theme-normal');
        stopAlarm();
    }
}

function evaluateThreat(events) {
    if (elements.body.dataset.simulating === 'true') return; // Do not override sim
    
    if (!events || events.length === 0) {
        setSystemState('NORMAL', 'NORMAL', 'Sınıf A-C', 'Önemli bir güneş aktivitesi tespit edilmedi. Uzay aracı operasyonları sorunsuz.');
        return;
    }
    
    // Check highest in the last 48 hours for active threat
    let highest = 'C';
    let maxVal = 0;
    
    events.forEach(ev => {
        const letter = ev.classType.charAt(0);
        const val = parseFloat(ev.classType.substring(1));
        
        let score = 0;
        if (letter === 'C') score = 10 + val;
        if (letter === 'M') score = 100 + val;
        if (letter === 'X') score = 1000 + val;
        
        if (score > maxVal) {
            maxVal = score;
            highest = letter;
        }
    });

    if (highest === 'X') {
        setSystemState('KRİTİK', 'KRİTİK', 'Sınıf X', 'UYARI: BÜYÜK X-SINIFI GÜNEŞ PATLAMASI TESPİT EDİLDİ. EVA ASTRONOTLARI İÇİN ACİL SIĞINAK GEREKİYOR. YAYGIN RADYO KESİNTİLERİ BEKLENİYOR.');
    } else if (highest === 'M') {
        setSystemState('DİKKAT', 'DİKKAT', 'Sınıf M', 'Uyarı: Orta Düzey M-Sınıfı Patlama tespit edildi. Küçük bir radyasyon fırtınası bekleniyor. İletişimi izleyin.');
    } else {
        setSystemState('NORMAL', 'NORMAL', 'Sınıf A-C', 'Önemli bir güneş tehlikesi yok. Küçük aktiviteler tespit edildi ancak yörünge varlıkları için tehdit oluşturmuyor.');
    }
}

// Simulation Override
elements.simBtn.addEventListener('click', () => {
    initAudio(); // Required for browsers to allow audio on click
    
    const isSimulating = elements.body.dataset.simulating === 'true';
    if (isSimulating) {
        // Stop sim
        elements.body.dataset.simulating = 'false';
        elements.simBtn.textContent = 'SİMÜLASYONU BAŞLAT';
        elements.simBtn.classList.remove('active');
        fetchSolarFlares(); // Reload real data
    } else {
        // Start sim
        elements.body.dataset.simulating = 'true';
        elements.simBtn.innerHTML = 'SİMÜLASYONU DURDUR';
        elements.simBtn.classList.add('active');
        
        // Inject fake X-Class event
        const simCardsHtml = `
            <div class="event-card x-class" style="animation: pulse 1s infinite alternate">
                <div class="event-header">
                    <span class="event-id">SIM-X5.2-OLAYI</span>
                    <span class="event-time">AZ ÖNCE</span>
                </div>
                <div class="event-body">
                    Sınıf <strong style="color:var(--color-critical)">X5.2</strong> Patlama tespit edildi. 
                    Kaynak: AR 3615
                </div>
            </div>
        ` + elements.eventsList.innerHTML;
        
        elements.eventsList.innerHTML = simCardsHtml;
        setSystemState('KRİTİK', 'KRİTİK', 'Sınıf X5.2', 'SİMÜLASYON: GELEN KKA VE AŞIRI RADYASYON FIRTINASI. HERKES EVA\'YI TERK ETSİN. 8 DAKİKA İÇİNDE ETKİYE HAZIR OLUN.');
    }
});

// Boot sequence
fetchSolarFlares();
// Refresh every 5 min
setInterval(() => {
    if (elements.body.dataset.simulating !== 'true') {
        fetchSolarFlares();
    }
}, CONFIG.UPDATE_INTERVAL);
