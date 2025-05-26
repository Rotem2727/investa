import finnhub
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import re # Import regex module for routing

# --- Hardcoded Finnhub API Key ---
# WARNING: For production, use environment variables (e.g., in Vercel project settings).
FINNHUB_API_KEY = "cvijij9r01qks9qat59gcvijij9r01qks9qat5a0"
finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)

class APIHandler(BaseHTTPRequestHandler):
    """
    This class mimics a request handler for Vercel's Python serverless functions.
    It dispatches requests based on the path.
    """
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*') # CORS header
        self.end_headers()

        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        response_data = {"error": "Endpoint not found"}
        status_code = 404

        if path == "/api/get-company-data":
            symbol = query_params.get('symbol', [None])[0]
            if not symbol:
                response_data = {"error": "Symbol parameter is required"}
                status_code = 400
            else:
                response_data, status_code = self._get_company_data(symbol)
        elif path == "/api/get-market-status":
            response_data, status_code = self._get_market_status()
        elif path == "/api/get-market-news":
            category = query_params.get('category', ['general'])[0]
            response_data, status_code = self._get_market_news(category)

        self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def _get_company_data(self, symbol: str):
        try:
            profile = finnhub_client.company_profile2(symbol=symbol)
            quote = finnhub_client.quote(symbol)

            combined_data = {}
            if profile:
                combined_data.update(profile)
            if quote:
                combined_data.update(quote)

            if not profile and not quote:
                return {"error": f"Data not found for symbol: {symbol}"}, 404
            if 'ticker' not in combined_data and symbol:
                combined_data['ticker'] = symbol.upper()
            if 'ticker' not in combined_data:
                return {"error": f"Could not retrieve data for symbol: {symbol}"}, 404

            return combined_data, 200

        except Exception as e:
            print(f"Error fetching company data for {symbol}: {e}")
            return {"error": f"Failed to fetch data for {symbol}"}, 500

    def _get_market_status(self):
        try:
            status = finnhub_client.market_status(exchange='US')
            if status and isinstance(status.get('isOpen'), bool):
                return status, 200
            else:
                print("Warning: Market status API returned unexpected data:", status)
                return {"isOpen": False, "session": "unknown", "endTime": None, "openTime": None}, 200
        except Exception as e:
            print(f"Error fetching market status: {e}")
            return {"isOpen": False, "session": "error", "endTime": None, "openTime": None}, 500

    def _get_market_news(self, category: str = 'general'):
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
            return formatted_news, 200

        except Exception as e:
            print(f"Error fetching market news: {e}")
            return {"error": "Failed to fetch market news."}, 500

# Vercel's entry point for Python serverless functions when using a single file for multiple routes
def handler(event, context):
    """
    Vercel's entry point. 'event' contains the request details.
    We simulate a BaseHTTPRequestHandler to reuse the logic.
    """
    # Create a dummy request object to mimic BaseHTTPRequestHandler structure
    class DummyRequest:
        def __init__(self, event):
            self.path = event['path']
            self.method = event['method']
            # You might need to add more attributes if your BaseHTTPRequestHandler usage required them
            # For GET requests, query params are handled by urlparse(self.path)

        def makefile(self, mode, bufsize=None):
            # This is a placeholder for file-like object; not used in our simple GET handler
            pass

        def send_response(self, code, message=None):
            context.res_status = code

        def send_header(self, keyword, value):
            if not hasattr(context, 'res_headers'):
                context.res_headers = {}
            context.res_headers[keyword] = value

        def end_headers(self):
            pass

        @property
        def wfile(self):
            # This is a placeholder for writing the response body
            # We'll capture the output directly from the APIHandler's methods
            class DummyWFile:
                def __init__(self):
                    self.content = b''
                def write(self, data):
                    self.content += data
            if not hasattr(context, '_wfile'):
                context._wfile = DummyWFile()
            return context._wfile

    # Create an instance of our custom handler
    api_handler = APIHandler(DummyRequest(event), ("0.0.0.0", 8000), None) # Host/port and server don't matter here

    # Dispatch based on method (Vercel typically uses POST for function execution,
    # but the path is what determines the route here)
    if event['method'] == 'GET':
        api_handler.do_GET()
    # Add other HTTP methods if needed (e.g., api_handler.do_POST())

    return {
        'statusCode': context.res_status,
        'headers': context.res_headers,
        'body': context._wfile.content.decode('utf-8')
    }