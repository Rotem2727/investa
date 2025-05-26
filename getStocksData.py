import finnhub
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

finnhub_client = finnhub.Client(api_key="cvijij9r01qks9qat59gcvijij9r01qks9qat5a0")

@app.get("/get-company-data")
async def get_company_data(symbol: str):
    try:
        profile = finnhub_client.company_profile2(symbol=symbol)
        quote = finnhub_client.quote(symbol)

        if not profile and not quote:
             raise HTTPException(status_code=404, detail=f"Data not found for symbol: {symbol}")
        if not profile:
             print(f"Warning: Profile data not found for {symbol}")
        if not quote:
             print(f"Warning: Quote data not found for {symbol}")

        combined_data = {}
        if profile:
            combined_data.update(profile)
        if quote:
            combined_data.update(quote)

        if 'ticker' not in combined_data and symbol:
             combined_data['ticker'] = symbol.upper()

        if 'ticker' not in combined_data:
             raise HTTPException(status_code=404, detail=f"Could not retrieve data for symbol: {symbol}")

        return combined_data

    except Exception as e:
        print(f"Error fetching company data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch data for {symbol}")

@app.get("/get-market-status")
async def get_market_status():
    try:
        status = finnhub_client.market_status(exchange='US')
        if status and isinstance(status.get('isOpen'), bool):
             return status
        else:
             print("Warning: Market status API returned unexpected data:", status)
             return {"isOpen": False, "session": "unknown", "endTime": None, "openTime": None}
    except Exception as e:
        print(f"Error fetching market status: {e}")
        return {"isOpen": False, "session": "error", "endTime": None, "openTime": None}

@app.get("/get-market-news")
async def get_market_news(category: str = 'general'):
    try:
        news = finnhub_client.general_news(category=category)
        formatted_news = []
        if isinstance(news, list):
            for item in news:
                formatted_news.append({
                    "title": item.get("headline"),
                    "url": item.get("url"),
                    "image": item.get("image"),
                    "summary": item.get("summary"),
                    "source": item.get("source"),
                    "datetime": item.get("datetime")
                })
        return formatted_news

    except Exception as e:
        print(f"Error fetching market news: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch market news.")

if __name__ == "__main__":
    uvicorn.run("getStocksData:app", host="127.0.0.1", port=8000, reload=True)
