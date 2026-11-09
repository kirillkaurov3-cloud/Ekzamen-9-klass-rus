import {test,expect,type Page} from '@playwright/test';
import {pack,task} from '../fixtures';

async function open(page:Page,path=''){await page.goto(`#/${path}`);await expect(page.getByRole('heading',{name:'Всё получится.'})).toBeVisible();}
async function startFirstTopic(page:Page){await page.goto('#/topics/t2');await page.getByRole('button',{name:/Тренироваться/}).click();await expect(page.getByRole('heading',{name:'Задание 1 из 3'})).toBeVisible();}

test('first launch, theory, incorrect answer, reload, and correction',async({page})=>{
 await open(page);await page.goto('#/topics/t2');await page.getByRole('link',{name:'Грамматическая основа',exact:true}).click();await expect(page.getByRole('heading',{name:'Грамматическая основа',exact:true})).toBeVisible();
 await startFirstTopic(page);await page.getByRole('button',{name:/город спал/}).click();await page.getByRole('button',{name:'Проверить',exact:true}).click();await expect(page.getByRole('status')).toContainText('Пока неверно');
 await page.getByRole('button',{name:'Показать разбор'}).click();await expect(page.getByText('Верный ответ:',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('status')).toContainText('Пока неверно');
 await page.goto('#/errors');await expect(page.getByText('1 в очереди',{exact:true})).toBeVisible();await page.getByRole('button',{name:/Повторить 1 заданий/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Завершить и перейти дальше'}).click();
 await page.getByRole('button',{name:/город спал/}).click();await page.getByRole('button',{name:/мы вышли; ветер коснулся/}).click();await page.getByRole('button',{name:'Проверить',exact:true}).click();await expect(page.getByRole('status')).toContainText('Верно!');await page.getByRole('button',{name:'К результату'}).click();await page.goto('#/errors');await expect(page.getByRole('heading',{name:'Здесь пока чисто'})).toBeVisible();
});

test('draft restored and mini-variant hides answers until atomic submission',async({page})=>{
 await open(page);await startFirstTopic(page);await page.getByRole('button',{name:/город спал/}).click();await page.reload();await expect(page.getByRole('button',{name:/город спал/})).toHaveAttribute('aria-pressed','true');
 await page.goto('#/mini');await page.getByRole('button',{name:/5 заданий.*10 минут/}).click();await page.getByRole('button',{name:'Завершить и перейти дальше'}).click();
 await expect(page.getByRole('button',{name:'Проверить',exact:true})).toHaveCount(0);await expect(page.getByText('Верный ответ:',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Сдать',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Без ответа: 5');await page.getByRole('button',{name:'Сдать и посмотреть результат'}).click();await expect(page.getByText('0 / 5',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('0 / 5',{exact:true})).toBeVisible();
});

test('local pack import survives offline relaunch; invalid pack leaves it intact',async({page,context})=>{
 await open(page);await page.goto('#/settings');await page.locator('#pack-file').setInputFiles({name:'pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack([task()]))) });await page.getByRole('button',{name:'Загрузить этот набор'}).click();await expect(page.getByRole('heading',{name:'Тестовый набор',exact:true})).toBeVisible();
 await page.goto('#/settings');await page.locator('#pack-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});await expect(page.getByRole('alert')).toContainText('JSON');await expect(page.getByRole('heading',{name:'Тестовый набор',exact:true})).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Тестовый набор',exact:true})).toBeVisible();
 for(const path of ['topics','errors','progress','settings']){await page.goto(`#/${path}`);await expect(page.locator('h1')).toBeVisible();}
 await context.setOffline(false);
});

for(const width of [360,390,430,1280])for(const colorScheme of ['light','dark'] as const){
 test(`responsive ${width}px ${colorScheme}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme,reducedMotion:'reduce'});await open(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`home-${width}-${colorScheme}.png`),fullPage:true});
  await startFirstTopic(page);await page.locator('html').evaluate(el=>{el.style.fontSize='200%';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`question-${width}-${colorScheme}.png`),fullPage:true});
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Пропустить',exact:true}).click();await page.getByRole('button',{name:i===2?'К результату':'Следующее'}).click();}await expect(page.getByText('Пропуски: 3',{exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath(`result-${width}-${colorScheme}.png`),fullPage:true});
 });
}

test('manifest scope, icons, and worker match configured base',async({page,request})=>{
 await open(page);const manifestLink=await page.locator('link[rel="manifest"]').getAttribute('href');expect(manifestLink).toBeTruthy();const response=await request.get(manifestLink!);expect(response.ok()).toBe(true);const manifest=await response.json();const base=process.env.OGE_BASE_PATH||'/';expect(manifest.start_url).toBe(base);expect(manifest.scope).toBe(base);
 for(const icon of manifest.icons){const url=new URL(icon.src,new URL(manifestLink!,page.url()));expect((await request.get(url.toString())).ok()).toBe(true);}
 const scope=await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;return registration.scope;});expect(new URL(scope).pathname).toBe(base);
});


test('timer expires once after background time and supports keyboard navigation',async({page})=>{
 await page.clock.install();await open(page);await page.keyboard.press('Tab');await expect(page.locator(':focus')).toBeVisible();
 await page.goto('#/mini');await page.getByRole('button',{name:/5 заданий.*10 минут/}).click();await expect(page.getByRole('heading',{name:'Задание 1 из 5'})).toBeVisible();
 await page.clock.fastForward(600001);await expect(page.getByText('0 / 5',{exact:true})).toBeVisible();await page.reload();await page.goto('#/progress');await expect(page.getByRole('link',{name:/0 из 5/})).toHaveCount(1);
});
