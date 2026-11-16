import copy
import importlib.util
import pathlib
import unittest
spec=importlib.util.spec_from_file_location('semantic_tables',pathlib.Path(__file__).parents[1]/'scripts'/'semantic_tables.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class SemanticTables(unittest.TestCase):
    def data(self):
        return {'formatVersion':1,'sourceSha256':module.SOURCE_SHA,'tables':{f'{module.PREFIX}{q}-table':{'sourceKey':'19','answerPages':[512],'rows':[[str(n),'СУЩ.','КОРЕНЬ','Проверяемая гласная','слово'] for n in range(1,10)]} for q in range(1,91)}}
    def test_requires_complete_distinct_question_and_row_addresses(self):
        data=self.data();self.assertEqual(len(module.validate_tables(data,module.SOURCE_SHA)),90)
        for mutate in [lambda d:d['tables'].pop(next(iter(d['tables']))),lambda d:d['tables'][next(iter(d['tables']))]['rows'].__setitem__(0,['2','СУЩ.','КОРЕНЬ','Правило','слово'])]:
            bad=copy.deepcopy(data);mutate(bad)
            with self.assertRaises(ValueError):module.validate_tables(bad,module.SOURCE_SHA)
    def test_rejects_wrong_edition_page_empty_and_unrecognized_cells(self):
        for field,value in [('sourceKey','11'),('answerPages',[479]),('rows',[[str(n),'СУЩ.','КОРЕНЬ','Правило','\uf0df'] for n in range(1,10)])]:
            data=self.data();data['tables'][next(iter(data['tables']))][field]=value
            with self.assertRaises(ValueError):module.validate_tables(data,module.SOURCE_SHA)
        with self.assertRaises(ValueError):module.validate_tables(self.data(),'0'*64)
    def test_enrichment_stays_self_assessment_and_preserves_the_question_and_source_key(self):
        id=module.PREFIX+'57-table';task={'id':id,'version':1,'type':'self','sourceKey':'19','timed':False,'reviewRequired':True,'source':{'pages':[285],'answerPages':[512]},'prompt':[{'type':'paragraph','text':'Исходное условие'}]}
        candidate={'id':id,'kind':'table','body':' '.join(f'({n}) слово' for n in range(1,10))};table=self.data()['tables'][id]
        result=module.enrich_table(task,candidate,table);self.assertEqual(result['version'],2);self.assertEqual(result['type'],'self');self.assertFalse(result['timed']);self.assertTrue(result['reviewRequired']);self.assertEqual(result['prompt'],task['prompt']);self.assertEqual(result['sourceKey'],'19');self.assertEqual(result['explanation'][-1]['type'],'table');self.assertEqual(task['version'],1)
    def test_rejects_a_table_from_another_key_page_or_set_of_positions(self):
        id=module.PREFIX+'57-table';task={'id':id,'type':'self','sourceKey':'12','source':{'answerPages':[512]}};candidate={'id':id,'kind':'table','body':'(1) слово'}
        with self.assertRaises(ValueError):module.enrich_table(task,candidate,self.data()['tables'][id])
        task['sourceKey']='19'
        with self.assertRaises(ValueError):module.enrich_table(task,candidate,self.data()['tables'][id])
        candidate['body']=' '.join(f'({n}) слово' for n in range(1,10));task['source']['answerPages']=[511]
        with self.assertRaises(ValueError):module.enrich_table(task,candidate,self.data()['tables'][id])
if __name__=='__main__':unittest.main()
