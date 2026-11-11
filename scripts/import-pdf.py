#!/usr/bin/env python3
"""Локальный, детерминированный импорт практикума 2026–2027. Python 3.10+, Poppler.
Никаких сетевых запросов. Непроверенные соответствия остаются в review.json.
"""
import argparse
import bisect
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

EDITION = 'rustutors-2026-2027'
SECTIONS = [(2,5,408),(3,50,421),(4,96,437),(5,170,440),(6,188,460),(7,263,480),(8,300,533),(9,318,535),(11,334,536),(12,377,540)]
TITLES = {2:'Грамматическая основа',3:'Синтаксический анализ предложения',4:'Пунктуационные правила',5:'Пунктуационный анализ',6:'Орфографический анализ',7:'Гласные в морфемах',8:'Морфологические нормы',9:'Синтаксис словосочетания',11:'Средства выразительности',12:'Лексический анализ'}
TOPICS = {
3: [(50,'Характеристика предложения'),(53,'Односоставные и двусоставные предложения'),(62,'Осложнение простого предложения'),(78,'Сложное предложение'),(86,'Придаточные в СПП'),(93,'Предложения с разными видами связи')],
4: [(96,'Тире между подлежащим и сказуемым'),(100,'Однородные члены'),(111,'Обособленное определение'),(117,'Обособленное приложение'),(121,'Обособленное обстоятельство'),(129,'Уточняющие члены'),(132,'Обращения'),(135,'Вводные слова и конструкции'),(141,'Вставные конструкции'),(142,'ССП'),(148,'СПП'),(154,'БСП'),(163,'Тире в неполном предложении'),(165,'Прямая речь'),(168,'Междометия')],
5: [(172,'Тире'),(176,'Двоеточие'),(178,'Запятые'),(186,'Кавычки')],
6: [(207,'Гласные и согласные в корне'),(216,'Правописание приставок'),(223,'Гласные на стыке морфем'),(226,'Мягкий и твёрдый знаки'),(231,'Суффиксы разных частей речи'),(235,'Н и НН'),(240,'Окончания существительных'),(244,'Окончания глаголов и суффиксы причастий'),(249,'НЕ и НИ'),(254,'Гласные после шипящих и Ц'),(259,'Слитное, раздельное и дефисное написание')],
7:[(263,'Гласные в морфемах')],8:[(300,'Морфологические нормы')],9:[(318,'Синтаксическая синонимия')],
11:[(334,'Сравнение'),(345,'Метафора'),(351,'Фразеологизм'),(365,'Эпитет'),(375,'Олицетворение')],
12:[(377,'Лексическое значение'),(391,'Синонимы'),(398,'Антонимы'),(403,'Фразеологизмы')],2:[(5,'Грамматическая основа')]}


def clean_page(raw, page):
    lines=raw.splitlines()
    while lines and not lines[-1].strip(): lines.pop()
    if lines and lines[-1].strip()==str(page): lines.pop()
    return '\n'.join(lines).rstrip()+'\n'

class Document:
    def __init__(self,pages):
        self.pages=pages
        self.offsets=[]
        acc=0
        for p in pages:
            self.offsets.append(acc); acc+=len(p)+1
        self.text='\n'.join(pages)
    def page(self,offset): return bisect.bisect_right(self.offsets,offset)
    def span(self,a,b): return list(range(self.page(a),self.page(max(a,b-1))+1))
    def section(self,a,b):
        start=self.offsets[a-1]
        end=self.offsets[b] if b<len(self.pages) else len(self.text)
        return self.text[start:end],start

def normalize(s): return re.sub(r'\s+',' ',s).strip()
def blocks(s):
    return [{'type':'paragraph','text':normalize(x)} for x in re.split(r'\n\s*\n',s.strip()) if x.strip()]
def strip_response(s): return re.split(r'(?im)^\s*Ответ\s*:',s)[0].strip()
def topic_id(n,g): return f'{EDITION}-oge{n}-topic{g+1}'
def task_id(n,g,q,sub=None): return f'{EDITION}-oge{n}-topic{g+1}-q{q}'+(f'-part{sub}' if sub else '')

