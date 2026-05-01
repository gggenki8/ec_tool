from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()
app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ec-tool.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProductInput(BaseModel):
    productName: str
    category: str
    features: str
    price: str
    target: str
    uniqueness: str
    note: str = ""
    platforms: list[str]

PLATFORM_PROMPTS = {
    "amazon": """
Amazonの商品ページ用説明文を作成してください。
以下の構成で、実際のAmazon出品者が丁寧に書いたような自然な文章にしてください。

構成：
1. キャッチコピー（1行・商品の本質を一言で）
2. 商品の魅力を伝える導入文（2〜3文・購入者目線で）
3. 選ばれる理由（箇条書き5点・具体的な数値や事実を含める）
4. こんな方におすすめ（2〜3パターン・具体的なシーン）
5. 安心ポイント（保証・サポートなど信頼を伝える一文）

注意：
- AIが書いたような無機質な表現は避ける
- 数字や具体例を自然に織り交ぜる
- 読んでいて購買意欲が高まる温かみのある文体で
""",
    "rakuten": """
楽天市場の商品ページ用説明文を作成してください。
楽天らしい親しみやすく熱量のある文体で、実際の店舗スタッフが書いたような説明文にしてください。

構成：
1. 思わず目が止まるキャッチコピー（1行）
2. お客様への語りかけ導入文（2〜3文・共感を呼ぶ書き出し）
3. 商品の魅力・特徴（箇条書き5点・お得感・嬉しいポイントを強調）
4. 価格の納得感を伝える一文
5. ご購入後のイメージ（使用シーンを具体的に）
6. 店舗からのひと言（温かみのあるメッセージ）

注意：
- 楽天ユーザーに馴染む親しみやすい言葉遣い
- お得感・満足感が伝わる表現を使う
- 過度な記号使用は避けシンプルに読みやすく
""",
    "shopify": """
Shopifyストア向けのブランディングを意識した商品説明文を作成してください。
洗練されたDtoCブランドが書くような、世界観を大切にした文章にしてください。

構成：
1. ブランドらしいキャッチコピー（1行・シンプルで印象的に）
2. 商品が生み出す体験・世界観（3〜4文・感情に訴える）
3. 主な特徴（箇条書き4点・シンプルかつ本質的に）
4. 誰のための商品か（1〜2文・ターゲットに語りかける）
5. 購入を後押しする締めの一文

注意：
- ブランドの世界観・ストーリーを大切に
- 過度な説明より感性に響く言葉を選ぶ
- すっきりと読みやすいシンプルな文体で
""",
    "sns": """
InstagramとX（Twitter）用の投稿文をそれぞれ作成してください。
実際のインフルエンサーや人気アカウントが投稿するような自然な文章にしてください。

【Instagram用】
- 最初の1〜2文で止まって読みたくなるフック
- 商品の魅力を体験談風に（4〜5文）
- 行動を促す自然なCTA
- 関連ハッシュタグ10〜15個

【X（Twitter）用】
- 140文字以内で完結
- 思わずRTしたくなる切り口
- ハッシュタグ2〜3個

注意：
- 広告っぽさを排除した自然な投稿風に
- 実際に使った人が書いたようなリアルな表現で
- 共感・保存・シェアされやすい言葉選びを
"""
}

@app.post("/generate")
async def generate(input: ProductInput):
    results = {}
    
    base_info = f"""
【商品情報】
商品名：{input.productName}
カテゴリ：{input.category}
販売価格：{input.price}
特徴・スペック：{input.features}
ターゲット層：{input.target}
他社との差別化ポイント：{input.uniqueness}
補足情報：{input.note if input.note else 'なし'}
"""

    for platform in input.platforms:
        prompt = base_info + PLATFORM_PROMPTS.get(platform, "商品説明文を作成してください。")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """あなたはEC販売のプロのコピーライターです。
                    以下のルールを必ず守ってください：
                    1. 入力された情報のみを使用する。記載のない仕様・機能・色・保証内容は絶対に追加しない
                    2. 数値や事実は入力情報から引用する。曖昧な表現（「業界最高水準」等）は使わない
                    3. 毎回異なる語尾・表現・構成を使いテンプレート感を出さない
                    4. 読んだ人が自然と欲しくなるような体験・感情を大切にした文章にする"""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=1000,
            temperature=0.8
        )
        results[platform] = response.choices[0].message.content

    return {"results": results}