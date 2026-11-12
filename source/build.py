"""Сборка тренажёра: SFI_B/C/D.json -> exercise-data в site/index.html.

Плашки: слова предложения, id w1..wn по порядку в предложении, порядок плашек перемешан (детерминированно по id).
Пояснения: правила порядка слов, подбираются по составу предложения (союзы, инверсия, модальные глаголы и т.д.).
"""
import json, random, re, sys, html

BASE = '/home/claude/sfi'
INDEX = BASE + '/site/index.html'
SRC = {'B': BASE + '/SFI_B.json', 'C': BASE + '/SFI_C.json', 'D': BASE + '/SFI_D.json'}
START = '<script type="application/json" id="exercise-data">'

# ---------- Правила порядка слов ----------
ADV_START = {'igår', 'idag', 'nu', 'ibland', 'sedan', 'då', 'varje', 'på', 'i', 'under', 'till', 'vid',
             'med', 'från', 'nästa', 'förra', 'ofta', 'vanligtvis', 'snart', 'tidigt', 'senare', 'kanske',
             'tyvärr', 'tillsammans', 'därför', 'dessutom', 'först', 'sist', 'här', 'där', 'för', 'genom',
             'efter', 'under', 'varje', 'alltid', 'aldrig', 'sällan', 'ofta', 'redan', 'sen', 'gärna'}
OPINION = {'tycker', 'tror', 'anser', 'märkt', 'märker', 'förstått', 'hoppas', 'menar', 'känner', 'har',
           'insåg', 'förstår', 'upptäckt', 'upptäcker', 'visar', 'vet', 'trodde', 'tyckte', 'blev', 'förstod', 'såg'}
MODALS = {'kan', 'ska', 'vill', 'måste', 'får', 'bör', 'brukar', 'behöver', 'kunde', 'skulle', 'ville', 'borde'}
CONJ = {  # слово -> перевод
    'eftersom': 'потому что', 'när': 'когда', 'medan': 'пока', 'innan': 'прежде чем',
    'fastän': 'хотя', 'tills': 'пока не', 'vilket': 'что (относится ко всей части предложения)',
    'om': 'если', 'trots': 'хотя',
}
TOKEN = re.compile(r"[\wåäöÅÄÖéÉ]+", re.UNICODE)


def words(sv):
    return [w for w in sv.rstrip('.?!').split(' ') if w]


def norm(w):
    return re.sub(r"[^\wåäöÅÄÖéÉ-]", "", w).lower()


