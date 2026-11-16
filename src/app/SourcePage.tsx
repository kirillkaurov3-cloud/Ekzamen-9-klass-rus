import {useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import type {State} from '../domain/schema';
import {localSources,saveLocalSource,type LocalSource} from '../storage/localSource';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function SourcePage({state}:{state:State}) {
 const [params,setParams]=useSearchParams(),checksum=state.pack.source.checksum;
 const requested=Math.max(1,Number(params.get('page'))||1);
 const [source,setSource]=useState<LocalSource|null>(null),[pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[rendering,setRendering]=useState(false),[text,setText]=useState(''),[zoom,setZoom]=useState(1),[pageInput,setPageInput]=useState(String(requested));
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),[width,setWidth]=useState(600);
 useEffect(()=>{let live=true;if(checksum)void localSources.files.get(checksum).then(file=>{if(live)setSource(file??null);}).catch(()=>{if(live)setError('Не удалось открыть локальное хранилище.');});return ()=>{live=false;};},[checksum]);
 useEffect(()=>{
  if(!source)return;let live=true,destroy:undefined|(()=>void);setLoading(true);setError('');
  void (async()=>{try{const pdfjs=await import('pdfjs-dist');if(!live)return;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;const data=new Uint8Array(await source.file.arrayBuffer());if(!live)return;const task=pdfjs.getDocument({data,useSystemFonts:true});destroy=()=>{void task.destroy();};const document=await task.promise;if(live)setPdf(document);}catch(e){if(live)setError(e instanceof Error?e.message:'Не удалось прочитать PDF.');}finally{if(live)setLoading(false);}})();
  return ()=>{live=false;destroy?.();};
 },[source]);
 useEffect(()=>{if(!container.current)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(container.current);return ()=>observer.disconnect();},[]);
 const page=pdf?Math.min(pdf.numPages,Math.floor(requested)):Math.floor(requested);
 useEffect(()=>{setPageInput(String(page));},[page]);
 useEffect(()=>{
  if(!pdf||!canvas.current)return;let live=true,task:RenderTask|undefined;setRendering(true);setText('');
  void (async()=>{try{const docPage=await pdf.getPage(page);if(!live||!canvas.current)return;const scale=Math.min(1.6,width/docPage.getViewport({scale:1}).width)*zoom,viewport=docPage.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),target=canvas.current;
   target.width=Math.ceil(viewport.width*ratio);target.height=Math.ceil(viewport.height*ratio);target.style.width=`${viewport.width}px`;target.style.height=`${viewport.height}px`;
   task=docPage.render({canvas:target,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});await task.promise;const content=await docPage.getTextContent();if(live)setText(content.items.flatMap(item=>'str' in item?[item.str]:[]).join(' '));
  }catch(e){if(live&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setError(e instanceof Error?e.message:'Не удалось показать страницу.');}finally{if(live)setRendering(false);}})();
  return ()=>{live=false;task?.cancel();};
 },[pdf,page,width,zoom]);
 const go=(next:number)=>{if(!pdf)return;setParams({page:String(Math.max(1,Math.min(pdf.numPages,next)))});};
 return <div className="reading source-page"><Link className="back" to="/library">← К библиотеке</Link><h1>Оригинал на устройстве</h1><p>Выбери свой PDF один раз: он сохранится только в этом браузере и будет доступен офлайн. Сверим редакцию по контрольной сумме набора.</p><section className="card"><label className="field-label" htmlFor="local-source">Исходный PDF · до 20 МБ</label><input id="local-source" className="file-input" type="file" accept="application/pdf,.pdf" disabled={!checksum||loading} onChange={async event=>{const file=event.target.files?.[0];if(!file||!checksum)return;setError('');setLoading(true);try{setSource(await saveLocalSource(file,checksum));}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить файл.');}finally{setLoading(false);event.target.value='';}}}/>{!checksum&&<p>Для этого набора не указана редакция PDF. Открой пособие в библиотеке.</p>}{source&&<p className="source">✓ Редакция проверена · {source.name} · {(source.size/1024/1024).toFixed(1)} МБ <button className="text-link" onClick={async()=>{if(!checksum)return;await localSources.files.delete(checksum);setSource(null);setPdf(null);setText('');}}>Убрать с устройства</button></p>}{loading&&<p role="status">Открываем PDF…</p>}{error&&<p role="alert" className="alert">{error}</p>}</section>
 <div ref={container} className="pdf-container">{pdf&&<><form className="pdf-toolbar" onSubmit={event=>{event.preventDefault();go(Number(pageInput)||page);}}><button className="button secondary" type="button" disabled={page<=1||rendering} onClick={()=>go(page-1)} aria-label="Предыдущая страница">←</button><label>Страница <input type="number" min={1} max={pdf.numPages} value={pageInput} onChange={e=>setPageInput(e.target.value)}/></label><span>из {pdf.numPages}</span><button className="button secondary" type="submit" disabled={rendering}>Перейти</button><button className="button secondary" type="button" disabled={page>=pdf.numPages||rendering} onClick={()=>go(page+1)} aria-label="Следующая страница">→</button><label htmlFor="pdf-zoom">Масштаб</label><select id="pdf-zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>По ширине</option><option value={1.5}>150%</option><option value={2}>200%</option></select></form><p className="progress-note">Физические страницы PDF. При увеличении страницу можно прокручивать в стороны.</p>{rendering&&<p role="status">Показываем страницу {page}…</p>}</>}
 <div className="pdf-scroll" tabIndex={pdf?0:undefined} role="region" aria-label="Страница оригинала"><canvas ref={canvas} hidden={!pdf} aria-label={`Оригинал, страница ${page}`}/></div>{pdf&&<details className="pdf-text"><summary>Текст страницы для чтения</summary><p>{text||'Текст загружается или страница содержит только изображение.'}</p></details>}
 </div></div>;
}
