"""Synthetic fixtures only: no source textbook is needed for CI."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('pdf_import',Path(__file__).parents[1]/'scripts'/'import-pdf.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def test_footer_only_removes_page_number(self):
        self.assertEqual(module.clean_page('Текст\n12\n',12),'Текст\n')
        self.assertEqual(module.clean_page('Ответ: 12\n',12),'Ответ: 12\n')
    def test_cross_page_exercise_keeps_continuation(self):
        doc=module.Document(['1. Начало\n','продолжение\n2. Следующий\n'])
        rows=module.number_blocks(doc.text)
        self.assertEqual([r[0] for r in rows],[1,2])
        self.assertIn('продолжение',rows[0][1])
        self.assertEqual(doc.span(rows[0][2],rows[0][3]),[1,2])
    def test_reset_numbers_start_distinct_key_groups(self):
        result=module.answer_groups('1. ОТВЕТ: ВЕРНО\n2. ОТВЕТ: НЕВЕРНО\nТЕМА\n1. ОТВЕТ: НЕВЕРНО\n')
        self.assertEqual(len(result),2)
        self.assertEqual(result[0][1]['key'],'ВЕРНО')
        self.assertEqual(result[1][1]['key'],'НЕВЕРНО')
    def test_two_digit_option_is_atomic(self):
        prompt,options=module.options_from('Укажите номера.\n1. Первый.\n12. Двенадцатый.','.')
        self.assertEqual([x['id'] for x in options],['1','12'])
        self.assertEqual(prompt.strip(),'Укажите номера.')
    def test_short_answer_page_not_discarded(self):
        doc=module.Document(['Вариант 1. ОТВЕТ: 2.\n','Вариант 2. ОТВЕТ: 12.\n'])
        self.assertIn('12.',doc.text)
        self.assertEqual(doc.page(doc.text.index('Вариант 2')),2)
    def test_alternatives_preserved(self):
        result=module.answer_groups('1) ОТВЕТ: шёл / шагал\n2) ОТВЕТ: пришёл\n')
        self.assertEqual(result[0][1]['key'],'шёл / шагал')
    def test_compound_addresses_do_not_collide_across_topics(self):
        self.assertNotEqual(module.task_id(3,0,1),module.task_id(3,1,1))
        self.assertNotEqual(module.task_id(2,0,1,1),module.task_id(2,0,1,2))
    def test_preserves_yo_stress_and_gaps(self):
        text='Ёлка, бело́к, ст..(1)ной'
        self.assertEqual(module.blocks(text)[0]['text'],text)

class ReviewedSpacingTests(unittest.TestCase):
    def candidate(self):
        return {'id':'synthetic-9-1','oge':9,'kind':'text','key':{'key':'синяякрыша / крышасиняя'},'reasons':[module.SPACING_REVIEW]}
    def override(self):
        return {'answerForms':['синяя крыша','крыша синяя'],'sourceSha256':'edition','sourceKey':'синяякрыша / крышасиняя'}
    def test_only_spacing_changes_and_all_alternatives_survive(self):
        self.assertEqual(module.reviewed_spacing(self.candidate(),self.override(),'edition'),['синяя крыша','крыша синяя'])
    def test_rejects_wrong_edition_and_key(self):
        for patch in [{'sourceSha256':'other'}, {'sourceKey':'other'}]:
            with self.assertRaises(ValueError): module.reviewed_spacing(self.candidate(),{**self.override(),**patch},'edition')
    def test_rejects_changed_words_dropped_alternatives_and_empty_forms(self):
        for forms in [['зелёная крыша','крыша синяя'],['синяя крыша'],['','крыша синяя'],['крыша синяя','синяя крыша']]:
            with self.assertRaises(ValueError): module.reviewed_spacing(self.candidate(),{**self.override(),'answerForms':forms},'edition')
    def test_does_not_clear_other_review_reasons(self):
        candidate=self.candidate();candidate['reasons'].append('Нет подтверждённого условия')
        with self.assertRaises(ValueError): module.reviewed_spacing(candidate,self.override(),'edition')
    def test_unreviewed_candidate_stays_in_queue(self):
        self.assertIsNone(module.reviewed_spacing(self.candidate(),{},'edition'))

class TheoryAndReviewTests(unittest.TestCase):
    def test_stops_at_practice_and_preserves_columns(self):
        doc=module.Document(['ТЕОРИЯ\nСлово       Пример\nА           Б\n','  ПРАКТИКА «ТЕМА»\n1. Упражнение\n'])
        result=module.theory_fragment(doc,1,2)
        self.assertEqual(result['pages'],[1])
        self.assertIn('Слово       Пример',result['blocks'][1]['text'])
        self.assertNotIn('Упражнение',str(result))
    def test_does_not_guess_end_of_theory_without_heading(self):
        self.assertIsNone(module.theory_fragment(module.Document(['Текст\n']),1,1))
    def test_reviewed_source_is_not_a_graded_key(self):
        doc=module.Document(['Условие\n','Ключ\n'])
        candidate={'id':'synthetic12','oge':12,'topic':'synthetic-topic','body':'Собственное условие', 'pages':[1], 'key':{'key':'слово','start':doc.offsets[1],'end':len(doc.text)}}
        task=module.review_task(candidate,doc)
        self.assertTrue(task['reviewRequired']);self.assertFalse(task['timed']);self.assertEqual(task['type'],'self')
        self.assertEqual(task['source']['answerPages'],[2]);self.assertEqual(task['explanation'][-1]['text'],'слово')
        candidate['key']['conflict']=True
        self.assertIsNone(module.review_task(candidate,doc))


class ReviewedTaskTests(unittest.TestCase):
    def candidate(self):
        return {'id':'synthetic12','oge':12,'topic':'topic12','pages':[2],'key':{'key':'тестом'}}
    def override(self):
        return {'sourceSha256':'edition','sourceKey':'тестом','task':{'id':'synthetic12','oge':12,'topicIds':['topic12'],'source':{'pages':[2]}}}
    def test_manual_task_is_bound_to_edition_key_and_address(self):
        self.assertEqual(module.reviewed_task(self.candidate(),self.override(),'edition')['verification'],'manual')
        for patch in [{'sourceSha256':'other'},{'sourceKey':'другое'}]:
            with self.assertRaises(ValueError):module.reviewed_task(self.candidate(),{**self.override(),**patch},'edition')
        override=self.override();override['task']['id']='different'
        with self.assertRaises(ValueError):module.reviewed_task(self.candidate(),override,'edition')

if __name__=='__main__': unittest.main()
