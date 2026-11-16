import {published} from '../published';
import {test,expect,type Page} from '@playwright/test';
import {PUNCTUATION_EXERCISES,type PunctuationExercise} from '../../src/domain/punctuation';

const saved=(page:Page,count:number,total:number)=>expect(page.getByRole('status',{name:'Сохранение знаков'})).toHaveText(`Сохранено ${count} из ${total}`);
async function fill(page:Page,exercise:PunctuationExercise,skipFirst=false){
 for(const p of exercise.positions){
  if(skipFirst&&p.id==='1')continue;
  await page.getByRole('button',{name:new RegExp(`^Позиция ${p.id},`)}).click();
  await expect(page.locator('.punctuation-tools>small')).toContainText(`Позиция ${p.id} ·`);
  await page.getByRole('button',{name:`Поставить: ${p.sign==='none'?'без знака':p.sign===','?'запятая':'тире'}`,exact:true}).click();
  await expect(page.getByRole('status',{name:'Сохранение знаков'})).not.toHaveText('Сохраняем…');
 }
}

test('punctuation: every sign, explicit blanks, keyboard, help, offline grading and separate drafts',async({page,context},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./#/library');await page.getByRole('button',{name:'Загрузить и открыть пособие'}).click();await expect(page).toHaveURL(/#\/topics$/,{timeout:30000});
 await page.goto('#/workshop');await page.getByRole('button',{name:'Разобрать 5 примеров'}).click();await page.getByRole('combobox',{name:'Пропущенная буква'}).selectOption('и');await expect(page.getByRole('status',{name:'Сохранение интерактива'})).toHaveText('Черновик сохранён');
 await page.goto('#/workshop');await page.getByRole('button',{name:'Расставить знаки · 5 текстов',exact:true}).click();await expect(page.getByRole('heading',{name:'Текст 1 из 5'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Проверить знаки'})).toBeDisabled();
 const first=page.getByRole('button',{name:'Позиция 1, не заполнено',exact:true});await first.focus();await first.press('ArrowRight');await saved(page,0,8);await expect(page.getByRole('button',{name:'Позиция 2, не заполнено',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Позиция 1, не заполнено',exact:true}).click();await saved(page,0,8);await page.getByRole('button',{name:'Поставить: запятая',exact:true}).click();await saved(page,1,8);await page.getByRole('button',{name:'Удалить знак',exact:true}).click();await saved(page,0,8);await expect(page.getByRole('button',{name:'Проверить знаки'})).toBeDisabled();await page.getByRole('button',{name:'Поставить: запятая',exact:true}).click();await saved(page,1,8);
 await fill(page,PUNCTUATION_EXERCISES[0],true);await saved(page,8,8);
 await page.getByRole('link',{name:'Правило по теме',exact:true}).click();await expect(page).toHaveURL(/#\/theory\//);await page.goBack();await expect(page.getByRole('note')).toContainText('решение с помощью');await saved(page,8,8);
 await page.goto('#/');await page.getByRole('link',{name:'Продолжить серию',exact:true}).click();await expect(page.getByRole('heading',{name:'Текст 1 из 5'})).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await saved(page,8,8);
 await page.getByRole('button',{name:'Проверить знаки'}).click();const feedback=page.getByRole('status',{name:'Результат расстановки знаков'});await expect(feedback).toContainText('Верно 7 из 8 позиций');await expect(feedback).toContainText('✕ Позиция 1');await expect(feedback).toContainText('Твой ответ: запятая. Верно: тире.');await expect(feedback).toContainText('перед «это»');
 await expect.poll(async()=>{const top=await feedback.boundingBox(),bar=await page.locator('.action-bar').boundingBox();return !!top&&!!bar&&top.y>=0&&top.y<bar.y;}).toBe(true);await page.screenshot({path:testInfo.outputPath('punctuation-feedback-390.png'),fullPage:true});await page.screenshot({path:testInfo.outputPath('punctuation-feedback-viewport-390.png')});
 const route=page.url();await page.getByRole('button',{name:'Вернуться к предложению ↑'}).click();await expect.poll(async()=>{const box=await page.locator('#punctuation-text').boundingBox();return !!box&&box.y>=0&&box.y<250;}).toBe(true);expect(page.url()).toBe(route);await page.reload();await expect(feedback).toContainText('Верно 7 из 8 позиций');await expect(page.getByRole('button',{name:'Проверить знаки'})).toHaveCount(0);
 for(const width of [360,390,430,1280])for(const colorScheme of ['light','dark'] as const){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme,reducedMotion:'reduce'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390||width===1280)await page.screenshot({path:testInfo.outputPath(`punctuation-${width}-${colorScheme}.png`),fullPage:true});}
 await page.setViewportSize({width:390,height:844});
 for(let i=1;i<PUNCTUATION_EXERCISES.length;i++){
  await page.getByRole('button',{name:'Следующий текст'}).click();await expect(page.getByRole('heading',{name:`Текст ${i+1} из 5`})).toBeVisible();await fill(page,PUNCTUATION_EXERCISES[i]);await saved(page,PUNCTUATION_EXERCISES[i].positions.length,PUNCTUATION_EXERCISES[i].positions.length);await page.getByRole('button',{name:'Проверить знаки'}).click();await expect(feedback).toContainText(`Верно ${PUNCTUATION_EXERCISES[i].positions.length} из ${PUNCTUATION_EXERCISES[i].positions.length} позиций`);
 }
 await page.getByRole('button',{name:'Завершить расстановку'}).click();await expect(page.getByRole('heading',{name:'У каждого знака есть причина'})).toBeVisible();await expect(page.getByText('Верно 42 из 43 позиций. С помощью: 1.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Верно 42 из 43 позиций. С помощью: 1.',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Мой прогресс',exact:true}).click();const stats=page.getByRole('region',{name:'Результаты расстановки знаков'});await expect(stats).toContainText('Проверено текстов5');await expect(stats).toContainText('Позиции верны42 / 43');await expect(stats).toContainText('Тексты без ошибок самостоятельно4 / 4');await expect(page.locator('.stat-number').first()).toHaveText(`0 / ${published.graded}`);
 await page.goto('#/workshop/letters');await expect(page.getByRole('combobox',{name:'Пропущенная буква'})).toHaveValue('и');await context.setOffline(false);
});
