import json,re,sys
from collections import Counter
FIX = {
 "к у д а -т о":"куда-то","к о м у -т о":"кому-то","ч т о -т о":"что-то",
 "п о -д р у г о м у":"по-другому","п о -н о в о м у":"по-новому","к т о -т о":"кто-то",
 "п о -р а з н о м у":"по-разному",
}
def fix_ru(s):
    for a,b in FIX.items(): s=s.replace(a,b)
    return s
SPACED=re.compile(r'(?<![^\W\d_])(?:[^\W\d_] ){2,}[^\W\d_](?![^\W\d_])')
TOPIC_RULES=[
 ("Технологии и цифровая жизнь", r"dator|digital|mejl|app|internet|nätet|program|lösenord|filer|telefon|webb|kalender|verktyg|onlin|datorn"),
 ("Государство и права", r"myndighet|regler|lag(?:en|ar)?|rättighet|kommun|skatt|försäkring|ansökan|samhälle|politik|beslut|invånare|ärende"),
 ("Деньги и жильё", r"pengar|lägenhet|hyra|boende|bostad|räkning|utgift|budget|kostnad|pris|köp|ekonom|bank|lån|inkomst|lön|spara|elräkning|bostäder|inköp"),
 ("Транспорт и поездки", r"resa|tåg|buss|bil|cykel|trafik|station|perrong|flyg|kollektiv|väg|stad|semester|besöker"),
 ("Здоровье и самочувствие", r"hälsa|sjuk|vila|sömn|sover|träna|motion|kropp|läkare|energi|humör|stress|ögon|tränar|trött|vädret"),
 ("Работа и коллеги", r"arbet|jobb|chef|kollega|arbetsgivare|möte|uppgift|kontor|anställ|medarbetar|rast"),
 ("Учёба и язык", r"studera|skola|svenska|lär|ord|grammatik|kurs|utbildning|lektion|språk|lärare|betyg|uttryck|övning|bibliotek|läs"),
 ("Общение и отношения", r"vän|familj|kompis|förhållande|samtal|berätta|respekt|åsikt|samarbet|lyssn|kritiser|förklar|ursäkt|människor|andra|tillsammans"),
 ("Планы и будущее", r"framtid|mål|hoppas|utveckl|växa|karriär|drömm|erfarenhet|tidigare|för några år"),
]
def topic_for(sv):
    low=sv.lower()
    for name,pat in TOPIC_RULES:
        if re.search(pat, low): return name
    return "Повседневная жизнь"
if __name__=='__main__':
    # 1) fix Russian letter-spacing in all SFI files
    for letter in 'BCD':
        fn=f'SFI_{letter}.json'
        d=json.load(open(fn,encoding='utf-8'))
        for lvl in d['levels']:
            for s in lvl['sentences']:
                s['ru']=fix_ru(s['ru'])
                if SPACED.search(s['ru']): print('STILL SPACED', s['id'], s['ru'])
                if letter=='D' and True:
                    s['topic']=topic_for(s['sv'])
        json.dump(d,open(fn,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    d=json.load(open('SFI_D.json',encoding='utf-8'))
    c=Counter(s['topic'] for l in d['levels'] for s in l['sentences'])
    print(c.most_common())
