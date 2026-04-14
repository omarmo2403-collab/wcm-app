// === MOCK DATA === //

const events = [
  { id: 1, day: "12", month: "Apr", title: "Wembley Stadium Event Day", desc: "Parking and traffic disruptions expected around the Masjid area. Please plan ahead.", time: "All Day", weekday: "Sunday" },
  { id: 2, day: "14", month: "Apr", title: "Wembley Stadium Event Day", desc: "Expect increased traffic on Ealing Road. Consider public transport.", time: "All Day", weekday: "Tuesday" },
  { id: 3, day: "18", month: "Apr", title: "Community Iftar Gathering", desc: "Join us for a community gathering and iftar at the Masjid hall. All welcome.", time: "6:30 PM", weekday: "Saturday" },
  { id: 4, day: "25", month: "Apr", title: "Islamic History Lecture", desc: "A talk on the history of Islam in Britain by Shaykh Abdullah. Open to all.", time: "After Maghrib", weekday: "Saturday" },
  { id: 5, day: "26", month: "Apr", title: "Youth Workshop", desc: "Interactive workshop for young Muslims aged 13-18. Topics include identity, faith and community.", time: "2:00 PM - 5:00 PM", weekday: "Sunday" },
  { id: 6, day: "10", month: "May", title: "Madrasah Open Day", desc: "Parents and prospective students are welcome to visit our Madrasah classes.", time: "10:00 AM - 1:00 PM", weekday: "Sunday" },
  { id: 7, day: "16", month: "May", title: "Fundraising Dinner", desc: "Annual fundraising dinner to support the Masjid's running costs and development projects.", time: "7:00 PM", weekday: "Saturday" },
];

const news = [
  { id: 1, title: "Ramadan 2026 Timetable Now Available", desc: "Download the full Ramadan timetable from the Masjid office or check the prayer times section for daily updates.", date: "25 Mar 2026" },
  { id: 2, title: "New Madrasah Term Starting", desc: "Enrolment is now open for the new Madrasah term beginning in April. Spaces are limited, so register early.", date: "20 Mar 2026" },
  { id: 3, title: "Masjid Renovation Update", desc: "Phase 2 of the wudu area renovation is now complete. We thank all donors for their generous contributions.", date: "15 Mar 2026" },
  { id: 4, title: "Sponsor Your Masjid Campaign", desc: "We are looking for 1,000 sponsors at just 30p a day to help cover the Masjid's annual running costs.", date: "10 Mar 2026" },
];

const donateDetails = {
  zakaat: { title: "Zakaat", icon: "fa-balance-scale", desc: "Zakaat is one of the five pillars of Islam. It is obligatory for every Muslim who meets the criteria of nisab. Your Zakaat is distributed to those in need within the community." },
  sadaqah: { title: "Sadaqah", icon: "fa-heart", desc: "Sadaqah is voluntary charity given for the sake of Allah. Any amount, big or small, makes a difference. All Sadaqah is used to benefit the local community." },
  sponsor: { title: "Sponsor the Masjid", icon: "fa-star", desc: "For just 30p a day (approximately £100 per year), you can become one of 1,000 sponsors helping to cover the Masjid's annual running costs including utilities, maintenance and staffing." },
  general: { title: "General Donation", icon: "fa-mosque", desc: "General donations go towards the day-to-day running of the Masjid, maintenance, utility bills and community programmes." },
};

// === NAVIGATION === //

let currentScreen = 'home';
let screenHistory = [];

function showScreen(name) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  // Show target
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');

  // Update tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.tab[data-tab="${name}"]`);
  if (tab) tab.classList.add('active');

  // Reset header
  document.getElementById('headerBack').style.display = 'none';
  document.getElementById('headerLogo').style.display = '';
  var logoText = document.getElementById('headerLogoText');
  if (logoText) logoText.style.display = '';
  document.getElementById('headerText').style.display = 'none';

  currentScreen = name;
  screenHistory = [];

  // Scroll to top
  document.getElementById('screenContainer').scrollTop = 0;
}

