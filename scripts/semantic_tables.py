#!/usr/bin/env python3
"""Local, checksum-bound extraction of the 90 answer tables. No PDF is published."""
import argparse
import hashlib
import json
import re
from pathlib import Path
SOURCE_SHA='f6ed218ac5b38133e1042d34cabd6cc13ce63b837dd6f4696c5dac85267bf127'
PREFIX='rustutors-2026-2027-oge7-topic1-q'
HEADERS=['Позиция','Часть речи','Морфема','Правило / проверочное слово','Восстановленное слово']

def validate_tables(data,checksum):
    if data.get('sourceSha256')!=checksum or checksum!=SOURCE_SHA:
        raise ValueError('Таблицы относятся к другой редакции PDF')
    if data.get('formatVersion')!=1:raise ValueError('Неизвестная версия разметки таблиц')
    tables=data.get('tables',{})
    if set(tables)!={f'{PREFIX}{q}-table' for q in range(1,91)}:
        raise ValueError('Нужны ровно 90 таблиц с составными адресами')
    for id,table in tables.items():
        rows=table.get('rows',[]);pages=table.get('answerPages',[])
        if len(rows)!=9 or any(len(row)!=5 for row in rows) or [r[0] for r in rows]!=list('123456789'):
            raise ValueError('Нарушены девять строк или пять столбцов: '+id)
        if not pages or pages!=sorted(set(pages)) or any(type(p) is not int or not 480<=p<=532 for p in pages):
            raise ValueError('Неверные страницы таблицы: '+id)
        if not re.fullmatch('[1-9]+',table.get('sourceKey','')) or len(set(table['sourceKey']))!=len(table['sourceKey']):
            raise ValueError('Неверный адресный ключ таблицы: '+id)
        if any(not isinstance(cell,str) or not cell.strip() or re.search(r'[\ue000-\uf8ff]',cell) for row in rows for cell in row):
            raise ValueError('Пустая или нераспознанная ячейка: '+id)
    return tables

def enrich_table(task,candidate,table):
    if candidate['kind']!='table' or candidate['id']!=task['id'] or task['type']!='self':
        raise ValueError('Таблица не соответствует исходному материалу')
    if task.get('sourceKey')!=table['sourceKey'] or not set(table['answerPages'])<=set(task['source']['answerPages']):
        raise ValueError('Таблица не соответствует ключу/страницам: '+task['id'])
    positions=list(dict.fromkeys(re.findall(r'\((\d+)\)',candidate['body'])))
    if positions!=list('123456789'):
        raise ValueError('Позиции условия не соответствуют строкам: '+task['id'])
    return {**task,'version':2,'reviewRequired':True,'explanation':[
        {'type':'emphasis','text':'Таблица из ключа пособия · самопроверка'},
        {'type':'paragraph','text':'Сравни восстановленное слово, его часть речи, морфему и правило. Номер строки соответствует позиции в исходном тексте. Это самопроверка: ответ не оценивается автоматически.'},
        {'type':'table','headers':HEADERS,'rows':table['rows']} ]}

def extract(input_path):
    # Optional dependency only for local extraction. Validation/import remain stdlib-only.
    import fitz
    checksum=hashlib.sha256(Path(input_path).read_bytes()).hexdigest()
    if checksum!=SOURCE_SHA:raise ValueError('Нужна проверенная редакция исходного PDF')
    pdf=fitz.open(input_path);records={};keys={};current=None
    for number in range(480,533):
        page=pdf[number-1];blocks=page.get_text('blocks');headings=[]
        for block in blocks:
            match=re.fullmatch(r'\s*(\d+)\.\s*',block[4])
            if match:headings.append((block[1],int(match[1])))
        headings.sort()
        for block in blocks:
            match=re.match(r'\s*ОТВЕТ:[ \t]*([1-9 ]+)',block[4])
            if match:
                preceding=[q for y,q in headings if y<block[1]];question=preceding[-1] if preceding else current
                if question is not None:
                    key=match[1].replace(' ','')
                    if question in keys:raise ValueError('Повтор ключа таблицы')
                    keys[question]=key
        for table in sorted(page.find_tables().tables,key=lambda t:t.bbox[1]):
            preceding=[q for y,q in headings if y<table.bbox[1]];question=preceding[-1] if preceding else current
            if question is None:raise ValueError('Таблица без заголовка задания')
            record=records.setdefault(question,{'rows':[],'answerPages':[]})
            for raw in table.extract():
                cells=[' '.join(cell.split()) for cell in raw if cell and cell.strip()]
                if not cells or not re.fullmatch('[1-9]',cells[0]):continue
                # One reviewed broken cell, p.491/q19/position3. Exact text guard.
                if number==491 and question==19 and cells==['3','СУЩ.','ОКОНЧАНИЕ','В Д.п. сущ. пишется окончание','ЯМ','лохмотьям']:
                    cells=cells[:3]+[cells[3]+' '+cells[4],cells[5]]
                if len(cells)!=5:raise ValueError(f'Неразрешённая ячейка {number}/{question}: {cells}')
                record['rows'].append(cells);record['answerPages'].append(number)
        if headings:current=headings[-1][1]
    result={'sourceSha256':checksum,'formatVersion':1,'extractor':'PyMuPDF '+fitz.VersionBind,'tables':{
        f'{PREFIX}{q}-table':{**r,'answerPages':sorted(set(r['answerPages'])),'sourceKey':keys.get(q,'')} for q,r in records.items()}}
    validate_tables(result,checksum);return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',default='content-source/Tematicheskiy_praktikum_2026-2027-2.pdf');parser.add_argument('--output',default='content-private/praktikum-2027/semantic-tables.json');args=parser.parse_args()
    output=Path(args.output)
    if any(part in ['public','dist'] for part in output.parts):raise ValueError('Рабочие таблицы должны оставаться локальными')
    data=extract(args.input);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+'\n');print('90 tables / 810 rows saved locally.')