def number_blocks(text,offset=0,standalone=False):
    pattern=r'(?m)^\s*(\d+)\.\s*\n' if standalone else r'(?m)^[ \t]*(\d+)\.[ \t]+'
    ms=list(re.finditer(pattern,text))
    return [(int(m[1]),text[m.end():ms[i+1].start() if i+1<len(ms) else len(text)],offset+m.start(),offset+(ms[i+1].start() if i+1<len(ms) else len(text))) for i,m in enumerate(ms)]

def answer_groups(text,offset=0):
    pat=r'(?m)^[ \t]*(\d+)[.)][ \t]*(?:(?i:ОТВЕТ):[ \t]*)?(НЕВЕРНО|ВЕРНО|\d+|[^\n]+)'
    matches=list(re.finditer(pat,text)); groups=[]
    for i,m in enumerate(matches):
        q=int(m[1]); key=m[2].strip(); end=matches[i+1].start() if i+1<len(matches) else len(text)
        tail=text[m.end():end].strip()
        # Stop source explanation at a chapter/topic heading, preserving short pages.
        tail=re.split(r'\n[ \t]*[А-ЯЁ][А-ЯЁ /(),–—-]{8,}[ \t]*(?:\n|$)', '\n'+tail)[0].strip()
        if q==1 or not groups: groups.append({})
        if q in groups[-1]: groups[-1][q]={'conflict':True}
        else: groups[-1][q]={'key':key,'explanation':tail,'start':offset+m.start(),'end':offset+end}
    return groups

def options_from(s,sep=')'):
    pat=r'(?m)^[ \t]*(\d+)'+re.escape(sep)+r'[ \t]+'
    ms=list(re.finditer(pat,s)); options=[]
    prompt=s[:ms[0].start()] if ms else s
    for i,m in enumerate(ms):
        val=s[m.end():ms[i+1].start() if i+1<len(ms) else len(s)]
        options.append({'id':m[1],'text':normalize(val)})
    return prompt,options

SPACING_REVIEW = 'Слитный ключ №9: требуется проверенная читаемая форма; формат пробелов подтверждён, словоформы — нет'

def reviewed_spacing(candidate, override, checksum):
    """Only a reviewed spacing change; never silently changes words or key address."""
    if not override.get('answerForms'):
        return None
    if candidate['oge'] != 9 or candidate['kind'] != 'text':
        raise ValueError('Корректировка пробелов поддерживается только для текстовых заданий №9')
    key = candidate.get('key')
    if not key or key.get('conflict') or override.get('sourceSha256') != checksum or override.get('sourceKey') != key['key']:
        raise ValueError('Корректировка не соответствует редакции или исходному ключу: '+candidate['id'])
    forms = override['answerForms']
    if not isinstance(forms, list) or not forms or any(not isinstance(f, str) or not f.strip() for f in forms):
        raise ValueError('Пустые или неверные читаемые формы: '+candidate['id'])
    compact = lambda x: re.sub(r'\s+', '', x).lower()
    if [compact(f) for f in forms] != [compact(f) for f in key['key'].split('/')]:
        raise ValueError('Корректировка меняет слова, порядок или альтернативы: '+candidate['id'])
    if any(r != SPACING_REVIEW for r in candidate['reasons']):
        raise ValueError('Есть нерешённые причины помимо пробелов: '+candidate['id'])
    return [normalize(f) for f in forms]

