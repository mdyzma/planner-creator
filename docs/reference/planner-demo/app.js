/**
 * TERAPEUTYCZNY PLANNER A4 - SILNIK INTERAKTYWNY & WIZUALIZACJA STRUKTURY
 * Obsługa rozkładówek, Koła Życia (SVG), monitoringu HALT, bazy sentencji
 * oraz symulatora introligatorskich marginesów oprawy twardej.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. BAZA SENTENCJI DO NAGŁÓWKA (SENTENCJE AUTORSKIE, BEZ CYTATÓW Z CUDZYCH DZIEŁ)
  // =========================================================================
  const QUOTES_DATABASE = [
    {
      text: "„Prośba o pomoc nie jest porażką. To pierwszy krok, który robię razem z kimś, a nie przeciwko sobie.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Nie muszę dźwigać całego życia naraz. Wystarczy, że dziś zadbam o te jedne 24 godziny.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Dziś wybieram jedną małą rzecz, która mnie wzmacnia – i doprowadzam ją do końca.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Zanim zareaguję, mogę wziąć oddech. Ta krótka pauza należy tylko do mnie.”",
      author: "Sentencja autorska"
    },
    {
      text: "„To, co powiem na głos zaufanej osobie, przestaje rządzić mną w ukryciu.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Spokój nie przychodzi od razu. Buduję go z każdego dnia przeżytego świadomie.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Moja przeszłość nie jest wyrokiem. Może stać się doświadczeniem, które kiedyś pomoże komuś innemu.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Zmiana zaczyna się tam, gdzie przestaję walczyć ze sobą i zaczynam siebie rozumieć.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Trzeźwość na pierwszym miejscu – na niej stoi wszystko, na czym mi naprawdę zależy.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Przyjąć fakty nie znaczy się na nie zgadzać. Znaczy przestać tracić siły na to, czego nie zmienię.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Zdrowienie to droga pokonywana krokami, nie skokami. Spokojne tempo też prowadzi do celu.”",
      author: "Sentencja autorska"
    },
    {
      text: "„Stawiając granice, dbam jednocześnie o relację i o siebie.”",
      author: "Sentencja autorska"
    }
  ];

  let currentQuoteIndex = 1;

  // =========================================================================
  // 2. DEFINICJA KOŁA ŻYCIA (8 SFER ZDROWIENIA)
  // =========================================================================
  const WHEEL_SECTORS = [
    { id: 'health', name: 'Zdrowie fizyczne i sen', icon: '🏃', val: 7 },
    { id: 'emotions', name: 'Emocje i spokój umysłu', icon: '🧘', val: 6 },
    { id: 'sobriety', name: 'Trzeźwość i Krok 12', icon: '🛡️', val: 9 },
    { id: 'relations', name: 'Relacje i bliskość', icon: '🤝', val: 6 },
    { id: 'finances', name: 'Finanse i stabilność', icon: '💳', val: 7 },
    { id: 'work', name: 'Praca i obowiązki', icon: '💼', val: 7 },
    { id: 'growth', name: 'Rozwój i pasje', icon: '🌱', val: 5 },
    { id: 'rest', name: 'Regeneracja i odpoczynek', icon: '☕', val: 6 }
  ];

  // =========================================================================
  // 3. KOMENTARZE INTROLIGATORSKIE I TERAPEUTYCZNE DLA KAŻDEJ ZAKŁADKI
  // =========================================================================
  const RATIONALE_GUIDES = {
    'daily-page': '<strong>Układ dobowy pacjenta:</strong> Zmniejszony nagłówek z datą i dniem trzeźwości na lewej stronie dający maksymalną przestrzeń na swobodne refleksje z dnia (dot-grid). Na prawej stronie: Zasada 24H, 3 kluczowe kroki dnia, skala HALT (oceny 1–5), Plan Dnia co godzinę (07:00–18:00) oraz praktyka wdzięczności rozciągnięta na całą szerokość strony.',
    'weekly-spread': '<strong>Zewnętrzny margines i boks skupienia:</strong> W twardej oprawie A4 wewnętrzne 15-20 mm jest ukryte w szyciu. Cele tygodnia (maks. 3-4!) umieszczono wyłącznie na marginesie zewnętrznym, by pacjent miał do nich łatwy dostęp.',
    'monthly-spread': '<strong>Otwarcie miesiąca na rozkładówce:</strong> Siatka miesięczna rozciągnięta na lewą i prawą stronę sięga do połowy stron (Pn–Czw na lewej, Pt–Nd + fokus na prawej). W dolnej połowie: 3–4 główne cele miesiąca, ważne daty i rocznice oraz intencje emocjonalne.',
    'wheel-page': '<strong>Koło Życia (Koniec miesiąca):</strong> Wykres 8 sfer do zakolorowania. Pacjent widząc z miesiąca na miesiąc, jak koło robi się równiejsze, otrzymuje namacalny, graficzny dowód na to, że terapia i abstynencja działają.',
    'dot-grid-page': '<strong>Wolne karty (Dot Grid 5mm):</strong> Delikatna siatka kropkowa zamiast gładkiego papieru usuwa paraliżujący „strach przed czystą kartką”, ułatwiając rysowanie własnych tabel, wykresów lub notatek z mityngów.',
    'crisis-warning-signs': '<strong>Sygnały ostrzegawcze (2 strony):</strong> Profilaktyka nawrotu oparta na 4 sferach (Ciało, Myśli, Emocje, Zachowania). Pacjent uczy się wychwytywać nawrót na długo przed sięgnięciem po substancję.',
    'crisis-balance': '<strong>Bilans Zysków i Strat (4 ćwiartki CBT):</strong> Tabela krzyżowa konfrontująca iluzję głodu z bolesną prawdą. Kluczowa ćwiartka: uznanie, co substancja dawała (np. ucieczkę od stresu), aby znaleźć zdrowe zamienniki.',
    'crisis-sos': '<strong>Moja Sieć Wsparcia / Plan Awaryjny:</strong> Karta ratunkowa w momencie ostrego głodu nałogowego. Numery do Sponsora i Terapeuty oraz bezwzględna procedura 5 kroków ratunkowych (STOP, Reset fizyczny, Telefon, 24H, Mityng).'
  };

  // =========================================================================
  // 4. INICJALIZACJA ELEMENTÓW DOM
  // =========================================================================
  const navTabs = document.querySelectorAll('.nav-tab');
  const sectionViews = document.querySelectorAll('.section-view');
  const rationaleText = document.getElementById('rationaleText');

  const btnAutofill = document.getElementById('btnAutofill');
  const btnClearData = document.getElementById('btnClearData');
  const btnRandomQuote = document.getElementById('btnRandomQuote');
  const btnToggleMargins = document.getElementById('btnToggleMargins');
  const btnOverviewModal = document.getElementById('btnOverviewModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnPrint = document.getElementById('btnPrint');

  const viewSpreadBtn = document.getElementById('viewSpreadBtn');
  const viewSingleBtn = document.getElementById('viewSingleBtn');
  const bookWorkspace = document.getElementById('bookWorkspace');
  const structureModal = document.getElementById('structureModal');

  const dailyQuoteText = document.getElementById('dailyQuoteText');
  const dailyQuoteAuthor = document.getElementById('dailyQuoteAuthor');

  // =========================================================================
  // 5. NAWIGACJA PO SEKCJACH PLANNERA
  // =========================================================================
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      sectionViews.forEach(view => {
        if (view.id === `view-${targetId}`) {
          view.classList.add('active-view');
          view.style.display = 'block';
        } else {
          view.classList.remove('active-view');
          view.style.display = 'none';
        }
      });

      // Zaktualizuj komentarz rationale
      if (RATIONALE_GUIDES[targetId] && rationaleText) {
        rationaleText.innerHTML = RATIONALE_GUIDES[targetId];
      }

      // Jeśli wchodzimy na Koło Życia, odrysuj SVG
      if (targetId === 'wheel-page') {
        renderWheelOfLife();
      }
    });
  });

  // Ustawienie początkowego stanu widoków
  sectionViews.forEach((view, idx) => {
    if (idx === 0) {
      view.style.display = 'block';
    } else {
      view.style.display = 'none';
    }
  });

  // =========================================================================
  // 6. PRZEŁĄCZANIE TRYBÓW WIDOKU (ROZKŁADÓWKA VS POJEDYNCZA STRONA)
  // =========================================================================
  viewSpreadBtn.addEventListener('click', () => {
    viewSpreadBtn.classList.add('active');
    viewSingleBtn.classList.remove('active');
    bookWorkspace.classList.remove('single-page-mode');
  });

  viewSingleBtn.addEventListener('click', () => {
    viewSingleBtn.classList.add('active');
    viewSpreadBtn.classList.remove('active');
    bookWorkspace.classList.add('single-page-mode');
  });

  // Wskaźnik strefy szycia (15-20 mm marginesu wewnętrznego)
  let marginsVisible = false;
  btnToggleMargins.addEventListener('click', () => {
    marginsVisible = !marginsVisible;
    if (marginsVisible) {
      bookWorkspace.classList.add('show-margins');
      btnToggleMargins.classList.add('active');
    } else {
      bookWorkspace.classList.remove('show-margins');
      btnToggleMargins.classList.remove('active');
    }
  });

  // Modal architektury tomu
  btnOverviewModal.addEventListener('click', () => {
    structureModal.classList.add('open');
  });

  btnCloseModal.addEventListener('click', () => {
    structureModal.classList.remove('open');
  });

  structureModal.addEventListener('click', (e) => {
    if (e.target === structureModal) {
      structureModal.classList.remove('open');
    }
  });

  // Drukuj do PDF A4
  btnPrint.addEventListener('click', () => {
    window.print();
  });

  // =========================================================================
  // 7. ROTATOR SENTENCJI W NAGŁÓWKU
  // =========================================================================
  btnRandomQuote.addEventListener('click', () => {
    currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES_DATABASE.length;
    const q = QUOTES_DATABASE[currentQuoteIndex];
    if (dailyQuoteText && dailyQuoteAuthor) {
      dailyQuoteText.style.opacity = 0;
      setTimeout(() => {
        dailyQuoteText.innerText = q.text;
        dailyQuoteAuthor.innerText = q.author;
        dailyQuoteText.style.opacity = 1;
      }, 150);
    }
  });

  // =========================================================================
  // 8. OBSŁUGA SKALI HALT (KLIKALNE PRZYCISKI STANU)
  // =========================================================================
  const haltButtons = document.querySelectorAll('.halt-scale-btn');
  haltButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const parentCard = btn.closest('.halt-card');
      const buttonsInCard = parentCard.querySelectorAll('.halt-scale-btn');
      
      buttonsInCard.forEach(b => {
        b.classList.remove('selected-ok', 'selected-warn', 'selected-risk');
      });

      const val = btn.getAttribute('data-val');
      if (val === 'ok') btn.classList.add('selected-ok');
      else if (val === 'warn') btn.classList.add('selected-warn');
      else if (val === 'risk') btn.classList.add('selected-risk');
    });
  });

  // =========================================================================
  // 9. KOŁO ŻYCIA - SILNIK SVG & KONTROLKI SUWAKÓW
  // =========================================================================
  const wheelGridCircles = document.getElementById('wheelGridCircles');
  const wheelGridAxes = document.getElementById('wheelGridAxes');
  const wheelPolygon = document.getElementById('wheelPolygon');
  const wheelPolygonNodes = document.getElementById('wheelPolygonNodes');
  const wheelSlidersContainer = document.getElementById('wheelSlidersContainer');

  const centerX = 150;
  const centerY = 150;
  const maxRadius = 110;
  const numSectors = WHEEL_SECTORS.length;

  function initWheelSvgBackground() {
    if (!wheelGridCircles || !wheelGridAxes) return;

    // Rysowanie 10 koncentrycznych okręgów (skala 1-10)
    wheelGridCircles.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const r = (maxRadius / 10) * i;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', centerX);
      circle.setAttribute('cy', centerY);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', i === 10 ? '#94a3b8' : '#e2e8f0');
      circle.setAttribute('stroke-width', i === 10 ? '1.5' : '1');
      if (i % 2 === 0 && i !== 10) {
        circle.setAttribute('stroke-dasharray', '2,3');
      }
      wheelGridCircles.appendChild(circle);
    }

    // Rysowanie 8 osi dla każdej sfery
    wheelGridAxes.innerHTML = '';
    for (let i = 0; i < numSectors; i++) {
      const angle = (2 * Math.PI / numSectors) * i;
      const x2 = centerX + maxRadius * Math.cos(angle);
      const y2 = centerY + maxRadius * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', centerX);
      line.setAttribute('y1', centerY);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#cbd5e1');
      line.setAttribute('stroke-width', '1');
      wheelGridAxes.appendChild(line);
    }
  }

  function initWheelSliders() {
    if (!wheelSlidersContainer) return;
    wheelSlidersContainer.innerHTML = '';

    WHEEL_SECTORS.forEach((sec, idx) => {
      const item = document.createElement('div');
      item.className = 'sector-slider-item';

      item.innerHTML = `
        <label class="sector-slider-label" for="slider-${sec.id}">
          <span>${sec.icon}</span>
          <span>${sec.name}</span>
        </label>
        <input type="range" class="sector-slider-input" id="slider-${sec.id}" min="1" max="10" value="${sec.val}">
        <span class="sector-score-val" id="score-${sec.id}">${sec.val}</span>
      `;

      const slider = item.querySelector('input');
      const score = item.querySelector('.sector-score-val');

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        WHEEL_SECTORS[idx].val = val;
        score.innerText = val;
        renderWheelPolygon();
      });

      wheelSlidersContainer.appendChild(item);
    });
  }

  function renderWheelPolygon() {
    if (!wheelPolygon || !wheelPolygonNodes) return;

    const points = [];
    wheelPolygonNodes.innerHTML = '';

    for (let i = 0; i < numSectors; i++) {
      const angle = (2 * Math.PI / numSectors) * i;
      const r = (maxRadius / 10) * WHEEL_SECTORS[i].val;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      points.push(`${x},${y}`);

      // Kropka węzła
      const nodeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      nodeCircle.setAttribute('cx', x);
      nodeCircle.setAttribute('cy', y);
      nodeCircle.setAttribute('r', '4');
      nodeCircle.setAttribute('fill', '#0d9488');
      nodeCircle.setAttribute('stroke', '#ffffff');
      nodeCircle.setAttribute('stroke-width', '1.5');
      wheelPolygonNodes.appendChild(nodeCircle);
    }

    wheelPolygon.setAttribute('points', points.join(' '));
  }

  function renderWheelOfLife() {
    initWheelSvgBackground();
    renderWheelPolygon();
  }

  initWheelSvgBackground();
  initWheelSliders();
  renderWheelPolygon();

  // =========================================================================
  // 10. PRZYCISKI: WYPEŁNIENIE DANYCH PACJENTA (AUTOFILL) VS CZYSTY SZABLON
  // =========================================================================
  btnAutofill.addEventListener('click', () => {
    // 1. Strona dzienna
    const sobrietyInput = document.getElementById('sobrietyDayInput');
    if (sobrietyInput) sobrietyInput.value = '142';

    const dailyDateInput = document.getElementById('dailyDateInput');
    if (dailyDateInput) dailyDateInput.value = 'Środa, 18 Października';

    const pledgeInput = document.getElementById('pledgeInput');
    if (pledgeInput) pledgeInput.value = 'uważność na głód fizyczny, telefon do Marka po pracy i ominięcie ulicy ze starym pubem.';

    const dailyTask1 = document.getElementById('dailyTask1');
    if (dailyTask1) dailyTask1.value = 'Krok 4 – dokończenie listy urazów z terapeutą';
    const dailyTask1Sub = document.getElementById('dailyTask1Sub');
    if (dailyTask1Sub) dailyTask1Sub.value = 'Skupienie na faktach, bez oceniania siebie i bez zbędnego pośpiechu';
    const dailyTask1Note = document.getElementById('dailyTask1Note');
    if (dailyTask1Note) dailyTask1Note.value = 'W razie oporu: 3 głębokie oddechy i kontakt ze sponsorem Markiem';

    const dailyTask2 = document.getElementById('dailyTask2');
    if (dailyTask2) dailyTask2.value = '30 minut spokojnego spaceru w lesie bez telefonu';
    const dailyTask2Sub = document.getElementById('dailyTask2Sub');
    if (dailyTask2Sub) dailyTask2Sub.value = 'Ścieżka przyrodnicza za miastem, uważność na zmysły i rytm oddechu';
    const dailyTask2Note = document.getElementById('dailyTask2Note');
    if (dailyTask2Note) dailyTask2Note.value = 'Czysta obecność tu i teraz, wyciszenie gonitwy myśli po pracy';

    const dailyTask3 = document.getElementById('dailyTask3');
    if (dailyTask3) dailyTask3.value = 'Ugotowanie ciepłego posiłku na dwa dni';
    const dailyTask3Sub = document.getElementById('dailyTask3Sub');
    if (dailyTask3Sub) dailyTask3Sub.value = 'Zupa krem i pieczone warzywa (ochrona przed Hungry w skali HALT)';
    const dailyTask3Note = document.getElementById('dailyTask3Note');
    if (dailyTask3Note) dailyTask3Note.value = 'Spokojne przygotowanie wieczorem przy relaksującej muzyce';

    const dailyReflections = document.getElementById('dailyReflectionsLeft');
    if (dailyReflections) {
      dailyReflections.value = 'Dzisiejszy dzień był dla mnie dużym sprawdzianem cierpliwości i uważności. Rano pojawił się silny stres przed spotkaniem zespołu, ale zamiast uciekać w złość, wyszedłem na 5 minut i zrobiłem ćwiczenie oddechowe. Około 14:00 zauważyłem spadek energii – w tabeli HALT wpisałem wyższe wartości (H: 3, A: 3, T: 2), więc natychmiast zjadłem ciepły posiłek i napiłem się wody, co powstrzymało narastający głód emocjonalny.\n\nPo południu odbyłem spokojny spacer w lesie. Doceniam to, że nie muszę już niczego udowadniać ani zakładać masek. Kolejny dzień kończę w trzeźwości z poczuciem wolności i głębokiej wdzięczności.';
    }

    // Wypełnij Skalę HALT w osobnym bloku (oceny 1-5)
    const haltH = document.getElementById('haltInputH');
    if (haltH) haltH.value = '2';
    const haltA = document.getElementById('haltInputA');
    if (haltA) haltA.value = '3';
    const haltL = document.getElementById('haltInputL');
    if (haltL) haltL.value = '1';
    const haltT = document.getElementById('haltInputT');
    if (haltT) haltT.value = '3';

    // Wypełnij Plan Dnia co godzinę (07:00 - 18:00, po 2 linie na każdą godzinę)
    const hourlyPlanSamples = [
      'Pobudka, wdzięczność, szklanka wody',
      'Poranny rozruch i modlitwa o spokój ducha',
      'Ciepłe śniadanie białkowe (ochrona HALT)',
      'Krótki spacer z psem przed pracą',
      'Rozpoczęcie pracy: priorytety bez pośpiechu',
      'Przegląd kalendarza i wyznaczenie przerw',
      'Blok pracy głębokiej w skupieniu',
      '5 minut ćwiczeń oddechowych przy oknie',
      'Krótka przerwa na owoc i nawodnienie',
      'Telefon kontrolny do przyjaciela z AA',
      'Pożywny, ciepły obiad (ochrona Hungry)',
      'Odpoczynek bez telefonu i mediów',
      'Bieżąca korespondencja i sprawy biurowe',
      'Uważność na pierwsze sygnały zmęczenia',
      'Spotkanie zespołowe – asertywność i spokój',
      'Unikanie zbędnych sporów i obrony ego',
      'Herbata ziołowa, podwieczorek (orzechy)',
      'Chwila uważności: ocena tabeli HALT',
      'Zamykanie zadań dnia, czyste biurko',
      'Przygotowanie planu na kolejny poranek',
      'Zakończenie pracy i bezpieczny powrót',
      'Ominięcie miejsc wyzwalających i pubów',
      'Mityng grupy wsparcia / Sesja terapii',
      'Dzielenie się siłą i doświadczeniem'
    ];
    const scheduleInputs = document.querySelectorAll('.schedule-plan-input');
    scheduleInputs.forEach((input, idx) => {
      if (hourlyPlanSamples[idx]) input.value = hourlyPlanSamples[idx];
    });

    const g1 = document.getElementById('gratitudeInput1');
    if (g1) g1.value = 'Za kolejny dzień w pełnej trzeźwości i poranny spokój bez kaca moralnego.';
    const g2 = document.getElementById('gratitudeInput2');
    if (g2) g2.value = 'Za to, że zadzwoniłem do sponsora zamiast tłumić złość po trudnej rozmowie w pracy.';
    const g3 = document.getElementById('gratitudeInput3');
    if (g3) g3.value = 'Za ciepłą herbatę, bezpieczny dom i poczucie wolności, z którym kładę się dziś spać.';

    // 2. Koło życia
    const sampleValues = [7, 6, 9, 6, 7, 7, 5, 6];
    sampleValues.forEach((val, idx) => {
      WHEEL_SECTORS[idx].val = val;
      const slider = document.getElementById(`slider-${WHEEL_SECTORS[idx].id}`);
      const score = document.getElementById(`score-${WHEEL_SECTORS[idx].id}`);
      if (slider) slider.value = val;
      if (score) score.innerText = val;
    });
    renderWheelPolygon();

    // 3. Bilans Zysków i Strat
    const matrixGains = document.getElementById('matrixGainsSober');
    if (matrixGains) {
      matrixGains.value = `• Prawdziwy szacunek moich dzieci – gdy wracam do domu, nie boją się mojego wzroku.\n• Spokojny sen bez dławiącego lęku i porannego koszmaru moralnego.\n• Czyste finanse: brak długów, kontrola nad wydatkami, oszczędności.\n• Jasny umysł w pracy: zdolność do logicznego myślenia i stabilność.\n• Wolność od kłamstwa – nie muszę pamiętać, co komu zmyśliłem.`;
    }

    const matrixLosses = document.getElementById('matrixLossesRelapse');
    if (matrixLosses) {
      matrixLosses.value = `• Całkowita utrata zaufania żony i dzieci – kolejnej szansy już nie będzie.\n• Utrata pracy i upadłość finansowa.\n• Ostateczne złamanie godności osobistej i powrót do koszmaru bezsilności.\n• Realne zagrożenie zawałem, udarem i śmiercią w samotności.`;
    }

    const matrixFunction = document.getElementById('matrixSubstanceFunction');
    if (matrixFunction) {
      matrixFunction.value = `• Dawała natychmiastowe „wyłączenie” gonitwy myśli po 10 godzinach stresu.\n  → ZDROWA ALTERNATYWNA: 40 minut szybkiego marszu w lesie + prysznic.\n• Dawała fałszywą odwagę w kontaktach z ludźmi.\n  → ZDROWA ALTERNATYWNA: Akceptacja nieśmiałości; mityng AA.\n• Dawała szybką nagrodę, gdy czułem się niedoceniony.\n  → ZDROWA ALTERNATYWNA: Dobry ciepły posiłek, telefon do przyjaciela.`;
    }

    const matrixCosts = document.getElementById('matrixPastCosts');
    if (matrixCosts) {
      matrixCosts.value = `• Tysiące zmarnowanych godzin w stanie zamroczenia i na leczeniu kaca.\n• Olbrzymi wstyd przed sąsiadami i rodziną po incydentach.\n• Ciągły lęk, że ktoś wyczuje woń alkoholu w pracy.\n• Zniszczone zdrowie żołądka, wątroby i układu nerwowego.`;
    }

    // Informacja toast
    showNotification('Wypełniono przykładowe autentyczne dane pacjenta w procesie zdrowienia!');
  });

  btnClearData.addEventListener('click', () => {
    // Wyczyść inputy tekstowe i pola
    document.querySelectorAll('.input-line, .item-input, .stream-of-consciousness, .quadrant-textarea, .reflections-daily-textarea').forEach(el => {
      el.value = '';
    });

    const sobrietyInput = document.getElementById('sobrietyDayInput');
    if (sobrietyInput) sobrietyInput.value = '';

    const dailyDateInput = document.getElementById('dailyDateInput');
    if (dailyDateInput) dailyDateInput.value = '';

    // Zresetuj Skalę HALT i Plan Dnia co godzinę
    document.querySelectorAll('.halt-scale-input').forEach(input => {
      input.value = '';
    });
    document.querySelectorAll('.schedule-plan-input').forEach(input => {
      input.value = '';
    });

    // Zresetuj Wdzięczności
    document.querySelectorAll('.gratitude-full-input').forEach(input => {
      input.value = '';
    });

    // Zresetuj Koło życia do 3
    WHEEL_SECTORS.forEach((sec, idx) => {
      WHEEL_SECTORS[idx].val = 3;
      const slider = document.getElementById(`slider-${sec.id}`);
      const score = document.getElementById(`score-${sec.id}`);
      if (slider) slider.value = 3;
      if (score) score.innerText = 3;
    });
    renderWheelPolygon();

    showNotification('Przywrócono czysty szablon plannera (gotowy do druku)');
  });

  function showNotification(msg) {
    let note = document.getElementById('appNotificationToast');
    if (!note) {
      note = document.createElement('div');
      note.id = 'appNotificationToast';
      note.style.position = 'fixed';
      note.style.bottom = '24px';
      note.style.right = '24px';
      note.style.background = '#0d9488';
      note.style.color = '#ffffff';
      note.style.padding = '0.75rem 1.25rem';
      note.style.borderRadius = '8px';
      note.style.fontWeight = '600';
      note.style.fontSize = '0.85rem';
      note.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';
      note.style.zIndex = '9999';
      note.style.transition = 'all 0.25s ease';
      document.body.appendChild(note);
    }
    note.innerText = msg;
    note.style.opacity = '1';
    note.style.transform = 'translateY(0)';
    setTimeout(() => {
      note.style.opacity = '0';
      note.style.transform = 'translateY(10px)';
    }, 3200);
  }
});
