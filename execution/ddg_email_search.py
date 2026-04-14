import sys
import json
import re
import time
from duckduckgo_search import DDGS

def find_email_ddg(url, business_name, location):
    # Strip protocol from url for site: search
    clean_domain = url.replace("https://", "").replace("http://", "").replace("www.", "").strip("/")
    
    # query 1
    # site:domain.com "email"
    query = f'site:{clean_domain} "email"'
    
    texts = []
    
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=10)
            for r in results:
                texts.append(r.get('body', ''))
                texts.append(r.get('title', ''))
    except Exception as e:
        print(f"Error querying DDG: {e}", file=sys.stderr)
        return None

    combined_text = " ".join(texts)
    
    email_regex = r'([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    matches = re.findall(email_regex, combined_text)
    
    placeholders = ['jane', 'janes', 'jdoe', 'john', 'doe', 'johndoe', 'janedoe', 'john.doe', 'jane.doe', 'first', 'last', 'firstlast', 'first.last', 'yourname', 'name', 'email', 'test']
    
    cleaned = []
    for e in matches:
        e = e.lower().strip()
        e = e.lstrip('.')
        if '@' not in e: continue
        prefix = e.split('@')[0]
        if (prefix not in placeholders 
            and 'sentry' not in e 
            and 'example.com' not in e 
            and 'wixpress' not in e
            and not e.endswith('.png')
            and not e.endswith('.jpg')
            and not e.endswith('.css')
            and not e.endswith('.js')):
            
            # Additional validation
            if len(e.split('@')[1]) > 3:
                cleaned.append(e)

    if cleaned:
        # Return first valid
        return list(set(cleaned))[0]
    
    return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            payload = json.loads(sys.argv[1])
            website = payload.get("website")
            name = payload.get("name", "")
            location = payload.get("location", "")
            
            if website:
                email = find_email_ddg(website, name, location)
                print(json.dumps({"success": True, "email": email}))
            else:
                print(json.dumps({"success": False, "error": "No website provided"}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
    else:
        print(json.dumps({"success": False, "error": "No args"}))