function showSubScreen(name, param) {
  screenHistory.push(currentScreen);

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');

  // Show back button, hide logos, show text
  document.getElementById('headerBack').style.display = 'flex';
  document.getElementById('headerLogo').style.display = 'none';
  var logoText = document.getElementById('headerLogoText');
  if (logoText) logoText.style.display = 'none';
  document.getElementById('headerText').style.display = '';

  // Set header title
  const titles = {
    'about': 'About',
    'news': 'News',
    'ask-scholar': 'Ask the Scholar',
    'qibla': 'Qibla',
    'contact': 'Contact Us',
    'services': 'Services',
    'tour': 'Virtual Tour',
    'notifications': 'Notifications',
    'stadium': 'Stadium Event Days',
    'donate-detail': 'Donate',
  };
  document.getElementById('headerText').textContent = titles[name] || '';

  // Handle donate detail
  if (name === 'donate-detail' && param && donateDetails[param]) {
    const d = donateDetails[param];
    document.getElementById('donateDetailTitle').textContent = d.title;
    document.getElementById('donateDetailDesc').textContent = d.desc;
    document.getElementById('headerText').textContent = d.title;
    // Reset amount selection
    document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('customAmount').value = '';
  }

  currentScreen = name;
  document.getElementById('screenContainer').scrollTop = 0;
}

function goBack() {
  const prev = screenHistory.pop();
  if (prev) {
    showScreen(prev);
  } else {
    showScreen('home');
  }
}

// === RENDER FUNCTIONS === //

function renderEvents() {
  const container = document.getElementById('eventsList');
  container.innerHTML = events.map(e => `
    <div class="event-card">
      <div class="event-card-top">
        <div class="event-date-box">
          <div class="day">${e.day}</div>
          <div class="month">${e.month}</div>
        </div>
        <div class="event-info">
          <h3>${e.title}</h3>
          <p>${e.desc}</p>
          <div class="event-time"><i class="fas fa-clock"></i> ${e.weekday} | ${e.time}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderNews() {
  const container = document.getElementById('newsList');
  container.innerHTML = news.map(n => `
    <div class="news-card">
      <h3>${n.title}</h3>
      <p>${n.desc}</p>
      <div class="news-date">${n.date}</div>
    </div>
  `).join('');
}

// === DONATE INTERACTIONS === //

function selectAmount(btn, amount) {
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('customAmount').value = amount;
}

// Frequency buttons
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('freq-btn')) {
    document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// === ASK SCHOLAR FORM === //

function submitScholarForm(e) {
  e.preventDefault();
  showToast('Question submitted successfully!');
  e.target.reset();
}

// === TOAST === //

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.querySelector('.phone-frame').appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// === STATUS BAR TIME === //

function updateStatusTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const period = h >= 12 ? '' : '';
  document.getElementById('statusTime').textContent = `${h % 12 || 12}:${m}`;
}

// === BANNERS === //

function initBanners() {
  const track = document.getElementById('bannersTrack');
  const dotsContainer = document.getElementById('bannerDots');
  const slides = track.querySelectorAll('.banner-slide');
  const count = slides.length;

  // Create dots
  dotsContainer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'banner-dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => {
      slides[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    };
    dotsContainer.appendChild(dot);
  }

  // Update dots on scroll
  track.addEventListener('scroll', () => {
    const scrollLeft = track.scrollLeft;
    const slideWidth = slides[0].offsetWidth + 12;
    const index = Math.round(scrollLeft / slideWidth);
    dotsContainer.querySelectorAll('.banner-dot').forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
  });

  // Auto-scroll every 4 seconds (scroll the track only, not the page)
  let current = 0;
  setInterval(() => {
    current = (current + 1) % count;
    const slideWidth = slides[0].offsetWidth + 12;
    track.scrollTo({ left: slideWidth * current, behavior: 'smooth' });
  }, 4000);
}

// === INIT === //

function init() {
  renderEvents();
  renderNews();
  updateStatusTime();
  setInterval(updateStatusTime, 60000);
  initBanners();
}

init();
