import {test,expect} from '@playwright/test';
import {LETTER_EXERCISES} from '../../src/domain/interactive';

test('letters and rules: keyboard, hint, draft, theory, offline feedback and separate progress',async({page,context},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
 await page.goto('./#/workshop');await expect(page.getByRole('heading',{name:'Мастерская правил'})).toBeVisible();
 await page.getByRole('link',{name:'Открыть пособие',exact:true}).click();await page.getByRole('button',{name:'Загрузить и открыть пособие'}).click();await expect(page).toHaveURL(/#\/topics$/,{timeout:30000});
 await page.goto('#/topics/rustutors-2026-2027-oge7-topic1');await page.getByRole('link',{name:'Интерактив: буква и правило'}).click();await page.getByRole('button',{name:'Разобрать 5 примеров'}).click();await expect(page.getByRole('heading',{name:'Пример 1 из 5'})).toBeVisible();
 const saved=()=>expect(page.getByRole('status',{name:'Сохранение интерактива'})).toHaveText('Черновик сохранён');
 const letter=page.getByRole('combobox',{name:'Пропущенная буква'});
 await letter.focus();await letter.press('ArrowDown');await saved();await expect(letter).toHaveValue('е');await letter.press('ArrowDown');await saved();await expect(letter).toHaveValue('и');
 await page.getByRole('radio',{name:'Гласная в корне проверяется ударением',exact:true}).check();await saved();await page.getByRole('button',{name:'Нужна подсказка'}).click();await saved();await expect(page.getByRole('note')).toContainText('Этот ответ будет отмечен');
 await page.getByRole('link',{name:'Правило по теме',exact:true}).click();await expect(page.locator('h1')).toBeVisible();await page.goBack();await expect(letter).toHaveValue('и');await expect(page.getByRole('radio',{name:'Гласная в корне проверяется ударением',exact:true})).toBeChecked();await expect(page.getByRole('note')).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(letter).toHaveValue('и');
 await page.getByRole('button',{name:'Проверить',exact:true}).click();const feedback=page.getByRole('status',{name:'Результат интерактива'});await expect(feedback).toContainText('✓ Буква верна');await expect(feedback).toContainText('✕ Ошибка в правиле');await expect(feedback).toContainText('Твоё объяснение:');await expect(feedback).toContainText('окончании -ий');
 await expect.poll(async()=>{const top=await feedback.boundingBox(),bar=await page.locator('.action-bar').boundingBox();return !!top&&!!bar&&top.y>=0&&top.y<bar.y;}).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('letter-feedback-390-dark.png'),fullPage:true});await page.screenshot({path:testInfo.outputPath('letter-feedback-viewport-390-dark.png')});
 await page.goto('#/');await page.getByRole('link',{name:'Продолжить серию',exact:true}).click();await expect(feedback).toContainText('✕ Ошибка в правиле');await expect(page.getByRole('button',{name:'Проверить',exact:true})).toHaveCount(0);
 for(let i=1;i<LETTER_EXERCISES.length;i++){
  await page.getByRole('button',{name:'Следующий пример'}).click();await expect(page.getByRole('heading',{name:`Пример ${i+1} из 5`})).toBeVisible();
  const e=LETTER_EXERCISES[i];await page.getByRole('combobox',{name:'Пропущенная буква'}).selectOption(e.letter);await saved();await page.getByRole('radio',{name:e.choices.find(c=>c.id===e.rule)!.text,exact:true}).check();await saved();await page.getByRole('button',{name:'Проверить',exact:true}).click();await expect(feedback).toContainText('✓ Правило верно');
 }
 await page.getByRole('button',{name:'Завершить интерактив'}).click();await expect(page.getByRole('heading',{name:'Буква — и причина'})).toBeVisible();await expect(page.getByText('Буквы: 5 из 5. Правила: 4 из 5.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Буквы: 5 из 5. Правила: 4 из 5.',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Мой прогресс',exact:true}).click();const stats=page.locator('section').filter({has:page.getByRole('heading',{name:'Интерактивы: буква и правило',exact:true})});await expect(stats).toContainText('Проверено примеров5');await expect(stats).toContainText('Оба шага самостоятельно4 / 4');await expect(stats).toContainText('С подсказкой1');await expect(page.locator('.stat-number').first()).toHaveText('0 / 1411');
 for(const width of [360,430,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
 await context.setOffline(false);
});
