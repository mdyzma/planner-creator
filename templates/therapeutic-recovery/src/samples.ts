import type { LocalizedText } from '@planner/schema';

/**
 * Example filling for the guide and "example" exports: what a page might look like after a
 * day or a month of use, written by a fictional client (Marek). Short grey notes explain what
 * each part is for. All names, numbers and events are made up.
 */

const L = (en: string, pl: string): LocalizedText => ({ en, pl });

type Sample = { fill?: unknown; note?: LocalizedText; noteAt?: string };

/** One month calendar split over the spread (Mon–Thu left, Fri–Sun right): the same entries. */
const CALENDAR = {
  '3': L('walk', 'spacer'),
  '6': L('therapy 17:00', 'terapia 17:00'),
  '8': L('group 18:30', 'grupa 18:30'),
  '12': L('doctor 9:30', 'lekarz 9:30'),
  '13': L('therapy 17:00', 'terapia 17:00'),
  '15': L('group 18:30', 'grupa 18:30'),
  '18': L('family lunch', 'obiad u rodziny'),
  '20': L('therapy 17:00', 'terapia 17:00'),
  '22': L('group 18:30', 'grupa 18:30'),
  '27': L("mum's birthday", 'urodziny mamy'),
  '30': L('30 days!', '30 dni!'),
};

