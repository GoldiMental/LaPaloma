// /LaPaloma/scripts.js
(() => {
  // ===== Helpers =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ROUTES = ['#home', '#about', '#menu', '#bundesliga-feed', '#gallery', '#contact'];

  // Alle Routen-Sections ermitteln
  const sections = {};
  function collectSections() {
    ROUTES.forEach(hash => {
      const el = $(hash);
      if (el) sections[hash] = el;
    });
  }

  // Sichtbarkeit steuern (SPA, ohne Scrolling)
  function showRoute(hash, { push = true } = {}) {
    if (!sections[hash]) hash = '#home'; // Fallback
    Object.entries(sections).forEach(([key, el]) => {
      const active = key === hash;
      el.style.display = active ? '' : 'none';
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    // aktiven Link markieren
    $$('header nav a[href^="#"]').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });

    // URL aktualisieren (ohne Scroll)
    if (push) history.pushState({ hash }, '', hash);

    // an den Anfang setzen (ohne smooth, ohne Sprung)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  // Nav-Klicks abfangen
  function setupNav() {
    $$('header nav a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        e.preventDefault();
        showRoute(href, { push: true });
      });
    });

    // Back/Forward
    window.addEventListener('popstate', (e) => {
      const hash = (e.state && e.state.hash) || location.hash || '#home';
      showRoute(hash, { push: false });
    });
  }

  // Kleiner UX-Touch: Header-Schatten beim Scroll
  function setupHeaderShadow() {
    const header = $('header');
    if (!header) return;
    const toggle = () => {
      if (window.scrollY > 5) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
  }

  // ===== Bundesliga Feed =====
  async function loadBundesliga() {
    const status = $('#bl-status');
    const list = $('#bl-list');
    if (!status || !list) return;

    try {
      status.textContent = 'Lade Daten …';

      // Saison grob bestimmen (Start ~ Juli/August)
      const now = new Date();
      const seasonYear = (now.getMonth() >= 6) ? now.getFullYear() : now.getFullYear() - 1;

      // aktuellen Spieltag holen
      const groupRes = await fetch('https://api.openligadb.de/getcurrentgroup/bl1');
      const group = await groupRes.json().catch(() => null);
      const matchday = Number(group?.groupOrderID ?? group?.GroupOrderID ?? group?.groupOrderId) || undefined;

      const url = matchday
        ? `https://api.openligadb.de/getmatchdata/bl1/${seasonYear}/${matchday}`
        : `https://api.openligadb.de/getmatchdata/bl1/${seasonYear}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!Array.isArray(data) || !data.length) {
        status.textContent = 'Keine Daten gefunden – zeige Beispiel.';
        return;
      }

      list.innerHTML = '';

      // sortieren nach Anstoß
      data.sort((a, b) =>
        new Date(a.MatchDateTimeUTC || a.matchDateTimeUTC || a.MatchDateTime) -
        new Date(b.MatchDateTimeUTC || b.matchDateTimeUTC || b.MatchDateTime)
      );

      const badge = (text, cls) => `<span class="${cls} bl-badge">${text}</span>`;
      const day = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

      for (const m of data) {
        const t1 = m.Team1?.TeamName || m.team1?.teamName || 'Team 1';
        const t2 = m.Team2?.TeamName || m.team2?.teamName || 'Team 2';

        const startUTC = m.MatchDateTimeUTC || m.matchDateTimeUTC || m.MatchDateTime;
        const dt = startUTC ? new Date(startUTC) : null;
        const timeText = dt ? `${day[dt.getDay()]}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';

        const finished = !!(m.MatchIsFinished ?? m.matchIsFinished);
        const live = !finished && dt && (Date.now() >= dt.getTime());

        // Ergebnis
        let score = '-:-';
        const results = Array.isArray(m.MatchResults) ? m.MatchResults : (Array.isArray(m.matchResults) ? m.matchResults : null);
        if (results && results.length) {
          const r = results[results.length - 1];
          const g1 = r.PointsTeam1 ?? r.pointsTeam1;
          const g2 = r.PointsTeam2 ?? r.pointsTeam2;
          if (Number.isFinite(g1) && Number.isFinite(g2)) score = `${g1}:${g2}`;
        }

        let statusBadge = '';
        if (finished) statusBadge = badge('Endstand', 'bl-finished');
        else if (live) statusBadge = badge('LIVE', 'bl-live');
        else if (dt) {
          const mins = Math.max(0, Math.round((dt.getTime() - Date.now()) / 60000));
          statusBadge = badge(`In Kürze • ${mins} Min`, 'bl-soon');
        }

        const li = document.createElement('li');
        li.className = 'bl-item';
        li.innerHTML = `
          <div class="bl-time">${timeText}</div>
          <div class="bl-teams">
            <div class="bl-name">
              <span>${t1}</span>
              <span>${t2}</span>
            </div>
            <div>${statusBadge}</div>
          </div>
          <div class="bl-score">${score}</div>
        `;
        list.appendChild(li);
      }

      status.textContent = `Aktualisiert: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      console.error(err);
      $('#bl-status').textContent = 'Konnte Live-Daten nicht laden – zeige Beispiel.';
      // Fallback: deine HTML-Dummy-Liste bleibt sichtbar
    }
  }

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', () => {
    collectSections();
    setupNav();
    setupHeaderShadow();

    // Initiale Route anzeigen (Hash oder Home)
    const startHash = location.hash && sections[location.hash] ? location.hash : '#home';
    // ersten State setzen, damit Back/Forward sauber läuft
    history.replaceState({ hash: startHash }, '', startHash);
    showRoute(startHash, { push: false });

    // Bundesliga einmal laden (Section existiert ja bereits)
    loadBundesliga();
  });
})();


(async function () {
    const FEED = document.getElementById('bl-list');
    const STATUS = document.getElementById('bl-status');

    // Helper: Datumsformat in Europe/Berlin
    const fmt = new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        weekday: 'short', hour: '2-digit', minute: '2-digit'
    });

    // "In Kürze" = innerhalb der nächsten 3 Stunden
    const SOON_MS = 3 * 60 * 60 * 1000;

    function formatCountdown(ms) {
        if (ms <= 0) return 'gleich';
        const totalMin = Math.round(ms / 60000);
        if (totalMin < 60) return `${totalMin} Min`;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h} Std ${m} Min`;
    }

    function statusLabel({ live, finished, started, start, now }) {
        if (live) return '<span class="bl-live bl-badge">LIVE</span>';
        if (finished) return '<span class="bl-finished bl-badge">Endstand</span>';
        if (!started) {
            const diff = start.getTime() - now;
            if (diff <= SOON_MS) {
                return `<span class="bl-soon bl-badge">In Kürze • ${formatCountdown(diff)}</span>`;
            }
            return `<span class="bl-muted">geplant</span>`;
        }
        return '<span class="bl-muted">läuft</span>';
    }

    async function fetchMatchesForCurrentMatchday() {
        const res = await fetch('https://api.openligadb.de/getmatchdata/bl1');
        if (!res.ok) throw new Error('Fehler beim Laden der Spieldaten');
        return res.json();
    }

    function render(matches) {
        FEED.innerHTML = '';
        const now = Date.now();

        // Sortierung: LIVE -> In Kürze -> Rest nach Startzeit -> Beendet
        matches.sort((a, b) => {
            const aStart = new Date(a.matchDateTimeUTC || a.matchDateTime).getTime();
            const bStart = new Date(b.matchDateTimeUTC || b.matchDateTime).getTime();

            const aLive = a.matchIsLive ? 1 : 0;
            const bLive = b.matchIsLive ? 1 : 0;
            if (bLive - aLive !== 0) return bLive - aLive;

            const aSoon = (aStart > now) && (aStart - now <= SOON_MS) ? 1 : 0;
            const bSoon = (bStart > now) && (bStart - now <= SOON_MS) ? 1 : 0;
            if (bSoon - aSoon !== 0) return bSoon - aSoon;

            const aFinished = a.matchIsFinished ? 1 : 0;
            const bFinished = b.matchIsFinished ? 1 : 0;
            if (aFinished !== bFinished) return aFinished - bFinished; // nicht beendet vor beendet

            return aStart - bStart;
        });

        matches.forEach(m => {
            const start = new Date(m.matchDateTimeUTC || m.matchDateTime);
            const started = start.getTime() <= now;
            const finished = !!m.matchIsFinished;
            const live = !!m.matchIsLive;

            const li = document.createElement('li');
            li.className = 'bl-item';

            const time = document.createElement('div');
            time.className = 'bl-time';
            time.textContent = fmt.format(start);

            const teams = document.createElement('div');
            teams.className = 'bl-teams';
            teams.innerHTML = `
        <div class="bl-name">
          <span>${m.team1?.teamName ?? 'Team A'}</span>
          <span>${m.team2?.teamName ?? 'Team B'}</span>
        </div>
        <div>${statusLabel({ live, finished, started, start, now: Date.now() })}</div>
      `;

            const score = document.createElement('div');
            score.className = 'bl-score';
            const results = m.matchResults || [];
            const endRes = results.find(r => r.resultTypeID === 2) || results[results.length - 1];
            score.textContent = endRes ? `${endRes.pointsTeam1 ?? '-'}:${endRes.pointsTeam2 ?? '-'}` : '-:-';

            li.appendChild(time);
            li.appendChild(teams);
            li.appendChild(score);
            FEED.appendChild(li);
        });

        STATUS.textContent = `Aktualisiert: ${new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}`;
    }

    async function refresh() {
        try {
            STATUS.textContent = 'Aktualisiere…';
            const matches = await fetchMatchesForCurrentMatchday();
            render(matches);
        } catch (e) {
            STATUS.textContent = 'Fehler beim Laden der Daten.';
            console.error(e);
        }
    }

    await refresh();
    // Kürzeres Intervall, damit der Countdown „In Kürze“ frischer wirkt
    setInterval(refresh, 30_000);
})();