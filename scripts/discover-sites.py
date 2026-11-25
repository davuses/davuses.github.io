import json, pathlib, urllib.request, urllib.parse, datetime
from html.parser import HTMLParser
ROOT=pathlib.Path(".")
FILE=ROOT/"sites.json"
OWNER="davuses"
BASE="https://davuses.github.io/"
today=datetime.date.today().isoformat()
class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=""; self.description=""; self.inside=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="title": self.inside=True
        if tag=="meta" and a.get("name","").lower()=="description": self.description=a.get("content","")
    def handle_endtag(self,tag):
        if tag=="title": self.inside=False
    def handle_data(self,data):
        if self.inside: self.title+=data
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"davuses-site-directory","Accept":"application/vnd.github+json"}),timeout=25) as r:
        return json.load(r)
old=json.loads(FILE.read_text()) if FILE.exists() else []
records={x["url"]:dict(x,status="not_discovered") for x in old}
def add(url,title,description,source,repo=None):
    previous=records.get(url,{})
    records[url]={"url":url,"title":title,"description":description or "","source":source,"repository":repo,"first_seen":previous.get("first_seen",today),"status":"discovered"}
page=1
while True:
    batch=get(f"https://api.github.com/users/{OWNER}/repos?type=owner&per_page=100&page={page}")
    for r in batch:
        if r.get("has_pages") and r["name"].lower()!=f"{OWNER}.github.io":
            url=BASE+urllib.parse.quote(r["name"])+"/"
            # Only use homepage as canonical if it is the standard Pages URL; custom domains need verification.
            add(url,r["name"],r.get("description"),"repository",r["html_url"])
    if len(batch)<100: break
    page+=1
for p in ROOT.glob("*/index.html"):
    if p.parent.name.startswith((".", "_")) or p.parent.name in {"assets","node_modules","vendor","docs","scripts"}: continue
    m=Metadata(); m.feed(p.read_text(encoding="utf-8",errors="replace"))
    add(BASE+urllib.parse.quote(p.parent.name)+"/",m.title.strip() or p.parent.name,m.description,"subsite","https://github.com/davuses/davuses.github.io")
FILE.write_text(json.dumps(sorted(records.values(),key=lambda x:x["url"].lower()),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
