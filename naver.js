const puppeteer = require('puppeteer');

function splitNp(str) {
    const p1 = /[0-9]+,[0-9]+원/;
    const p2 = /[0-9]+원/;
    
    try {
        const a1 = str.match(p1)[0];
        const name = str.replace(a1, "").trim().split("\n")[0];
        return [name, a1];
    } catch (error) {
        const a2 = str.match(p2)[0];
        const name = str.replace(a2, "").trim().split("\n")[0];
        return [name, a2];
    }
}

async function extractFromMap(input_, target) {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // 네이버 지도 접속
    await page.goto("https://map.naver.com/p?c=15.00,0,0,0,dh");
    await page.waitForTimeout(2000);

    // 현재 위치로 조정
    await page.click('#app-layout > div.sc-dXyEyt.dzeHPo > div.sc-eWKPCf.eIPzqQ.sc-tXRCi.hZZZPt > div.sc-ixOOwA.gcHXiN > div.sc-edEGER.hEPKfM > div > button');
    await page.waitForTimeout(2000);

    // 줌 아웃
    await page.click('#app-layout > div.sc-dXyEyt.dzeHPo > div.sc-eWKPCf.eIPzqQ.sc-tXRCi.hZZZPt > div.sc-ixOOwA.gcHXiN > div.sc-lbotLG.dmrhKS > button:nth-child(2)');
    await page.waitForTimeout(1000);

    // 검색창에 음식 검색하기
    await page.type('.input_search', input_);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 가게 정보 저장
    const shopDict = {};

    // 가게 정보 접근하기
    const frame = page.frames().find(frame => frame.name() === 'searchIframe');
    const temp = await frame.$$('#_pcmap_list_scroll_container > ul > li');
    
    let information = {};
    
    // 제일 위에 있는 음식점을 가져온다.
    // 가게 클릭
    try {
        let shop, shopName;
        try {
            shop = await temp[0].$('div:nth-child(1) > div:nth-child(2) > a:nth-child(1) > div > div');
            shopName = await shop.evaluate(el => el.textContent);
            await shop.click();
        } catch {
            shop = await temp[0].$('div:nth-child(1) > a > div > div');
            shopName = await shop.evaluate(el => el.textContent);
            await shop.click();
        }
        await page.waitForTimeout(2000);
        
        const entryFrame = page.frames().find(frame => frame.name() === 'entryIframe');
        
        if (target === "menu") {
            const menuButtons = await entryFrame.$$('.veBoZ');
            for (let button of menuButtons) {
                const text = await button.evaluate(el => el.textContent);
                if (text === "메뉴") {
                    await button.click();
                    break;
                }
            }
            await page.waitForTimeout(2000);
            
            // 메뉴 정보 가져오기 (메뉴 이름, 가격, 이미지)
            
            // 메뉴 이름, 가격
            const bb = await entryFrame.$$('.MXkFw');
            const menuList = await Promise.all(bb.map(async (el) => {
                const text = await el.evaluate(el => el.textContent);
                return splitNp(text);
            }));
            console.log(menuList);
            
            // 메뉴 이미지
            const images = await entryFrame.$$('.E2jtL');
            const imageList = await Promise.all(images.map(async (el) => {
                const img = await el.$('img');
                return img.evaluate(el => el.src);
            }));
            
            // information에 정보 저장하기
            information.menu_name = menuList.map(item => item[0]);
            information.menu_price = menuList.map(item => item[1]);
            information.menu_image = imageList;
        }
        
        if (target === "review") {
            const menuButtons = await entryFrame.$$('.veBoZ');
            for (let button of menuButtons) {
                const text = await button.evaluate(el => el.textContent);
                if (text === "리뷰") {
                    await button.click();
                    break;
                }
            }
            await page.waitForTimeout(2000);

            // 리뷰 정보 가져오기
            const bb = await entryFrame.$$('.zPfVt');
            const reviewList = await Promise.all(bb.map(el => el.evaluate(el => el.textContent)));

            // information에 정보 저장하기
            information.review = reviewList;
        }
        
        // shopDict에 information 저장하기
        shopDict[shopName] = information;
    } catch (error) {
        console.error("Error occurred:", error);
    }

    await browser.close();
    
    return shopDict;
}

module.exports = { extractFromMap };

// 예시로 실행
// extractFromMap("동향", "menu").then(console.log);