export const SAMPLES: Record<string, Record<string, Sample>> = {
  cover: {
    owner: {
      fill: 'Marek K.',
      note: L('your name, or leave it blank', 'Twoje imię, albo zostaw puste'),
    },
  },
  'how-to': {
    notes: {
      fill: L(
        'Morning: left page. Evening: right page.\nCrisis pages are at the back.',
        'Rano: lewa strona. Wieczorem: prawa.\nStrony kryzysowe są na końcu.',
      ),
      note: L('your own reminders', 'Twoje własne przypomnienia'),
    },
  },
  agreement: {
    care: { fill: L('sleep and time with my son', 'sen i czas z synem') },
    more: { fill: L('walk and call people', 'spacerować i dzwonić do ludzi') },
    less: { fill: L('scroll in the evening', 'scrollować wieczorem') },
    learn: { fill: L('to say no calmly', 'spokojnie mówić „nie”') },
    remember: {
      fill: L('a bad day is not a bad life', 'zły dzień to nie złe życie'),
      note: L('your own words', 'własnymi słowami'),
      noteAt: 'bottom-right',
    },
    'dont-have-to': { fill: L('do everything today', 'zrobić wszystkiego dzisiaj') },
    'ask-for-help': { fill: L('I start isolating', 'zaczynam się izolować') },
    promise: { fill: L('I will be kind to myself', 'będę dla siebie życzliwy') },
  },
  'good-life': {
    feel: { fill: L('calm, rested, useful', 'spokojnie, wypoczęty, potrzebny') },
    others: { fill: L('with patience, without shouting', 'cierpliwie, bez krzyku') },
    'more-time': { fill: L('my son, the bike, books', 'syn, rower, książki') },
  },
  'more-less': {
    more: {
      fill: L('calm\nwalks\ntime with Kuba', 'spokoju\nspacerów\nczasu z Kubą'),
      note: L('a word or two is enough', 'wystarczy słowo lub dwa'),
      noteAt: 'bottom-right',
    },
    less: { fill: L('rush\nscreens at night\ncoffee', 'pośpiechu\nekranu w nocy\nkawy') },
  },
  values: {
    'values-1': { fill: { done: [0, 1, 4] } },
    'values-2': { fill: { done: [2, 6] } },
    'values-3': { fill: { done: [2, 5] } },
    'top-five': {
      fill: {
        items: [
          L('family', 'rodzina'),
          L('health', 'zdrowie'),
          L('honesty', 'uczciwość'),
          L('calm', 'spokój'),
          L('presence', 'obecność'),
        ],
      },
    },
    living: {
      fill: L('I put the phone away at dinner', 'odkładam telefon przy kolacji'),
      note: L('something you can see', 'coś, co widać'),
      noteAt: 'bottom-right',
    },
  },
  strengths: {
    'can-do': { fill: L('fix things, cook, listen', 'naprawiać, gotować, słuchać') },
    proud: { fill: L('42 days, and my son', '42 dni i mój syn') },
    'still-can': { fill: L('pick up the phone', 'podnieść słuchawkę') },
  },
  recharge: {
    'five-minutes': { fill: L('cold water, ten breaths', 'zimna woda, dziesięć oddechów') },
    'half-hour': { fill: L('a walk by the river', 'spacer nad rzeką') },
    evening: { fill: L('a film with Kuba', 'film z Kubą') },
    tense: {
      fill: L('go outside, shake it off', 'wyjść na zewnątrz, rozruszać się'),
      note: L('what really works for you', 'to, co naprawdę działa'),
      noteAt: 'bottom-right',
    },
  },
  contract: {
    commitments: {
      fill: {
        items: [
          L('attend therapy every Tuesday', 'chodzić na terapię we wtorki'),
          L('go to 3 meetings a week', 'chodzić na 3 mityngi w tygodniu'),
          L('call my sponsor before I drink', 'zadzwonić do sponsora, zanim wypiję'),
          L('fill in the planner every evening', 'wypełniać planer każdego wieczoru'),
        ],
      },
      note: L('agree these with your therapist', 'ustal je z terapeutą'),
    },
    signature: { fill: 'Marek K.' },
    therapist: { fill: 'Anna Nowak' },
    date: { fill: '1.10.2026' },
  },
  'safety-rules': {
    rules: {
      note: L('read them when a day feels risky', 'przeczytaj je, gdy dzień wydaje się ryzykowny'),
    },
  },
  'month-divider': {
    intention: {
      fill: L('Patience', 'Cierpliwość'),
      note: L('one word to carry through the month', 'jedno słowo na cały miesiąc'),
    },
  },
  'month-open-left': {
    calendar: {
      fill: CALENDAR,
      note: L('fixed appointments first', 'najpierw stałe terminy'),
    },
    intention: {
      fill: L(
        'Get through the month sober, one day at a time.',
        'Przejść ten miesiąc trzeźwo, dzień po dniu.',
      ),
      note: L('what matters most this month', 'co jest najważniejsze w tym miesiącu'),
    },
    goals: {
      fill: {
        items: [
          L('12 meetings', '12 mityngów'),
          L('sleep by 23:00', 'spać przed 23:00'),
          L('finish step 3 with my sponsor', 'przerobić 3. krok ze sponsorem'),
        ],
        done: [2],
      },
      note: L('3–4 goals are enough; tick them off', '3–4 cele wystarczą; odhaczaj je'),
    },
  },
  'month-open-right': {
    calendar: { fill: CALENDAR },
    focus: {
      fill: L('Evenings without a screen, early nights', 'Wieczory bez ekranu, wcześnie spać'),
      note: L('the area of recovery to work on', 'obszar zdrowienia do pracy'),
    },
    remember: {
      fill: L(
        'It is fine to ask for help.\nTired + alone = call someone.',
        'Proszenie o pomoc jest OK.\nZmęczony + sam = dzwonię.',
      ),
    },
    appointments: {
      fill: L(
        'Tue 17:00 therapy\nThu 18:30 AA group\n12th doctor 9:30',
        'wt 17:00 terapia\nczw 18:30 grupa AA\n12. lekarz 9:30',
      ),
      note: L('recurring and one-off', 'stałe i jednorazowe'),
    },
    habits: {
      fill: L(
        'walk 20 min every day\n30 days sober on the 5th',
        'spacer 20 min codziennie\n5-go: 30 dni trzeźwości',
      ),
    },
  },
  'week-left': {
    remember: {
      fill: L(
        'Friday is payday: plan the evening.\nCall Tomek on Sunday.',
        'W piątek wypłata: zaplanuj wieczór.\nW niedzielę zadzwoń do Tomka.',
      ),
      note: L('what could catch you off guard this week?', 'co może Cię zaskoczyć w tym tygodniu?'),
    },
    mon: {
      fill: { markers: ['therapy'], text: L('therapy 17:00', 'terapia 17:00') },
      note: L('circle what happened that day', 'zakreśl, co się wydarzyło'),
      noteAt: 'bottom-right',
    },
    tue: { fill: { markers: ['exercise'], text: L('pool after work', 'basen po pracy') } },
    wed: {
      fill: {
        markers: ['aa', 'recovery'],
        text: L('meeting, read step 3', 'mityng, czytanie 3. kroku'),
      },
    },
    goals: {
      fill: {
        items: [
          L('3 meetings', '3 mityngi'),
          L('walk 4×', 'spacer 4×'),
          L('call Tomek', 'tel. Tomek'),
        ],
        done: [0],
      },
    },
  },
  'week-right': {
    thu: { fill: { markers: ['group'], text: L('therapy group 18:30', 'grupa Nawroty 18:30') } },
    fri: {
      fill: {
        markers: ['risk'],
        text: L('payday: cinema with my sister', 'wypłata: kino z siostrą'),
      },
      note: L('! marks a risky day: plan it', '! to dzień ryzyka: zaplanuj go'),
      noteAt: 'bottom-right',
    },
    sat: { fill: { markers: ['exercise'], text: L('bike ride', 'rower') } },
    sun: {
      fill: {
        markers: ['recovery'],
        text: L('call Tomek, plan the week', 'tel. do Tomka, plan tygodnia'),
      },
    },
    // The outer column is narrow: short lines, no notes.
    'if-then': {
      fill: L(
        'If tense after\nwork, then call\nTomek first',
        'Jeśli napięcie\npo pracy, to\ntelefon do Tomka',
      ),
    },
    watch: { fill: L('Fri: payday\nSat: a birthday', 'pt.: wypłata\nsob.: urodziny') },
  },
  // Lines in the two columns are short: examples stay brief so nothing is cut off.
  'week-review': {
    numbers: {
      fill: ['6', '4', '7', '2', '5', '4', '3'],
      note: L('count from the evening pages', 'policz ze stron wieczornych'),
      noteAt: 'bottom-right',
    },
    halt: { fill: { ticks: [false, true, false, true, false] } },
    'halt-reason': { fill: L('arguments, short nights', 'kłótnie, krótkie noce') },
    triggers: { fill: { done: [1, 5] } },
    hardest: { fill: L('Friday evening, payday', 'piątek wieczór, wypłata') },
    protected: { fill: { done: [0, 1, 2] } },
    'most-effective': { fill: L('calling Tomek straight away', 'telefon do Tomka od razu') },
    wins: {
      fill: {
        items: [
          L('called before reacting', 'telefon przed reakcją'),
          L('a meeting though I did not want to', 'mityng mimo niechęci'),
          L('rest instead of overwork', 'odpoczynek zamiast pracy'),
        ],
      },
    },
    pattern: {
      fill: L('less sleep, more craving', 'gdy śpię mniej, rośnie głód'),
      note: L('this is where the notes pay off', 'tu notatki zaczynają pracować'),
      noteAt: 'bottom-right',
    },
    continue: { fill: L('a walk every day', 'codzienny spacer') },
    differently: { fill: L('bed by 23:00', 'spać przed 23:00') },
    'if-then': {
      fill: L(
        'If tense after work, then call Tomek.',
        'Jeśli napięcie po pracy, to telefon do Tomka.',
      ),
      note: L('copy it to next week', 'przepisz na kolejny tydzień'),
      noteAt: 'bottom-right',
    },
    'one-sentence': {
      fill: L(
        'A hard week, and I got through it by asking for help.',
        'Trudny tydzień, który przeszedłem, prosząc o pomoc.',
      ),
    },
    // A5, the quick version
    'numbers-a5': { fill: ['6', '4', '7', '2'] },
    'halt-quick': { fill: L('A and T', 'A i T') },
    'trigger-quick': { fill: L('conflict', 'konflikt') },
    'helped-quick': { fill: L('calling Tomek', 'telefon do Tomka') },
    'win-quick': { fill: L('called before reacting', 'telefon przed reakcją') },
  },
  'day-left': {
    date: {
      fill: ['42'],
      note: L('count from your sobriety date', 'licz od daty trzeźwości'),
      // The counter sits at the right of the header line: the note goes under the date.
      noteAt: 'bottom-left',
    },
    // Mood, energy, tension, craving, hours of sleep, sleep quality.
    checkin: { fill: ['6', '5', '4', '3', '6', '3'] },
    commitment: {
      // One line: the A5 page has room for only one.
      fill: L('the 18:00 meeting and a call to my sponsor', 'mityng o 18:00 i telefon do sponsora'),
      note: L('one concrete action for today', 'jedno konkretne działanie na dziś'),
      noteAt: 'bottom-right',
    },
    priorities: {
      fill: {
        items: [
          L('meeting at 18:00', 'mityng o 18:00'),
          L('finish the report', 'skończyć raport'),
          L('20-minute walk', 'spacer 20 minut'),
        ],
        sub: [
          [
            L('leave work at 17:15', 'wyjść z pracy 17:15'),
            L('ask Tomek to come', 'poprosić Tomka'),
          ],
          [
            L('two blocks before lunch', 'dwa bloki przed obiadem'),
            L('ask for more time', 'poprosić o czas'),
          ],
          // No answer for the last line: the note sits there.
          [L('after dinner', 'po kolacji')],
        ],
        subFor: ['How:', 'If it gets hard:'],
        done: [0, 2],
      },
      note: L(
        'at most three; how, and what if it gets hard',
        'najwyżej trzy; jak, i co gdy będzie trudno',
      ),
      // The printed title is long, so the note goes under the list.
      noteAt: 'bottom-right',
    },
    schedule: {
      fill: {
        '07:00': L('get up, coffee', 'pobudka, kawa'),
        '08:00': L('call Tomek', 'telefon do Tomka'),
        '09:00': L('work: report', 'praca: raport'),
        '13:00': L('lunch with Ola', 'obiad z Olą'),
        '17:00': L('leave work', 'wyjście z pracy'),
        '18:00': L('meeting', 'mityng'),
        '21:00': L('evening page', 'strona wieczorna'),
      },
      note: L('fixed points only', 'tylko stałe punkty'),
    },
    halt: {
      fill: {
        values: [2, 4, 1, 3, 2],
        notes: [
          L('ate late', 'późny obiad'),
          L('argument at work', 'kłótnia w pracy'),
          '',
          L('short night', 'krótka noc'),
          L('nothing planned', 'nic zaplanowanego'),
        ],
      },
      note: L('check in at midday; 4–5 = act now', 'sprawdź w południe; 4–5 = działaj'),
    },
  },
  'day-right': {
    threat: {
      fill: L(
        'Anger after the argument, drove past the shop.\nCalled Tomek from the car park.',
        'Złość po kłótni, przejechałem obok sklepu.\nZadzwoniłem do Tomka z parkingu.',
      ),
      note: L('be honest; it helps to see patterns', 'szczerze; tak widać wzorce'),
    },
    reflection: {
      fill: L(
        'The meeting helped. I was calmer after\nthe walk. Tomorrow: talk to the boss calmly.',
        'Mityng pomógł. Po spacerze byłem spokojniejszy.\nJutro: spokojna rozmowa z szefem.',
      ),
      note: L('free space: feelings, thoughts, plans', 'wolne miejsce: uczucia, myśli, plany'),
    },
    gratitude: {
      fill: {
        items: [
          L('Tomek picked up straight away', 'Tomek od razu odebrał'),
          L('a warm dinner', 'ciepła kolacja'),
          L('42 days', '42 dni'),
        ],
      },
      note: L('small things are enough', 'drobne rzeczy wystarczą'),
    },
    checkout: { fill: ['6', '4', '7', '17:30'] },
    'checkout-line': { fill: ['6', '4', '7'] },
    trigger: {
      fill: { done: [2] },
      note: L('tick all that apply', 'zaznacz wszystkie'),
      noteAt: 'bottom-right',
    },
    'trigger-response': {
      fill: L('called Tomek,\nwent for a walk', 'telefon do Tomka,\nspacer'),
    },
    'trigger-line': {
      fill: L(
        'argument at work; called Tomek; the walk helped',
        'kłótnia w pracy; telefon do Tomka; pomógł spacer',
      ),
    },
    protected: { fill: { done: [0, 1, 2] } },
    victory: {
      fill: L('I did not answer back in anger.', 'Nie odpowiedziałem ze złością.'),
      note: L('even something small', 'nawet drobiazg'),
      // The printed titles are long, so the notes go under the lines.
      noteAt: 'bottom-right',
    },
    'good-life': {
      fill: L('played chess with my son', 'partia szachów z synem'),
      note: L('not only: did I stay sober?', 'nie tylko: czy nie piłem?'),
      noteAt: 'bottom-right',
    },
    tomorrow: { fill: L('talk to the boss calmly', 'spokojna rozmowa z szefem') },
  },
  situation: {
    'risky-thought': {
      fill: L(
        "one beer after a day like this won't hurt",
        'jedno piwo po takim dniu nie zaszkodzi',
      ),
      note: L('write it word for word', 'zapisz dosłownie'),
      noteAt: 'bottom-right',
    },
    'thought-answer': {
      fill: L(
        'One is never one for me. I can rest without it.',
        'Dla mnie jedno nigdy nie jest jedno. Odpocznę bez tego.',
      ),
    },
    happened: { fill: L('argument with the boss on Wednesday', 'kłótnia z szefem w środę') },
    thought: { fill: L('he never listens to me', 'on mnie nigdy nie słucha') },
    felt: { fill: L('anger 8/10, then shame', 'złość 8/10, potem wstyd') },
    did: { fill: L('left the room, called Tomek', 'wyszedłem z pokoju, telefon do Tomka') },
    'next-time': {
      fill: L('ask for a break before I answer', 'poprosić o przerwę, zanim odpowiem'),
      note: L('one small step', 'jeden mały krok'),
    },
  },
  'wheel-of-life': {
    wheel: {
      fill: [6, 5, 8, 4, 5, 7, 6, 3],
      note: L('shade each area up to its score', 'zamaluj każdy obszar do swojej oceny'),
    },
    notice: {
      fill: L(
        'Sobriety is strong; rest and relationships need time.\nNext month: one free evening a week.',
        'Trzeźwość mocna; odpoczynek i relacje potrzebują czasu.\nW przyszłym miesiącu: jeden wolny wieczór w tygodniu.',
      ),
    },
  },
  'monthly-review': {
    'prompt-1': {
      fill: L('Meetings and walks with Tomek.', 'Mityngi i spacery z Tomkiem.'),
      note: L('a few words per question are enough', 'kilka słów na pytanie wystarczy'),
    },
    'prompt-2': {
      fill: L('Paydays and tiredness after work.', 'Dni wypłaty i zmęczenie po pracy.'),
    },
    'prompt-3': { fill: L('Skipping dinner, irritability.', 'Pomijanie kolacji, drażliwość.') },
    'prompt-4': {
      fill: L('I need a plan for Friday evenings.', 'Potrzebuję planu na piątkowe wieczory.'),
    },
    'prompt-5': {
      fill: L('Evening walks, the Thursday group.', 'Wieczorne spacery, czwartkowa grupa.'),
    },
    'prompt-6': { fill: L('Sleep and my relationship with Ola.', 'Sen i relacja z Olą.') },
  },
  notes: {
    notes: {
      fill: L(
        'Book to read: "Twelve Steps and Twelve Traditions"\nAsk the doctor about sleep.',
        'Do przeczytania: „Dwanaście Kroków i Dwanaście Tradycji”\nZapytać lekarza o sen.',
      ),
      note: L('anything that does not fit elsewhere', 'wszystko, co nie pasuje gdzie indziej'),
    },
  },
  'warning-signs-left': {
    grid: {
      fill: [
        L('tight jaw\nbad sleep', 'zaciśnięta szczęka\nzły sen'),
        L('"just one"\n"I have it under control"', '„tylko jeden”\n„mam to pod kontrolą”'),
      ],
      note: L('your own early signs, in your words', 'Twoje wczesne sygnały, Twoimi słowami'),
    },
  },
  'warning-signs-right': {
    grid: {
      fill: [
        L('irritation\nself-pity', 'rozdrażnienie\nużalanie się'),
        L('skipping meetings\nlate nights', 'opuszczanie mityngów\npóźne noce'),
      ],
    },
    threshold: { fill: ['3'] },
    'three-signs': {
      fill: {
        items: [
          L('call Tomek the same day', 'dzwonię do Tomka tego samego dnia'),
          L('go to a meeting', 'idę na mityng'),
          L('tell my therapist', 'mówię o tym terapeutce'),
        ],
      },
      note: L('agree this plan with your therapist', 'uzgodnij ten plan z terapeutą'),
      noteAt: 'bottom-right',
    },
  },
  'gains-losses': {
    quadrants: {
      fill: [
        L('relief after work\nfeeling relaxed', 'ulga po pracy\nrozluźnienie'),
        L('debts, arguments\nhealth', 'długi, kłótnie\nzdrowie'),
        L('mornings without a hangover\ntrust at home', 'poranki bez kaca\nzaufanie w domu'),
        L('boredom in the evenings\nawkward parties', 'nuda wieczorami\ntrudne imprezy'),
      ],
      note: L('be honest about both sides', 'szczerze, po obu stronach'),
      noteAt: 'bottom-right',
    },
  },
  'support-network': {
    contacts: {
      fill: [
        ['Tomek', '600 100 200', L('any time', 'o każdej porze')],
        ['Anna Nowak', '600 300 400', L('weekdays until 17:00', 'w tygodniu do 17:00')],
        ['Piotr', '600 500 600', L('evenings', 'wieczorem')],
        [L('sister Kasia', 'siostra Kasia'), '600 700 800', L('any time', 'o każdej porze')],
        ['dr Lis', '600 900 100', L('surgery hours', 'godziny przychodni')],
        [L('Ola', 'Ola'), '600 200 300'],
      ],
      note: L('fake numbers: write your own', 'numery przykładowe: wpisz swoje'),
    },
    isolate: { fill: L('Tomek, even with a text message', 'Tomek, choćby SMS-em') },
  },
  sos: {
    feelings: { fill: { done: [0, 1] } },
    sober: {
      note: L('aloud, slowly', 'na głos, powoli'),
      noteAt: 'bottom-right',
    },
    contacts: {
      fill: [
        ['Tomek', '600 100 200'],
        ['Anna', '600 300 400'],
        [L('sister Kasia', 'siostra Kasia'), '600 700 800'],
      ],
      note: L('fake numbers: write your own', 'numery przykładowe: wpisz swoje'),
    },
    change: { fill: { done: [0, 2, 4] } },
    places: {
      fill: L(
        'Thursday group, parish hall 18:30; online meeting 21:00',
        'grupa czwartkowa, salka 18:30; mityng online 21:00',
      ),
    },
  },
  'craving-thresholds': {
    low: { fill: L('walk, cold water, breathing', 'spacer, zimna woda, oddech') },
    mid: { fill: L('Tomek; I leave the house', 'Tomek; wychodzę z domu') },
    high: { fill: L('Anna; the Thursday group', 'Anna; grupa czwartkowa') },
    top: { fill: L('Tomek; I stay at my sister’s', 'Tomek; zostaję u siostry') },
    negotiate: {
      fill: ['20', L('Tomek', 'Tomka')],
      note: L('bargaining is a warning sign', 'negocjowanie to sygnał ostrzegawczy'),
      noteAt: 'bottom-right',
    },
  },
  'emergency-list': {
    first: { fill: { done: [2, 4] } },
    more: { fill: { done: [0] } },
    best: {
      fill: {
        items: [
          L('a walk, 20 minutes', 'spacer, 20 minut'),
          L('calling Tomek', 'telefon do Tomka'),
          L('a meeting the same day', 'mityng tego samego dnia'),
        ],
      },
    },
    where: { fill: L('tight stomach, dry mouth', 'ścisk w żołądku, suchość w ustach') },
    'ride-out': {
      fill: L('cold water, a walk, counting breaths', 'zimna woda, spacer, liczenie oddechów'),
    },
    strength: {
      fill: ['7', '8', '5', '3'],
      note: L('it passes', 'to mija'),
      noteAt: 'bottom-right',
    },
  },
  'relapse-chain': {
    first: { fill: L('sleeping less, skipping meals', 'mniej spać, pomijać posiłki') },
    think: { fill: L('I can handle it myself', 'poradzę sobie sam') },
    neglect: { fill: L('meetings and the planner', 'mityngi i planer') },
    'pull-away': { fill: L('Tomek and my family', 'Tomka i rodziny') },
    'tell-myself': { fill: L('one beer will not hurt', 'jedno piwo nie zaszkodzi') },
    risk: { fill: L('I am alone on a Friday evening', 'jestem sam w piątek wieczorem') },
    break: {
      fill: L('at step 1: when I sleep less', 'przy kroku 1: gdy mniej śpię'),
      note: L('the earlier, the easier', 'im wcześniej, tym łatwiej'),
      noteAt: 'bottom-right',
    },
    then: { fill: L('call Tomek, go to bed by 23:00', 'telefon do Tomka, sen przed 23:00') },
  },
  'after-slip': {
    'next-hour': {
      fill: L('stop, pour it out, call Tomek', 'przerwać, wylać, zadzwonić do Tomka'),
      note: L('the next hour matters most', 'najważniejsza jest najbliższa godzina'),
      noteAt: 'bottom-right',
    },
    contact: { fill: L('Tomek, then my therapist', 'Tomek, potem terapeutka') },
  },
  'craving-card': {
    when: { fill: ['14.10', '18:40'] },
    where: { fill: L('at home, after work', 'w domu, po pracy') },
    happened: { fill: L('an argument on the phone', 'kłótnia przez telefon') },
    feel: { fill: { done: [0, 1] } },
    strength: {
      fill: ['8', '6', '3'],
      note: L('write it down every 10 minutes', 'zapisuj co 10 minut'),
      noteAt: 'bottom-right',
    },
    instead: {
      fill: L('went out for a walk, called Tomek', 'wyszedłem na spacer, telefon do Tomka'),
    },
    worked: { fill: L('leaving the flat straight away', 'wyjście z mieszkania od razu') },
    learned: {
      fill: L('phone arguments are my trigger', 'kłótnie przez telefon to mój wyzwalacz'),
    },
  },
};

