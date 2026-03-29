document.addEventListener("DOMContentLoaded", () => {
    fetchSolarData();
    fetchSolarFlareCalendar();
});

async function fetchSolarData() {
    try {
        const response = await fetch('https://services.swpc.noaa.gov/json/solar_probabilities.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Sort to ensure the most recent is first
            data.sort((a, b) => new Date(b.date) - new Date(a.date));
            const latest = data[0];
            const nextDay = data[1] || data[0];
            const thirdDay = data[2] || data[0];
            
            updateDashboard(latest);
            updateTimeline([latest, nextDay, thirdDay]);
        }
    } catch (error) {
        console.error("Error fetching solar data:", error);
        document.getElementById('threat-level').textContent = "BAĞLANTI HATASI";
        document.getElementById('threat-message').textContent = "NOAA verileri alınamadı.";
        document.getElementById('status-hero').classList.remove('loading');
    }
}

function updateDashboard(data) {
    const cProb = data.c_class_1_day || 0;
    const mProb = data.m_class_1_day || 0;
    const xProb = data.x_class_1_day || 0;
    
    // Update Dials
    setDial('c', cProb);
    setDial('m', mProb);
    setDial('x', xProb);

    // Update Hero Status
    const heroCard = document.getElementById('status-hero');
    const threatLevel = document.getElementById('threat-level');
    const threatMsg = document.getElementById('threat-message');
    
    heroCard.classList.remove('loading', 'threat-safe', 'threat-moderate', 'threat-extreme');
    const xCard = document.getElementById('card-x');
    xCard.classList.remove('danger');
    
    // Threat logic mapping
    if (xProb >= 10 || mProb >= 50) {
        heroCard.classList.add('threat-extreme');
        threatLevel.textContent = "ŞİDDETLİ RİSK";
        threatMsg.textContent = `Büyük güneş patlaması ihtimali yüksek. X-Sınıfı riski: %${xProb}.`;
        xCard.classList.add('danger');
    } else if (mProb >= 15 || xProb >= 1) {
        heroCard.classList.add('threat-moderate');
        threatLevel.textContent = "ORTA RİSK";
        threatMsg.textContent = `Artan güneş aktivitesi tespit edildi. M-Sınıfı riski: %${mProb}.`;
    } else {
        heroCard.classList.add('threat-safe');
        threatLevel.textContent = "HER ŞEY NORMAL";
        threatMsg.textContent = "Güneş aktivitesinin düşük seyretmesi bekleniyor.";
    }
    
    const dateObj = new Date(data.date);
    document.getElementById('last-updated').textContent = dateObj.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setDial(type, value) {
    const card = document.getElementById(`card-${type}`);
    if (!card) return;
    
    const dial = card.querySelector('.dial');
    const text = document.getElementById(`prob-${type}`);
    
    let current = 0;
    const target = parseInt(value, 10);
    
    if(target === 0) {
        dial.style.setProperty('--percentage', `0%`);
        text.textContent = '0%';
        return;
    }

    const duration = 1500;
    const stepTime = Math.abs(Math.floor(duration / target));
    
    const timer = setInterval(() => {
        current += 1;
        dial.style.setProperty('--percentage', `${current}%`);
        text.textContent = `${current}%`;
        if (current >= target) {
            clearInterval(timer);
        }
    }, stepTime);
}

function updateTimeline(daysData) {
    const container = document.getElementById('forecast-container');
    container.innerHTML = ''; 

    daysData.forEach((day, index) => {
        if(!day) return;
        
        const dateObj = new Date(day.date);
        
        // Relative date logic
        let dateLabel = "Bugün";
        if(index === 1) {
            dateLabel = "Yarın";
        } else if(index === 2) {
            dateLabel = dateObj.toLocaleDateString('tr-TR', {weekday: 'long'});
        }
        
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        row.innerHTML = `
            <div class="timeline-date">${dateLabel}</div>
            <div class="timeline-bars">
                <div class="bar-wrapper">
                    <span class="bar-label m">M</span>
                    <div class="bar-container">
                        <div class="bar-fill m" style="width: 0%" data-target="${day.m_class_1_day || 0}%"></div>
                    </div>
                    <span class="bar-value">%${day.m_class_1_day || 0}</span>
                </div>
                <div class="bar-wrapper">
                    <span class="bar-label x">X</span>
                    <div class="bar-container">
                        <div class="bar-fill x" style="width: 0%" data-target="${day.x_class_1_day || 0}%"></div>
                    </div>
                    <span class="bar-value">%${day.x_class_1_day || 0}</span>
                </div>
            </div>
        `;
        container.appendChild(row);
    });

    // Animate bars after a short delay for smooth UI enter
    setTimeout(() => {
        const fills = document.querySelectorAll('.bar-fill');
        fills.forEach(fill => {
            fill.style.width = fill.getAttribute('data-target');
        });
    }, 150);
}

async function fetchSolarFlareCalendar() {
    const container = document.getElementById('calendar-container');
    try {
        // Fetch last 60 days of flares to ensure we have data
        const endDate = new Date().toISOString().split('T')[0];
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - 60);
        const startDate = startDateObj.toISOString().split('T')[0];
        
        const response = await fetch(`https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=DEMO_KEY`);
        
        if (!response.ok) {
            throw new Error(`NASA API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Sort by latest first
            data.sort((a, b) => new Date(b.beginTime) - new Date(a.beginTime));
            
            container.innerHTML = '';
            
            data.forEach(flare => {
                const dateObj = new Date(flare.beginTime);
                const dateStr = dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const classTitle = flare.classType || 'Bilinmiyor';
                const region = flare.activeRegionNum ? `Bölge: ${flare.activeRegionNum}` : 'Bölge Bilinmiyor';
                
                let cssClass = 'class-c';
                if(classTitle.startsWith('X')) cssClass = 'class-x';
                else if(classTitle.startsWith('M')) cssClass = 'class-m';
                
                const item = document.createElement('div');
                item.className = `calendar-item ${cssClass}`;
                item.innerHTML = `
                    <div class="cal-class">${classTitle}</div>
                    <div class="cal-details">
                        <div class="cal-date">${dateStr}</div>
                        <div class="cal-region">${region}</div>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<p class="loading-calendar">Son 60 günde önemli bir güneş patlaması kaydedilmedi.</p>';
        }
        
    } catch (error) {
        console.error("Error fetching NASA data:", error);
        container.innerHTML = '<p class="loading-calendar" style="color: #ef4444;">Takvim verileri alınamadı (NASA API Hatası).</p>';
    }
}
