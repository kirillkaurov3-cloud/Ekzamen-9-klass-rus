import {test,expect} from '@playwright/test';
import {published} from '../published';
test('lexical meaning accepts reviewed base forms, shows a concrete explanation and retains offline progress',async({page,context},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./#/library');await page.getByRole('button',{name:'Загрузить и открыть пособие'}).click();await expect(page).toHaveURL(/#\/topics$/,{timeout:30000});await page.goto('#/topics/rustutors-2026-2027-oge12-topic1');await expect(page.getByText('Ключи на сверке:',{exact:false})).toHaveCount(0);await page.getByRole('button',{name:'Тренироваться · 5',exact:false}).click();
 for(const answer of ['бомбардир','заманчивый','привязанность','бойкот','гордость']){
  await page.getByRole('textbox',{name:'Твой ответ',exact:true}).fill(answer);await expect(page.getByText('Ответ сохранён',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Проверить',exact:true}).click();await expect(page.getByRole('status',{name:'Результат ответа'})).toContainText('Верно!');if(answer==='гордость'){await page.getByRole('button',{name:'Показать разбор',exact:true}).click();await expect(page.locator('.explanation')).toContainText('чувство собственного достоинства');await expect(page.locator('.explanation')).toContainText('предложении 25');await page.screenshot({path:testInfo.outputPath('lexical-feedback-390.png'),fullPage:true});}
  await page.getByRole('button',{name:answer==='гордость'?'К результату':'Следующее',exact:true}).click();
 }
 await expect(page).toHaveURL(/#\/result\//);await page.goto('#/progress');await expect(page.locator('.stat-number').first()).toHaveText(`5 / ${published.graded}`);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(page.locator('.stat-number').first()).toHaveText(`5 / ${published.graded}`);await context.setOffline(false);
});

test('synonyms support a reversed pair, base forms and a complete five-question series',async({page})=>{
 await page.goto('./#/library');await page.getByRole('button',{name:'Загрузить и открыть пособие'}).click();await expect(page).toHaveURL(/#\/topics$/,{timeout:30000});await page.goto('#/topics/rustutors-2026-2027-oge12-topic2');await page.getByRole('button',{name:'Тренироваться · 5',exact:false}).click();
 const answers=['пугать','мерзнут дрогнут','смело','спокойно','неведомый'];for(const [i,answer] of answers.entries()){
  await expect(page.getByRole('heading',{name:`Задание ${i+1} из 5`})).toBeVisible();await page.getByRole('textbox',{name:'Твой ответ',exact:true}).fill(answer);await expect(page.getByText('Ответ сохранён',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Проверить',exact:true}).click();await expect(page.getByRole('status',{name:'Результат ответа'})).toContainText('Верно!');await page.getByRole('button',{name:i===4?'К результату':'Следующее',exact:true}).click();
 }
 await expect(page).toHaveURL(/#\/result\//);await expect(page.getByText('5 / 5',{exact:true})).toBeVisible();
});