def grammar_notes(sv):
    ws = words(sv)
    lw = [norm(w) for w in ws]
    notes = []
    n = len(lw)

    # 1. Союзные придаточные: берём самый ранний союз в предложении
    MULTI = [
        (('trots', 'att'), 'trots att', 'хотя / несмотря на то что'),
        (('även', 'om'), 'även om', 'даже если'),
        (('för', 'att'), 'för att', 'чтобы'),
        (('efter', 'att'), 'efter att', 'после того как'),
        (('genom', 'att'), 'genom att', 'путём того, что / используя'),
    ]
    cands = []
    for i in range(n):
        for pair, label, ru in MULTI:
            if lw[i:i + 2] == list(pair):
                cands.append((i, label, ru))
        if lw[i] in CONJ:
            cands.append((i, lw[i], CONJ[lw[i]]))
        if lw[i] == 'att' and i > 0 and lw[i - 1] not in {'för', 'efter', 'genom', 'trots'}:
            prev = lw[i - 1]
            if prev in OPINION:
                cands.append((i, 'att', 'что'))
            elif prev not in {'försöker', 'brukar', 'vill', 'behöver', 'lär', 'hinner', 'kan', 'ska', 'måste', 'bad'}:
                cands.append((i, 'att', 'что / чтобы'))
    conj_pos = conj_label = ru = None
    if cands:
        conj_pos, conj_label, ru = min(cands, key=lambda c: (c[0], -len(c[1])))

    if conj_pos is not None:
        notes.append(
            f"Союз «{conj_label}» — «{ru}». В придаточном сначала подлежащее, потом глагол: "
            f"«{conj_label} jag går», а не «{conj_label} går jag»."
        )
        if conj_pos == 0:
            notes.append("Если придаточное стоит первым, главное предложение начинается с глагола: "
                         "«…, försöker jag …» (глагол на втором месте, подлежащее после него).")

    # 2. Инверсия: обстоятельство в начале, сказуемое на втором месте
    if conj_pos != 0 and lw and lw[0] in ADV_START and n >= 3:
        notes.append("Порядок: если предложение начинается не с подлежащего, сказуемое стоит на втором месте, "
                     "а подлежащее — после него (например: «Igår gick jag…»).")

    # 3. Модальные глаголы: инфинитив без att (без примера, чтобы не путать существительное с инфинитивом)
    modal = next((w for w in lw if w in MODALS), None)
    if modal:
        notes.append(f"После модального глагола «{modal}» смысловой глагол стоит в инфинитиве без «att».")

    # 4. Конструкция det är + прилагательное + att
    if 'det' in lw and 'är' in lw and 'att' in lw:
        j = lw.index('det')
        if j + 1 < n and lw[j + 1] == 'är':
            notes.append("Конструкция «Det är + прилагательное + att …» — «Важно / трудно / легко, чтобы …».")

    # 5. Отрицание inte
    if 'inte' in lw:
        ip = lw.index('inte')
        if conj_pos is not None and conj_pos < ip:
            notes.append("«inte» в придаточном стоит после подлежащего и перед глаголом: «att jag inte förstår».")
        else:
            notes.append("«inte» стоит сразу после спрягаемого глагола: «jag förstår inte», «jag kan inte».")

    # 6. Условное предложение (om + прошедшее, hade + причастие)
    if 'om' in lw and 'hade' in lw and lw.index('hade') > lw.index('om'):
        notes.append("Условное предложение нереального типа: в «om»-части прошедшее время, "
                     "в главной — «hade» + причастие (например: «hade försökt» = «я бы постарался»).")

    # 7. brukar — привычка
    if 'brukar' in lw:
        notes.append("«brukar» + глагол = «обычно (делаю)» — привычное действие.")

    if not notes and n >= 2 and lw[0] not in ADV_START:
        notes.append(f"Простой порядок: подлежащее, затем глагол, затем дополнения — «{ws[0]} {ws[1]} …». "
                     "Глагол стоит на втором месте.")
    if not notes:
        notes.append("Глагол стоит на втором месте в главном предложении.")
    return notes


def tiles_for(sv, eid):
    ws = words(sv)
    # убрать финальный знак препинания с последнего слова — он выводится отдельно
    ws[-1] = re.sub(r"[.?!]+$", "", ws[-1])
    tiles = [{'id': f'w{i+1}', 'text': w} for i, w in enumerate(ws)]
    order = list(range(len(tiles)))
    rng = random.Random(eid)
    for _ in range(50):
        rng.shuffle(order)
        if order != sorted(order):
            break
    shuffled = [tiles[i] for i in order]
    return shuffled, [t['id'] for t in tiles]


def build_exercises():
    out = []
    for letter in 'BCD':
        d = json.load(open(SRC[letter], encoding='utf-8'))
        for lvl in d['levels']:
            for s in lvl['sentences']:
                sv = s['sv']
                punct = '?' if sv.endswith('?') else '.'
                tiles, order = tiles_for(sv, s['id'])
                notes = grammar_notes(sv)
                rule = ' '.join(notes)
                ex = {
                    'id': s['id'],
                    'level': lvl['code'],
                    'topic': s['topic'],
                    'sentence_sv': sv,
                    'translation': s['ru'],
                    'tiles': tiles,
                    'variants': [{
                        'id': 'v1',
                        'instruction': 'Bygg meningen på svenska',
                        'correctAnswers': [order],
                        'explanation': rule,
                    }],
                    'explanation': f"Правильный порядок: «{sv}». Перевод: «{s['ru']}»",
                    'status': 'draft',
                    'punctuation': punct,
                }
                out.append(ex)
    return out


def inject(exercises):
    h = open(INDEX, encoding='utf-8').read()
    i = h.index(START) + len(START)
    j = h.index('</script>', i)
    payload = json.dumps({'exercises': exercises}, ensure_ascii=False, separators=(',', ':'))
    h = h[:i] + '\n' + payload + '\n' + h[j:]
    open(INDEX, 'w', encoding='utf-8').write(h)


if __name__ == '__main__':
    ex = build_exercises()
    if '--dry' in sys.argv:
        print(len(ex))
        for e in ex[::150]:
            print(e['id'], e['sentence_sv'], e['variants'][0]['explanation'])
    else:
        inject(ex)
        print('written', len(ex))