/** What to fill in on each page and why: the text of the printed guide. */
export const GUIDES: Record<string, LocalizedText> = {
  cover: L(
    'Write your name if you like; the planner is yours. The start date is printed from the date you chose when creating the planner.',
    'Wpisz swoje imię, jeśli chcesz; planer należy do Ciebie. Data rozpoczęcia jest drukowana z daty wybranej przy tworzeniu planera.',
  ),
  'how-to': L(
    'A short description of the whole planner. Read it once at the start; the lines below are for your own reminders.',
    'Krótki opis całego planera. Przeczytaj go raz na początku; linie poniżej są na Twoje własne przypomnienia.',
  ),
  agreement: L(
    'The first page of "A good start": a commitment to yourself, without clinical language. Write what you want to take better care of, do more and less often, and what to remember when it gets hard; then one promise, and sign it.',
    'Pierwsza strona „Na dobry początek”: zobowiązanie wobec siebie, bez języka klinicznego. Wpisz, o co chcesz bardziej dbać, co robić częściej i rzadziej i o czym pamiętać, gdy będzie trudno; potem jedna obietnica i podpis.',
  ),
  'good-life': L(
    'A direction rather than a list of goals. Answer in a few words how you want to feel, treat yourself and others, and what you want more and less of. The last question looks a year ahead.',
    'Kierunek zamiast listy celów. Odpowiedz kilkoma słowami, jak chcesz się czuć, traktować siebie i innych oraz czego chcesz mieć więcej i mniej. Ostatnie pytanie patrzy rok do przodu.',
  ),
  'more-less': L(
    'Two columns for everyday life: what you want more of and less of. The examples under the heading are only prompts; write your own. Come back to this page when you set monthly and weekly goals.',
    'Dwie kolumny o codzienności: czego chcesz więcej, a czego mniej. Przykłady pod nagłówkiem są tylko podpowiedzią; wpisz własne. Wracaj do tej strony, gdy ustalasz cele miesiąca i tygodnia.',
  ),
  values: L(
    'Tick at most ten values that matter to you, then choose the five most important. The last question makes them concrete: how would you see in daily life that you live by them?',
    'Zaznacz najwyżej dziesięć wartości, które są dla Ciebie ważne, potem wybierz pięć najważniejszych. Ostatnie pytanie czyni je konkretnymi: po czym w codziennym życiu widać, że nimi żyjesz?',
  ),
  strengths: L(
    'Start from what already works: what you can do, what carried you through hard times, what you are proud of and what others value in you. Short answers are enough.',
    'Zacznij od tego, co już działa: co potrafisz, co pomagało Ci w trudnych chwilach, z czego jesteś {g:dumny|dumna} i co inni w Tobie cenią. Wystarczą krótkie odpowiedzi.',
  ),
  recharge: L(
    'Your own list for recharging, so a hard day does not start from zero: what helps when you have five minutes, half an hour or an evening, and when you are tense, lonely or tired.',
    'Twoja lista regeneracji, żeby trudny dzień nie zaczynał się od zera: co pomaga, gdy masz pięć minut, pół godziny albo wieczór, i gdy jesteś {g:spięty|spięta}, {g:samotny|samotna} lub {g:zmęczony|zmęczona}.',
  ),
  contract: L(
    'Fill in the therapeutic contract together with your therapist during one of the first sessions. Write commitments you can really keep, then sign and date it.',
    'Kontrakt terapeutyczny wypełnij razem z terapeutą na jednej z pierwszych sesji. Wpisz zobowiązania, które naprawdę możesz dotrzymać, potem podpisz i wpisz datę.',
  ),
  'safety-rules': L(
    'Printed rules to come back to. Read them whenever a day feels risky; nothing needs to be written here.',
    'Wydrukowane zasady, do których warto wracać. Przeczytaj je, gdy dzień wydaje się ryzykowny; tu nie trzeba nic wpisywać.',
  ),
  'month-divider': L(
    'Each month begins with a divider page. Write one word you want to carry through the month.',
    'Każdy miesiąc zaczyna się stroną przekładki. Wpisz jedno słowo, które chcesz nieść przez cały miesiąc.',
  ),
  'month-open-left': L(
    'The monthly spread. Put fixed appointments into the calendar first (therapy, meetings, the doctor). Then write the main intention and three or four goals; tick them off as you go.',
    'Rozkładówka miesiąca. Najpierw wpisz do kalendarza stałe terminy (terapia, mityngi, lekarz). Potem główną intencję i trzy–cztery cele; odhaczaj je na bieżąco.',
  ),
  'month-open-right': L(
    'The right-hand page continues the calendar (Friday to Sunday) and holds your recovery focus, what you want to remember, regular meetings and visits, and habits or milestones such as 30 days sober.',
    'Prawa strona kontynuuje kalendarz (piątek–niedziela) i mieści fokus zdrowienia, to, o czym chcesz pamiętać, stałe mityngi i wizyty oraz nawyki i kamienie milowe, np. 30 dni trzeźwości.',
  ),
  'week-left': L(
    'The weekly spread, filled in on Sunday or Monday. Note what could catch you off guard this week, set three or four goals in the outer column, and circle the markers of what happened each day: AA meeting, group, therapy, doctor, exercise, recovery activity, or ! for a risky day.',
    'Rozkładówka tygodnia, wypełniana w niedzielę lub poniedziałek. Zapisz, co może Cię zaskoczyć w tym tygodniu, ustal trzy–cztery cele w zewnętrznej kolumnie i zakreślaj znaczniki tego, co działo się każdego dnia: mityng AA, grupa, terapia, lekarz, ruch, działanie na rzecz zdrowienia albo ! dla dnia ryzyka.',
  ),
  'week-right': L(
    'Thursday to Sunday and the marker legend. The outer column is for the week ahead: copy your if–then plan from last week\'s "My week", and note the days or situations to watch out for.',
    'Czwartek–niedziela i legenda znaczników. Zewnętrzna kolumna jest na nadchodzący tydzień: przepisz plan jeśli–to z „Mojego tygodnia” poprzedniego tygodnia i zapisz dni lub sytuacje, na które chcesz uważać.',
  ),
  'week-review': L(
    'The end of the week, in two or three minutes. Look back over your evening pages and add up: average mood and tension, the strongest craving, and on how many days you had support, exercise or a meeting. Tick which HALT feelings were most often high, the triggers that came up and what protected you most. Then three wins (not only "I did not drink"), one pattern you notice, what to keep and change, and an if–then plan to copy into next week.',
    'Koniec tygodnia w dwie–trzy minuty. Przejrzyj strony wieczorne i podsumuj: średni nastrój i napięcie, najsilniejszy głód oraz ile dni miało wsparcie, ruch lub mityng. Zaznacz, które odczucia HALT były najczęściej wysoko, jakie wyzwalacze się pojawiły i co najbardziej Cię chroniło. Potem trzy zwycięstwa (nie tylko „nie piłem”), jeden wzorzec, który zauważasz, co zachować, co zmienić, i plan jeśli–to do przepisania na kolejny tydzień.',
  ),
  'day-left': L(
    'The morning page. Write your sobriety day number and read the quote. Do a quick check-in: mood, energy, tension and craving from 0 to 10, and how you slept. Then write one concrete action that protects your sobriety today. Choose at most three priorities, each with how you will do it and what you will do if it gets hard. Write only fixed points into the schedule. Around midday, rate each row of the HALT scale from 1 to 5 and note the reason; a 4 or 5 is a signal to act now.',
    'Strona poranna. Wpisz numer dnia trzeźwości i przeczytaj sentencję. Zrób szybki check-in: nastrój, energia, napięcie i głód od 0 do 10 oraz jak {g:spałeś|spałaś}. Potem wpisz jedno konkretne działanie, którym chronisz dziś trzeźwość. Wybierz najwyżej trzy priorytety, każdy z planem i tym, co zrobisz, gdy będzie trudno. W plan dnia wpisz tylko stałe punkty. Około południa oceń każdy wiersz skali HALT od 1 do 5 i wpisz powód; 4 lub 5 to sygnał, by działać od razu.',
  ),
  'day-right': L(
    'The evening page. In the outer column, check out: write your mood, tension and strongest craving from 0 to 10, and tick any trigger and what protected you. Then write honestly what was hard today; over weeks this shows your patterns. Use the dot grid for feelings, thoughts and plans for tomorrow. Note one small victory and one thing you did for the life you want to live, then three things you are grateful for, and one thing worth remembering tomorrow.',
    'Strona wieczorna. W zewnętrznej kolumnie zrób check-out: wpisz nastrój, napięcie i najsilniejszy głód w skali 0–10, zaznacz wyzwalacz i to, co Cię chroniło. Potem napisz szczerze, co było dziś trudne; po kilku tygodniach zobaczysz swoje wzorce. Kropki są na uczucia, myśli i plany na jutro. Zapisz jedno małe zwycięstwo i jedną rzecz, którą {g:zrobiłeś|zrobiłaś} dla życia, jakie chcesz prowadzić, potem trzy rzeczy, za które jesteś {g:wdzięczny|wdzięczna}, i jedną rzecz, o której warto jutro pamiętać.',
  ),
  situation: L(
    'An optional page at the end of each week (switch it on in Structure). Take one situation from the week: first the thought that raised the risk and what you can answer it, then what happened, what you thought, felt and did, and what could help next time.',
    'Strona opcjonalna na koniec każdego tygodnia (włącz ją w Strukturze). Weź jedną sytuację z tygodnia: najpierw myśl, która zwiększała ryzyko, i to, co możesz jej odpowiedzieć, potem co się wydarzyło, co {g:pomyślałeś|pomyślałaś}, {g:poczułeś|poczułaś} i {g:zrobiłeś|zrobiłaś} oraz co mogłoby pomóc następnym razem.',
  ),
  'wheel-of-life': L(
    'At the end of the month, score each area of life from 1 to 10 and shade it from the centre out to that ring. The lopsided parts show where to put attention next month; write what you notice below.',
    'Na koniec miesiąca oceń każdy obszar życia w skali 1–10 i zamaluj go od środka do tego pierścienia. Nierówne miejsca pokazują, czemu poświęcić uwagę w przyszłym miesiącu; poniżej zapisz, co zauważasz.',
  ),
  'monthly-review': L(
    'Six questions for looking back at the month, ideally before the next session with your therapist. A few honest words per question are enough.',
    'Sześć pytań na podsumowanie miesiąca, najlepiej przed kolejną sesją z terapeutą. Wystarczy kilka szczerych słów na pytanie.',
  ),
  notes: L(
    'Dot-grid pages at the end of each month for anything else: notes from meetings, books, questions for the doctor.',
    'Strony w kropki na końcu każdego miesiąca na wszystko inne: notatki z mityngów, książki, pytania do lekarza.',
  ),
  'warning-signs-left': L(
    'Your personal early warning signs of relapse, in four areas: body, thoughts, emotions and behaviour. The printed examples are prompts; write your own signs in your own words.',
    'Twoje osobiste wczesne sygnały ostrzegawcze nawrotu, w czterech obszarach: ciało, myśli, emocje i zachowania. Wydrukowane przykłady są podpowiedzią; wpisz własne sygnały, własnymi słowami.',
  ),
  'warning-signs-right': L(
    'Emotions and behaviours, and the most important part: your own threshold (how many signs) and three things you will do as soon as you reach it. Agree it with your therapist.',
    'Emocje i zachowania oraz najważniejsza część: Twój próg (ile sygnałów) i trzy rzeczy, które zrobisz, gdy go osiągniesz. Uzgodnij to z terapeutą.',
  ),
  'gains-losses': L(
    'The decisional balance: honest gains and losses of drinking or using, and of sobriety. Both sides matter; the hard parts of sobriety are worth naming too.',
    'Bilans decyzyjny: szczere zyski i straty z picia lub używania oraz z trzeźwości. Obie strony są ważne; trudności trzeźwości też warto nazwać.',
  ),
  'support-network': L(
    'The people you can call: sponsor, therapist, friends, family, doctor, and when you can call each of them. Write numbers you actually use; the planner never prints emergency numbers for you. At the bottom: who you contact first when you feel like isolating.',
    'Osoby, do których możesz zadzwonić: sponsor, terapeuta, przyjaciele, rodzina, lekarz, i kiedy możesz do każdej zadzwonić. Wpisz numery, z których naprawdę korzystasz; planer nigdy nie drukuje za Ciebie numerów alarmowych. Na dole: z kim kontaktujesz się najpierw, gdy masz ochotę się izolować.',
  ),
  sos: L(
    'Your plan for a hard moment, first in the crisis section so it is quick to find. Step 1: stop and tick what is happening, then take the SOBER pause. Step 2: three people you can call. Step 3: tick how you can change the situation. Fill it in on a calm day.',
    'Twój plan na trudny moment, na początku sekcji kryzysowej, żeby łatwo go znaleźć. Krok 1: zatrzymaj się i zaznacz, co się dzieje, potem zrób pauzę SOBER. Krok 2: trzy osoby, do których możesz zadzwonić. Krok 3: zaznacz, jak możesz zmienić sytuację. Wypełnij go w spokojny dzień.',
  ),
  'craving-thresholds': L(
    'Your personal alarm threshold: what you do on your own at 0–3, whom you contact at 4–6, and when you do not decide or stay alone (7–10). The last line is for the moment you start bargaining with yourself.',
    'Twój osobisty próg alarmowy: co robisz {g:sam|sama} przy 0–3, z kim się kontaktujesz przy 4–6 i kiedy nie decydujesz ani nie zostajesz {g:sam|sama} (7–10). Ostatnia linia jest na chwilę, gdy zaczynasz negocjować ze sobą.',
  ),
  'emergency-list': L(
    'When nothing comes to mind: tick what usually helps you and pick one thing first. Write your three most effective strategies. The wave reminds you that a craving rises, peaks and falls; note where you feel it and how its strength changes.',
    'Gdy nic nie przychodzi do głowy: zaznacz, co zwykle Ci pomaga, i wybierz najpierw jedną rzecz. Wpisz trzy najskuteczniejsze strategie. Fala przypomina, że głód narasta, osiąga szczyt i opada; zapisz, gdzie go czujesz i jak zmienia się jego siła.',
  ),
  'relapse-chain': L(
    'How trouble usually starts for you, as a chain: what you start doing, thinking, neglecting, whom you pull away from, what you tell yourself, when the risk grows. Then mark the earliest link where you can break the chain, and what you will do there.',
    'Jak zwykle zaczyna się u Ciebie problem, jako łańcuch: co zaczynasz robić, myśleć, zaniedbywać, od kogo się odsuwasz, co sobie tłumaczysz, kiedy rośnie ryzyko. Potem zaznacz najwcześniejsze ogniwo, w którym możesz przerwać łańcuch, i co wtedy zrobisz.',
  ),
  'after-slip': L(
    'If you drank or used: this page is for what comes next, not for blame. Answer the questions, above all what you will do in the next hour and whom you will contact. There is no line for "days lost".',
    'Jeśli doszło do picia lub użycia: ta strona jest o tym, co dalej, a nie o winie. Odpowiedz na pytania, przede wszystkim co zrobisz w najbliższej godzinie i z kim się skontaktujesz. Nie ma tu rubryki „ile dni {g:straciłem|straciłam}”.',
  ),
  'craving-card': L(
    'Two cards for a strong craving (for example 4 or more). Note when and where it came and what had just happened, tick what you feel, and write the craving at the start and after 10 and 20 minutes. Then what you did instead, what worked and what you learned.',
    'Dwie karty na silny głód (na przykład 4 i więcej). Zapisz, kiedy i gdzie się pojawił i co się właśnie wydarzyło, zaznacz, co czujesz, i wpisz siłę głodu na początku oraz po 10 i 20 minutach. Potem co {g:zrobiłeś|zrobiłaś} zamiast tego, co zadziałało i czego się {g:dowiedziałeś|dowiedziałaś}.',
  ),
};