def run(args):
    inp=Path(args.input); out=Path(args.output_dir)
    out.mkdir(parents=True,exist_ok=True)
    if 'public' in out.parts or 'dist' in out.parts: raise ValueError('Локальный импорт нельзя сохранять в public или dist')
    subprocess.run(['pdftotext','-layout',str(inp),str(out/'pages.txt')],check=True)
    raw=(out/'pages.txt').read_text().split('\f')
    if not raw[-1].strip(): raw.pop()
    pages=[clean_page(p,i+1) for i,p in enumerate(raw)]
    doc=Document(pages)
    if len(pages)!=545: raise ValueError(f'Ожидалось 545 страниц, найдено {len(pages)}; требуется другая карта редакции')
    checksum=hashlib.sha256(inp.read_bytes()).hexdigest()
    boundaries=[]
    for i,(n,start,answer) in enumerate(SECTIONS):
        for kind,p in [('material',start),('answer',answer)]:
            hit=re.search(r'ЗАДАНИЕ\s+'+str(n)+r'\.',pages[p-1])
            if not hit: raise ValueError(f'Не подтверждена граница №{n}, {kind}, страница {p}')
            boundaries.append({'oge':n,'kind':kind,'page':p,'confirmedBy':'chapter heading'})
    candidates=[]; texts=[]; topics=[]; theory=[]; unmatched=[]
    def add(n,g,q,body,a,b,key=None,kind=None,shared=None,sub=None):
        tid=task_id(n,g,q,sub); reason=[]; body=strip_response(body)
        c={'id':tid,'oge':n,'topic':topic_id(n,g),'question':q,'pages':doc.span(a,b),'body':body,'key':key,'kind':kind,'textId':shared,'reasons':reason,'status':'review'}
        if not body: reason.append('Пустое условие')
        if not key or key.get('conflict'): reason.append('Нет однозначного ключа по составному адресу')
        if re.search(r'[\ue000-\uf8ff]',body): reason.append('Значимый символ из нестандартного шрифта')
        candidates.append(c);return c
    for si,(n,start,answer) in enumerate(SECTIONS):
        end=(SECTIONS[si+1][1]-1) if si+1<len(SECTIONS) else 407
        ansend=SECTIONS[si+1][2] if si+1<len(SECTIONS) else 543
        ans,ao=doc.section(answer,ansend)
        m=re.search(r'ЗАДАНИЕ\s+'+str(n)+r'\.',ans); ao+=m.start();ans=ans[m.start():]
        if si+1<len(SECTIONS): ans=re.split(r'ЗАДАНИЕ\s+'+str(SECTIONS[si+1][0])+r'\.',ans)[0]
        if n==2:
            material,mo=doc.section(9,end)
            mt=list(re.finditer(r'(?m)^\s*ТЕКСТ\s+(\d+)\.',material))
            at=list(re.finditer(r'(?m)^\s*ТЕКСТ\s+(\d+)\s*:',ans)); ak={}
            for j,h in enumerate(at):
                block=ans[h.end():at[j+1].start() if j+1<len(at) else len(ans)]
                qs=list(re.finditer(r'ЗАДАНИЕ\s*№\s*(\d+)\.\s*(\d+|НЕВЕРНО|ВЕРНО)',block))
                for k,z in enumerate(qs):
                    tail=block[z.end():qs[k+1].start() if k+1<len(qs) else len(block)].strip()
                    ak[(int(h[1]),int(z[1]))]={'key':z[2],'explanation':tail,'start':ao+h.end()+z.start(),'end':ao+h.end()+(qs[k+1].start() if k+1<len(qs) else len(block))}
            for j,h in enumerate(mt):
                limit=mt[j+1].start() if j+1<len(mt) else len(material); segment=material[h.end():limit]
                qm=list(re.finditer(r'ЗАДАНИЕ\s*№\s*(\d+)\.',segment))
                textid=f'{EDITION}-text{h[1]}'
                textbody=segment[:qm[0].start()].strip() if qm else segment
                texts.append({'id':textid,'blocks':blocks(textbody),'source':{'title':'РУСТЬЮТОРС. Тематический практикум ОГЭ 2026–2027','pages':doc.span(mo+h.end(),mo+h.end()+(qm[0].start() if qm else len(segment)))}})
                for k,z in enumerate(qm):
                    stop=qm[k+1].start() if k+1<len(qm) else len(segment)
                    add(n,0,int(h[1]),segment[z.end():stop],mo+h.end()+z.start(),mo+h.end()+stop,ak.get((int(h[1]),int(z[1]))),'choice' if z[1]=='1' else 'boolean',textid,int(z[1]))
        elif n==4:
            # One answer unit per rule / variant, not one per sentence option.
            am=list(re.finditer(r'(?m)^[ \t]*(?:Вариант\s+(\d+)\.[ \t]*)?ОТВЕТ:[ \t]*([\d, .\n]+)',ans))
            akeys=[]
            for m in am:
                k=re.sub(r'\s+','',m[2]).rstrip('.')
                akeys.append({'key':k,'explanation':'','start':ao+m.start(),'end':ao+m.end(),'variant':int(m[1] or 1)})
            allc=[]
            for g,(tp,title) in enumerate(TOPICS[n]):
                te=TOPICS[n][g+1][0]-1 if g+1<len(TOPICS[n]) else end
                mat,off=doc.section(tp,te)
                practice=mat.find('ПРАКТИКА')
                if practice<0: unmatched.append({'oge':n,'page':tp,'reason':'Не найден заголовок практики'});continue
                mat=mat[practice:];off+=practice
                starts=list(re.finditer(r'(?m)^[ \t]*(?:ВАРИАНТ\s*(\d+)\s*[.:]?|ЗАДАНИЕ\s*[.:])',mat))
                if not starts:
                    unmatched.append({'oge':n,'page':tp,'reason':'Не распознано начало варианта'});continue
                for i,m in enumerate(starts):
                    q=int(m[1] or 1);stop=starts[i+1].start() if i+1<len(starts) else len(mat)
                    c=add(n,g,q,mat[m.end():stop],off+m.start(),off+stop,kind='choice-long');allc.append(c)
            if len(allc)==len(akeys):
                for c,k in zip(allc,akeys):
                    if c['question']==k['variant']:
                        c['key']=k;c['reasons'].remove('Нет однозначного ключа по составному адресу')
                    else:c['reasons'].append('Вариант условия и ключа не совпал')
            else: unmatched.append({'oge':n,'reason':f'Число блоков условий {len(allc)} и ключей {len(akeys)} различается'})
        else:
            ag=answer_groups(ans,ao) if n!=7 else []
            if n==7:
                nums=number_blocks(ans,ao,standalone=True)
                ag=[{}]
                for q,s,a,b in nums:
                    k=re.search(r'ОТВЕТ:\s*(\d+)',s)
                    if k:ag[0][q]={'key':k[1],'explanation':'','table':s[k.end():].strip(),'start':a,'end':b}
            if len(ag)!=len(TOPICS[n]): unmatched.append({'oge':n,'reason':f'Групп условий {len(TOPICS[n])}; групп ключей {len(ag)}. Соответствия не импортируются.'})
            for g,(tp,title) in enumerate(TOPICS[n]):
                te=TOPICS[n][g+1][0]-1 if g+1<len(TOPICS[n]) else end
                mat,off=doc.section(tp,te);practice=mat.find('ПРАКТИКА')
                if practice<0: unmatched.append({'oge':n,'page':tp,'reason':'Не найден заголовок практики'});continue
                mat=mat[practice:];off+=practice
                # Numbered learning strategies before ЗАДАНИЕ are not answer units.
                if n in [3,6]:
                    instruction=re.search(r'ЗАДАНИЕ\s*:',mat)
                    if instruction:
                        off+=instruction.start();mat=mat[instruction.start():]
                nums=number_blocks(mat,off,standalone=n in [5,7,8,9,11,12])
                inherited=normalize(mat[mat.find('ЗАДАНИЕ:')+8:nums[0][2]-off]) if n in [3,5,6] and nums else ''
                if inherited.startswith('ПРАКТИКА') or len(inherited)>700:inherited='Верно ли утверждение? Обоснуйте ответ.' if n in [3,6] else 'Укажите позиции знаков.'
                for q,s,a,b in nums:
                    key=ag[g].get(q) if len(ag)==len(TOPICS[n]) else None
                    kind='boolean' if n in [3,6] else 'positions' if n in [5,7] else 'choice' if n==11 else 'text'
                    c=add(n,g,q,(inherited+'\n\n' if inherited else '')+s,a,b,key,kind)
                    if n==12:c['reasons'].append('Требуется явный список словоформ и разметка слитных пар; в пособии разрешена начальная форма')
                    if n==7:
                        table=re.split(r'(?im)^\s*Ответ\s*:',s,maxsplit=1)
                        tab=add(n,g,str(q)+'-table', 'Заполните таблицу: часть речи, морфема, правило, восстановленное слово.\n\n'+strip_response(s),a,b,key,'table')
                        tab['reasons'].append('Таблица требует координатного восстановления ячеек и сверки переноса страниц')
        for g,(tp,title) in enumerate(TOPICS[n]): topics.append({'id':topic_id(n,g),'title':title,'oge':n,'theoryIds':[]})
    # Duplicate composite addresses are never silently admitted.
    duplicate_ids={key for key,count in Counter(c['id'] for c in candidates).items() if count>1}
    for c in candidates:
        if c['id'] in duplicate_ids:c['reasons'].append('Повтор составного адреса упражнения')
    # Convert candidates only after consistency checks.
    tasks=[]
    corrections_path=Path(args.corrections) if args.corrections else out/'corrections.json'
    if not corrections_path.exists(): corrections_path.write_text('{}\n')
    corrections=json.loads(corrections_path.read_text())
    for c in candidates:
        key=c['key']; kind=c['kind']; prompt=c['body']; opts=[]; answer=None; policy={'caseSensitive':False,'foldYo':False,'ignoreSpaces':False}
        if key and not key.get('conflict'):
            rawkey=key['key']
            if kind=='boolean':
                if rawkey not in ['ВЕРНО','НЕВЕРНО']:c['reasons'].append('Ключ не является ВЕРНО/НЕВЕРНО')
                else:answer=['true' if rawkey=='ВЕРНО' else 'false'];opts=[{'id':'true','text':'Верно'},{'id':'false','text':'Неверно'}]
            elif kind in ['choice','choice-long']:
                prompt,opts=options_from(prompt, '.' if kind=='choice-long' else ')')
                ids=[x['id'] for x in opts]
                answer=rawkey.split(',') if kind=='choice-long' else list(rawkey)
                if not opts or len(ids)!=len(set(ids)) or any(x not in ids for x in answer):c['reasons'].append('Номера вариантов и ключа не согласованы')
                if kind=='choice' and ids!=['1','2','3','4','5']:c['reasons'].append('Ожидалось пять полных вариантов')
            elif kind=='positions':
                ids=list(dict.fromkeys(re.findall(r'\(\s*(\d+)\s*\)',prompt)))
                opts=[{'id':x,'text':x} for x in ids];answer=list(rawkey)
                if not ids or any(len(x)>1 for x in ids) or any(x not in ids for x in answer):c['reasons'].append('Неоднозначный цифровой ключ позиций')
            elif kind=='text':
                answer=[normalize(x) for x in rawkey.split('/')]
                if any(not x or '\n' in x for x in answer):c['reasons'].append('Некорректные альтернативы текстового ключа')
                if c['oge']==9:
                    policy['ignoreSpaces']=True
                    c['reasons'].append(SPACING_REVIEW)
        if len(prompt)<8:c['reasons'].append('Слишком короткое условие')
        if re.search(r'\w-\s*\n\s*\w',prompt):c['reasons'].append('Подозрительный перенос слова: требуется сверка')
        c['reasons']=list(dict.fromkeys(c['reasons']))
        if c['id'] in corrections:
            override=corrections[c['id']]
            if override.get('exclude'):
                c['status']='excluded';c['reasons']=[override.get('reason','Исключено корректировкой')];continue
            if override.get('task'):
                task=override['task'];task['verification']='manual';tasks.append(task);c['status']='manual';c['reasons']=[];continue
        reviewed = reviewed_spacing(c, corrections.get(c['id'], {}), checksum)
        if reviewed:
            answer=reviewed;c['reasons']=[]
        if not c['reasons'] and answer is not None:
            c['status']='manual' if reviewed else 'automatic'
            tasks.append({'id':c['id'],'version':1,'oge':c['oge'],'topicIds':[c['topic']],'type':'multi' if kind in ['choice','choice-long'] else kind,'prompt':blocks(prompt),'options':opts,**({'textId':c['textId']} if c['textId'] else {}),'sourceKey':key['key'],'key':answer[0] if kind in ['text','boolean'] else answer,'accepted':answer if kind=='text' else [],'policy':{'yo':'strict','ignoreSpaces':policy['ignoreSpaces']},'explanation':blocks(key.get('explanation','')),'source':{'title':'РУСТЬЮТОРС. Тематический практикум ОГЭ 2026–2027','pages':c['pages'],'answerPages':doc.span(key['start'],key['end'])},'verification':'manual' if reviewed else 'rules','timed':True})
    pack={'schemaVersion':1,'packId':EDITION,'packVersion':'1.0.0+'+checksum[:12]+'.'+hashlib.sha256(json.dumps(corrections,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:8],'title':'Тематический практикум ОГЭ 2026–2027 · локальный импорт','source':{'title':'РУСТЬЮТОРС. Тематический практикум ОГЭ 2026–2027','checksum':checksum},'topics':topics,'texts':texts,'theory':theory,'tasks':tasks}
    def write(name,data): (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+'\n')
    # The same Zod schema validates build-time and browser imports. Keep the previous
    # valid pack intact if validation fails. No unchecked pack is published.
    write('pack.pending.json',pack)
    validator=Path(__file__).resolve().parent/'validate.ts'
    runner=validator.parent.parent/'node_modules'/'.bin'/'tsx'
    subprocess.run([str(runner),str(validator),str(out/'pack.pending.json')],check=True)
    (out/'pack.pending.json').replace(out/'pack.json')
    write('candidates.json',candidates)
    write('review.json',{'tasks':[c for c in candidates if c['status']=='review'],'unmatchedBlocks':unmatched})
    inventory=[]
    for i,p in enumerate(pages,1):
        section=next((n for j,(n,a,_) in enumerate(SECTIONS) if a<=i<(SECTIONS[j+1][1] if j+1<len(SECTIONS) else 408)),None)
        inventory.append({'page':i,'role':'practice/theory' if 5<=i<=407 else 'answers' if 408<=i<=543 else 'frontmatter/advertisement','oge':section,'characters':len(p),'exerciseStarts':[c['id'] for c in candidates if c['pages'][0]==i],'exerciseOverlaps':[c['id'] for c in candidates if i in c['pages']],'answerLines':len(re.findall(r'(?m)^.*(?:ОТВЕТ:|НЕВЕРНО|ВЕРНО)',p))})
    counts=[]
    for n,_,_ in SECTIONS:
        cs=[c for c in candidates if c['oge']==n]
        counts.append({'oge':n,'found':len(cs),'automatic':sum(c['status']=='automatic' for c in cs),'manual':sum(c['status']=='manual' for c in cs),'selfCheck':0,'review':sum(c['status']=='review' for c in cs),'excluded':sum(c['status']=='excluded' for c in cs)})
    report={'sourceSha256':checksum,'pagesProcessed':len(pages),'boundaries':boundaries,'counts':counts,'unmatchedBlocks':unmatched,'coverageComplete':False,'note':'Полный постраничный проход выполнен; полнота обнаружения и перенос всех форматов пока не подтверждены. Найдено означает единицы ответа, распознанные правилами, а не независимо установленное полное число упражнений. №7: основной выбор и таблица учитываются отдельно.','keysWithExplanations':sum(bool(t['explanation']) for t in tasks),'imported':len(tasks),'manualVerified':sum(t['verification']=='manual' for t in tasks),'pages':inventory}
    write('report.json',report)
    rows=['| № ОГЭ | Обнаружено | Автоматически | Вручную | Самопроверка | На сверке | Исключено |','|---|---:|---:|---:|---:|---:|---:|']
    rows += ['| '+' | '.join(str(r[k]) for k in ['oge','found','automatic','manual','selfCheck','review','excluded'])+' |' for r in counts]
    (out/'REPORT.md').write_text('# Отчёт локального импорта\n\n'+report['note']+'\n\n'+'\n'.join(rows)+f"\n\nОбработано страниц: {len(pages)}. В пакете: {len(tasks)} заданий. С пояснениями: {report['keysWithExplanations']}. Ручная поштучная сверка всех заданий не выполнена.\n\nПодробности: report.json, review.json, candidates.json и pages.txt. Корректировки: corrections.json.\n\nОткрытые форматы: таблицы №7; допустимые словоформы №12; читаемые ключи №9; значимые символы, подозрительные переносы и несовпадения адресов. Теоретические таблицы сохранены в pages.txt; их семантическая разметка ещё не завершена.\n")
    print(json.dumps({'output':str(out),'counts':counts,'unmatched':unmatched,'imported':len(tasks)},ensure_ascii=False))

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',default='content-source/Tematicheskiy_praktikum_2026-2027-2.pdf')
    ap.add_argument('--output-dir',default='content-private/praktikum-2027')
    ap.add_argument('--corrections')
    try:run(ap.parse_args())
    except (ValueError,OSError,subprocess.CalledProcessError) as exc:
        print(f'Импорт остановлен: {exc}',file=sys.stderr);sys.exit(1)
