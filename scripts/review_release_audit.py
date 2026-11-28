"""Review branch audit: tracked files only; no secret values in reports."""
import json, re, subprocess, sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote, quote
from collections import Counter
import posixpath
ROOT=Path(__file__).resolve().parents[1]
def tracked():
    return subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().strip('\0').split('\0')
def loadjs(name):
    return json.loads((ROOT/name).read_text().split('=',1)[1].strip().rstrip(';'))
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.ids=[]; self.viewport=False; self.blank=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.append(a['id'])
        if tag=='meta' and a.get('name','').lower()=='viewport': self.viewport=True
        self.refs.extend(a[k] for k in ('href','src','poster') if a.get(k))
        if a.get('target')=='_blank' and a.get('href') and not {'noopener','noreferrer'}.intersection(a.get('rel','').split()): self.blank+=1
def main():
    report_dir=Path(sys.argv[1]); report_dir.mkdir(parents=True,exist_ok=True)
    candidates=json.loads((ROOT/'review-cleanup-plan.json').read_text())['candidates']
    names=tracked()
    ext={'.html','.js','.css','.json','.py','.yml','.yaml','.md','.txt','.xml','.csv'}
    texts={}
    for n in names:
        if Path(n).suffix.lower() in ext:
            try: texts[n]=(ROOT/n).read_text(encoding='utf-8')
            except UnicodeError: pass
    removal=[]; candidate_names={x['path'] for x in candidates}
    for item in candidates:
        n=item['path']
        refs=[p for p,s in texts.items() if p not in candidate_names and p not in ('review-cleanup-plan.json','scripts/review_release_audit.py') and (n in s or quote(n) in s)]
        if not refs:
            assert subprocess.check_output(['git','rev-parse','HEAD:'+n],cwd=ROOT,text=True).strip()==item['sha']
            subprocess.run(['git','rm','--',n],cwd=ROOT,check=True)
        removal.append(dict(item,removed=not refs,references=refs))
    available=set(tracked())
    report={'tracked_files':len(available),'cleanup':removal,'html':[],'suspected_secret_locations':[],'syntax_failures':[],'unsafe_blank_links':[]}
    patterns={'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','github_token':r'\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})\b','aws_access_key':r'\bAKIA[0-9A-Z]{16}\b'}
    for n,s in texts.items():
        if n not in available: continue
        p=ROOT/n
        if n!='scripts/review_release_audit.py':
            for label,pattern in patterns.items():
                if re.search(pattern,s): report['suspected_secret_locations'].append({'file':n,'pattern':label})
        try:
            if p.suffix=='.py': compile(s,n,'exec')
            if p.suffix=='.json': json.loads(s)
            if p.suffix=='.js' and subprocess.run(['node','--check',str(p)],capture_output=True).returncode: report['syntax_failures'].append(n)
        except (SyntaxError,ValueError): report['syntax_failures'].append(n)
        if p.suffix!='.html': continue
        page=Page();page.feed(s);missing=[]
        for ref in page.refs:
            u=urlsplit(ref)
            if u.scheme or u.netloc or not u.path or chr(36)+'{' in ref: continue
            value=unquote(u.path)
            target=posixpath.normpath(value.lstrip('/') if value.startswith('/') else posixpath.join(posixpath.dirname(n),value))
            if target=='.': target='index.html'
            if target not in available and target.rstrip('/')+'/index.html' not in available: missing.append(ref)
        report['html'].append({'file':n,'missing':sorted(set(missing)),'duplicate_ids':[k for k,v in Counter(page.ids).items() if v>1],'viewport':page.viewport})
        if page.blank: report['unsafe_blank_links'].append({'file':n,'count':page.blank})
    registries=[loadjs(n) for n in ('headline-audio-data.js','post-audio-data.js','summary-audio-data.js','audio-bulletins.js')]
    audio={r['audioUrl'] for rows in registries for r in rows}
    report['audio']={'registered':len(audio),'missing':sorted(audio-available)}
    approved=json.loads((ROOT/'photo-gallery-approved.json').read_text())['items']
    gallery=json.loads((ROOT/'photo-gallery-feed.json').read_text())['items']
    fields=('credit','license','license_url','photo_date','archive','approved','modification_note')
    assert len(approved)==len(gallery)==4
    assert all(any(x['source_url']==y['source_url'] and all(x[k]==y[k] for k in fields) for y in gallery) for x in approved)
    report['approved_photos']=len(approved)
    (report_dir/'static.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    assert not report['audio']['missing'] and not report['syntax_failures'] and not report['suspected_secret_locations']
    assert not any(p['missing'] or p['duplicate_ids'] or not p['viewport'] for p in report['html'])
if __name__=='__main__': main()
