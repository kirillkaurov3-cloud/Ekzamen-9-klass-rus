import {test,expect} from '@playwright/test';
for(const exam of ['mini','diagnostic'])test(`active ${exam} keeps workshop drafts but prevents learning hints before submission`,async({page})=>{
 await page.goto('./#/library');await page.getByRole('button',{name:'Загрузить и открыть пособие'}).click();await expect(page).toHaveURL(/#\/topics$/,{timeout:30000});
 await page.goto('#/workshop/lesson?list=1');await page.getByRole('button',{name:'Начать урок',exact:true}).first().click();await page.getByRole('button',{name:'Следующий шаг',exact:true}).click();
 await page.goto(`#/`+exam);await page.getByRole('button',{name:exam==='mini'?/5 заданий.*10 минут/:'Начать диагностику',exact:exam==='diagnostic'}).click();
 await expect(page.getByRole('heading',{name:exam==='mini'?'Задание 1 из 5':'Задание 1 из 10',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Короткий урок',exact:true})).toHaveCount(0);
 for(const path of ['workshop','workshop/lesson','workshop/letters','workshop/punctuation','workshop/cards','workshop/daily']){await page.goto('#/'+path);await expect(page.getByRole('heading',{name:'Сначала заверши проверочную серию'})).toBeVisible();await expect(page.getByRole('button',{name:'Нужна подсказка'})).toHaveCount(0);}
 await page.getByRole('link',{name:'Продолжить серию',exact:true}).click();await page.getByRole('button',{name:exam==='mini'?'Сдать':'Завершить',exact:true}).click();await page.getByRole('button',{name:exam==='mini'?'Сдать и посмотреть результат':'Завершить и посмотреть результат'}).click();await expect(page).toHaveURL(/#\/result\//);await page.goto('#/workshop/lesson');await expect(page.getByRole('heading',{name:'Шаг 2 из 5'})).toBeVisible();
});
