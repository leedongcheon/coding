const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const naver = require('./naver');
const googleMap = require('./google_map');

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

const app = express();
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const systemInstruction = `당신은 사용자의 입력에서 중요한 키워드를 추출하고, 필요에 따라 적절한 키워드를 추천하는 모델입니다. 추출된 키워드와 추천된 키워드는 웹 크롤링 작업에 활용됩니다. 아래의 지침을 따릅니다:

**지시:**
다음과 같은 형식으로 답변을 생성하세요.

* **입력:** 사용자의 질문
* **출력:** {entity: 엔티티 ,keyword: 키워드,  answer: 답변, recommend menu : 추천 메뉴, crawling: 크롤링}

**entity:** menu, review, image 중 하나를 선택하여 출력합니다. 없을 경우 none을 출력합니다.
**keyword:**  사용자의 입력에서 음식이나 음식점 이름을 출력합니다. 지도에서 key를 검색하는 용도로 사용하기 때문에 검색할 만한 단어로 만들어야 됩니다.
**recommend menu:**  answer에서 음식 메뉴 이름을 출력합니다. 단 추천하지 않을 경우에는 출력하지 않습니다. 없을 경우는 출력하지 않습니다.
**crawling:** 만약 주변(거리)와 관련된 질문일 경우 google을 출력합니다. 리뷰와 메뉴에 관련된 내용은  naver을 출력합니다. 만약 크롤링이 필요하지 않는 경우에는 none을 출력합니다.
**answer** 너의 답변을 그냥 여기에 저장하면 되는데, 만약 사용자가 어떤 정보를 요청하면 다른 곳에서 정보를 전달하기 때문에 "잠시만 기다려 주세요 "라고 말해.

**예시:**

* **입력:** 오늘 날씨도 더운데 뭐 먹을지 추천해줘
* **출력:** {entity: none, keyword : none ,answer: "오늘처럼 더운 날에는 시원한 냉면이나 콩국수 어떠세요? 아니면 입맛 돋우는 새콤달콤한 비빔국수도 좋겠네요!", recommend menu: ['냉면','콩국수','비빔국수'],crawling:none}

**추가 지시:**

* **키워드 선택:** 사용자의 질문에 가장 적합한 키워드를 선택합니다.
* **답변:** 선택된 키워드에 맞는 구체적인 답변을 제공합니다.
* **다양성:** 다양한 표현과 어휘를 사용하여 답변의 자연스러움을 높입니다.`;

let chat;

async function initChat() {
    chat = model.startChat({
        history: [],
        generationConfig,
        safetySettings: [],
        tools: [{
            functionDeclarations: [{
                name: "process_user_input",
                description: "Process user input and generate a response",
                parameters: {
                    type: "object",
                    properties: {
                        entity: { type: "string" },
                        keyword: { type: "string" },
                        answer: { type: "string" },
                        recommend_menu: { type: "array", items: { type: "string" } },
                        crawling: { type: "string" }
                    },
                    required: ["entity", "keyword", "answer", "crawling"]
                }
            }]
        }]
    });
}

initChat();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/get_recommendation', async (req, res) => {
    const { latitude, longitude, request } = req.body;

    try {
        const response = await chat.sendMessage(request);
        const responseText = response.text();
        const modelOutput = JSON.parse(responseText);

        console.log("jj", modelOutput);
        const { crawling, entity, answer, recommend_menu, keyword } = modelOutput;

        let finalAnswer = {
            answer: answer,
            info: null,
            crawling_f: null,
            marker: null
        };

        if (recommend_menu && !crawling) {
            finalAnswer.info = recommend_menu;
        } else if (crawling) {
            if (crawling === "google") {
                const nearbyRestaurantsArray = await googleMap.getNearbyRestaurants(MAPS_API_KEY, keyword, latitude, longitude);
                finalAnswer.info = nearbyRestaurantsArray;
                finalAnswer.crawling_f = "google";
                finalAnswer.marker = "yes";

                await chat.sendMessage("이건 내가 가지고 있는 정보야" + JSON.stringify(nearbyRestaurantsArray));
            } else if (crawling === "naver") {
                const naverOutput = await naver.extractFromMap(keyword, entity);
                finalAnswer.info = naverOutput;
                finalAnswer.crawling_f = "naver";
                await chat.sendMessage("이건 내가 가지고 있는 정보야" + JSON.stringify(naverOutput));
            }
        }

        console.log(finalAnswer);
        res.json(finalAnswer);

    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).json({ error: '추천을 생성하는 중 오류가 발생했습니다. 다시 시도해 주세요.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
