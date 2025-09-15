
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